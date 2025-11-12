
import React, { useState, useEffect, useMemo, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';

interface OnboardingProps {
  onFinish: () => void;
}

interface Step {
  title: string;
  description: string;
  targetId?: string;
  preAction?: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const { setView } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps: Step[] = useMemo(() => [
    {
      title: "Welcome to AI Camera!",
      description: "Let's take a quick tour of the main features.",
    },
    {
      title: "Camera Modes",
      description: "Switch between PHOTO, VIDEO, and VISION modes. VISION lets you interact with the world through AI.",
      targetId: "onboarding-camera-modes",
    },
    {
      title: "Capture for AI",
      description: "In VISION mode, tap the shutter button to send what you see directly to the AI for analysis.",
      targetId: "onboarding-shutter",
    },
    {
      title: "Camera Controls",
      description: "Use these controls to manage the flash and flip the camera.",
      targetId: "onboarding-flash",
    },
    {
      title: "Switch to Chat",
      description: "Tap here to navigate to the AI Chat view where your conversations happen.",
      targetId: "onboarding-chat-nav",
      preAction: () => setView('camera'),
    },
    {
      title: "Start a Conversation",
      description: "Type your questions here. If you've sent an image from VISION mode, it will appear here to chat about.",
      targetId: "onboarding-chat-input",
      preAction: () => setView('chat'),
    },
    {
      title: "Smarter Answers",
      description: "Enable Search or Maps to ground the AI's answers with real-time web and location data.",
      targetId: "onboarding-ai-tools",
    },
    {
      title: "Live Conversation",
      description: "Tap the microphone to start a real-time voice conversation with Gemini.",
      targetId: "onboarding-mic",
    },
    {
      title: "You're All Set!",
      description: "Enjoy exploring the world with your new AI-powered camera. The possibilities are endless!",
    }
  ], [setView]);

  const activeStep = steps[currentStep];

  useEffect(() => {
    activeStep.preAction?.();
    
    const updateTargetRect = () => {
      if (activeStep.targetId) {
        const element = document.getElementById(activeStep.targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };
    
    // Delay allows for view transitions
    const timer = setTimeout(updateTargetRect, 450);
    window.addEventListener('resize', updateTargetRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [currentStep, activeStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onFinish();
    }
  };

  const highlightStyle: CSSProperties = targetRect
    ? {
        position: 'absolute',
        top: `${targetRect.top - 8}px`,
        left: `${targetRect.left - 8}px`,
        width: `${targetRect.width + 16}px`,
        height: `${targetRect.height + 16}px`,
        borderRadius: '12px',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        transition: 'all 0.35s ease-in-out',
        pointerEvents: 'none',
      }
    : {};

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const textBoxPosition = (): CSSProperties => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const isBottomHalf = targetRect.top > window.innerHeight / 2;
    if (isBottomHalf) {
      return { bottom: `${window.innerHeight - targetRect.top + 20}px`, left: '50%', transform: 'translateX(-50%)' };
    } else {
      return { top: `${targetRect.bottom + 20}px`, left: '50%', transform: 'translateX(-50%)' };
    }
  };
  
  return (
    <div className="absolute inset-0 z-[100] font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      {targetRect && <div style={highlightStyle} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          style={textBoxPosition()}
          className="absolute w-[90%] max-w-sm p-5 bg-gray-800 text-white rounded-2xl shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-lg font-bold mb-2 text-yellow-300">{activeStep.title}</h3>
          <p className="text-sm text-gray-200 mb-4">{activeStep.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{currentStep + 1} / {steps.length}</span>
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-yellow-400 text-black rounded-full text-sm font-bold"
            >
              {isLastStep || isFirstStep ? 'Get Started!' : 'Next'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
