import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen } from '../types';
import { Copy, Check, QrCode, UserPlus, Sparkles, AlertCircle, ArrowRight, Clock, ShieldCheck, HeartHandshake } from 'lucide-react';
import { motion } from 'motion/react';

interface ConnectScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const ConnectScreen: React.FC<ConnectScreenProps> = ({ onNavigate }) => {
  const {
    currentUser,
    pendingIncoming,
    pendingOutgoing,
    sendConnectionRequest,
    respondToConnection,
    searchUserByCode,
    availableUsers,
  } = useAuth();

  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  const handleCopy = () => {
    if (!currentUser?.raysCode) return;
    navigator.clipboard.writeText(currentUser.raysCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!inputCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a RAYS Code' });
      return;
    }

    setIsSending(true);
    const res = await sendConnectionRequest(inputCode.trim());
    setIsSending(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Connection request sent successfully!' });
      setInputCode('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to send connection request' });
    }
  };

  const handleRespond = async (connectionId: string, action: 'accept' | 'decline') => {
    setStatusMessage(null);
    const res = await respondToConnection(connectionId, action);
    if (res.success && action === 'accept') {
      onNavigate('home');
    } else if (!res.success) {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to process request' });
    }
  };

  // Find another demo user to offer 1-click test connect
  const otherDemoUser = availableUsers.find((u) => u.id !== currentUser?.id && !u.connectedPartnerId);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full space-y-4"
      >
        {/* Top Header Card */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600" />

          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-3">
            <HeartHandshake className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-white font-['Space_Grotesk']">Private Connection</h2>
          <p className="text-xs text-[#A0A0A0] max-w-xs mx-auto mt-1">
            RAYS connects exactly two people. Share your code with your partner or enter theirs below.
          </p>

          {/* User's RAYS Code Box */}
          <div className="mt-5 p-4 rounded-xl bg-[#151515] border border-[#2A2A2A] flex flex-col items-center">
            <span className="text-[11px] font-semibold text-[#A0A0A0] uppercase tracking-wider mb-1">
              Your Unique RAYS Code
            </span>
            <div className="flex items-center gap-3 my-1">
              <span className="text-2xl font-mono font-bold tracking-widest text-amber-400">
                {currentUser?.raysCode || 'RAYS-XXXXXX'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-xs font-semibold text-white transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-[#A0A0A0]" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] text-xs font-semibold text-white transition-all active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5 text-[#A0A0A0]" />
                <span>Show QR</span>
              </button>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Incoming Requests Section */}
        {pendingIncoming.length > 0 && (
          <div className="bg-[#1E1E1E] border border-amber-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>Incoming Connection Request ({pendingIncoming.length})</span>
            </div>

            <div className="space-y-3">
              {pendingIncoming.map(({ connection, initiator }) => (
                <div
                  key={connection.id}
                  className="bg-[#151515] border border-[#2A2A2A] rounded-xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={initiator.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${initiator.id}`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-[#3A3A3A] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{initiator.name}</p>
                      <p className="text-xs text-[#A0A0A0] font-mono truncate">{initiator.raysCode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRespond(connection.id, 'decline')}
                      className="px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#333333] text-xs font-semibold text-[#A0A0A0] hover:text-white transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespond(connection.id, 'accept')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black shadow-md transition-all active:scale-95"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing Requests Section */}
        {pendingOutgoing.length > 0 && (
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A0A0A0] mb-2 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending Outgoing Request</span>
            </div>

            {pendingOutgoing.map(({ connection, target }) => (
              <div
                key={connection.id}
                className="bg-[#151515] border border-[#2A2A2A] rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={target.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=${target.id}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">{target.name || target.username}</p>
                    <p className="text-[11px] text-amber-400/80 font-mono">Waiting for acceptance...</p>
                  </div>
                </div>
                <span className="text-[10px] text-[#A0A0A0] font-mono">{connection.targetCode}</span>
              </div>
            ))}
          </div>
        )}

        {/* Enter Partner's Code Card */}
        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1">Enter Partner's RAYS Code</h3>
          <p className="text-xs text-[#A0A0A0] mb-3.5">
            Ask your partner for their code, paste it here, and send a request.
          </p>

          <form onSubmit={handleSendRequest} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. RAYS-3M7N9X"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="flex-1 bg-[#151515] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-sm font-mono text-amber-400 focus:outline-none focus:border-amber-500 uppercase tracking-wider"
              />
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Connect</span>
              </button>
            </div>
          </form>

          {/* Quick Simulation Connect Shortcut */}
          {otherDemoUser && (
            <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex items-center justify-between text-xs">
              <span className="text-[#A0A0A0]">Testing locally?</span>
              <button
                type="button"
                onClick={() => setInputCode(otherDemoUser.raysCode)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-fill {otherDemoUser.name}'s Code</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1">Scan RAYS Code</h3>
            <p className="text-xs text-[#A0A0A0] mb-4">Point your partner's camera to connect</p>

            <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-4 shadow-lg">
              {/* Synthetic visual QR matrix */}
              <div className="w-44 h-44 bg-black p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-12 h-12 border-4 border-white flex items-center justify-center">
                    <div className="w-6 h-6 bg-white" />
                  </div>
                  <div className="w-12 h-12 border-4 border-white flex items-center justify-center">
                    <div className="w-6 h-6 bg-white" />
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-white font-mono font-bold text-[10px] tracking-widest bg-[#151515] px-1 py-0.5 rounded">
                    {currentUser?.raysCode}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="w-12 h-12 border-4 border-white flex items-center justify-center">
                    <div className="w-6 h-6 bg-white" />
                  </div>
                  <div className="w-8 h-8 bg-white grid grid-cols-2 gap-1 p-1">
                    <div className="bg-black" />
                    <div className="bg-black" />
                    <div className="bg-black" />
                    <div className="bg-black" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm font-mono font-bold text-amber-400 mb-4">{currentUser?.raysCode}</p>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#353535] text-white font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
