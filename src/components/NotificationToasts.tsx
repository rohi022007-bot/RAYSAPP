import React from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X } from 'lucide-react';

export const NotificationToasts: React.FC<{ onOpenChat?: () => void }> = ({ onOpenChat }) => {
  const { notifications, removeNotification } = useAuth();

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center pointer-events-none px-4 space-y-2 max-w-md mx-auto">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-amber-500/40 transition-colors rays-subtle-glow"
            onClick={() => {
              removeNotification(notif.id);
              if (onOpenChat) onOpenChat();
            }}
          >
            {notif.avatar ? (
              <img
                src={notif.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-[#3A3A3A] shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <MessageSquare className="w-5 h-5" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white truncate">{notif.title}</p>
                <span className="text-[10px] text-[#A0A0A0]">Just now</span>
              </div>
              <p className="text-xs text-[#A0A0A0] truncate mt-0.5">{notif.body}</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notif.id);
              }}
              className="text-[#A0A0A0] hover:text-white p-1 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
