import React from 'react';
import { motion } from 'framer-motion';
import { BoundingBoxIcon } from './Icons';
import { cn } from '../utils/cn';

interface VisionControlsProps {
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  uniqueLabels: string[];
  activeFilterLabels: Set<string>;
  onFilterToggle: (label: string) => void;
  onManualTag: () => void;
  isTagging: boolean;
}

const VisionControls: React.FC<VisionControlsProps> = ({
  sensitivity,
  onSensitivityChange,
  uniqueLabels,
  activeFilterLabels,
  onFilterToggle,
  onManualTag,
  isTagging,
}) => {
  return (
    <motion.div
      className="absolute bottom-24 left-0 right-0 bg-black/70 backdrop-blur-md p-4 pt-2 z-10 rounded-t-2xl"
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '100%' }}
      transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
    >
      {/* Sensitivity Slider */}
      <div className="mb-3">
        <label htmlFor="sensitivity" className="text-xs text-gray-300 block mb-1">
          Detection Sensitivity
        </label>
        <div className="flex items-center gap-3">
            <input
              id="sensitivity"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={sensitivity}
              onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-400"
            />
            <span className="text-sm font-mono w-10 text-center">{sensitivity.toFixed(2)}</span>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300">Filters</span>
            {activeFilterLabels.size > 0 && 
              <button onClick={() => uniqueLabels.forEach(l => onFilterToggle(l))} className="text-xs text-yellow-400">Clear</button>
            }
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {uniqueLabels.length > 0 ? uniqueLabels.map(label => (
            <button
              key={label}
              onClick={() => onFilterToggle(label)}
              className={cn(
                'px-3 py-1 text-sm rounded-full border transition-colors duration-200 whitespace-nowrap',
                activeFilterLabels.has(label)
                  ? 'bg-yellow-400 text-black border-yellow-400'
                  : 'bg-gray-700/50 text-white border-gray-600'
              )}
            >
              {label}
            </button>
          )) : <p className="text-xs text-gray-500 italic">Point camera at objects to see filters</p>}
        </div>
      </div>
      
      {/* Manual Tag */}
       <div>
        <button 
            onClick={onManualTag}
            className={cn(
                "w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors",
                isTagging ? "bg-yellow-500 text-black animate-pulse" : "bg-gray-700 text-white"
            )}
        >
            <BoundingBoxIcon isActive={isTagging} />
            <span className="font-bold text-sm">{isTagging ? "Tap and drag to draw box" : "Manually Tag Object"}</span>
        </button>
       </div>

    </motion.div>
  );
};

export default VisionControls;