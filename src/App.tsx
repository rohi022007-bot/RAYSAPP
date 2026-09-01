import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActiveScreen } from './types';
import { Header } from './components/Header';
import { AuthScreens } from './components/AuthScreens';
import { ConnectScreen } from './components/ConnectScreen';
import { HomeScreen } from './components/HomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { ChatInfoModal } from './components/ChatInfoModal';
import { AppSettingsModal } from './components/AppSettingsModal';
import { PinnedMessagesView } from './components/PinnedMessagesView';
import { NotificationToasts } from './components/NotificationToasts';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { motion, AnimatePresence } from 'motion/react';

const MainApp: React.FC = () => {
  const { currentUser, partner } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('home');
  const [activeMedia, setActiveMedia] = useState<{
    url: string;
    type: 'image' | 'video';
    title?: string;
  } | null>(null);

  // Derive screen if unauthenticated or unconnected
  let screenToRender: ActiveScreen = currentScreen;
  if (!currentUser) {
    screenToRender = 'auth';
  } else if (!currentUser.name) {
    screenToRender = 'profile-setup';
  } else if (!partner && (currentScreen === 'home' || currentScreen === 'chat' || currentScreen === 'chat-info')) {
    screenToRender = 'connect';
  }

  const handleNavigate = (screen: ActiveScreen) => {
    setCurrentScreen(screen);
  };

  const handleOpenMedia = (url: string, type: 'image' | 'video', title?: string) => {
    setActiveMedia({ url, type, title });
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#E0E0E0] flex flex-col font-['Plus_Jakarta_Sans'] select-none overflow-hidden">
      {/* Top Real-Time Notification Banners */}
      <NotificationToasts onOpenChat={() => setCurrentScreen('chat')} />

      {/* Media Lightbox / Fullscreen Viewer */}
      <MediaPreviewModal media={activeMedia} onClose={() => setActiveMedia(null)} />

      {/* Global Top Navigation Header */}
      <Header currentScreen={screenToRender} onNavigate={handleNavigate} />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {screenToRender === 'auth' || screenToRender === 'login' || screenToRender === 'register' || screenToRender === 'phone-otp' || screenToRender === 'profile-setup' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <AuthScreens currentScreen={screenToRender} onNavigate={handleNavigate} />
            </motion.div>
          ) : screenToRender === 'connect' ? (
            <motion.div
              key="connect"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col"
            >
              <ConnectScreen onNavigate={handleNavigate} />
            </motion.div>
          ) : screenToRender === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col"
            >
              <HomeScreen onNavigate={handleNavigate} />
            </motion.div>
          ) : screenToRender === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <ChatScreen onNavigate={handleNavigate} onOpenMedia={handleOpenMedia} />
            </motion.div>
          ) : screenToRender === 'chat-info' ? (
            <motion.div
              key="chat-info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col"
            >
              <ChatInfoModal onNavigate={handleNavigate} onOpenMedia={handleOpenMedia} />
            </motion.div>
          ) : screenToRender === 'pinned-messages' ? (
            <motion.div
              key="pinned-messages"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col"
            >
              <PinnedMessagesView onNavigate={handleNavigate} />
            </motion.div>
          ) : screenToRender === 'app-settings' ? (
            <motion.div
              key="app-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col"
            >
              <AppSettingsModal onNavigate={handleNavigate} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
