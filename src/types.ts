export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice';

export interface UserProfile {
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
    privacyMode: boolean; // When true, shows "New message" instead of preview
  };
}

export interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'pending' | 'accepted' | 'declined' | 'disconnected';
  initiatorId: string;
  targetCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReplyPreview {
  id: string;
  senderName: string;
  senderId: string;
  type: MessageType;
  preview: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null; // seconds for voice/video
  waveform?: number[]; // normalized heights 0..100 for audio visualization
  replyTo: ReplyPreview | null;
  reactions: Record<string, string>; // userId -> emoji
  isEdited: boolean;
  isDeleted: boolean;
  isDeletedForEveryone: boolean;
  deletedForUserIds: string[]; // local delete for specific users
  isPinned: boolean;
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
  status?: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessage: string;
  lastMessageType: MessageType;
  lastMessageTime: number;
  createdAt: number;
  typingUserIds: string[];
  pinnedMessageIds: string[];
  status: 'active' | 'archived' | 'deleted';
}

export type ActiveScreen = 
  | 'splash'
  | 'auth'
  | 'login'
  | 'phone-otp'
  | 'otp-verify'
  | 'register'
  | 'forgot-password'
  | 'profile-setup'
  | 'home'
  | 'connect'
  | 'chat'
  | 'chat-info'
  | 'chat-settings'
  | 'app-settings'
  | 'profile-edit'
  | 'storage'
  | 'pinned-messages'
  | 'help-about';

export interface StorageCategoryStats {
  bytes: number;
  count: number;
}

export interface StorageBreakdown {
  images: StorageCategoryStats;
  videos: StorageCategoryStats;
  files: StorageCategoryStats;
  voice: StorageCategoryStats;
  totalBytes: number;
}

export interface NotificationToast {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  conversationId?: string;
  avatar?: string;
}
