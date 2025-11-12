
import React from 'react';
import { motion } from 'framer-motion';
import { CameraMode, GalleryItem } from '../types';
import { cn } from '../utils/cn';
import { CameraFlipIcon, PlayIcon } from './Icons';

interface CameraControlsProps {
  mode: CameraMode;
  setMode: (mode: CameraMode) => void;
  onShutter: () => void;
  onFlip: () => void;
  lastCapture: GalleryItem | null;
  facingMode: 'user' | 'environment';
  isFlipping: boolean;
  isRecording: boolean;
}

const CameraControls: React.FC<CameraControlsProps> = ({ mode, setMode, onShutter, onFlip, lastCapture, facingMode, isFlipping, isRecording }) => {
  const modes: CameraMode[] = ['photo', 'video', 'vision'];
  const shutterColor = mode === 'video' ? 'bg-red-500' : 'bg-white';

  return (
    <div className="w-full flex flex-col items-center pb-8 pt-4 bg-gradient-to-t from-black/70 to-transparent">
      <div id="onboarding-camera-modes" className="relative flex items-center space-x-6 mb-6 text-sm font-bold">
        {modes.map((m) => (
          <button 
            key={m} 
            onClick={() => !isRecording && setMode(m)} 
            className="relative px-2 py-1 text-white disabled:text-gray-500"
            disabled={isRecording}
          >
            <span className={cn('relative z-10 transition-colors duration-300', mode === m && !isRecording ? 'text-black' : 'text-white')}>
              {m.toUpperCase()}
            </span>
            {mode === m && (
              <motion.div 
                layoutId="activeModeIndicator"
                className="absolute inset-0 bg-yellow-400 rounded-full z-0"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-around items-center w-full px-4">
        <div className="w-16 h-16 flex items-center justify-center">
          {lastCapture ? (
            <div className="relative w-12 h-12 rounded-lg border-2 border-white overflow-hidden">
                {lastCapture.type === 'photo' ? (
                     <img src={lastCapture.src} alt="Last capture" className="w-full h-full object-cover" />
                ) : (
                    <>
                        <video src={lastCapture.src} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <PlayIcon />
                        </div>
                    </>
                )}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-800" />
          )}
        </div>

        <motion.button 
            id="onboarding-shutter"
            onClick={onShutter} 
            className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center p-1"
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className={cn('w-full h-full border-4 border-black/50 transition-all duration-200', shutterColor, isRecording ? 'rounded-xl' : 'rounded-full')} />
        </motion.button>

        <motion.button 
          onClick={onFlip} 
          disabled={isFlipping || isRecording}
          className={cn(
            'w-16 h-16 flex items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
            facingMode === 'user' ? 'bg-gray-600' : 'bg-gray-800/80'
          )}
          aria-label={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
          whileTap={{ scale: isFlipping ? 1 : 0.9 }}
        >
            <CameraFlipIcon isFlipping={isFlipping} />
        </motion.button>
      </div>
    </div>
  );
};

export default CameraControls;