import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen, Message } from '../types';
import { formatTimeOnly, formatFileSize, formatDuration } from '../utils/format';
import {
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Mic,
  Link2,
  Bell,
  Pin,
  Trash2,
  HeartCrack,
  Download,
  Play,
  Pause,
  ExternalLink,
  ShieldAlert,
  X,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';

interface ChatInfoModalProps {
  onNavigate: (screen: ActiveScreen) => void;
  onOpenMedia?: (url: string, type: 'image' | 'video', title?: string) => void;
}

export const ChatInfoModal: React.FC<ChatInfoModalProps> = ({ onNavigate, onOpenMedia }) => {
  const {
    partner,
    messages,
    clearChat,
    disconnectPartner,
    togglePinMessage,
    updateProfile,
    currentUser,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice' | 'links'>('media');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false);
  const [clearForEveryone, setClearForEveryone] = useState<boolean>(false);
  const [disconnectAction, setDisconnectAction] = useState<'archive' | 'delete'>('archive');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  if (!partner) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <button
          onClick={() => onNavigate('home')}
          className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  // Filter items by type from message metadata
  const mediaItems = messages.filter(
    (m) => (m.type === 'image' || m.type === 'video') && m.fileUrl && !m.isDeleted && !m.isDeletedForEveryone
  );

  const fileItems = messages.filter(
    (m) => m.type === 'file' && m.fileUrl && !m.isDeleted && !m.isDeletedForEveryone
  );

  const voiceItems = messages.filter(
    (m) => m.type === 'voice' && m.fileUrl && !m.isDeleted && !m.isDeletedForEveryone
  );

  // Link extractor
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const linkItems: { url: string; msg: Message }[] = [];
  messages.forEach((m) => {
    if (m.text && !m.isDeleted && !m.isDeletedForEveryone) {
      const matches = m.text.match(linkRegex);
      if (matches) {
        matches.forEach((url) => linkItems.push({ url, msg: m }));
      }
    }
  });

  const pinnedItems = messages.filter((m) => m.isPinned && !m.isDeleted && !m.isDeletedForEveryone);

  const handleClearConfirm = async () => {
    await clearChat(clearForEveryone);
    setShowClearConfirm(false);
  };

  const handleDisconnectConfirm = async () => {
    await disconnectPartner(disconnectAction);
    setShowDisconnectConfirm(false);
    onNavigate('connect');
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full bg-[#0B0B0B] overflow-y-auto">
      {/* Header */}
      <div className="bg-[#151515] border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-white font-['Space_Grotesk']">Conversation Details</h2>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Partner Profile Card */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 flex flex-col items-center text-center shadow-xl">
          <div className="relative mb-3">
            <img
              src={partner.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${partner.id}`}
              alt={partner.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/40 shadow-xl"
            />
            <span
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#1E1E1E] ${
                partner.status === 'online' ? 'bg-emerald-500' : 'bg-[#666666]'
              }`}
            />
          </div>

          <h3 className="text-lg font-bold text-white">{partner.name}</h3>
          <p className="text-xs text-[#A0A0A0] font-mono">@{partner.username}</p>

          {partner.bio && (
            <p className="text-xs text-[#CCCCCC] mt-2 max-w-sm italic">"{partner.bio}"</p>
          )}

          {/* RAYS Code Pill */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#151515] border border-[#2A2A2A] text-xs font-mono text-amber-400">
            <span className="text-[#A0A0A0]">RAYS Code:</span>
            <strong>{partner.raysCode}</strong>
          </div>
        </div>

        {/* Media & Files Gallery Container */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-[#2A2A2A] bg-[#151515] text-xs">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'media'
                  ? 'border-amber-400 text-amber-400 bg-[#1E1E1E]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media ({mediaItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'files'
                  ? 'border-amber-400 text-amber-400 bg-[#1E1E1E]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Files ({fileItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'voice'
                  ? 'border-amber-400 text-amber-400 bg-[#1E1E1E]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice ({voiceItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('links')}
              className={`flex-1 py-3 font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'links'
                  ? 'border-amber-400 text-amber-400 bg-[#1E1E1E]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Links ({linkItems.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 min-h-[160px]">
            {/* Media Grid */}
            {activeTab === 'media' && (
              mediaItems.length === 0 ? (
                <p className="text-center text-xs text-[#777777] py-6">No shared photos or videos yet</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => onOpenMedia && onOpenMedia(m.fileUrl!, m.type as any, m.fileName || 'Media')}
                      className="aspect-square bg-black rounded-xl overflow-hidden cursor-pointer group relative border border-[#2A2A2A]"
                    >
                      {m.type === 'image' ? (
                        <img src={m.fileUrl!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center relative">
                          <video src={m.fileUrl!} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white fill-current" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Files List */}
            {activeTab === 'files' && (
              fileItems.length === 0 ? (
                <p className="text-center text-xs text-[#777777] py-6">No documents shared yet</p>
              ) : (
                <div className="space-y-2">
                  {fileItems.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{m.fileName}</p>
                          <p className="text-[10px] text-[#A0A0A0]">{formatFileSize(m.fileSize)} • {formatTimeOnly(m.createdAt)}</p>
                        </div>
                      </div>
                      <a
                        href={m.fileUrl!}
                        download={m.fileName || 'file'}
                        className="p-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-white transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Voice List */}
            {activeTab === 'voice' && (
              voiceItems.length === 0 ? (
                <p className="text-center text-xs text-[#777777] py-6">No voice notes shared yet</p>
              ) : (
                <div className="space-y-2">
                  {voiceItems.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            if (playingVoiceId === m.id) {
                              setPlayingVoiceId(null);
                            } else {
                              const a = new Audio(m.fileUrl!);
                              a.play();
                              a.onended = () => setPlayingVoiceId(null);
                              setPlayingVoiceId(m.id);
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center"
                        >
                          {playingVoiceId === m.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <div>
                          <p className="text-xs font-semibold text-white">Voice Note</p>
                          <p className="text-[10px] text-[#A0A0A0]">{formatDuration(m.duration || 0)} • {formatTimeOnly(m.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Links List */}
            {activeTab === 'links' && (
              linkItems.length === 0 ? (
                <p className="text-center text-xs text-[#777777] py-6">No links shared yet</p>
              ) : (
                <div className="space-y-2">
                  {linkItems.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A] hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-white truncate">{item.url}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#A0A0A0] shrink-0" />
                    </a>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Pinned Messages Section */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              <span>Pinned Messages ({pinnedItems.length})</span>
            </h4>
          </div>

          {pinnedItems.length === 0 ? (
            <p className="text-xs text-[#777777]">No messages pinned in this conversation.</p>
          ) : (
            <div className="space-y-2">
              {pinnedItems.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#151515] border border-[#2A2A2A] rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate">{m.text || m.fileName || 'Attachment'}</p>
                    <span className="text-[10px] text-[#A0A0A0]">{formatTimeOnly(m.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => togglePinMessage(m.id)}
                    className="text-xs text-amber-400 hover:underline shrink-0"
                  >
                    Unpin
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Settings & Danger Zone */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider mb-2">Actions & Settings</h4>

          {/* Clear Chat Button */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#151515] hover:bg-red-500/10 border border-[#2A2A2A] hover:border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Clear Chat History</span>
            </div>
            <span className="text-[10px] text-[#A0A0A0]">Local or Everyone</span>
          </button>

          {/* Disconnect Partner Button */}
          <button
            onClick={() => setShowDisconnectConfirm(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-[#151515] hover:bg-red-500/10 border border-[#2A2A2A] hover:border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <HeartCrack className="w-4 h-4" />
              <span>Disconnect Partner</span>
            </div>
            <span className="text-[10px] text-[#A0A0A0]">Archive / Delete</span>
          </button>
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Clear Conversation Messages</span>
            </div>
            <p className="text-xs text-[#A0A0A0]">
              Are you sure you want to clear message history? You can clear messages for yourself only, or delete for both participants.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="clear_choice"
                  checked={!clearForEveryone}
                  onChange={() => setClearForEveryone(false)}
                  className="accent-amber-500"
                />
                <span className="text-white">Clear for me only (preserves partner's copy)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="clear_choice"
                  checked={clearForEveryone}
                  onChange={() => setClearForEveryone(true)}
                  className="accent-amber-500"
                />
                <span className="text-white">Delete for everyone</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-[#2A2A2A] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConfirm}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Partner Confirmation Modal (§6) */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <HeartCrack className="w-5 h-5" />
              <span>Disconnect from {partner.name}</span>
            </div>
            <p className="text-xs text-[#A0A0A0]">
              Disconnecting will end your 1:1 active connection. Choose what should happen to your private conversation:
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="disc_choice"
                  checked={disconnectAction === 'archive'}
                  onChange={() => setDisconnectAction('archive')}
                  className="accent-amber-500"
                />
                <span className="text-white"><strong>Archive:</strong> Disconnect but keep messages saved</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="disc_choice"
                  checked={disconnectAction === 'delete'}
                  onChange={() => setDisconnectAction('delete')}
                  className="accent-amber-500"
                />
                <span className="text-white"><strong>Permanently Delete:</strong> Erase all messages & media</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-[#2A2A2A] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
