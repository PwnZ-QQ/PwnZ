import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { CameraMode, FlashMode, GalleryItem, DetectedObject } from '../types';
import CameraControls from './CameraControls';
import VisionControls from './VisionControls';
import { FlashOnIcon, FlashOffIcon, FlashAutoIcon, CloseIcon, InfoIcon, CategoryIcon, PercentIcon, ChatIcon } from './Icons';
import { useAppStore } from '../store';
import { cn } from '../utils/cn';
import { playSound } from '../utils/audioCues';
import { detectObjectsInImage } from '../services/geminiService';

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

type ResolutionKey = 'default' | 'hd' | 'fhd' | 'uhd';
type VideoQualityKey = '720p' | '1080p' | '4k';
type AspectRatioKey = '4:3' | '16:9' | '1:1';

const RESOLUTION_OPTIONS: Record<ResolutionKey, { label: string; constraints: MediaTrackConstraints }> = {
  'default': { label: 'SD', constraints: { width: { ideal: 640 }, height: { ideal: 480 } } },
  'hd': { label: 'HD', constraints: { width: { ideal: 1280 }, height: { ideal: 720 } } },
  'fhd': { label: 'FHD', constraints: { width: { ideal: 1920 }, height: { ideal: 1080 } } },
  'uhd': { label: '4K', constraints: { width: { ideal: 3840 }, height: { ideal: 2160 } } },
};
const RESOLUTION_ORDER: ResolutionKey[] = ['default', 'hd', 'fhd', 'uhd'];

const VIDEO_QUALITY_OPTIONS: Record<VideoQualityKey, { label: string; constraints: MediaTrackConstraints }> = {
  '720p': { label: '720p', constraints: { width: { ideal: 1280 }, height: { ideal: 720 } } },
  '1080p': { label: '1080p', constraints: { width: { ideal: 1920 }, height: { ideal: 1080 } } },
  '4k': { label: '4K', constraints: { width: { ideal: 3840 }, height: { ideal: 2160 } } },
};
const VIDEO_QUALITY_ORDER: VideoQualityKey[] = ['720p', '1080p', '4k'];

const ASPECT_RATIO_OPTIONS: Record<AspectRatioKey, { label: string; value: number }> = {
    '4:3': { label: '4:3', value: 4/3 },
    '16:9': { label: '16:9', value: 16/9 },
    '1:1': { label: '1:1', value: 1/1 },
};
const ASPECT_RATIO_ORDER: AspectRatioKey[] = ['4:3', '16:9', '1:1'];

const focusBoxVariants: Variants = {
  idle: { scale: 1 },
  focusing: { scale: 1 },
  focused: { scale: 1.1, transition: { type: 'spring', stiffness: 400, damping: 15 } },
};

const cornerVariants: Variants = {
  focusing: {
    borderColor: '#facc15',
    scale: [1, 1.1, 1],
    transition: {
      scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
      borderColor: { duration: 0.2 },
    },
  },
  focused: {
    borderColor: '#4ade80',
    scale: 1,
    transition: { duration: 0.2 },
  },
};

const triggerHapticFeedback = (duration: number | number[]) => {
    if (navigator.vibrate) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            console.warn("Haptic feedback is not supported or failed.", e);
        }
    }
};

const CameraView: React.FC = () => {
  const { addToGallery, setImageForChat } = useAppStore();
  const [mode, setMode] = useState<CameraMode>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastCapture, setLastCapture] = useState<GalleryItem | null>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isFlashAvailable, setIsFlashAvailable] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  
  const [zoomRange, setZoomRange] = useState<{ min: number, max: number, step: number } | null>(null);
  const [isFocusPointSupported, setIsFocusPointSupported] = useState(false);
  const [focusIndicator, setFocusIndicator] = useState<{ x: number, y: number, visible: boolean }>({ x: 0, y: 0, visible: false });
  const [focusState, setFocusState] = useState<'idle' | 'focusing' | 'focused'>('idle');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionKey>('hd');
  const [selectedVideoQuality, setSelectedVideoQuality] = useState<VideoQualityKey>('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioKey>('4:3');

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Vision mode state
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [uniqueLabels, setUniqueLabels] = useState<Set<string>>(new Set());
  const [activeFilterLabels, setActiveFilterLabels] = useState<Set<string>>(new Set());
  const [isTagging, setIsTagging] = useState(false);
  const [taggingBox, setTaggingBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [taggingStart, setTaggingStart] = useState<{ x: number; y: number } | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const pinchDistRef = useRef<number>(0);
  const currentZoomRef = useRef<number>(1);
  const focusTimeoutRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const visionLoopRef = useRef<number | null>(null);

  const handleCameraError = useCallback((err: any) => {
    let message = "An unknown error occurred while trying to access the camera. Please try again.";
    if (err instanceof DOMException) {
        switch (err.name) {
            case 'NotAllowedError':
                message = "Camera access denied. To continue, please grant camera permission in your browser's settings.";
                break;
            case 'NotFoundError':
            case 'DevicesNotFoundError': // Some browsers use this
                message = "No camera was found on your device. Please ensure a camera is connected and enabled.";
                break;
            case 'NotReadableError':
            case 'TrackStartError': // Some browsers use this
                message = "The camera is currently unavailable. It might be in use by another application or there's a hardware issue. Please close other apps and try again.";
                break;
            case 'OverconstrainedError':
                message = mode === 'video'
                    ? `The selected video quality (${VIDEO_QUALITY_OPTIONS[selectedVideoQuality].label}) is not supported by your device.`
                    : `The selected settings (${RESOLUTION_OPTIONS[selectedResolution].label}, ${ASPECT_RATIO_OPTIONS[selectedAspectRatio].label}) are not supported by your device. Please try a different combination of settings.`;
                break;
            case 'AbortError':
                 message = "The request for camera access was aborted. This can happen if you switch settings too quickly.";
                 break;
            case 'SecurityError':
                message = "Camera access is not permitted on insecure origins. Please use HTTPS.";
                break;
            default:
                message = `Could not access the camera due to a hardware or browser error (${err.name}). Please try again.`;
        }
    } else if (err instanceof Error) {
        message = err.message;
    }
    console.error("Camera access failed:", err);
    setCameraError(message);
  }, [selectedResolution, selectedAspectRatio, selectedVideoQuality, mode]);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
        setCameraError(null);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        let videoConstraints: MediaTrackConstraints = {
            facingMode,
        };

        if (mode === 'video') {
            videoConstraints = {
                ...videoConstraints,
                ...VIDEO_QUALITY_OPTIONS[selectedVideoQuality].constraints,
            };
        } else { // photo or vision
            videoConstraints = {
                ...videoConstraints,
                ...RESOLUTION_OPTIONS[selectedResolution].constraints,
                aspectRatio: { ideal: ASPECT_RATIO_OPTIONS[selectedAspectRatio].value },
            };
        }

        let newStream: MediaStream | null = null;
        const constraintSets: { constraints: MediaStreamConstraints; description: string }[] = [
            { constraints: { video: videoConstraints, audio: true }, description: 'ideal video with audio' },
            { constraints: { video: videoConstraints }, description: 'ideal video without audio' },
            { constraints: { video: { facingMode } }, description: 'basic video' },
            { constraints: { video: true }, description: 'any video' },
        ];

        let lastError: any = null;
        for (const { constraints, description } of constraintSets) {
            try {
                newStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log(`Successfully acquired stream with: ${description}`);
                lastError = null;
                break;
            } catch (err) {
                console.warn(`Failed to get stream with ${description}:`, err);
                lastError = err;
                if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    break;
                }
            }
        }
        
        if (active) {
            if (newStream) {
                setStream(newStream);
                setFocusState('idle');
            } else if (lastError) {
                handleCameraError(lastError);
            } else {
                handleCameraError(new Error("Could not acquire a camera stream with any attempted configurations."));
            }
        } else {
            newStream?.getTracks().forEach(track => track.stop());
        }
    };

    startCamera();
    return () => { active = false; };
  }, [facingMode, selectedResolution, selectedAspectRatio, selectedVideoQuality, mode, retryCount, handleCameraError]);
  
  // Vision Mode Analysis Loop
  useEffect(() => {
    if (mode === 'vision' && stream && videoRef.current) {
        const video = videoRef.current;
        const captureCanvas = document.createElement('canvas');
        const ctx = captureCanvas.getContext('2d', { willReadFrequently: true });
        
        const loop = async () => {
            if (!isAnalyzingRef.current && video.readyState >= 2) {
                isAnalyzingRef.current = true;
                const captureWidth = 480;
                captureCanvas.width = captureWidth;
                captureCanvas.height = captureWidth / (video.videoWidth / video.videoHeight);
                ctx?.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
                
                const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.5);
                const base64Data = dataUrl.split(',')[1];
                
                try {
                    const objects = await detectObjectsInImage({ mimeType: 'image/jpeg', data: base64Data });
                    setDetectedObjects(prev => [...prev.filter(p => p.manual), ...objects]);
                    setUniqueLabels(prev => {
                        const newLabels = new Set(prev);
                        objects.forEach(o => newLabels.add(o.label));
                        return newLabels;
                    });
                } catch (e) {
                    console.error("Object detection failed:", e);
                } finally {
                    isAnalyzingRef.current = false;
                }
            }
            visionLoopRef.current = requestAnimationFrame(loop);
        };
        
        visionLoopRef.current = requestAnimationFrame(loop);
        
        return () => {
            if (visionLoopRef.current) cancelAnimationFrame(visionLoopRef.current);
            setDetectedObjects([]);
            isAnalyzingRef.current = false;
        };
    }
  }, [mode, stream]);

  const filteredObjects = useMemo(() => {
    let objects = detectedObjects.filter(obj => obj.manual || (obj.score ?? 1.0) >= sensitivity);
    if (activeFilterLabels.size > 0) {
        objects = objects.filter(obj => activeFilterLabels.has(obj.label));
    }
    return objects;
  }, [detectedObjects, sensitivity, activeFilterLabels]);

  // Drawing overlay for Vision Mode
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const draw = () => {
        const rect = video.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (mode === 'vision') {
            // Draw detected objects
            filteredObjects.forEach(obj => {
                const { x1, y1, x2, y2 } = obj.box;
                const x = x1 * canvas.width;
                const y = y1 * canvas.height;
                const width = (x2 - x1) * canvas.width;
                const height = (y2 - y1) * canvas.height;
                
                const color = obj.manual ? '#4ade80' : '#facc15';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
                
                ctx.fillStyle = color;
                ctx.font = 'bold 14px sans-serif';
                ctx.textBaseline = 'bottom';
                const text = `${obj.label}${obj.score ? ` (${(obj.score*100).toFixed(0)}%)` : ''}`;
                const textMetrics = ctx.measureText(text);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(x, y - 20, textMetrics.width + 8, 20);
                ctx.fillStyle = color;
                ctx.fillText(text, x + 4, y - 2);
            });
            // Draw manual tagging box
            if (isTagging && taggingBox) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(taggingBox.x1, taggingBox.y1, taggingBox.x2 - taggingBox.x1, taggingBox.y2 - taggingBox.y1);
                ctx.setLineDash([]);
            }
        }
    };
    
    let animationFrameId = requestAnimationFrame(draw);
    const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(draw);
    });
    resizeObserver.observe(video);

    return () => {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.unobserve(video);
    }
  }, [filteredObjects, mode, isTagging, taggingBox]);

  useEffect(() => {
    if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const capabilitiesTimeout = setTimeout(() => {
                try {
                    const capabilities = videoTrack.getCapabilities() as any;
                    setIsFlashAvailable(!!capabilities.torch);
                    if (capabilities.zoom) {
                        setZoomRange({ min: capabilities.zoom.min, max: capabilities.zoom.max, step: capabilities.zoom.step });
                        if (videoTrack.getConstraints().advanced?.some((c: any) => c.zoom)) {
                            videoTrack.applyConstraints({ advanced: [{ zoom: 1 }] } as any).catch(e => console.error(e));
                        }
                        currentZoomRef.current = 1;
                    } else { setZoomRange(null); }
                    setIsFocusPointSupported(!!capabilities.pointsOfInterest);
                } catch(e) {
                    console.error("Failed to get video track capabilities:", e);
                    setIsFlashAvailable(false);
                    setZoomRange(null);
                    setIsFocusPointSupported(false);
                }
            }, 100);
            return () => clearTimeout(capabilitiesTimeout);
        }
    }
    return () => { stream?.getTracks().forEach(track => track.stop()); };
  }, [stream]);
  
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) window.clearTimeout(focusTimeoutRef.current);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (!stream || !isFlashAvailable) return;
    const track = stream.getVideoTracks()[0];
    if (track && track.readyState === 'live') {
      // NOTE: For video streams, 'auto' flash is not supported by browsers via `torch`.
      // The `torch` constraint is a simple boolean (on/off). We interpret 'auto' as 'off'.
      // The user can manually toggle the torch on if needed.
      const torchState = flashMode === 'on';
      track.applyConstraints({ advanced: [{ torch: torchState }] } as any)
        .catch(e => console.error("Could not apply flash constraints:", e));
    }
  }, [stream, flashMode, isFlashAvailable]);

  const handleFlipCamera = () => {
    if (isFlipping || isRecording) return;
    setIsFlipping(true);
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    window.setTimeout(() => setIsFlipping(false), 500);
  };
  
  const handleToggleFlash = () => {
    if (!isFlashAvailable || isRecording) return;
    const nextMode: Record<FlashMode, FlashMode> = { off: 'on', on: 'auto', auto: 'off' };
    setFlashMode(prev => nextMode[prev]);
  };
  
  const handleCycleResolution = () => {
      if (isRecording) return;
      const currentIndex = RESOLUTION_ORDER.indexOf(selectedResolution);
      setSelectedResolution(RESOLUTION_ORDER[(currentIndex + 1) % RESOLUTION_ORDER.length]);
  };

  const handleCycleVideoQuality = () => {
    if (isRecording) return;
    const currentIndex = VIDEO_QUALITY_ORDER.indexOf(selectedVideoQuality);
    setSelectedVideoQuality(VIDEO_QUALITY_ORDER[(currentIndex + 1) % VIDEO_QUALITY_ORDER.length]);
  };

  const handleCycleAspectRatio = () => {
      if (isRecording || mode === 'video') return;
      const currentIndex = ASPECT_RATIO_ORDER.indexOf(selectedAspectRatio);
      setSelectedAspectRatio(ASPECT_RATIO_ORDER[(currentIndex + 1) % ASPECT_RATIO_ORDER.length]);
  };

  const takePicture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const targetAspectRatio = ASPECT_RATIO_OPTIONS[selectedAspectRatio].value;
        let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;

        if (videoAspectRatio > targetAspectRatio) {
            sWidth = video.videoHeight * targetAspectRatio;
            sx = (video.videoWidth - sWidth) / 2;
        } else {
            sHeight = video.videoWidth / targetAspectRatio;
            sy = (video.videoHeight - sHeight) / 2;
        }
        
        canvas.width = sWidth;
        canvas.height = sHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (facingMode === 'user') {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(video, sx, sy, sWidth, sHeight, -sWidth, 0, sWidth, sHeight);
                ctx.restore();
            } else {
                ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            }
            const dataUrl = canvas.toDataURL('image/jpeg');
            playSound('shutter');
            const item: GalleryItem = { type: 'photo', src: dataUrl };
            setLastCapture(item);
            addToGallery(item);
        }
    }
  }, [facingMode, addToGallery, selectedAspectRatio]);
  
  const captureAndChatAboutObject = useCallback((object: DetectedObject) => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const targetAspectRatio = ASPECT_RATIO_OPTIONS[selectedAspectRatio].value;
      let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;
      if (videoAspectRatio > targetAspectRatio) {
          sWidth = video.videoHeight * targetAspectRatio;
          sx = (video.videoWidth - sWidth) / 2;
      } else {
          sHeight = video.videoWidth / targetAspectRatio;
          sy = (video.videoHeight - sHeight) / 2;
      }
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          if (facingMode === 'user') {
              ctx.save();
              ctx.scale(-1, 1);
              ctx.drawImage(video, sx, sy, sWidth, sHeight, -sWidth, 0, sWidth, sHeight);
              ctx.restore();
          } else {
              ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
          }
          const dataUrl = canvas.toDataURL('image/jpeg');
          setImageForChat(dataUrl, `Tell me more about the ${object.label} in this image.`);
      }
    }
  }, [facingMode, selectedAspectRatio, setImageForChat]);


  const startRecording = () => {
    if (!stream || isRecording) return;
    recordedChunksRef.current = [];
    try {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const item: GalleryItem = { type: 'video', src: base64data };
          addToGallery(item);
          setLastCapture(item);
        };
        recordedChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      playSound('start');
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (e) { console.error("Error starting MediaRecorder:", e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      playSound('stop');
      setIsRecording(false);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
  };
  
  const handleShutter = () => {
    if (cameraError || mode === 'vision') return;
    if (mode === 'video') {
      isRecording ? stopRecording() : startRecording();
    } else {
      takePicture();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRecording || cameraError) return;
    const video = videoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (mode === 'vision') {
        if (isTagging) {
            if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
                setTaggingStart({ x, y });
                setTaggingBox({ x1: x, y1: y, x2: x, y2: y });
            }
            return;
        }

        if (e.touches.length === 1) {
            const normalizedX = x / rect.width;
            const normalizedY = y / rect.height;
            const tappedObject = [...filteredObjects].reverse().find(obj => {
                const { x1, y1, x2, y2 } = obj.box;
                return normalizedX >= x1 && normalizedX <= x2 && normalizedY >= y1 && normalizedY <= y2;
            });
            if (tappedObject) {
                e.preventDefault();
                playSound('start');
                setSelectedObject(tappedObject);
                return;
            }
        }
    }
      
    if (e.touches.length === 2 && zoomRange) {
        e.preventDefault();
        pinchDistRef.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    } else if (e.touches.length === 1 && isFocusPointSupported) {
        setFocusIndicator({ x, y, visible: true });
        setFocusState('focusing');
        triggerHapticFeedback(50);
        const track = stream?.getVideoTracks()[0];
        track?.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: x/rect.width, y: y/rect.height }] }] } as any).catch(err => console.error("Focus failed: ", err));
        if (focusTimeoutRef.current) window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = window.setTimeout(() => {
            setFocusState('focused');
            triggerHapticFeedback(100);
            focusTimeoutRef.current = window.setTimeout(() => {
                setFocusIndicator(prev => ({ ...prev, visible: false }));
                focusTimeoutRef.current = window.setTimeout(() => setFocusState('idle'), 3000);
            }, 1000);
        }, 700);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRecording || cameraError) return;
    if (mode === 'vision' && isTagging && taggingStart && videoRef.current) {
        const video = videoRef.current;
        const rect = video.getBoundingClientRect();
        const touch = e.touches[0];
        const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, touch.clientY - rect.top));
        setTaggingBox({ x1: taggingStart.x, y1: taggingStart.y, x2: x, y2: y });
        return;
    }
    if (e.touches.length === 2 && pinchDistRef.current > 0 && zoomRange && stream) {
        e.preventDefault();
        const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        const zoomFactor = newDist / pinchDistRef.current;
        let newZoom = currentZoomRef.current * zoomFactor;
        newZoom = Math.max(zoomRange.min, Math.min(zoomRange.max, newZoom));
        const track = stream.getVideoTracks()[0];
        track.applyConstraints({ advanced: [{ zoom: newZoom }] } as any)
            .then(() => { currentZoomRef.current = newZoom; })
            .catch(err => console.error("Zoom failed: ", err));
        pinchDistRef.current = newDist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      if (pinchDistRef.current > 0) pinchDistRef.current = 0;
      if (mode === 'vision' && isTagging && taggingStart && taggingBox && videoRef.current) {
        const video = videoRef.current;
        const rect = video.getBoundingClientRect();
        const finalBoxRaw = {
            x1: Math.min(taggingStart.x, taggingBox.x2),
            y1: Math.min(taggingStart.y, taggingBox.y2),
            x2: Math.max(taggingStart.x, taggingBox.x2),
            y2: Math.max(taggingStart.y, taggingBox.y2),
        };
        if ((finalBoxRaw.x2 - finalBoxRaw.x1) < 10 || (finalBoxRaw.y2 - finalBoxRaw.y1) < 10) {
            // Box is too small, cancel
            setTaggingBox(null);
            setTaggingStart(null);
            setIsTagging(false);
            return;
        }
        
        setTaggingBox(finalBoxRaw);
        setTaggingStart(null);
        setShowTagInput(true);
      }
  };
  
  const handleSaveTag = () => {
    const label = tagInputRef.current?.value.trim();
    const video = videoRef.current;
    if (label && taggingBox && video) {
        const rect = video.getBoundingClientRect();
        const newObject: DetectedObject = {
            label,
            box: {
                x1: taggingBox.x1 / rect.width,
                y1: taggingBox.y1 / rect.height,
                x2: taggingBox.x2 / rect.width,
                y2: taggingBox.y2 / rect.height,
            },
            manual: true,
            score: 1.0,
        };
        setDetectedObjects(prev => [...prev, newObject]);
        setUniqueLabels(prev => new Set(prev).add(label));
    }
    setShowTagInput(false);
    setTaggingBox(null);
    setIsTagging(false);
  };
  
  const handleFilterToggle = (label: string) => {
    setActiveFilterLabels(prev => {
        const newSet = new Set(prev);
        if (newSet.has(label)) {
            newSet.delete(label);
        } else {
            newSet.add(label);
        }
        return newSet;
    });
  };

  const handleRetry = () => {
    setCameraError(null);
    setRetryCount(c => c + 1);
  };

  const renderFlashIcon = () => {
    switch (flashMode) {
      case 'on': return <FlashOnIcon />;
      case 'auto': return <FlashAutoIcon />;
      default: return <FlashOffIcon />;
    }
  };

  return (
    <div 
        className="relative h-full w-full bg-black flex flex-col justify-between overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex items-center justify-center">
        <div 
            className="relative overflow-hidden transition-all duration-300 ease-in-out"
            style={{ 
                width: mode === 'video' ? '100%' : 'auto',
                height: mode === 'video' ? '100%' : 'auto',
                aspectRatio: mode !== 'video' ? `${ASPECT_RATIO_OPTIONS[selectedAspectRatio].value}` : 'auto',
                maxHeight: '100%',
                maxWidth: '100%'
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "h-full w-full object-cover transition-all duration-500",
                  focusState === 'idle' && !cameraError && "blur-[2px]",
                  cameraError && "blur-md"
                )}
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
            />
            <canvas 
                ref={overlayCanvasRef} 
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
        </div>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence>
        {focusIndicator.visible && !cameraError && (
            <motion.div
                className="absolute w-20 h-20 pointer-events-none"
                style={{ left: focusIndicator.x - 40, top: focusIndicator.y - 40 }}
                initial={{ opacity: 0, scale: 1.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="relative w-full h-full"
                variants={focusBoxVariants}
                animate={focusState}
              >
                <motion.div variants={cornerVariants} animate={focusState} className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg" />
                <motion.div variants={cornerVariants} animate={focusState} className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg" />
                <motion.div variants={cornerVariants} animate={focusState} className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg" />
                <motion.div variants={cornerVariants} animate={focusState} className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 rounded-br-lg" />
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="flex items-center gap-3">
            <button 
              id="onboarding-flash"
              onClick={handleToggleFlash}
              disabled={!isFlashAvailable || isRecording || !!cameraError}
              className="text-white p-2 rounded-full bg-black/30 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Flash mode is ${flashMode}. Tap to change.`}
            >
              {renderFlashIcon()}
            </button>
            {mode === 'video' ? (
                <button
                    onClick={handleCycleVideoQuality}
                    disabled={isRecording || !!cameraError}
                    className="text-white text-xs font-bold px-3 py-2 rounded-full bg-black/30 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Set video quality to ${VIDEO_QUALITY_OPTIONS[selectedVideoQuality].label}`}
                >
                    {VIDEO_QUALITY_OPTIONS[selectedVideoQuality].label}
                </button>
            ) : (
                <>
                    <button
                        onClick={handleCycleResolution}
                        disabled={isRecording || !!cameraError}
                        className="text-white text-xs font-bold px-3 py-2 rounded-full bg-black/30 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Set resolution to ${RESOLUTION_OPTIONS[selectedResolution].label}`}
                    >
                        {RESOLUTION_OPTIONS[selectedResolution].label}
                    </button>
                    <button
                        onClick={handleCycleAspectRatio}
                        disabled={isRecording || !!cameraError}
                        className="text-white text-xs font-bold px-3 py-2 rounded-full bg-black/30 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Set aspect ratio to ${ASPECT_RATIO_OPTIONS[selectedAspectRatio].label}`}
                    >
                        {ASPECT_RATIO_OPTIONS[selectedAspectRatio].label}
                    </button>
                </>
            )}
        </div>
        {isRecording && (
          <div className="flex items-center space-x-2 bg-black/50 px-3 py-1 rounded-full">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="font-mono text-sm text-white">{formatTime(recordingTime)}</span>
          </div>
        )}
        <div className="w-10"></div>
      </div>
      
      <AnimatePresence>
        {mode === 'vision' && !cameraError && (
            <VisionControls 
                sensitivity={sensitivity}
                onSensitivityChange={setSensitivity}
                uniqueLabels={Array.from(uniqueLabels).sort()}
                activeFilterLabels={activeFilterLabels}
                onFilterToggle={handleFilterToggle}
                onManualTag={() => setIsTagging(!isTagging)}
                isTagging={isTagging}
            />
        )}
      </AnimatePresence>

      <AnimatePresence>
          {showTagInput && (
              <motion.div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                  <div className="bg-gray-800 p-4 rounded-lg w-full max-w-sm">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-white">Add a Tag</h3>
                          <button onClick={() => { setShowTagInput(false); setTaggingBox(null); setIsTagging(false); }}>
                            <CloseIcon />
                          </button>
                      </div>
                      <input 
                        ref={tagInputRef}
                        type="text" 
                        placeholder="Enter object label..."
                        className="w-full bg-gray-700 text-white p-2 rounded mb-4"
                        autoFocus
                      />
                      <button onClick={handleSaveTag} className="w-full bg-yellow-500 text-black font-bold py-2 rounded">
                          Save Tag
                      </button>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
      
      <AnimatePresence>
        {selectedObject && (
            <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedObject(null)}
            >
                <motion.div
                    className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm text-white"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold text-yellow-400 capitalize">{selectedObject.label}</h2>
                        <button onClick={() => setSelectedObject(null)} className="p-1 -mr-1 -mt-1"><CloseIcon /></button>
                    </div>

                    <div className="space-y-4 text-sm">
                        {selectedObject.category && (
                            <div className="flex items-start">
                                <CategoryIcon className="w-5 h-5 mr-3 mt-0.5 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-gray-400">Category</p>
                                    <p>{selectedObject.category}</p>
                                </div>
                            </div>
                        )}
                        {selectedObject.score && !selectedObject.manual && (
                            <div className="flex items-start">
                                <PercentIcon className="w-5 h-5 mr-3 mt-0.5 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-gray-400">Confidence</p>
                                    <p>{(selectedObject.score * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        )}
                        {selectedObject.description && (
                            <div className="flex items-start">
                                <InfoIcon className="w-5 h-5 mr-3 mt-0.5 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-gray-400">Description</p>
                                    <p>{selectedObject.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button
                        onClick={() => {
                            if (selectedObject) captureAndChatAboutObject(selectedObject);
                            setSelectedObject(null);
                        }}
                        className="mt-6 w-full bg-yellow-500 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <ChatIcon isActive={false} width={20} height={20} />
                        <span>Chat about this</span>
                    </button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-24 left-0 right-0 z-10">
          <CameraControls
            mode={mode}
            setMode={setMode}
            onShutter={handleShutter}
            onFlip={handleFlipCamera}
            lastCapture={lastCapture}
            facingMode={facingMode}
            isFlipping={isFlipping}
            isRecording={isRecording}
          />
      </div>

      <AnimatePresence>
        {cameraError && (
            <motion.div
                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <h2 className="text-xl font-bold text-red-500 mb-4">Camera Unavailable</h2>
                <p className="text-gray-200 mb-6 max-w-md">{cameraError}</p>
                <button
                    onClick={handleRetry}
                    className="px-6 py-2 bg-yellow-500 text-black rounded-full font-bold transition-transform active:scale-95"
                >
                    Try Again
                </button>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraView;