import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, WifiOff, Copy, Check, Users, Shield, Sparkles } from 'lucide-react';
import { ActiveScreen } from '../types';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate }) => {
  const { currentUser, isOnline, availableUsers, switchActiveUser, partner } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleCopyCode = () => {
    if (!currentUser?.raysCode) return;
    navigator.clipboard.writeText(currentUser.raysCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full bg-[#0B0B0B]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-2.5 z-40 sticky top-0 shrink-0">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Brand & Connection Tagline */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => {
            if (currentUser) {
              onNavigate(partner ? 'home' : 'connect');
            }
          }}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 font-bold text-black text-sm tracking-tighter">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wider text-white font-['Space_Grotesk']">RAYS</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1E1E1E] text-amber-400 border border-amber-500/20">
                1:1 Private
              </span>
            </div>
          </div>
        </div>

        {/* Right Section Controls */}
        <div className="flex items-center gap-2">
          {/* Offline Warning Pill */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <WifiOff className="w-3 h-3" />
              <span>Offline (Queued)</span>
            </div>
          )}

          {currentUser && (
            <>
              {/* RAYS Code Quick Copy */}
              <button
                onClick={handleCopyCode}
                title="Click to copy your unique RAYS Code"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-xs text-white transition-colors"
              >
                <span className="text-[#A0A0A0]">My Code:</span>
                <span className="font-mono font-semibold text-amber-400">{currentUser.raysCode}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-[#A0A0A0]" />}
              </button>

              {/* Fast Switch Tester for instant 2-person testing in one window */}
              {availableUsers.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all"
                    title="Switch user account to test two-person chat in real-time"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Test Switch</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-[#A0A0A0] uppercase tracking-wider border-b border-[#2A2A2A] mb-1 flex items-center justify-between">
                        <span>Switch Active Account</span>
                        <Sparkles className="w-3 h-3 text-amber-400" />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {availableUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              switchActiveUser(u.id);
                              setShowUserMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs hover:bg-[#2A2A2A] transition-colors ${
                              currentUser.id === u.id ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'text-white'
                            }`}
                          >
                            <img
                              src={u.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${u.id}`}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover border border-[#3A3A3A]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{u.name || u.username}</p>
                              <p className="text-[10px] text-[#A0A0A0] font-mono">{u.raysCode}</p>
                            </div>
                            {currentUser.id === u.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* App Settings Button */}
              <button
                onClick={() => onNavigate('app-settings')}
                className={`p-2 rounded-lg transition-colors ${
                  currentScreen === 'app-settings'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#1E1E1E]'
                }`}
                title="App Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
