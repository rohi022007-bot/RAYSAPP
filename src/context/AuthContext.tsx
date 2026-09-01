import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, Connection, Conversation, Message, NotificationToast, MessageType, ReplyPreview } from '../types';
import { getCachedUser, saveCachedUser, getUnsentQueue, addToUnsentQueue, removeFromUnsentQueue } from '../utils/storage';
import { playNotificationChime, playMessageSentSound } from '../utils/audio';

interface AuthContextType {
  currentUser: UserProfile | null;
  partner: UserProfile | null;
  activeConnection: Connection | null;
  activeConversation: Conversation | null;
  messages: Message[];
  pendingIncoming: { connection: Connection; initiator: UserProfile }[];
  pendingOutgoing: { connection: Connection; target: UserProfile }[];
  isOnline: boolean;
  isPartnerTyping: boolean;
  isLoading: boolean;
  notifications: NotificationToast[];
  availableUsers: UserProfile[]; // for rapid test simulation switcher
  // Actions
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (name: string, email: string, pass: string, username?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  requestPhoneOtp: (phone: string) => Promise<{ success: boolean; previewCode?: string; error?: string }>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  // Connection Actions
  searchUserByCode: (code: string) => Promise<{ user?: any; error?: string }>;
  sendConnectionRequest: (targetCode: string) => Promise<{ success: boolean; error?: string }>;
  respondToConnection: (connectionId: string, action: 'accept' | 'decline') => Promise<{ success: boolean; error?: string }>;
  disconnectPartner: (action: 'archive' | 'delete') => Promise<{ success: boolean; error?: string }>;
  // Messaging Actions
  sendMessage: (payload: {
    type: MessageType;
    text?: string;
    fileUrl?: string;
    thumbnailUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    waveform?: number[];
    replyTo?: ReplyPreview | null;
  }) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  editMessage: (messageId: string, newText: string) => Promise<void>;
  deleteMessage: (messageId: string, deleteForEveryone: boolean) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  clearChat: (clearForEveryone: boolean) => Promise<void>;
  sendTypingStatus: (isTyping: boolean) => void;
  // Quick test switch
  switchActiveUser: (userId: string) => Promise<void>;
  removeNotification: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCachedUser());
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<{ connection: Connection; initiator: UserProfile }[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<{ connection: Connection; target: UserProfile }[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  const sseRef = useRef<EventSource | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  // Monitor browser network online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processUnsentQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch all available users for the fast switch tester
  const fetchAvailableUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.users || []);
      }
    } catch (err) {
      console.debug('Failed to load user list', err);
    }
  };

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  // Fetch connection & conversation state for active user
  const refreshUserConnections = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/connections/user/${userId}`);
      if (!res.ok) return;
      const data = await res.json();

      setActiveConnection(data.activeConnection || null);
      setPartner(data.partner || null);
      setActiveConversation(data.conversation || null);
      setPendingIncoming(data.pendingIncoming || []);
      setPendingOutgoing(data.pendingOutgoing || []);

      if (data.conversation?.id) {
        fetchMessages(data.conversation.id, userId);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error refreshing connections', err);
    }
  }, []);

  // Fetch messages for active conversation
  const fetchMessages = async (convId: string, userId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  // Push an in-app notification toast
  const addNotificationToast = useCallback((toast: Omit<NotificationToast, 'id' | 'timestamp'>) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const newToast: NotificationToast = {
      ...toast,
      id,
      timestamp: Date.now(),
    };
    setNotifications((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 4.5s
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Process offline unsent queue
  const processUnsentQueue = useCallback(async () => {
    if (!currentUser || !navigator.onLine) return;
    const queue = getUnsentQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const res = await fetch(`/api/conversations/${item.conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removeFromUnsentQueue(item.id);
        }
      } catch (err) {
        console.error('Error processing unsent item', err);
        break;
      }
    }
  }, [currentUser]);

  // Setup Server-Sent Events (SSE) stream for instant real-time sync
  useEffect(() => {
    if (!currentUser) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    // Refresh connections on login
    refreshUserConnections(currentUser.id);
    saveCachedUser(currentUser);

    // Start SSE stream
    const sse = new EventSource(`/api/realtime/stream?userId=${currentUser.id}`);
    sseRef.current = sse;

    sse.addEventListener('new_message', (e) => {
      const { message, conversation } = JSON.parse(e.data);
      if (message.conversationId === currentUser.activeConversationId || message.conversationId === activeConversation?.id) {
        setMessages((prev) => {
          // If message already in list, replace; else append
          const exists = prev.some((m) => m.id === message.id);
          if (exists) {
            return prev.map((m) => (m.id === message.id ? message : m));
          }
          return [...prev, message];
        });

        // Trigger notifications if incoming from partner
        if (message.senderId !== currentUser.id && message.senderId !== 'system') {
          if (currentUser.notificationSettings.sound) {
            playNotificationChime();
          }
          const notifBody = currentUser.notificationSettings.privacyMode
            ? 'New message received'
            : message.type === 'text'
            ? message.text || ''
            : `Sent a ${message.type}`;

          addNotificationToast({
            title: partner?.name || 'Partner',
            body: notifBody,
            conversationId: message.conversationId,
            avatar: partner?.profileImage,
          });
        }
      }
      setActiveConversation(conversation);
    });

    sse.addEventListener('reaction_updated', (e) => {
      const { messageId, reactions } = JSON.parse(e.data);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    });

    sse.addEventListener('message_edited', (e) => {
      const { messageId, text, isEdited } = JSON.parse(e.data);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, text, isEdited } : m))
      );
    });

    sse.addEventListener('message_deleted_everyone', (e) => {
      const { messageId } = JSON.parse(e.data);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, isDeletedForEveryone: true, text: 'This message was deleted', fileUrl: null, thumbnailUrl: null }
            : m
        )
      );
    });

    sse.addEventListener('pin_updated', (e) => {
      const { messageId, isPinned, pinnedMessageIds } = JSON.parse(e.data);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
      );
      setActiveConversation((prev) => (prev ? { ...prev, pinnedMessageIds } : null));
    });

    sse.addEventListener('chat_cleared', (e) => {
      const { clearForEveryone, userId } = JSON.parse(e.data);
      if (clearForEveryone || userId === currentUser.id) {
        setMessages([]);
      }
    });

    sse.addEventListener('presence_update', (e) => {
      const { userId, status, lastSeen } = JSON.parse(e.data);
      if (partner && partner.id === userId) {
        setPartner((prev) => (prev ? { ...prev, status, lastSeen } : null));
      }
    });

    sse.addEventListener('typing_update', (e) => {
      const { userId, isTyping } = JSON.parse(e.data);
      if (partner && partner.id === userId) {
        setIsPartnerTyping(isTyping);
      }
    });

    sse.addEventListener('connection_request', (e) => {
      const { connection, initiator } = JSON.parse(e.data);
      setPendingIncoming((prev) => {
        const filtered = prev.filter((p) => p.connection.id !== connection.id);
        return [{ connection, initiator }, ...filtered];
      });
      if (currentUser.notificationSettings.sound) {
        playNotificationChime();
      }
      addNotificationToast({
        title: 'New Connection Request',
        body: `${initiator.name} (${initiator.raysCode}) wants to connect on RAYS`,
        avatar: initiator.profileImage,
      });
    });

    sse.addEventListener('connection_accepted', (e) => {
      refreshUserConnections(currentUser.id);
      fetchAvailableUsers();
      if (currentUser.notificationSettings.sound) {
        playNotificationChime();
      }
      addNotificationToast({
        title: 'Connection Accepted',
        body: 'You are now privately connected.',
      });
    });

    sse.addEventListener('disconnected', (e) => {
      refreshUserConnections(currentUser.id);
      fetchAvailableUsers();
      addNotificationToast({
        title: 'Disconnected',
        body: 'Your active connection has ended.',
      });
    });

    sse.addEventListener('messages_read', (e) => {
      const { conversationId, readerId } = JSON.parse(e.data);
      if (readerId !== currentUser.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUser.id && !m.readAt
              ? { ...m, readAt: Date.now(), deliveredAt: m.deliveredAt || Date.now() }
              : m
          )
        );
      }
    });

    // Heartbeat every 25 seconds
    heartbeatIntervalRef.current = window.setInterval(() => {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, status: 'online' }),
      }).catch(() => {});
    }, 25000);

    return () => {
      sse.close();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [currentUser?.id, partner?.id, refreshUserConnections, addNotificationToast]);

  // Auth Operations
  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      setCurrentUser(data.user);
      saveCachedUser(data.user);
      await fetchAvailableUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string, username?: string, phone?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass, username, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      setCurrentUser(data.user);
      saveCachedUser(data.user);
      await fetchAvailableUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const requestPhoneOtp = async (phone: string) => {
    try {
      const res = await fetch('/api/auth/otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true, previewCode: data.previewCode };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const verifyPhoneOtp = async (phone: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      setCurrentUser(data.user);
      saveCachedUser(data.user);
      await fetchAvailableUsers();
      return { success: true, isNewUser: data.isNewUser };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error };

      setCurrentUser(result.user);
      saveCachedUser(result.user);
      await fetchAvailableUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    if (currentUser) {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, status: 'offline' }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    setPartner(null);
    setActiveConnection(null);
    setActiveConversation(null);
    setMessages([]);
    saveCachedUser(null);
  };

  const deleteAccount = async () => {
    if (!currentUser) return;
    if (currentUser.connectedPartnerId) {
      await disconnectPartner('delete');
    }
    logout();
  };

  // Connection Operations
  const searchUserByCode = async (code: string) => {
    try {
      const res = await fetch(`/api/users/by-code/${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'User not found' };
      return { user: data.user };
    } catch (err: any) {
      return { error: err.message || 'Lookup failed' };
    }
  };

  const sendConnectionRequest = async (targetCode: string) => {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, targetCode }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await refreshUserConnections(currentUser.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const respondToConnection = async (connectionId: string, action: 'accept' | 'decline') => {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, userId: currentUser.id, action }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await refreshUserConnections(currentUser.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const disconnectPartner = async (action: 'archive' | 'delete') => {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    try {
      const res = await fetch('/api/connections/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, action }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await refreshUserConnections(currentUser.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Messaging Operations
  const sendMessage = async (payload: {
    type: MessageType;
    text?: string;
    fileUrl?: string;
    thumbnailUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    waveform?: number[];
    replyTo?: ReplyPreview | null;
  }) => {
    if (!currentUser || !currentUser.activeConversationId) return;

    const convId = currentUser.activeConversationId;
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: convId,
      senderId: currentUser.id,
      type: payload.type,
      text: payload.text || null,
      fileUrl: payload.fileUrl || null,
      thumbnailUrl: payload.thumbnailUrl || null,
      fileName: payload.fileName || null,
      fileSize: payload.fileSize || null,
      mimeType: payload.mimeType || null,
      duration: payload.duration || null,
      waveform: payload.waveform,
      replyTo: payload.replyTo || null,
      reactions: {},
      isEdited: false,
      isDeleted: false,
      isDeletedForEveryone: false,
      deletedForUserIds: [],
      isPinned: false,
      createdAt: Date.now(),
      deliveredAt: null,
      readAt: null,
      status: 'sending',
    };

    // Optimistically update UI
    setMessages((prev) => [...prev, optimisticMsg]);
    playMessageSentSound();

    const serverPayload = {
      senderId: currentUser.id,
      ...payload,
    };

    // If offline, save to unsent queue
    if (!navigator.onLine) {
      addToUnsentQueue({
        id: tempId,
        conversationId: convId,
        senderId: currentUser.id,
        payload: serverPayload,
        queuedAt: Date.now(),
        retryCount: 0,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'queued' } : m))
      );
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
      }
    } catch {
      addToUnsentQueue({
        id: tempId,
        conversationId: convId,
        senderId: currentUser.id,
        payload: serverPayload,
        queuedAt: Date.now(),
        retryCount: 0,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'queued' } : m))
      );
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    // Optimistic
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const newReactions = { ...m.reactions };
        if (newReactions[currentUser.id] === emoji) {
          delete newReactions[currentUser.id];
        } else {
          newReactions[currentUser.id] = emoji;
        }
        return { ...m, reactions: newReactions };
      })
    );

    try {
      await fetch(`/api/conversations/${convId}/messages/${messageId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, emoji }),
      });
    } catch (err) {
      console.error('Error toggling reaction', err);
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    // Optimistic
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, text: newText, isEdited: true } : m))
    );

    try {
      await fetch(`/api/conversations/${convId}/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, text: newText }),
      });
    } catch (err) {
      console.error('Error editing message', err);
    }
  };

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    if (deleteForEveryone) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, isDeletedForEveryone: true, text: 'This message was deleted', fileUrl: null, thumbnailUrl: null }
            : m
        )
      );
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }

    try {
      await fetch(`/api/conversations/${convId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, deleteForEveryone }),
      });
    } catch (err) {
      console.error('Error deleting message', err);
    }
  };

  const togglePinMessage = async (messageId: string) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    try {
      const res = await fetch(`/api/conversations/${convId}/messages/${messageId}/pin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isPinned: data.isPinned } : m))
        );
        setActiveConversation((prev) =>
          prev ? { ...prev, pinnedMessageIds: data.pinnedMessageIds } : null
        );
      }
    } catch (err) {
      console.error('Error pinning message', err);
    }
  };

  const clearChat = async (clearForEveryone: boolean) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    setMessages([]);

    try {
      await fetch(`/api/conversations/${convId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, clearForEveryone }),
      });
    } catch (err) {
      console.error('Error clearing chat', err);
    }
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (!currentUser || !currentUser.activeConversationId) return;
    const convId = currentUser.activeConversationId;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    fetch('/api/presence/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, userId: currentUser.id, isTyping }),
    }).catch(() => {});

    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        sendTypingStatus(false);
      }, 3000);
    }
  };

  // Quick switch between accounts for frictionless tester exploration
  const switchActiveUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        saveCachedUser(data.user);
      }
    } catch (err) {
      console.error('Error switching user', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        partner,
        activeConnection,
        activeConversation,
        messages,
        pendingIncoming,
        pendingOutgoing,
        isOnline,
        isPartnerTyping,
        isLoading,
        notifications,
        availableUsers,
        loginWithEmail,
        registerWithEmail,
        requestPhoneOtp,
        verifyPhoneOtp,
        updateProfile,
        logout,
        deleteAccount,
        searchUserByCode,
        sendConnectionRequest,
        respondToConnection,
        disconnectPartner,
        sendMessage,
        toggleReaction,
        editMessage,
        deleteMessage,
        togglePinMessage,
        clearChat,
        sendTypingStatus,
        switchActiveUser,
        removeNotification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
