
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraView from './components/CameraView';
import ChatView from './components/ChatView';
import BottomNavBar from './components/BottomNavBar';
import { useAppStore } from './store';

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
  const direction = appView === 'camera' ? -1 : 1;

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
      </AnimatePresence>
      
      <BottomNavBar />
    </div>
  );
};

export default App;
