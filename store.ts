
import { create } from 'zustand';
import type { AppView } from './types';

interface AppState {
  appView: AppView;
  imageForChat: string | null;
  setView: (view: AppView) => void;
  setImageForChat: (image: string) => void;
  clearImageForChat: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  appView: 'camera',
  imageForChat: null,
  setView: (view) => set({ appView: view }),
  setImageForChat: (image) => set({ imageForChat: image, appView: 'chat' }),
  clearImageForChat: () => set({ imageForChat: null }),
}));
