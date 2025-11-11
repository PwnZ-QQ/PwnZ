
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { MicIcon, CloseIcon } from './Icons';

interface LiveSession {
  sendRealtimeInput(input: { media: { data: string; mimeType: string } }): void;
  close(): void;
}

interface LiveConversationOverlayProps {
  onClose: () => void;
}

const LiveConversationOverlay: React.FC<LiveConversationOverlayProps> = ({ onClose }) => {
  const [transcription, setTranscription] = useState<{ user: string, bot: string }>({ user: '', bot: '' });
  const [isListening, setIsListening] = useState(false);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);

  const audioResourcesRef = useRef<{
      stream: MediaStream | null;
      inputContext: AudioContext | null;
      outputContext: AudioContext | null;
      processor: ScriptProcessorNode | null;
      source: MediaStreamAudioSourceNode | null;
  }>({ stream: null, inputContext: null, outputContext: null, processor: null, source: null });

  const cleanup = useCallback(async () => {
    const resources = audioResourcesRef.current;
    resources.stream?.getTracks().forEach(track => track.stop());
    resources.processor?.disconnect();
    resources.source?.disconnect();
    if (resources.inputContext?.state !== 'closed') await resources.inputContext?.close().catch(e => console.error(e));
    if (resources.outputContext?.state !== 'closed') await resources.outputContext?.close().catch(e => console.error(e));
    
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

  const startConversation = useCallback(async () => {
    setIsListening(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const resources = audioResourcesRef.current;
    resources.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

    let currentUserTranscription = '';
    let currentBotTranscription = '';

    try {
      resources.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            resources.inputContext = new AudioContext({ sampleRate: 16000 });
            resources.source = resources.inputContext.createMediaStreamSource(resources.stream!);
            resources.processor = resources.inputContext.createScriptProcessor(4096, 1, 1);

            resources.processor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
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
            if (message.serverContent?.inputTranscription) {
                currentUserTranscription += message.serverContent.inputTranscription.text;
                setTranscription({ user: currentUserTranscription, bot: currentBotTranscription });
            }
            if (message.serverContent?.outputTranscription) {
                currentBotTranscription += message.serverContent.outputTranscription.text;
                setTranscription({ user: currentUserTranscription, bot: currentBotTranscription });
            }
            if (message.serverContent?.turnComplete) {
                currentUserTranscription = '';
                currentBotTranscription = '';
            }
          },
          onclose: () => { setIsListening(false); cleanup(); onClose(); },
          onerror: (e) => { console.error("Live session error:", e); setIsListening(false); cleanup(); onClose(); }
        }
      });
    } catch (err) {
      console.error("Mic access error:", err);
      setIsListening(false);
      cleanup();
      onClose();
    }
  }, [cleanup, onClose]);

  useEffect(() => {
    startConversation();
    return () => {
      cleanup();
    };
  }, [startConversation, cleanup]);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center z-50"
    >
      <button onClick={handleClose} className="absolute top-5 right-5 p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-white">
        <CloseIcon />
      </button>

      <div className="text-center p-4">
        <p className="text-gray-400 text-lg mb-2">You:</p>
        <p className="text-white text-2xl min-h-[3rem]">{transcription.user || '...'}</p>
      </div>

      <div className="my-12">
        <button onClick={handleClose} className="text-white">
            <MicIcon isListening={isListening} />
        </button>
      </div>

      <div className="text-center p-4">
        <p className="text-cyan-400 text-lg mb-2">AI:</p>
        <p className="text-white text-2xl min-h-[3rem]">{transcription.bot || '...'}</p>
      </div>
    </motion.div>
  );
};

export default LiveConversationOverlay;
