
import React, { useRef, useState } from 'react';
import type { AiChatMessage } from '../types';
import { cn } from '../utils/cn';
import { SpeakerIcon, LoadingSpinner } from './Icons';
import { textToSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface MessageProps {
  message: AiChatMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 max-w-xs md:max-w-md">
              {message.sources.map((source, index) => (
                  <a 
                    href={source.uri} 
                    key={index}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs bg-gray-800 text-blue-300 px-2 py-1 rounded-full truncate hover:underline"
                    title={source.title || source.uri}
                  >
                    {new URL(source.uri).hostname}
                  </a>
              ))}
          </div>
      )}
    </div>
  );
};

export default Message;
