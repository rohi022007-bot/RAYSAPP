import React from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MediaPreviewModalProps {
  media: {
    url: string;
    type: 'image' | 'video';
    title?: string;
  } | null;
  onClose: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ media, onClose }) => {
  if (!media) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
        {/* Top bar controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50 text-white max-w-4xl mx-auto w-full">
          <span className="text-xs text-[#A0A0A0] font-medium truncate max-w-xs">{media.title || 'Media'}</span>

          <div className="flex items-center gap-3">
            <a
              href={media.url}
              download={media.title || 'rays-media'}
              className="p-2 rounded-full bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Frame */}
        <div className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-2">
          {media.type === 'image' ? (
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={media.url}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          ) : (
            <video
              src={media.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
            />
          )}
        </div>
      </div>
    </AnimatePresence>
  );
};
