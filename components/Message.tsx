
import React, { useRef, useState, useMemo } from 'react';
import type { AiChatMessage } from '../types';
import { cn } from '../utils/cn';
import { SpeakerIcon, LoadingSpinner, SearchIcon, MapIcon } from './Icons';
import { textToSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface MessageProps {
  message: AiChatMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { webSources, mapSources } = useMemo(() => {
    const webSources = message.sources?.filter(s => s.type === 'web');
    const mapSources = message.sources?.filter(s => s.type === 'maps');
    return { webSources, mapSources };
  }, [message.sources]);

  const handleSpeak = async () => {
    if (isSpeaking || !message.text) return;
    setIsSpeaking(true);
    
    try {
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const base64Audio = await textToSpeech(message.text);
      const decodedBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-end space-x-2 max-w-full">
        <div className={cn(
            'max-w-xs md:max-w-md p-3 rounded-2xl', 
            isUser ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'
        )}>
          <p className="whitespace-pre-wrap text-sm break-words">{message.text}</p>
        </div>
        {!isUser && message.text && (
          <button onClick={handleSpeak} className="p-1.5 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors self-end mb-1" disabled={isSpeaking}>
            {isSpeaking ? <LoadingSpinner /> : <SpeakerIcon />}
          </button>
        )}
      </div>
      {((webSources && webSources.length > 0) || (mapSources && mapSources.length > 0)) && (
          <div className="mt-2 space-y-3 max-w-xs md:max-w-md">
              {webSources && webSources.length > 0 && (
                <div className="border-l-2 border-gray-700 pl-2">
                    <h4 className="text-xs font-semibold text-gray-400 mb-1 flex items-center">
                        <SearchIcon active={true} size={14} /> 
                        <span className="ml-1.5">Sources from the web</span>
                    </h4>
                    <div className="flex flex-col items-start gap-1">
                        {webSources.map((source, index) => (
                            <a 
                                href={source.uri} 
                                key={`web-${index}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline"
                                title={source.title || source.uri}
                            >
                               <p className="truncate">{source.title || new URL(source.uri).hostname}</p>
                            </a>
                        ))}
                    </div>
                </div>
              )}
              {mapSources && mapSources.length > 0 && (
                <div className="border-l-2 border-gray-700 pl-2">
                     <h4 className="text-xs font-semibold text-gray-400 mb-1 flex items-center">
                        <MapIcon active={true} size={14} /> 
                        <span className="ml-1.5">Places from Maps</span>
                     </h4>
                     <div className="flex flex-col items-start gap-1">
                        {mapSources.map((source, index) => (
                            <a 
                                href={source.uri} 
                                key={`map-${index}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-green-400 hover:underline"
                                title={source.title || source.uri}
                            >
                                <p className="truncate">{source.title || new URL(source.uri).hostname}</p>
                            </a>
                        ))}
                    </div>
                </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Message;