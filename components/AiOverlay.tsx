
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { analyzeCapturedImage } from '../services/geminiService';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import type { AiChatMessage } from '../types';
import Message from './Message';
import { SendIcon, MicIcon, CloseIcon, LoadingSpinner } from './Icons';

interface AiOverlayProps {
  imageDataUrl: string;
  onClose: () => void;
}

interface LiveSession {
  sendRealtimeInput(input: { media: { data: string; mimeType: string } }): void;
  close(): void;
}

const AiOverlay: React.FC<AiOverlayProps> = ({ imageDataUrl, onClose }) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLiveRef = useRef(false);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioResourcesRef = useRef<{
      stream: MediaStream | null;
      inputContext: AudioContext | null;
      outputContext: AudioContext | null;
      processor: ScriptProcessorNode | null;
      source: MediaStreamAudioSourceNode | null;
  }>({ stream: null, inputContext: null, outputContext: null, processor: null, source: null });


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  const handleSend = useCallback(async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: AiChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const base64Data = imageDataUrl.split(',')[1];
      const responseText = await analyzeCapturedImage(currentInput, {
        mimeType: 'image/jpeg',
        data: base64Data
      });
      const botMessage: AiChatMessage = { sender: 'bot', text: responseText };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorBotMessage: AiChatMessage = { sender: 'bot', text: `Error: ${errorMessage}` };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, imageDataUrl]);

  const cleanupLiveConversation = useCallback(async () => {
    isLiveRef.current = false;
    const resources = audioResourcesRef.current;
    
    resources.stream?.getTracks().forEach(track => track.stop());
    resources.processor?.disconnect();
    resources.source?.disconnect();
    if (resources.inputContext?.state !== 'closed') await resources.inputContext?.close();
    
    Object.keys(resources).forEach(key => (resources as any)[key] = null);

    if (sessionPromiseRef.current) {
        const promise = sessionPromiseRef.current;
        sessionPromiseRef.current = null;
        try {
            const session = await promise;
            session.close();
        } catch (e) { console.error("Error closing session:", e); }
    }
  }, []);

  const toggleLiveConversation = useCallback(async () => {
    if (isLiveRef.current) {
      setIsListening(false);
      await cleanupLiveConversation();
      return;
    }

    setIsListening(true);
    isLiveRef.current = true;
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const resources = audioResourcesRef.current;
    resources.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

    try {
        resources.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: { responseModalities: [Modality.AUDIO] },
            callbacks: {
                onopen: () => {
                    resources.inputContext = new AudioContext({ sampleRate: 16000 });
                    resources.source = resources.inputContext.createMediaStreamSource(resources.stream!);
                    resources.processor = resources.inputContext.createScriptProcessor(4096, 1, 1);
                    
                    resources.processor.onaudioprocess = (event) => {
                        if (!isLiveRef.current) return;
                        const inputData = event.inputBuffer.getChannelData(0);
                        const int16 = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromiseRef.current?.then(session => {
                            if (isLiveRef.current) session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    resources.source.connect(resources.processor);
                    resources.processor.connect(resources.inputContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && resources.outputContext) {
                        nextStartTime = Math.max(nextStartTime, resources.outputContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), resources.outputContext, 24000, 1);
                        const sourceNode = resources.outputContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(resources.outputContext.destination);
                        sourceNode.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                    }
                },
                onclose: () => {
                    setIsListening(false);
                    cleanupLiveConversation();
                },
                onerror: (e) => {
                    console.error("Live session error:", e);
                    setIsListening(false);
                    cleanupLiveConversation();
                }
            }
        });

    } catch (err) {
        console.error("Microphone access error:", err);
        setIsListening(false);
        await cleanupLiveConversation();
    }
  }, [cleanupLiveConversation]);

  useEffect(() => {
    return () => {
        cleanupLiveConversation();
    };
  }, [cleanupLiveConversation]);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col animate-fade-in">
        <div className="flex-shrink-0 p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold">AI Assistant</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50">
                <CloseIcon />
            </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-4">
            <div className="w-full">
                <img src={imageDataUrl} alt="Analysis subject" className="rounded-lg max-h-48 w-auto mx-auto" />
            </div>
            <div className="flex-1 space-y-4">
                {messages.map((msg, index) => <Message key={index} message={msg} />)}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 rounded-2xl p-3">
                            <LoadingSpinner />
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
        </div>
        <div className="flex-shrink-0 p-4 bg-black/50">
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about the image..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-yellow-500 text-black rounded-full disabled:bg-gray-600">
                    <SendIcon />
                </button>
                 <button onClick={toggleLiveConversation} className={`p-3 rounded-full transition-colors ${isListening ? 'bg-cyan-500' : 'bg-gray-700'}`}>
                    <MicIcon isListening={isListening} />
                </button>
            </div>
        </div>
    </div>
  );
};

export default AiOverlay;
