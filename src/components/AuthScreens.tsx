import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveScreen } from '../types';
import { Phone, Mail, Lock, User, ArrowRight, Sparkles, Check, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreensProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ currentScreen, onNavigate }) => {
  const {
    currentUser,
    partner,
    loginWithEmail,
    registerWithEmail,
    requestPhoneOtp,
    verifyPhoneOtp,
    updateProfile,
    isLoading,
  } = useAuth();

  // Mode: 'email' | 'phone'
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('phone');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form Fields
  const [phone, setPhone] = useState<string>('+1 555 234 5678');
  const [otpCode, setOtpCode] = useState<string>('');
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState<boolean>(false);

  const [email, setEmail] = useState<string>('sarah@rays.chat');
  const [password, setPassword] = useState<string>('password123');
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  // Profile Setup State
  const [setupName, setSetupName] = useState<string>(currentUser?.name || '');
  const [setupUsername, setSetupUsername] = useState<string>(currentUser?.username || '');
  const [setupBio, setSetupBio] = useState<string>(currentUser?.bio || '');
  const [setupAvatar, setSetupAvatar] = useState<string>(
    currentUser?.profileImage || `https://api.dicebear.com/7.x/shapes/svg?seed=user_${Date.now()}`
  );
  const [avatarIndex, setAvatarIndex] = useState<number>(0);

  const sampleAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  ];

  // Handle Phone OTP Request
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!phone) {
      setErrorMessage('Please enter a valid phone number');
      return;
    }

    const res = await requestPhoneOtp(phone);
    if (res.success) {
      setOtpSent(true);
      if (res.previewCode) {
        setPreviewOtp(res.previewCode);
        setOtpCode(res.previewCode); // Auto-fill preview for frictionless test verification
      }
    } else {
      setErrorMessage(res.error || 'Failed to send OTP code');
    }
  };

  // Handle Phone OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length < 4) {
      setErrorMessage('Please enter the verification code');
      return;
    }

    const res = await verifyPhoneOtp(phone, otpCode);
    if (res.success) {
      if (res.isNewUser || !currentUser?.name) {
        onNavigate('profile-setup');
      } else {
        onNavigate(partner ? 'home' : 'connect');
      }
    } else {
      setErrorMessage(res.error || 'Invalid verification code');
    }
  };

  // Handle Email Auth (Login / Register)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isRegistering) {
      if (!name || !email || !password) {
        setErrorMessage('Please fill in all required fields');
        return;
      }
      const res = await registerWithEmail(name, email, password, username, phone);
      if (res.success) {
        onNavigate('profile-setup');
      } else {
        setErrorMessage(res.error || 'Registration failed');
      }
    } else {
      if (!email || !password) {
        setErrorMessage('Please enter both email/username and password');
        return;
      }
      const res = await loginWithEmail(email, password);
      if (res.success) {
        onNavigate(partner ? 'home' : 'connect');
      } else {
        setErrorMessage(res.error || 'Login failed');
      }
    }
  };

  // Handle Profile Setup completion
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!setupName.trim()) {
      setErrorMessage('Please provide your name');
      return;
    }

    const res = await updateProfile({
      name: setupName.trim(),
      username: setupUsername.trim() || setupName.toLowerCase().replace(/\s+/g, '_'),
      bio: setupBio.trim(),
      profileImage: setupAvatar,
    });

    if (res.success) {
      onNavigate(partner ? 'home' : 'connect');
    } else {
      setErrorMessage(res.error || 'Failed to update profile');
    }
  };

  // Profile Setup Screen
  if (currentScreen === 'profile-setup') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 shadow-2xl rays-subtle-glow"
        >
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white font-['Space_Grotesk']">Set Up Your Profile</h2>
            <p className="text-xs text-[#A0A0A0] mt-1">This will be visible only to your one connected partner</p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Avatar Selector */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <img
                src={setupAvatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-amber-500/50 shadow-xl"
              />
              <button
                type="button"
                onClick={() => {
                  const nextIndex = (avatarIndex + 1) % sampleAvatars.length;
                  setAvatarIndex(nextIndex);
                  setSetupAvatar(sampleAvatars[nextIndex]);
                }}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-black hover:bg-amber-400 shadow-md transition-transform active:scale-90"
                title="Shuffle photo"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-[#A0A0A0] mt-2">Tap button to change photo</span>
          </div>

          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Display Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Username (unique)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-[#A0A0A0]">@</span>
                <input
                  type="text"
                  placeholder="e.g. sarah_j"
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-8 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Status / Bio</label>
              <input
                type="text"
                placeholder="e.g. Minimalist & coffee enthusiast"
                value={setupBio}
                onChange={(e) => setSetupBio(e.target.value)}
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold py-3 rounded-xl hover:from-amber-400 hover:to-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] mt-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Login & Registration Screen
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
      {/* Brand Hero Heading */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-black font-extrabold text-2xl font-['Space_Grotesk'] mb-3 shadow-xl shadow-amber-500/20">
          R
        </div>
        <h1 className="text-2xl font-bold text-white font-['Space_Grotesk'] tracking-wide">RAYS</h1>
        <p className="text-xs text-[#A0A0A0] mt-1 font-medium">Private. Simple. Connected.</p>
      </div>

      <div className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 shadow-2xl rays-subtle-glow">
        {/* Auth Method Switcher Tabs */}
        <div className="flex rounded-xl bg-[#151515] p-1 border border-[#2A2A2A] mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('phone');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'phone'
                ? 'bg-[#1E1E1E] text-amber-400 border border-amber-500/30 shadow-md'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone OTP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('email');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'email'
                ? 'bg-[#1E1E1E] text-amber-400 border border-amber-500/30 shadow-md'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Login</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Phone OTP Mode */}
        {authMode === 'phone' ? (
          <div>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-[#A0A0A0] mt-1.5">
                    We will send a 6-digit verification code to this phone.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                >
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#A0A0A0]">Enter 6-Digit Code</label>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Change number
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2.5 text-base tracking-widest text-center text-amber-400 font-mono focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  {previewOtp && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between">
                      <span>Preview Verification Code: <strong>{previewOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(previewOtp)}
                        className="text-xs font-bold text-amber-400 hover:underline"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Email / Password Mode */
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">
                {isRegistering ? 'Email Address' : 'Email or Username'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. sarah@rays.chat"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#A0A0A0]">Password</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => alert('Password reset link sent to demo account')}
                    className="text-[11px] text-[#A0A0A0] hover:text-amber-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A0]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black font-bold py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] mt-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setErrorMessage('');
                }}
                className="text-xs text-[#A0A0A0] hover:text-white transition-colors"
              >
                {isRegistering ? (
                  <span>Already have an account? <strong className="text-amber-400">Sign In</strong></span>
                ) : (
                  <span>New to RAYS? <strong className="text-amber-400">Create Account</strong></span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick Test Demo Account Shortcuts */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#A0A0A0]">
        <span>Demo Logins:</span>
        <button
          onClick={() => {
            setEmail('sarah@rays.chat');
            setPassword('password123');
            setAuthMode('email');
            setIsRegistering(false);
          }}
          className="text-amber-400/80 hover:text-amber-400 underline underline-offset-2"
        >
          Sarah
        </button>
        <span>•</span>
        <button
          onClick={() => {
            setEmail('liam@rays.chat');
            setPassword('password123');
            setAuthMode('email');
            setIsRegistering(false);
          }}
          className="text-amber-400/80 hover:text-amber-400 underline underline-offset-2"
        >
          Liam
        </button>
      </div>
    </div>
  );
};
