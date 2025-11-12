
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { generateChatResponse, editImageWithPrompt } from '../services/geminiService';
import type { AiChatMessage, GroundingSource } from '../types';
import Message from './Message';
import LiveConversationOverlay from './LiveConversationOverlay';
import { SendIcon, MicIcon, CloseIcon, LoadingSpinner, SearchIcon, MapIcon } from './Icons';

const ChatView: React.FC = () => {
  const { imageForChat, clearImageForChat, initialChatPrompt, clearInitialChatPrompt } = useAppStore();

  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAttachedImage(imageForChat);
  }, [imageForChat]);

  useEffect(() => {
    if (initialChatPrompt) {
        setInput(initialChatPrompt);
        clearInitialChatPrompt();
    }
  }, [initialChatPrompt, clearInitialChatPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);
  
  useEffect(() => {
    if (useMaps && !location) {
        navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => {
                console.warn(`Geolocation error: ${err.message}`);
                setUseMaps(false);
            }
        );
    }
  }, [useMaps, location]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: AiChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentImage = attachedImage;
    setInput('');
    setIsLoading(true);

    try {
      const isEditPrompt = /\b(edit|add|remove|change|make|turn)\b/i.test(currentInput);

      if (currentImage && isEditPrompt) {
        const base64Data = currentImage.split(',')[1];
        const newBase64 = await editImageWithPrompt(currentInput, { mimeType: 'image/jpeg', data: base64Data });
        setAttachedImage(`data:image/jpeg;base64,${newBase64}`);
        const botMessage: AiChatMessage = { sender: 'bot', text: "Here is the edited image." };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const imagePart = currentImage ? { mimeType: 'image/jpeg', data: currentImage.split(',')[1] } : null;
        const response = await generateChatResponse(currentInput, imagePart, { useSearch, useMaps, location: location ?? undefined });
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        const sources: GroundingSource[] = groundingChunks?.map((chunk: any) => {
            if (chunk.web && chunk.web.uri) {
                return { type: 'web', uri: chunk.web.uri, title: chunk.web.title || '' };
            }
            if (chunk.maps && chunk.maps.uri) {
                return { type: 'maps', uri: chunk.maps.uri, title: chunk.maps.title || '' };
            }
            return null;
        }).filter((s: any): s is GroundingSource => s !== null) ?? [];
        
        const botMessage: AiChatMessage = { sender: 'bot', text: response.text, sources };
        setMessages(prev => [...prev, botMessage]);
      }
      
      if(attachedImage){
          setAttachedImage(null);
          clearImageForChat();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorBotMessage: AiChatMessage = { sender: 'bot', text: `Error: ${errorMessage}` };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRemoveImage = () => {
      setAttachedImage(null);
      clearImageForChat();
  }

  return (
    <div className="h-full w-full bg-black flex flex-col pt-10 pb-24">
        <h1 className="text-xl font-bold text-center text-white fixed top-0 left-0 right-0 py-4 bg-black/80 backdrop-blur-md z-10">AI Chat</h1>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 && !attachedImage && (
                <div className="h-full flex flex-col justify-center items-center text-center text-gray-400">
                    <p className="text-lg">Welcome to AI Chat</p>
                    <p className="text-sm">Go to the Camera tab and use VISION mode to start a conversation about an image.</p>
                </div>
            )}
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10, x: isUser ? 20 : -20 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                >
                  <Message message={msg} />
                </motion.div>
              );
            })}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 10, x: -20 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                    className="flex justify-start"
                >
                    <div className="bg-gray-700 rounded-2xl p-3">
                        <LoadingSpinner />
                    </div>
                </motion.div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="fixed bottom-24 left-0 right-0 p-4 bg-black/80 backdrop-blur-md">
            {attachedImage && (
                <div className="relative w-24 h-24 mb-2">
                    <img src={attachedImage} alt="Attached for chat" className="rounded-lg object-cover w-full h-full" />
                    <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-gray-700 rounded-full p-1 text-white">
                        <CloseIcon />
                    </button>
                </div>
            )}
            <div className="flex items-center space-x-2">
                <div id="onboarding-chat-input" className="flex-1 bg-gray-800 border border-gray-700 rounded-full flex items-center pr-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask Gemini..."
                        className="flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-400 focus:outline-none"
                        disabled={isLoading}
                    />
                    <div id="onboarding-ai-tools" className="flex items-center">
                      <button onClick={() => setUseSearch(!useSearch)}><SearchIcon active={useSearch} /></button>
                      <button onClick={() => setUseMaps(!useMaps)} className="ml-2"><MapIcon active={useMaps} /></button>
                    </div>
                </div>
                <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-yellow-500 text-black rounded-full disabled:bg-gray-600">
                    <SendIcon />
                </button>
                 <button id="onboarding-mic" onClick={() => setIsLiveOpen(true)} className="p-3 rounded-full bg-gray-700 text-white">
                    <MicIcon isListening={false} />
                </button>
            </div>
        </div>
        <AnimatePresence>
            {isLiveOpen && <LiveConversationOverlay onClose={() => setIsLiveOpen(false)} />}
        </AnimatePresence>
    </div>
  );
};

export default ChatView;