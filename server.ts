import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with generous payload limits for base64 media uploads (images, audio, video snippets, files)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-Memory & Persistent Application State
interface ServerUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  profileImage: string;
  raysCode: string;
  status: 'online' | 'offline';
  lastSeen: number;
  createdAt: number;
  bio?: string;
  connectedPartnerId?: string | null;
  activeConversationId?: string | null;
  notificationSettings: {
    enabled: boolean;
    sound: boolean;
    privacyMode: boolean;
  };
}

interface ServerConnection {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'pending' | 'accepted' | 'declined' | 'disconnected';
  initiatorId: string;
  targetCode: string;
  createdAt: number;
  updatedAt: number;
}

interface ServerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice';
  text: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  waveform?: number[];
  replyTo: {
    id: string;
    senderName: string;
    senderId: string;
    type: 'text' | 'image' | 'video' | 'file' | 'voice';
    preview: string;
  } | null;
  reactions: Record<string, string>;
  isEdited: boolean;
  isDeleted: boolean;
  isDeletedForEveryone: boolean;
  deletedForUserIds: string[];
  isPinned: boolean;
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
}

interface ServerConversation {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessage: string;
  lastMessageType: 'text' | 'image' | 'video' | 'file' | 'voice';
  lastMessageTime: number;
  createdAt: number;
  typingUserIds: string[];
  pinnedMessageIds: string[];
  status: 'active' | 'archived' | 'deleted';
}

const users = new Map<string, ServerUser>();
const connections = new Map<string, ServerConnection>();
const conversations = new Map<string, ServerConversation>();
const messages = new Map<string, ServerMessage[]>(); // conversationId -> messages array
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// SSE Event Stream clients
interface SSEClient {
  id: string;
  userId: string;
  res: Response;
}
let sseClients: SSEClient[] = [];

function broadcastEvent(eventType: string, data: any, targetUserIds?: string[]) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    if (!targetUserIds || targetUserIds.includes(client.userId)) {
      try {
        client.res.write(payload);
      } catch (err) {
        console.error('Failed to write to SSE client', err);
      }
    }
  });
}

// Generate unique RAYS code (format: RAYS-XXXXXX)
function generateRaysCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RAYS-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // ensure uniqueness
  for (const u of users.values()) {
    if (u.raysCode === code) return generateRaysCode();
  }
  return code;
}

// Initial bootstrap sample users for seamless testing if needed
function bootstrapInitialUsers() {
  const user1: ServerUser = {
    id: 'usr_sarah',
    name: 'Sarah Jenkins',
    username: 'sarah_j',
    email: 'sarah@rays.chat',
    phone: '+1 (555) 234-5678',
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    raysCode: 'RAYS-8K4P29',
    status: 'online',
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 5,
    bio: 'Minimalist & photographer. Exploring the quiet spaces.',
    connectedPartnerId: null,
    activeConversationId: null,
    notificationSettings: {
      enabled: true,
      sound: true,
      privacyMode: false,
    },
  };

  const user2: ServerUser = {
    id: 'usr_liam',
    name: 'Liam Chen',
    username: 'liam_c',
    email: 'liam@rays.chat',
    phone: '+1 (555) 876-5432',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    raysCode: 'RAYS-3M7N9X',
    status: 'online',
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 5,
    bio: 'Architect. Design & coffee enthusiast.',
    connectedPartnerId: null,
    activeConversationId: null,
    notificationSettings: {
      enabled: true,
      sound: true,
      privacyMode: false,
    },
  };

  users.set(user1.id, user1);
  users.set(user2.id, user2);
}

bootstrapInitialUsers();

// ================= API ROUTES =================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: Date.now(), totalUsers: users.size });
});

// SSE Real-time stream
app.get('/api/realtime/stream', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'anonymous';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newClient: SSEClient = { id: clientId, userId, res };
  sseClients.push(newClient);

  // Send initial keepalive
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);

  // Update user online status
  const user = users.get(userId);
  if (user) {
    user.status = 'online';
    user.lastSeen = Date.now();
    broadcastEvent('presence_update', { userId, status: 'online', lastSeen: user.lastSeen });
  }

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
    // If no active connections for this user, mark offline after brief grace
    const stillActive = sseClients.some((c) => c.userId === userId);
    if (!stillActive && user) {
      user.status = 'offline';
      user.lastSeen = Date.now();
      broadcastEvent('presence_update', { userId, status: 'offline', lastSeen: user.lastSeen });
    }
  });
});

// Auth: Phone OTP Request
app.post('/api/auth/otp-send', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
  
  // Return OTP for easy verification & preview testing
  res.json({ success: true, message: 'OTP sent successfully', previewCode: code });
});

// Auth: Phone OTP Verify
app.post('/api/auth/otp-verify', (req: Request, res: Response) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const stored = otpStore.get(phone);
  if (!stored || stored.code !== code.trim() || Date.now() > stored.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired OTP code' });
  }

  // Look for existing user by phone
  let user: ServerUser | undefined;
  for (const u of users.values()) {
    if (u.phone === phone) {
      user = u;
      break;
    }
  }

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    user = {
      id: userId,
      name: '',
      username: '',
      email: '',
      phone,
      profileImage: '',
      raysCode: generateRaysCode(),
      status: 'online',
      lastSeen: Date.now(),
      createdAt: Date.now(),
      connectedPartnerId: null,
      activeConversationId: null,
      notificationSettings: { enabled: true, sound: true, privacyMode: false },
    };
    users.set(userId, user);
  }

  otpStore.delete(phone);
  res.json({ success: true, user, isNewUser });
});

// Auth: Email Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let user: ServerUser | undefined;
  for (const u of users.values()) {
    if (u.email.toLowerCase() === email.trim().toLowerCase() || u.username.toLowerCase() === email.trim().toLowerCase()) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'No account found with this email or username' });
  }

  user.status = 'online';
  user.lastSeen = Date.now();
  res.json({ success: true, user });
});

// Auth: Email Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name, username, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Check username uniqueness
  if (username) {
    for (const u of users.values()) {
      if (u.username.toLowerCase() === username.trim().toLowerCase()) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }
  }

  // Check email uniqueness
  for (const u of users.values()) {
    if (u.email.toLowerCase() === email.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newUser: ServerUser = {
    id: userId,
    name: name.trim(),
    username: (username || name.toLowerCase().replace(/\s+/g, '_') + Math.floor(Math.random() * 100)).trim(),
    email: email.trim(),
    phone: phone ? phone.trim() : '',
    profileImage: `https://api.dicebear.com/7.x/shapes/svg?seed=${userId}`,
    raysCode: generateRaysCode(),
    status: 'online',
    lastSeen: Date.now(),
    createdAt: Date.now(),
    connectedPartnerId: null,
    activeConversationId: null,
    notificationSettings: { enabled: true, sound: true, privacyMode: false },
  };

  users.set(userId, newUser);
  res.json({ success: true, user: newUser });
});

// Get User Profile
app.get('/api/users/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update User Profile
app.put('/api/users/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, username, email, phone, bio, profileImage, notificationSettings } = req.body;

  // If username changed, check uniqueness
  if (username && username !== user.username) {
    for (const [id, u] of users.entries()) {
      if (id !== user.id && u.username.toLowerCase() === username.trim().toLowerCase()) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }
    user.username = username.trim();
  }

  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) user.email = email.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (bio !== undefined) user.bio = bio.trim();
  if (profileImage !== undefined) user.profileImage = profileImage;
  if (notificationSettings) user.notificationSettings = { ...user.notificationSettings, ...notificationSettings };

  broadcastEvent('user_updated', { user });
  res.json({ success: true, user });
});

// Find User by RAYS Code
app.get('/api/users/by-code/:code', (req: Request, res: Response) => {
  const searchCode = req.params.code.trim().toUpperCase();
  for (const u of users.values()) {
    if (u.raysCode.toUpperCase() === searchCode) {
      return res.json({
        user: {
          id: u.id,
          name: u.name,
          username: u.username,
          profileImage: u.profileImage,
          raysCode: u.raysCode,
          status: u.status,
          lastSeen: u.lastSeen,
          bio: u.bio,
          hasActiveConnection: Boolean(u.connectedPartnerId),
        },
      });
    }
  }
  res.status(404).json({ error: 'No user found with this RAYS code' });
});

// Get User Connections & Pending Requests
app.get('/api/connections/user/:userId', (req: Request, res: Response) => {
  const userId = req.params.userId;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let activeConnection: ServerConnection | null = null;
  let partner: ServerUser | null = null;
  let activeConv: ServerConversation | null = null;
  const pendingIncoming: { connection: ServerConnection; initiator: ServerUser }[] = [];
  const pendingOutgoing: { connection: ServerConnection; target: ServerUser }[] = [];

  for (const conn of connections.values()) {
    if ((conn.user1Id === userId || conn.user2Id === userId) && conn.status === 'accepted') {
      activeConnection = conn;
      const partnerId = conn.user1Id === userId ? conn.user2Id : conn.user1Id;
      partner = users.get(partnerId) || null;
      if (user.activeConversationId) {
        activeConv = conversations.get(user.activeConversationId) || null;
      }
    } else if (conn.user2Id === userId && conn.status === 'pending') {
      const init = users.get(conn.user1Id);
      if (init) pendingIncoming.push({ connection: conn, initiator: init });
    } else if (conn.user1Id === userId && conn.status === 'pending') {
      const tgt = users.get(conn.user2Id);
      if (tgt) pendingOutgoing.push({ connection: conn, target: tgt });
    }
  }

  res.json({
    activeConnection,
    partner,
    conversation: activeConv,
    pendingIncoming,
    pendingOutgoing,
  });
});

// Send Connection Request
app.post('/api/connections/request', (req: Request, res: Response) => {
  const { senderId, targetCode } = req.body;
  const sender = users.get(senderId);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });

  if (sender.connectedPartnerId) {
    return res.status(400).json({ error: 'You already have an active connection. You must disconnect first.' });
  }

  // Find target user by code
  let target: ServerUser | undefined;
  const cleanCode = targetCode.trim().toUpperCase();
  for (const u of users.values()) {
    if (u.raysCode.toUpperCase() === cleanCode) {
      target = u;
      break;
    }
  }

  if (!target) {
    return res.status(404).json({ error: 'Invalid RAYS Code. Please check and try again.' });
  }

  if (target.id === sender.id) {
    return res.status(400).json({ error: 'You cannot connect with your own RAYS Code.' });
  }

  if (target.connectedPartnerId) {
    return res.status(400).json({ error: 'This user already has an active connection.' });
  }

  // Check if existing pending connection
  for (const conn of connections.values()) {
    if (
      ((conn.user1Id === sender.id && conn.user2Id === target.id) ||
        (conn.user1Id === target.id && conn.user2Id === sender.id)) &&
      conn.status === 'pending'
    ) {
      return res.status(400).json({ error: 'A connection request is already pending between you two.' });
    }
  }

  const connId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const connection: ServerConnection = {
    id: connId,
    user1Id: sender.id,
    user2Id: target.id,
    status: 'pending',
    initiatorId: sender.id,
    targetCode: cleanCode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  connections.set(connId, connection);

  broadcastEvent('connection_request', { connection, initiator: sender }, [target.id]);

  res.json({ success: true, connection, target });
});

// Respond to Connection Request (Accept / Decline)
app.post('/api/connections/respond', (req: Request, res: Response) => {
  const { connectionId, userId, action } = req.body; // action: 'accept' | 'decline'
  const conn = connections.get(connectionId);
  if (!conn) return res.status(404).json({ error: 'Connection request not found' });

  if (conn.user2Id !== userId && conn.user1Id !== userId) {
    return res.status(403).json({ error: 'Unauthorized to respond to this request' });
  }

  if (action === 'decline') {
    conn.status = 'declined';
    conn.updatedAt = Date.now();
    broadcastEvent('connection_updated', { connection: conn }, [conn.user1Id, conn.user2Id]);
    return res.json({ success: true, status: 'declined' });
  }

  if (action === 'accept') {
    const user1 = users.get(conn.user1Id);
    const user2 = users.get(conn.user2Id);
    if (!user1 || !user2) return res.status(404).json({ error: 'Users not found' });

    conn.status = 'accepted';
    conn.updatedAt = Date.now();

    // Create persistent conversation
    const convId = `conv_${conn.user1Id}_${conn.user2Id}`;
    let conversation = conversations.get(convId);
    if (!conversation) {
      conversation = {
        id: convId,
        user1Id: conn.user1Id,
        user2Id: conn.user2Id,
        lastMessage: 'Connected on RAYS',
        lastMessageType: 'text',
        lastMessageTime: Date.now(),
        createdAt: Date.now(),
        typingUserIds: [],
        pinnedMessageIds: [],
        status: 'active',
      };
      conversations.set(convId, conversation);
      messages.set(convId, []);
    }

    user1.connectedPartnerId = user2.id;
    user1.activeConversationId = convId;
    user2.connectedPartnerId = user1.id;
    user2.activeConversationId = convId;

    // Send initial system welcome message
    const welcomeMsg: ServerMessage = {
      id: `msg_init_${Date.now()}`,
      conversationId: convId,
      senderId: 'system',
      type: 'text',
      text: 'You are now privately connected. Exactly two people, one persistent space.',
      fileUrl: null,
      thumbnailUrl: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      duration: null,
      replyTo: null,
      reactions: {},
      isEdited: false,
      isDeleted: false,
      isDeletedForEveryone: false,
      deletedForUserIds: [],
      isPinned: false,
      createdAt: Date.now(),
      deliveredAt: Date.now(),
      readAt: Date.now(),
    };
    messages.get(convId)?.push(welcomeMsg);

    broadcastEvent('connection_accepted', { connection: conn, conversation }, [user1.id, user2.id]);

    return res.json({ success: true, connection: conn, conversation });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// Disconnect Connection
app.post('/api/connections/disconnect', (req: Request, res: Response) => {
  const { userId, action } = req.body; // action: 'archive' | 'delete'
  const user = users.get(userId);
  if (!user || !user.connectedPartnerId) {
    return res.status(400).json({ error: 'No active connection to disconnect' });
  }

  const partnerId = user.connectedPartnerId;
  const partner = users.get(partnerId);
  const convId = user.activeConversationId;

  if (convId) {
    const conv = conversations.get(convId);
    if (conv) {
      if (action === 'delete') {
        conv.status = 'deleted';
        messages.delete(convId);
      } else {
        conv.status = 'archived';
      }
    }
  }

  user.connectedPartnerId = null;
  user.activeConversationId = null;

  if (partner) {
    partner.connectedPartnerId = null;
    partner.activeConversationId = null;
  }

  // Update connection status
  for (const conn of connections.values()) {
    if (
      (conn.user1Id === userId && conn.user2Id === partnerId) ||
      (conn.user1Id === partnerId && conn.user2Id === userId)
    ) {
      conn.status = 'disconnected';
      conn.updatedAt = Date.now();
    }
  }

  broadcastEvent('disconnected', { userId, partnerId, action }, [userId, partnerId]);
  res.json({ success: true, message: 'Disconnected successfully' });
});

// Get Messages
app.get('/api/conversations/:id/messages', (req: Request, res: Response) => {
  const convId = req.params.id;
  const userId = req.query.userId as string;
  const convMessages = messages.get(convId) || [];

  // Filter messages that the user has "deleted for me"
  const visibleMessages = convMessages.filter((m) => !m.deletedForUserIds.includes(userId));

  // Mark unread partner messages as read
  if (userId) {
    let hasUpdates = false;
    visibleMessages.forEach((m) => {
      if (m.senderId !== userId && m.senderId !== 'system' && !m.readAt) {
        m.readAt = Date.now();
        m.deliveredAt = m.deliveredAt || Date.now();
        hasUpdates = true;
      }
    });
    if (hasUpdates) {
      broadcastEvent('messages_read', { conversationId: convId, readerId: userId });
    }
  }

  res.json({ messages: visibleMessages });
});

// Send Message
app.post('/api/conversations/:id/messages', (req: Request, res: Response) => {
  const convId = req.params.id;
  const conversation = conversations.get(convId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const {
    senderId,
    type,
    text,
    fileUrl,
    thumbnailUrl,
    fileName,
    fileSize,
    mimeType,
    duration,
    waveform,
    replyTo,
  } = req.body;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newMsg: ServerMessage = {
    id: msgId,
    conversationId: convId,
    senderId,
    type: type || 'text',
    text: text || null,
    fileUrl: fileUrl || null,
    thumbnailUrl: thumbnailUrl || null,
    fileName: fileName || null,
    fileSize: fileSize || null,
    mimeType: mimeType || null,
    duration: duration || null,
    waveform: waveform || undefined,
    replyTo: replyTo || null,
    reactions: {},
    isEdited: false,
    isDeleted: false,
    isDeletedForEveryone: false,
    deletedForUserIds: [],
    isPinned: false,
    createdAt: Date.now(),
    deliveredAt: Date.now(),
    readAt: null,
  };

  let convMsgs = messages.get(convId);
  if (!convMsgs) {
    convMsgs = [];
    messages.set(convId, convMsgs);
  }
  convMsgs.push(newMsg);

  // Update conversation last message preview
  let previewText = text || 'Sent an attachment';
  if (type === 'image') previewText = '📷 Photo';
  if (type === 'video') previewText = '🎥 Video';
  if (type === 'voice') previewText = '🎙️ Voice note';
  if (type === 'file') previewText = `📁 ${fileName || 'File'}`;

  conversation.lastMessage = previewText;
  conversation.lastMessageType = type || 'text';
  conversation.lastMessageTime = Date.now();

  const recipientId = conversation.user1Id === senderId ? conversation.user2Id : conversation.user1Id;

  // Broadcast to participants
  broadcastEvent('new_message', { message: newMsg, conversation }, [senderId, recipientId]);

  res.json({ success: true, message: newMsg });
});

// React to Message
app.post('/api/conversations/:id/messages/:messageId/reaction', (req: Request, res: Response) => {
  const { id: convId, messageId } = req.params;
  const { userId, emoji } = req.body;

  const convMsgs = messages.get(convId);
  const msg = convMsgs?.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (msg.reactions[userId] === emoji) {
    // Toggle off
    delete msg.reactions[userId];
  } else {
    msg.reactions[userId] = emoji;
  }

  broadcastEvent('reaction_updated', { conversationId: convId, messageId, reactions: msg.reactions });
  res.json({ success: true, reactions: msg.reactions });
});

// Edit Message
app.put('/api/conversations/:id/messages/:messageId', (req: Request, res: Response) => {
  const { id: convId, messageId } = req.params;
  const { userId, text } = req.body;

  const convMsgs = messages.get(convId);
  const msg = convMsgs?.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (msg.senderId !== userId) {
    return res.status(403).json({ error: 'You can only edit your own messages' });
  }

  msg.text = text.trim();
  msg.isEdited = true;

  broadcastEvent('message_edited', { conversationId: convId, messageId, text: msg.text, isEdited: true });
  res.json({ success: true, message: msg });
});

// Delete Message (Delete for Me vs Delete for Everyone)
app.delete('/api/conversations/:id/messages/:messageId', (req: Request, res: Response) => {
  const { id: convId, messageId } = req.params;
  const { userId, deleteForEveryone } = req.body;

  const convMsgs = messages.get(convId);
  const msg = convMsgs?.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (deleteForEveryone) {
    if (msg.senderId !== userId) {
      return res.status(403).json({ error: 'You can only delete for everyone on your own messages' });
    }
    msg.isDeleted = true;
    msg.isDeletedForEveryone = true;
    msg.text = 'This message was deleted';
    msg.fileUrl = null;
    msg.thumbnailUrl = null;

    broadcastEvent('message_deleted_everyone', { conversationId: convId, messageId });
  } else {
    // Delete for me
    if (!msg.deletedForUserIds.includes(userId)) {
      msg.deletedForUserIds.push(userId);
    }
  }

  res.json({ success: true, message: msg });
});

// Pin / Unpin Message
app.post('/api/conversations/:id/messages/:messageId/pin', (req: Request, res: Response) => {
  const { id: convId, messageId } = req.params;
  const conversation = conversations.get(convId);
  const convMsgs = messages.get(convId);
  const msg = convMsgs?.find((m) => m.id === messageId);

  if (!conversation || !msg) return res.status(404).json({ error: 'Message or conversation not found' });

  msg.isPinned = !msg.isPinned;

  if (msg.isPinned) {
    if (!conversation.pinnedMessageIds.includes(messageId)) {
      conversation.pinnedMessageIds.push(messageId);
    }
  } else {
    conversation.pinnedMessageIds = conversation.pinnedMessageIds.filter((id) => id !== messageId);
  }

  broadcastEvent('pin_updated', {
    conversationId: convId,
    messageId,
    isPinned: msg.isPinned,
    pinnedMessageIds: conversation.pinnedMessageIds,
  });

  res.json({ success: true, isPinned: msg.isPinned, pinnedMessageIds: conversation.pinnedMessageIds });
});

// Clear Chat
app.post('/api/conversations/:id/clear', (req: Request, res: Response) => {
  const { id: convId } = req.params;
  const { userId, clearForEveryone } = req.body;

  const convMsgs = messages.get(convId);
  if (!convMsgs) return res.json({ success: true });

  if (clearForEveryone) {
    messages.set(convId, []);
    broadcastEvent('chat_cleared', { conversationId: convId, clearForEveryone: true });
  } else {
    convMsgs.forEach((m) => {
      if (!m.deletedForUserIds.includes(userId)) {
        m.deletedForUserIds.push(userId);
      }
    });
    broadcastEvent('chat_cleared', { conversationId: convId, clearForEveryone: false, userId }, [userId]);
  }

  res.json({ success: true });
});

// Presence & Typing Triggers
app.post('/api/presence/typing', (req: Request, res: Response) => {
  const { conversationId, userId, isTyping } = req.body;
  const conv = conversations.get(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  if (isTyping) {
    if (!conv.typingUserIds.includes(userId)) conv.typingUserIds.push(userId);
  } else {
    conv.typingUserIds = conv.typingUserIds.filter((id) => id !== userId);
  }

  const partnerId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
  broadcastEvent('typing_update', { conversationId, userId, isTyping, typingUserIds: conv.typingUserIds }, [partnerId]);
  res.json({ success: true });
});

// Presence Heartbeat
app.post('/api/presence/heartbeat', (req: Request, res: Response) => {
  const { userId, status } = req.body;
  const user = users.get(userId);
  if (user) {
    user.status = status || 'online';
    user.lastSeen = Date.now();
    broadcastEvent('presence_update', { userId, status: user.status, lastSeen: user.lastSeen });
  }
  res.json({ success: true });
});

// Quick Switch / Dev Helper to switch active session for instant testing
app.get('/api/users', (req: Request, res: Response) => {
  res.json({ users: Array.from(users.values()) });
});

// ================= VITE / SPA MIDDLEWARE =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RAYS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
