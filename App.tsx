import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraView from './components/CameraView';
import ChatView from './components/ChatView';
import GalleryView from './components/GalleryView';
import BottomNavBar from './components/BottomNavBar';
import Onboarding from './components/Onboarding';
import { useAppStore } from './store';
import { dbService } from './services/dbService';

const viewVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

const App: React.FC = () => {
  const { appView, initStore, isStoreInitialized } = useAppStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnboardingCheckDone, setIsOnboardingCheckDone] = useState(false);

  // Initialize the store from IndexedDB on app startup
  useEffect(() => {
    initStore();
  }, [initStore]);

  // Simple direction logic based on view index
  const viewOrder = ['gallery', 'camera', 'chat'];
  const currentIndex = viewOrder.indexOf(appView);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  
  useEffect(() => {
    setPrevIndex(currentIndex);
  }, [currentIndex]);
  
  const direction = currentIndex > prevIndex ? 1 : -1;

  // Check onboarding status once the store is initialized
  useEffect(() => {
    if (!isStoreInitialized) return;

    const checkOnboardingStatus = async () => {
        try {
            const hasCompleted = await dbService.getSetting<boolean>('hasCompletedOnboarding');
            if (!hasCompleted) {
                setShowOnboarding(true);
            }
        } catch (e) {
            console.error("Could not access IndexedDB for onboarding check, showing as a fallback:", e);
            setShowOnboarding(true);
        } finally {
            setIsOnboardingCheckDone(true);
        }
    };
    checkOnboardingStatus();
  }, [isStoreInitialized]);

  const handleOnboardingFinish = async () => {
    try {
        await dbService.setSetting('hasCompletedOnboarding', true);
    } catch (e) {
        console.error("Could not write to IndexedDB:", e);
    }
    setShowOnboarding(false);
  };
  
  // Render nothing until the store is loaded and onboarding status is checked to prevent UI flash
  if (!isStoreInitialized || !isOnboardingCheckDone) {
      return null;
  }

  return (
    <div className="h-full w-full bg-black font-sans select-none relative overflow-hidden">
      <AnimatePresence initial={false} custom={direction}>
        {appView === 'camera' && (
          <motion.div
            key="camera"
            custom={direction}
            variants={viewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
            className="absolute top-0 left-0 h-full w-full"
          >
            <CameraView />
          </motion.div>
        )}
        {appView === 'chat' && (
          <motion.div
            key="chat"
            custom={direction}
            variants={viewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
            className="absolute top-0 left-0 h-full w-full"
          >
            <ChatView />
          </motion.div>
        )}
        {appView === 'gallery' && (
          <motion.div
            key="gallery"
            custom={direction}
            variants={viewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
            className="absolute top-0 left-0 h-full w-full"
          >
            <GalleryView />
          </motion.div>
        )}
      </AnimatePresence>
      
      <BottomNavBar />
      
      <AnimatePresence>
        {showOnboarding && <Onboarding onFinish={handleOnboardingFinish} />}
      </AnimatePresence>
    </div>
  );
};

export default App;
