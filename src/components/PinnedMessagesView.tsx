import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen } from '../types';
import { formatTimeOnly } from '../utils/format';
import { ArrowLeft, Pin, Trash2, ExternalLink } from 'lucide-react';

interface PinnedMessagesViewProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const PinnedMessagesView: React.FC<PinnedMessagesViewProps> = ({ onNavigate }) => {
  const { messages, togglePinMessage, partner, currentUser } = useAuth();

  const pinned = messages.filter((m) => m.isPinned && !m.isDeleted && !m.isDeletedForEveryone);

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
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-400 rotate-45" />
            <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
              Pinned Messages ({pinned.length})
            </h2>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {pinned.length === 0 ? (
          <div className="text-center py-12 text-[#777777]">
            <p className="text-sm">No pinned messages yet.</p>
            <p className="text-xs mt-1">Right-click or hold any message in the chat to pin it here.</p>
          </div>
        ) : (
          pinned.map((m) => {
            const isMine = m.senderId === currentUser?.id;
            return (
              <div
                key={m.id}
                className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 shadow-md flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-amber-400">
                      {isMine ? 'You' : partner?.name}
                    </span>
                    <span className="text-[10px] text-[#A0A0A0]">{formatTimeOnly(m.createdAt)}</span>
                  </div>

                  {m.text && <p className="text-sm text-white break-words">{m.text}</p>}
                  {m.type === 'image' && m.fileUrl && (
                    <img src={m.fileUrl} alt="" className="mt-2 rounded-xl max-h-40 object-cover" />
                  )}
                  {m.fileName && (
                    <p className="text-xs text-[#A0A0A0] mt-1 font-mono">{m.fileName}</p>
                  )}
                </div>

                <button
                  onClick={() => togglePinMessage(m.id)}
                  className="text-xs text-[#A0A0A0] hover:text-amber-400 p-1.5 rounded-lg hover:bg-[#2A2A2A] transition-colors"
                  title="Unpin"
                >
                  Unpin
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
