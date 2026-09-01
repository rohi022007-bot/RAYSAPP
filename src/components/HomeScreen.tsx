import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen } from '../types';
import { formatTimeOnly, formatLastSeen } from '../utils/format';
import { MessageSquare, Shield, Info, Settings, Check, CheckCheck, Sparkles, Image, Video, Mic, FileText, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { partner, activeConversation, messages, currentUser, isPartnerTyping } = useAuth();

  if (!partner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
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

  // Find last visible message
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const isMine = lastMsg?.senderId === currentUser?.id;
  const unreadCount = messages.filter((m) => m.senderId !== currentUser?.id && !m.readAt).length;

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 justify-center">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-4"
      >
        {/* Top Status Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h1 className="text-xl font-bold text-white font-['Space_Grotesk']">Conversation</h1>
            <p className="text-xs text-[#A0A0A0]">One private space for you two</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>

        {/* The Single Connected Partner Card (§7) */}
        <div
          onClick={() => onNavigate('chat')}
          className="group relative bg-[#1E1E1E] hover:bg-[#232323] border border-[#2A2A2A] hover:border-amber-500/40 rounded-2xl p-5 shadow-2xl cursor-pointer transition-all duration-200 rays-subtle-glow active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            {/* Avatar with live presence ring & dot */}
            <div className="relative shrink-0">
              <img
                src={partner.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${partner.id}`}
                alt={partner.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#2A2A2A] group-hover:border-amber-500/50 transition-colors shadow-lg"
              />
              <span
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#1E1E1E] ${
                  partner.status === 'online' ? 'bg-emerald-500' : 'bg-[#555555]'
                }`}
                title={partner.status === 'online' ? 'Online' : 'Offline'}
              />
            </div>

            {/* Partner Details & Last Message Preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                  {partner.name}
                </h3>
                {lastMsg && (
                  <span className="text-[11px] text-[#A0A0A0] shrink-0 font-medium">
                    {formatTimeOnly(lastMsg.createdAt)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#A0A0A0] font-mono">@{partner.username}</span>
                <span className="text-[10px] text-[#666666]">•</span>
                <span className={`text-[11px] font-medium ${partner.status === 'online' ? 'text-emerald-400' : 'text-[#888888]'}`}>
                  {formatLastSeen(partner.lastSeen, partner.status)}
                </span>
              </div>

              {/* Snippet / Typing Banner */}
              <div className="mt-3 flex items-center justify-between gap-2">
                {isPartnerTyping ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold animate-pulse">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span>{partner.name.split(' ')[0]} is typing...</span>
                  </div>
                ) : lastMsg ? (
                  <div className="flex items-center gap-1.5 text-xs text-[#A0A0A0] truncate">
                    {isMine && (
                      <span className="shrink-0">
                        {lastMsg.readAt ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" />
                        ) : lastMsg.deliveredAt ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#888888] inline" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[#888888] inline" />
                        )}
                      </span>
                    )}

                    {lastMsg.type === 'image' && <Image className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {lastMsg.type === 'video' && <Video className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {lastMsg.type === 'voice' && <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {lastMsg.type === 'file' && <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />}

                    <span className="truncate">{lastMsg.text || activeConversation?.lastMessage || 'Attachment'}</span>
                  </div>
                ) : (
                  <span className="text-xs text-[#777777] italic">Tap to start your conversation</span>
                )}

                {/* Unread badge */}
                {unreadCount > 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[11px] font-extrabold shadow-md shadow-amber-500/20">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Footer Buttons */}
          <div className="mt-4 pt-3.5 border-t border-[#2A2A2A] flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-[#A0A0A0]">
              <Lock className="w-3 h-3 text-amber-500/80" />
              <span>Encrypted on transit & server</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('chat-info');
                }}
                className="p-1.5 rounded-lg bg-[#151515] hover:bg-[#2A2A2A] text-[#A0A0A0] hover:text-white transition-colors"
                title="Chat Info & Shared Media"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('chat');
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 group-hover:from-amber-400 group-hover:to-amber-300 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Chat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Partner Bio & Quick Info Snippet */}
        {partner.bio && (
          <div className="bg-[#1E1E1E]/60 border border-[#2A2A2A] rounded-xl p-3.5 text-xs text-[#A0A0A0]">
            <span className="text-white font-semibold mr-1">{partner.name.split(' ')[0]}:</span>
            <span>"{partner.bio}"</span>
          </div>
        )}
      </motion.div>
    </div>
  );
};
