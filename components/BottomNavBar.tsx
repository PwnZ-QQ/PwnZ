
import React from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils/cn';
import { CameraIcon, ChatIcon } from './Icons';

const BottomNavBar: React.FC = () => {
    const { appView: currentView, setView } = useAppStore();

    return (
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-black/80 backdrop-blur-md flex justify-around items-center border-t border-gray-800 z-20">
            <button onClick={() => setView('camera')} className="flex flex-col items-center justify-center text-white transition-colors duration-200 w-20">
                <CameraIcon isActive={currentView === 'camera'} />
                <span className={cn('text-xs mt-1', currentView === 'camera' ? 'text-yellow-400' : 'text-gray-400')}>Camera</span>
            </button>
            <button onClick={() => setView('chat')} className="flex flex-col items-center justify-center text-white transition-colors duration-200 w-20">
                <ChatIcon isActive={currentView === 'chat'} />
                <span className={cn('text-xs mt-1', currentView === 'chat' ? 'text-yellow-400' : 'text-gray-400')}>Chat</span>
            </button>
        </div>
    );
};

export default BottomNavBar;
