
import React from 'react';
import { CameraMode } from '../types';
import { CameraFlipIcon } from './Icons';

interface CameraControlsProps {
  mode: CameraMode;
  setMode: (mode: CameraMode) => void;
  onShutter: () => void;
  onFlip: () => void;
  lastCapture: string | null;
}

const CameraControls: React.FC<CameraControlsProps> = ({ mode, setMode, onShutter, onFlip, lastCapture }) => {
  const modes: CameraMode[] = ['ai', 'photo', 'video'];

  const shutterColor = mode === 'video' ? 'bg-red-500' : 'bg-white';

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-8 pt-4 bg-gradient-to-t from-black/70 to-transparent">
      {/* Mode Selector */}
      <div className="flex items-center space-x-6 mb-6 text-sm font-bold">
        {modes.map(m => (
          <button key={m} onClick={() => setMode(m)} className={mode === m ? 'text-yellow-400' : 'text-white'}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Action Row */}
      <div className="flex justify-around items-center w-full px-4">
        <div className="w-16 h-16 flex items-center justify-center">
          {lastCapture ? (
            <img src={lastCapture} alt="Last capture" className="w-12 h-12 rounded-lg border-2 border-white object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-800" />
          )}
        </div>

        <button onClick={onShutter} className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center p-1">
          <div className={`w-full h-full rounded-full ${shutterColor} transition-colors`} />
        </button>

        <button onClick={onFlip} className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-800">
            <CameraFlipIcon />
        </button>
      </div>
    </div>
  );
};

export default CameraControls;
