
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraMode, FlashMode } from '../types';
import CameraControls from './CameraControls';
import { FlashOnIcon, FlashOffIcon, FlashAutoIcon } from './Icons';
import { useAppStore } from '../store';

const CameraView: React.FC = () => {
  const setImageForChat = useAppStore((state) => state.setImageForChat);

  const [mode, setMode] = useState<CameraMode>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isFlashAvailable, setIsFlashAvailable] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

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
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        setIsFlashAvailable(!!(capabilities as any).torch);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsFlashAvailable(false);
    }
  }, [facingMode, mode]);

  useEffect(() => {
    startCamera();
  }, [facingMode, mode, startCamera]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [stream]);
  
  useEffect(() => {
    if (!stream || !isFlashAvailable) return;

    const track = stream.getVideoTracks()[0];
    const torchState = flashMode === 'on';
    
    if (track.readyState === 'live') {
      track.applyConstraints({ advanced: [{ torch: torchState }] } as any)
        .catch(e => console.error("Could not apply flash constraints:", e));
    }
  }, [stream, flashMode, isFlashAvailable]);

  const handleFlipCamera = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    setTimeout(() => setIsFlipping(false), 500); // Duration matches CSS transition
  };
  
  const handleToggleFlash = () => {
    if (!isFlashAvailable) return;
    const nextMode: Record<FlashMode, FlashMode> = {
      off: 'on',
      on: 'auto',
      auto: 'off',
    };
    setFlashMode(prev => nextMode[prev]);
  };

  const takePicture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
            ctx.restore();
        } else {
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        }
        const dataUrl = canvas.toDataURL('image/jpeg');
        if (mode === 'vision') {
          setImageForChat(dataUrl);
        } else {
          setLastCapture(dataUrl);
        }
      }
    }
  }, [mode, setImageForChat, facingMode]);

  const handleShutter = () => {
    if (mode === 'photo' || mode === 'vision') {
      takePicture();
    }
  };

  const renderFlashIcon = () => {
    switch (flashMode) {
      case 'on': return <FlashOnIcon />;
      case 'auto': return <FlashAutoIcon />;
      case 'off':
      default: return <FlashOffIcon />;
    }
  };

  return (
    <div className="relative h-full w-full bg-black flex flex-col justify-between">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent z-10">
        <button 
          onClick={handleToggleFlash}
          disabled={!isFlashAvailable}
          className="text-white p-2 rounded-full bg-black/30 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Turn flash ${flashMode}`}
        >
          {renderFlashIcon()}
        </button>
      </div>

      <div className="absolute bottom-24 left-0 right-0 z-10">
          <CameraControls
            mode={mode}
            setMode={setMode}
            onShutter={handleShutter}
            onFlip={handleFlipCamera}
            lastCapture={lastCapture}
            facingMode={facingMode}
            isFlipping={isFlipping}
          />
      </div>
    </div>
  );
};

export default CameraView;
