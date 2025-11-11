
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraMode } from '../types';
import CameraControls from './CameraControls';
import AiOverlay from './AiOverlay';
import { CameraFlipIcon, FlashIcon } from './Icons';

const CameraView: React.FC = () => {
  const [mode, setMode] = useState<CameraMode>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiCapture, setAiCapture] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: mode === 'video',
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      // TODO: Show an error message to the user
    }
  }, [facingMode, mode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [facingMode, mode]);

  const handleFlipCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const takePicture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        if (mode === 'ai') {
          setAiCapture(dataUrl);
          setIsAiPanelOpen(true);
        } else {
          setLastCapture(dataUrl);
        }
      }
    }
  }, [mode]);

  const handleShutter = () => {
    if (mode === 'photo' || mode === 'ai') {
      takePicture();
    } else {
      // TODO: Implement video recording
    }
  };

  return (
    <div className="relative h-full w-full bg-black flex flex-col justify-between">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
        <button className="text-white p-2 rounded-full bg-black/30">
          <FlashIcon />
        </button>
      </div>

      <CameraControls
        mode={mode}
        setMode={setMode}
        onShutter={handleShutter}
        onFlip={handleFlipCamera}
        lastCapture={lastCapture}
      />
        
      {isAiPanelOpen && aiCapture && (
        <AiOverlay 
          imageDataUrl={aiCapture}
          onClose={() => setIsAiPanelOpen(false)}
        />
      )}
    </div>
  );
};

export default CameraView;
