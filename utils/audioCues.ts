
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // User interaction is required to start audio context in some browsers.
  // The shutter/record button press will handle this.
  if (audioContext.state === 'suspended') {
      audioContext.resume();
  }
  return audioContext;
};

export const playSound = (type: 'shutter' | 'start' | 'stop') => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    if (type === 'shutter') {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1500, now);
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } else if (type === 'start') {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    } else if (type === 'stop') {
      const oscillator1 = ctx.createOscillator();
      const gainNode1 = ctx.createGain();
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(660, now);
      gainNode1.gain.setValueAtTime(0.3, now);
      gainNode1.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      oscillator1.connect(gainNode1);
      gainNode1.connect(ctx.destination);
      oscillator1.start(now);
      oscillator1.stop(now + 0.1);

      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(660, now + 0.15);
      gainNode2.gain.setValueAtTime(0.3, now + 0.15);
      gainNode2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      oscillator2.start(now + 0.15);
      oscillator2.stop(now + 0.25);
    }
  } catch (e) {
    console.error("Error playing audio cue:", e);
  }
};
