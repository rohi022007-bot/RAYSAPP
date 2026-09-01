import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen, Message, MessageType, ReplyPreview } from '../types';
import { formatTimeOnly, formatLastSeen, formatFileSize, formatDuration } from '../utils/format';
import { VoiceRecorder, playMessageSentSound, normalizeWaveform } from '../utils/audio';
import { compressImage } from '../utils/storage';
import {
  ArrowLeft,
  Search,
  Pin,
  Info,
  MoreVertical,
  Paperclip,
  Mic,
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Camera,
  X,
  Check,
  CheckCheck,
  Smile,
  Reply,
  Copy,
  Edit2,
  Trash2,
  Play,
  Pause,
  Download,
  Clock,
  Sparkles,
  ChevronDown,
  Volume2,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onOpenMedia?: (url: string, type: 'image' | 'video', title?: string) => void;
}

const EMOJI_REACTIONS = ['❤️', '😂', '👍', '😢', '😮', '😡'];

export const ChatScreen: React.FC<ChatScreenProps> = ({ onNavigate, onOpenMedia }) => {
  const {
    currentUser,
    partner,
    messages,
    sendMessage,
    toggleReaction,
    editMessage,
    deleteMessage,
    togglePinMessage,
    sendTypingStatus,
    isPartnerTyping,
    activeConversation,
  } = useAuth();

  const [inputText, setInputText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [activeContextMenuMsgId, setActiveContextMenuMsgId] = useState<string | null>(null);

  // Search in chat
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(0);

  // Voice recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);

  // Voice playback states: messageId -> { isPlaying, currentTime, duration, speed }
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voicePlaybackSpeed, setVoicePlaybackSpeed] = useState<Record<string, number>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [voiceProgress, setVoiceProgress] = useState<Record<string, number>>({});

  // Image / file upload input refs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto scroll to bottom on new message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matched = messages
      .filter((m) => !m.isDeleted && !m.isDeletedForEveryone)
      .filter((m) => (m.text && m.text.toLowerCase().includes(q)) || (m.fileName && m.fileName.toLowerCase().includes(q)))
      .map((m) => m.id);

    setSearchResults(matched);
    setCurrentSearchIndex(0);
    if (matched.length > 0) {
      jumpToMessage(matched[0]);
    }
  }, [searchQuery, messages]);

  const jumpToMessage = (msgId: string) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400');
      }, 1800);
    }
  };

  // Typing debounce handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    sendTypingStatus(true);
  };

  // Send text message or update edited message
  const handleSend = async () => {
    if (editingMessage) {
      if (editingMessage.text.trim()) {
        await editMessage(editingMessage.id, editingMessage.text.trim());
      }
      setEditingMessage(null);
      return;
    }

    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    sendTypingStatus(false);

    await sendMessage({
      type: 'text',
      text: textToSend,
      replyTo: replyingTo,
    });

    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    const recorder = new VoiceRecorder();
    voiceRecorderRef.current = recorder;
    const started = await recorder.start((state) => {
      setRecordingDuration(state.duration);
      setRecordingWaveform(state.waveform);
    });

    if (started) {
      setIsRecording(true);
      setRecordingDuration(0);
    }
  };

  // Stop & Send Voice Note
  const stopRecordingAndSend = async () => {
    if (!voiceRecorderRef.current) return;
    const result = await voiceRecorderRef.current.stop();
    setIsRecording(false);
    voiceRecorderRef.current = null;

    if (result && result.duration >= 1) {
      await sendMessage({
        type: 'voice',
        fileUrl: result.base64,
        duration: result.duration,
        waveform: result.waveform,
        replyTo: replyingTo,
      });
      setReplyingTo(null);
    }
  };

  const cancelRecording = () => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancel();
      voiceRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  // Play / Pause Voice Note
  const togglePlayVoice = (msgId: string, url: string) => {
    // If playing this one, pause
    if (playingVoiceId === msgId) {
      const audio = audioElementsRef.current[msgId];
      if (audio) audio.pause();
      setPlayingVoiceId(null);
      return;
    }

    // Stop all others
    Object.values(audioElementsRef.current).forEach((a: HTMLAudioElement) => {
      if (a && typeof a.pause === 'function') a.pause();
    });

    let audio = audioElementsRef.current[msgId];
    if (!audio) {
      audio = new Audio(url);
      audioElementsRef.current[msgId] = audio;

      audio.ontimeupdate = () => {
        setVoiceProgress((prev) => ({
          ...prev,
          [msgId]: audio.currentTime / (audio.duration || 1),
        }));
      };

      audio.onended = () => {
        setPlayingVoiceId(null);
        setVoiceProgress((prev) => ({ ...prev, [msgId]: 0 }));
      };
    }

    const speed = voicePlaybackSpeed[msgId] || 1;
    audio.playbackRate = speed;
    audio.play();
    setPlayingVoiceId(msgId);
  };

  const cycleVoiceSpeed = (msgId: string) => {
    const speeds = [1, 1.5, 2];
    const current = voicePlaybackSpeed[msgId] || 1;
    const next = speeds[(speeds.indexOf(current) + 1) % speeds.length];
    setVoicePlaybackSpeed((prev) => ({ ...prev, [msgId]: next }));

    const audio = audioElementsRef.current[msgId];
    if (audio) {
      audio.playbackRate = next;
    }
  };

  // Image Upload Handler
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    try {
      const { base64, size } = await compressImage(file);
      await sendMessage({
        type: 'image',
        fileUrl: base64,
        fileName: file.name,
        fileSize: size,
        mimeType: file.type,
        replyTo: replyingTo,
      });
      setReplyingTo(null);
    } catch (err) {
      console.error('Image compression failed', err);
    }
  };

  // Video Upload Handler
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    const reader = new FileReader();
    reader.onload = async () => {
      await sendMessage({
        type: 'video',
        fileUrl: reader.result as string,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        duration: 12, // approx duration
        replyTo: replyingTo,
      });
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
  };

  // File Upload Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    const reader = new FileReader();
    reader.onload = async () => {
      await sendMessage({
        type: 'file',
        fileUrl: reader.result as string,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        replyTo: replyingTo,
      });
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
  };

  // Pinned messages
  const pinnedMessages = messages.filter((m) => m.isPinned);
  const latestPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  if (!partner) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-[#A0A0A0]">
          <p>No active partner connection.</p>
          <button
            onClick={() => onNavigate('connect')}
            className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-xs"
          >
            Connect with Partner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full bg-[#0B0B0B] relative overflow-hidden">
      {/* Hidden File Inputs */}
      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
      <input type="file" ref={videoInputRef} accept="video/*" className="hidden" onChange={handleVideoSelect} />
      <input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={handleFileSelect} />

      {/* Chat Header */}
      <div className="bg-[#151515] border-b border-[#2A2A2A] px-3.5 py-2.5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Partner Avatar & Status */}
          <div
            onClick={() => onNavigate('chat-info')}
            className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
          >
            <div className="relative shrink-0">
              <img
                src={partner.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${partner.id}`}
                alt={partner.name}
                className="w-10 h-10 rounded-full object-cover border border-[#3A3A3A] group-hover:border-amber-400 transition-colors"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#151515] ${
                  partner.status === 'online' ? 'bg-emerald-500' : 'bg-[#555555]'
                }`}
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                {partner.name}
              </h2>
              <p className="text-[11px] truncate flex items-center gap-1">
                {isPartnerTyping ? (
                  <span className="text-amber-400 font-semibold animate-pulse">Typing...</span>
                ) : (
                  <span className={partner.status === 'online' ? 'text-emerald-400' : 'text-[#888888]'}>
                    {formatLastSeen(partner.lastSeen, partner.status)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${
              showSearch ? 'bg-amber-500/20 text-amber-400' : 'text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A]'
            }`}
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Pinned Messages Trigger */}
          <button
            onClick={() => onNavigate('pinned-messages')}
            className="p-2 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] relative transition-colors"
            title="Pinned messages"
          >
            <Pin className="w-4 h-4" />
            {pinnedMessages.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* Chat Info */}
          <button
            onClick={() => onNavigate('chat-info')}
            className="p-2 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] transition-colors"
            title="Chat info and media"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#1E1E1E] border-b border-[#2A2A2A] px-4 py-2 flex items-center gap-2 z-20"
          >
            <Search className="w-4 h-4 text-[#A0A0A0] shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search messages & files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder-[#777777] focus:outline-none"
            />
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-[#A0A0A0]">
                <span>
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
                <button
                  onClick={() => {
                    const next = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
                    setCurrentSearchIndex(next);
                    jumpToMessage(searchResults[next]);
                  }}
                  className="p-1 hover:bg-[#2A2A2A] rounded"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const next = (currentSearchIndex + 1) % searchResults.length;
                    setCurrentSearchIndex(next);
                    jumpToMessage(searchResults[next]);
                  }}
                  className="p-1 hover:bg-[#2A2A2A] rounded"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-1 text-[#A0A0A0] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned Message Quick Banner */}
      {latestPinned && (
        <div
          onClick={() => jumpToMessage(latestPinned.id)}
          className="bg-[#1E1E1E]/95 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 cursor-pointer hover:bg-[#252525] transition-colors z-10"
        >
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 rotate-45" />
            <span className="font-semibold text-white">Pinned:</span>
            <span className="text-[#A0A0A0] truncate">
              {latestPinned.text || latestPinned.fileName || 'Pinned attachment'}
            </span>
          </div>
          <span className="text-[10px] text-amber-400 font-medium shrink-0 ml-2">Jump</span>
        </div>
      )}

      {/* Messages List Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        onClick={() => setActiveContextMenuMsgId(null)}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#A0A0A0]">
            <div className="w-12 h-12 rounded-full bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center mb-3 text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Private conversation started</h3>
            <p className="text-xs text-[#777777] max-w-xs mt-1">
              Send a text, photo, voice note, or document. Messages are shared securely between only you and {partner.name}.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.senderId === currentUser?.id;
            const isSystem = msg.senderId === 'system';
            const hasReactions = Object.keys(msg.reactions || {}).length > 0;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-[#151515] border border-[#2A2A2A] text-[11px] text-[#A0A0A0] text-center max-w-xs">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                className={`relative flex flex-col group transition-all duration-300 ${
                  isMine ? 'items-end' : 'items-start'
                }`}
              >
                {/* Message Bubble Container */}
                <div className="relative max-w-[85%] sm:max-w-[75%]">
                  {/* Quoted Reply if any */}
                  {msg.replyTo && (
                    <div
                      onClick={() => jumpToMessage(msg.replyTo!.id)}
                      className={`mb-1 px-3 py-1.5 rounded-t-xl text-xs border-l-2 cursor-pointer transition-colors ${
                        isMine
                          ? 'bg-[#1E1E1E] border-amber-400 text-[#CCCCCC]'
                          : 'bg-[#1E1E1E] border-amber-500/80 text-[#CCCCCC]'
                      }`}
                    >
                      <p className="font-semibold text-[11px] text-amber-400">{msg.replyTo.senderName}</p>
                      <p className="text-[11px] text-[#A0A0A0] truncate">{msg.replyTo.preview}</p>
                    </div>
                  )}

                  {/* Main Bubble Body */}
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveContextMenuMsgId(msg.id);
                    }}
                    className={`rounded-2xl p-3 shadow-md relative ${
                      isMine
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black font-normal rounded-tr-sm'
                        : 'bg-[#1E1E1E] text-white border border-[#2A2A2A] rounded-tl-sm'
                    } ${msg.isDeleted || msg.isDeletedForEveryone ? 'italic opacity-70' : ''}`}
                  >
                    {/* Pinned Tag */}
                    {msg.isPinned && (
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold mb-1 ${
                          isMine ? 'text-black/80' : 'text-amber-400'
                        }`}
                      >
                        <Pin className="w-3 h-3 rotate-45" />
                        <span>Pinned</span>
                      </div>
                    )}

                    {/* Deleted Message Placeholder */}
                    {msg.isDeleted || msg.isDeletedForEveryone ? (
                      <p className="text-xs flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>This message was deleted</span>
                      </p>
                    ) : (
                      <>
                        {/* TYPE: Text Message */}
                        {msg.type === 'text' && (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
                            {msg.text}
                          </p>
                        )}

                        {/* TYPE: Image */}
                        {msg.type === 'image' && msg.fileUrl && (
                          <div className="space-y-1.5">
                            <img
                              src={msg.fileUrl}
                              alt={msg.fileName || 'Photo'}
                              onClick={() => onOpenMedia && onOpenMedia(msg.fileUrl!, 'image', msg.fileName || 'Photo')}
                              className="rounded-xl max-h-72 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            />
                            {msg.text && (
                              <p className="text-xs whitespace-pre-wrap mt-1 select-text">{msg.text}</p>
                            )}
                          </div>
                        )}

                        {/* TYPE: Video */}
                        {msg.type === 'video' && msg.fileUrl && (
                          <div className="space-y-1.5">
                            <div
                              onClick={() => onOpenMedia && onOpenMedia(msg.fileUrl!, 'video', msg.fileName || 'Video')}
                              className="relative rounded-xl overflow-hidden cursor-pointer group/vid max-h-64 bg-black flex items-center justify-center"
                            >
                              <video src={msg.fileUrl} className="w-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/vid:bg-black/20 transition-all">
                                <div className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl">
                                  <Play className="w-6 h-6 fill-current ml-0.5" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-80">
                              <span>{msg.fileName || 'Video file'}</span>
                              <span>{formatFileSize(msg.fileSize)}</span>
                            </div>
                          </div>
                        )}

                        {/* TYPE: Voice Note */}
                        {msg.type === 'voice' && msg.fileUrl && (
                          <div className="w-60 sm:w-68 py-1">
                            <div className="flex items-center gap-2.5">
                              {/* Play / Pause Button */}
                              <button
                                onClick={() => togglePlayVoice(msg.id, msg.fileUrl!)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-90 ${
                                  isMine ? 'bg-black text-amber-400' : 'bg-amber-500 text-black'
                                }`}
                              >
                                {playingVoiceId === msg.id ? (
                                  <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                )}
                              </button>

                              {/* Interactive Waveform Scrubber */}
                              <div className="flex-1 flex flex-col justify-center">
                                <div className="h-7 flex items-center gap-0.5">
                                  {(msg.waveform || normalizeWaveform([])).map((height, i) => {
                                    const progress = voiceProgress[msg.id] || 0;
                                    const isPlayed = i / 28 <= progress;
                                    return (
                                      <div
                                        key={i}
                                        style={{ height: `${Math.max(15, height)}%` }}
                                        className={`w-1 rounded-full transition-colors ${
                                          isMine
                                            ? isPlayed
                                              ? 'bg-black'
                                              : 'bg-black/30'
                                            : isPlayed
                                            ? 'bg-amber-400'
                                            : 'bg-[#444444]'
                                        }`}
                                      />
                                    );
                                  })}
                                </div>

                                <div
                                  className={`flex items-center justify-between text-[10px] mt-0.5 ${
                                    isMine ? 'text-black/80 font-medium' : 'text-[#A0A0A0]'
                                  }`}
                                >
                                  <span>{formatDuration(msg.duration || 0)}</span>
                                  {/* Speed button */}
                                  <button
                                    onClick={() => cycleVoiceSpeed(msg.id)}
                                    className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                      isMine ? 'bg-black/15 hover:bg-black/25' : 'bg-[#2A2A2A] hover:bg-[#353535]'
                                    }`}
                                  >
                                    {voicePlaybackSpeed[msg.id] || 1}x
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TYPE: Document / File */}
                        {msg.type === 'file' && (
                          <div className="flex items-center gap-3 p-1 min-w-[200px]">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isMine ? 'bg-black/20 text-black' : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{msg.fileName || 'Attachment'}</p>
                              <p
                                className={`text-[10px] ${
                                  isMine ? 'text-black/75 font-medium' : 'text-[#A0A0A0]'
                                }`}
                              >
                                {formatFileSize(msg.fileSize)}
                              </p>
                            </div>
                            {msg.fileUrl && (
                              <a
                                href={msg.fileUrl}
                                download={msg.fileName || 'download'}
                                className={`p-2 rounded-lg transition-colors ${
                                  isMine
                                    ? 'bg-black/15 hover:bg-black/30 text-black'
                                    : 'bg-[#2A2A2A] hover:bg-[#333333] text-white'
                                }`}
                                title="Download File"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Metadata: Time + Edited Tag + Delivery Ticks */}
                    <div
                      className={`flex items-center justify-end gap-1.5 text-[10px] mt-1 select-none ${
                        isMine ? 'text-black/70 font-medium' : 'text-[#888888]'
                      }`}
                    >
                      {msg.isEdited && <span>Edited</span>}
                      <span>{formatTimeOnly(msg.createdAt)}</span>

                      {/* Delivery Status Indicator */}
                      {isMine && (
                        <span>
                          {msg.status === 'queued' ? (
                            <Clock className="w-3 h-3 text-black/60 inline" title="Queued (offline)" />
                          ) : msg.readAt ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-900 inline font-bold" title="Read" />
                          ) : msg.deliveredAt ? (
                            <CheckCheck className="w-3.5 h-3.5 text-black/60 inline" title="Delivered" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-black/60 inline" title="Sent" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges Container */}
                  {hasReactions && (
                    <div
                      className={`flex flex-wrap gap-1 mt-1 ${
                        isMine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {Object.entries(msg.reactions).map(([userId, emoji]) => (
                        <button
                          key={userId}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border shadow-sm transition-transform active:scale-90 ${
                            userId === currentUser?.id
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-[#1E1E1E] border-[#2A2A2A] text-white'
                          }`}
                        >
                          <span>{emoji}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hover/Context Menu Action Buttons */}
                  <div
                    className={`absolute -top-3 hidden group-hover:flex items-center gap-0.5 bg-[#151515] border border-[#2A2A2A] rounded-full p-0.5 shadow-xl z-20 ${
                      isMine ? 'right-0' : 'left-0'
                    }`}
                  >
                    {/* Quick Reaction Pills */}
                    <div className="flex items-center px-1">
                      {EMOJI_REACTIONS.slice(0, 4).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform p-1 text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Reply */}
                    <button
                      onClick={() =>
                        setReplyingTo({
                          id: msg.id,
                          senderName: isMine ? 'You' : partner.name,
                          senderId: msg.senderId,
                          type: msg.type,
                          preview: msg.text || msg.fileName || 'Attachment',
                        })
                      }
                      className="p-1 text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] rounded-full"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* More Menu Toggle */}
                    <button
                      onClick={() => setActiveContextMenuMsgId(msg.id)}
                      className="p-1 text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] rounded-full"
                      title="More actions"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Context Modal / Menu Dropdown */}
                  {activeContextMenuMsgId === msg.id && (
                    <div
                      className={`absolute top-full mt-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl shadow-2xl py-1.5 z-40 w-44 text-xs ${
                        isMine ? 'right-0' : 'left-0'
                      }`}
                    >
                      {/* Emoji Bar */}
                      <div className="flex justify-between px-2.5 py-1.5 border-b border-[#2A2A2A]">
                        {EMOJI_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleReaction(msg.id, emoji);
                              setActiveContextMenuMsgId(null);
                            }}
                            className="hover:scale-125 transition-transform text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Reply */}
                      <button
                        onClick={() => {
                          setReplyingTo({
                            id: msg.id,
                            senderName: isMine ? 'You' : partner.name,
                            senderId: msg.senderId,
                            type: msg.type,
                            preview: msg.text || msg.fileName || 'Attachment',
                          });
                          setActiveContextMenuMsgId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#2A2A2A] text-white flex items-center gap-2"
                      >
                        <Reply className="w-3.5 h-3.5 text-[#A0A0A0]" />
                        <span>Reply</span>
                      </button>

                      {/* Copy Text */}
                      {msg.text && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text!);
                            setActiveContextMenuMsgId(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#2A2A2A] text-white flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#A0A0A0]" />
                          <span>Copy Text</span>
                        </button>
                      )}

                      {/* Edit (own only) */}
                      {isMine && msg.type === 'text' && !msg.isDeleted && (
                        <button
                          onClick={() => {
                            setEditingMessage({ id: msg.id, text: msg.text || '' });
                            setActiveContextMenuMsgId(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#2A2A2A] text-white flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#A0A0A0]" />
                          <span>Edit</span>
                        </button>
                      )}

                      {/* Pin */}
                      <button
                        onClick={() => {
                          togglePinMessage(msg.id);
                          setActiveContextMenuMsgId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#2A2A2A] text-white flex items-center gap-2"
                      >
                        <Pin className="w-3.5 h-3.5 text-[#A0A0A0]" />
                        <span>{msg.isPinned ? 'Unpin' : 'Pin Message'}</span>
                      </button>

                      <div className="my-1 border-t border-[#2A2A2A]" />

                      {/* Delete for Me */}
                      <button
                        onClick={() => {
                          deleteMessage(msg.id, false);
                          setActiveContextMenuMsgId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#2A2A2A] text-red-400 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete for me</span>
                      </button>

                      {/* Delete for Everyone (own only) */}
                      {isMine && !msg.isDeleted && (
                        <button
                          onClick={() => {
                            deleteMessage(msg.id, true);
                            setActiveContextMenuMsgId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#2A2A2A] text-red-400 flex items-center gap-2 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete for everyone</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="bg-[#1E1E1E] border-t border-[#2A2A2A] px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-xs border-l-2 border-amber-400 pl-2">
            <Reply className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <p className="font-semibold text-white">Replying to {replyingTo.senderName}</p>
              <p className="text-[#A0A0A0] text-[11px] truncate max-w-xs">{replyingTo.preview}</p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-[#A0A0A0] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="bg-[#1E1E1E] border-t border-[#2A2A2A] px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-xs border-l-2 border-amber-400 pl-2">
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-white">Editing message</span>
          </div>
          <button
            onClick={() => setEditingMessage(null)}
            className="p-1 text-[#A0A0A0] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Popover Menu */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute bottom-16 left-4 bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-3 shadow-2xl grid grid-cols-4 gap-2 z-40 max-w-xs"
          >
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-[#2A2A2A] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-[#A0A0A0]">Camera</span>
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-[#2A2A2A] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-[#A0A0A0]">Gallery</span>
            </button>

            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-[#2A2A2A] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <VideoIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-[#A0A0A0]">Video</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-[#2A2A2A] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-[#A0A0A0]">Document</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Composer / Audio Recording Toolbar */}
      <div className="p-3 bg-[#151515] border-t border-[#2A2A2A] shrink-0 z-30">
        {isRecording ? (
          /* Live Voice Recording Bar */
          <div className="flex items-center gap-3 bg-[#1E1E1E] border border-amber-500/40 rounded-2xl px-4 py-2.5 shadow-xl animate-pulse-glow">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-red-400">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            {/* Live Audio Visualizer Bars */}
            <div className="flex-1 flex items-center gap-0.5 h-6 overflow-hidden px-2">
              {recordingWaveform.slice(-20).map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.max(20, h)}%` }}
                  className="w-1 bg-amber-400 rounded-full transition-all duration-75"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-xs text-[#A0A0A0] hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={stopRecordingAndSend}
              className="p-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-transform active:scale-95 shadow-md"
              title="Send Voice Note"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : (
          /* Standard Text / Media Composer */
          <div className="flex items-end gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`p-2.5 rounded-xl transition-all ${
                showAttachMenu
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 rotate-45'
                  : 'bg-[#1E1E1E] text-[#A0A0A0] hover:text-white hover:bg-[#252525] border border-[#2A2A2A]'
              }`}
              title="Attach media or files"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Expanding Textarea Input */}
            <div className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] focus-within:border-amber-500/60 rounded-2xl px-3.5 py-2 transition-all flex items-end">
              {editingMessage ? (
                <textarea
                  rows={1}
                  value={editingMessage.text}
                  onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                  onKeyDown={handleKeyDown}
                  placeholder="Edit message..."
                  className="w-full bg-transparent text-sm text-white placeholder-[#666666] focus:outline-none resize-none max-h-28"
                />
              ) : (
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="w-full bg-transparent text-sm text-white placeholder-[#666666] focus:outline-none resize-none max-h-28"
                />
              )}
            </div>

            {/* Mic / Send Button */}
            {inputText.trim() || editingMessage ? (
              <button
                type="button"
                onClick={handleSend}
                className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold shadow-lg shadow-amber-500/20 transition-transform active:scale-90"
                title="Send Message"
              >
                <Send className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 rounded-xl bg-[#1E1E1E] hover:bg-amber-500/20 text-[#A0A0A0] hover:text-amber-400 border border-[#2A2A2A] hover:border-amber-500/40 transition-all active:scale-90"
                title="Record voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
