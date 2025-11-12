
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraView from './components/CameraView';
import ChatView from './components/ChatView';
import GalleryView from './components/GalleryView';
import BottomNavBar from './components/BottomNavBar';
import Onboarding from './components/Onboarding';
import { useAppStore } from './store';

// --- IndexedDB Helpers ---
const DB_NAME = 'AICameraDB';
const STORE_NAME = 'settings';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;
const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    } catch (e) {
        reject(e);
    }
  });
  return dbPromise;
};
const getSetting = <T,>(key: string): Promise<T | undefined> => {
  return new Promise(async (resolve, reject) => {
    try {
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            resolve(request.result ? request.result.value : undefined);
        };
    } catch (e) { reject(e); }
  });
};
const setSetting = <T,>(key: string, value: T): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ key, value });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    } catch (e) { reject(e); }
  });
};
// --- End IndexedDB Helpers ---

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
  const appView = useAppStore((state) => state.appView);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStatusChecked, setOnboardingStatusChecked] = useState(false);

  // Simple direction logic based on view index
  const viewOrder = ['gallery', 'camera', 'chat'];
  const currentIndex = viewOrder.indexOf(appView);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  
  useEffect(() => {
    setPrevIndex(currentIndex);
  }, [currentIndex]);
  
  const direction = currentIndex > prevIndex ? 1 : -1;

  useEffect(() => {
    const checkOnboardingStatus = async () => {
        try {
            const hasCompleted = await getSetting<boolean>('hasCompletedOnboarding');
            if (!hasCompleted) {
                setShowOnboarding(true);
            }
        } catch (e) {
            console.error("Could not access IndexedDB, showing onboarding as a fallback:", e);
            setShowOnboarding(true);
        } finally {
            setOnboardingStatusChecked(true);
        }
    };
    checkOnboardingStatus();
  }, []);

  const handleOnboardingFinish = async () => {
    try {
        await setSetting('hasCompletedOnboarding', true);
    } catch (e) {
        console.error("Could not write to IndexedDB:", e);
    }
    setShowOnboarding(false);
  };
  
  if (!onboardingStatusChecked) {
      return null; // Render nothing until we've checked onboarding status to prevent UI flash
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
