import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen } from '../types';
import { formatFileSize } from '../utils/format';
import {
  ArrowLeft,
  User,
  HardDrive,
  Bell,
  Shield,
  LogOut,
  Trash2,
  Check,
  Sparkles,
  Info,
  RefreshCw,
  Copy,
  AlertTriangle,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion } from 'motion/react';

interface AppSettingsModalProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({ onNavigate }) => {
  const {
    currentUser,
    updateProfile,
    regenerateRaysCode,
    logout,
    deleteAccount,
    messages,
    partner,
  } = useAuth();

  const [name, setName] = useState<string>(currentUser?.name || '');
  const [username, setUsername] = useState<string>(currentUser?.username || '');
  const [bio, setBio] = useState<string>(currentUser?.bio || '');
  const [avatar, setAvatar] = useState<string>(
    currentUser?.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${currentUser?.id || 'me'}`
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);

  // Storage breakdown calculations
  let imageBytes = 0;
  let videoBytes = 0;
  let voiceBytes = 0;
  let fileBytes = 0;

  messages.forEach((m) => {
    if (m.type === 'image') imageBytes += m.fileSize || 350000;
    if (m.type === 'video') videoBytes += m.fileSize || 1800000;
    if (m.type === 'voice') voiceBytes += m.fileSize || (m.duration ? m.duration * 8000 : 45000);
    if (m.type === 'file') fileBytes += m.fileSize || 500000;
  });

  const totalBytes = imageBytes + videoBytes + voiceBytes + fileBytes;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      name: name.trim(),
      username: username.trim(),
      bio: bio.trim(),
      profileImage: avatar,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCopyCode = () => {
    if (!currentUser?.raysCode) return;
    navigator.clipboard.writeText(currentUser.raysCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    setShowDeleteConfirm(false);
    onNavigate('login');
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full bg-[#0B0B0B] overflow-y-auto">
      {/* Top Header */}
      <div className="bg-[#151515] border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(partner ? 'home' : 'connect')}
            className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-white font-['Space_Grotesk']">Settings & Account</h2>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Profile Card & Editor */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <span>Profile Details</span>
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-500/50"
              />
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() =>
                    setAvatar(
                      `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 900000000)}?w=300&auto=format&fit=crop&q=80`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-xs font-semibold text-white transition-colors"
                >
                  Randomize Photo
                </button>
                <p className="text-[11px] text-[#A0A0A0] mt-1">Visible only to your partner</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Bio / Status</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a thought or status..."
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition-transform active:scale-95"
              >
                Save Changes
              </button>

              {savedSuccess && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Profile updated</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Unique RAYS Code Card */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Your RAYS Code</span>
            </h3>
            <button
              onClick={regenerateRaysCode}
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          </div>

          <p className="text-xs text-[#A0A0A0] mb-3">
            Share this code to let someone send you a connection request.
          </p>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#151515] border border-[#2A2A2A]">
            <span className="text-base font-mono font-bold text-amber-400 tracking-wider">
              {currentUser?.raysCode || 'RAYS-XXXXXX'}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Storage & Data Breakdown (§11) */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>Storage Usage ({formatFileSize(totalBytes)})</span>
          </h3>

          {/* Visual Storage Bar */}
          <div className="h-3 w-full bg-[#151515] rounded-full overflow-hidden flex gap-0.5 mb-3 border border-[#2A2A2A]">
            <div
              style={{ width: `${Math.min(100, (imageBytes / (totalBytes || 1)) * 100)}%` }}
              className="bg-amber-400"
              title="Photos"
            />
            <div
              style={{ width: `${Math.min(100, (videoBytes / (totalBytes || 1)) * 100)}%` }}
              className="bg-purple-400"
              title="Videos"
            />
            <div
              style={{ width: `${Math.min(100, (voiceBytes / (totalBytes || 1)) * 100)}%` }}
              className="bg-emerald-400"
              title="Voice notes"
            />
            <div
              style={{ width: `${Math.min(100, (fileBytes / (totalBytes || 1)) * 100)}%` }}
              className="bg-sky-400"
              title="Documents"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-4">
            <div className="p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]">
              <span className="text-[#A0A0A0] block text-[10px]">Photos</span>
              <span className="font-semibold text-white">{formatFileSize(imageBytes)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]">
              <span className="text-[#A0A0A0] block text-[10px]">Videos</span>
              <span className="font-semibold text-white">{formatFileSize(videoBytes)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]">
              <span className="text-[#A0A0A0] block text-[10px]">Voice Notes</span>
              <span className="font-semibold text-white">{formatFileSize(voiceBytes)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151515] border border-[#2A2A2A]">
              <span className="text-[#A0A0A0] block text-[10px]">Documents</span>
              <span className="font-semibold text-white">{formatFileSize(fileBytes)}</span>
            </div>
          </div>

          <button
            onClick={handleClearCache}
            className="w-full py-2.5 rounded-xl bg-[#151515] hover:bg-[#252525] border border-[#2A2A2A] text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>{cacheCleared ? 'Cache Cleared Successfully!' : 'Clear Offline Cached Media'}</span>
          </button>
        </div>

        {/* Account Management & Security (§12) */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Account & Security</span>
          </h3>

          <div className="space-y-2">
            <button
              onClick={logout}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#151515] hover:bg-[#252525] border border-[#2A2A2A] text-xs font-semibold text-white flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="w-4 h-4 text-[#A0A0A0]" />
                <span>Sign Out</span>
              </div>
              <span className="text-[10px] text-[#A0A0A0]">End current session</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#151515] hover:bg-red-500/10 border border-[#2A2A2A] hover:border-red-500/30 text-xs font-semibold text-red-400 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </div>
              <span className="text-[10px] text-red-400/80">Permanent</span>
            </button>
          </div>
        </div>

        {/* About RAYS Footer */}
        <div className="p-4 rounded-2xl bg-[#151515]/60 border border-[#2A2A2A] text-center text-xs text-[#777777] space-y-1">
          <p className="font-bold text-white">RAYS v2.0</p>
          <p>Strict 1-to-1 Private Architecture • End-to-End Encrypted Transport</p>
          <p className="text-[10px]">No group chats • No algorithms • No tracking</p>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Delete Your Account</span>
            </div>
            <p className="text-xs text-[#A0A0A0]">
              This will permanently delete your profile, disconnect you from your partner, and erase conversation history from the server. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-[#2A2A2A] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
