
import { create } from 'zustand';
import type { AppView, GalleryItem } from './types';

interface AppState {
  appView: AppView;
  imageForChat: string | null;
  gallery: GalleryItem[];
  initialChatPrompt: string | null;
  setView: (view: AppView) => void;
  setImageForChat: (image: string, initialPrompt?: string) => void;
  clearImageForChat: () => void;
  clearInitialChatPrompt: () => void;
  addToGallery: (item: GalleryItem) => void;
  removeFromGallery: (index: number) => void;
}

const getInitialGallery = (): GalleryItem[] => {
    try {
        const items = localStorage.getItem('gallery-items');
        if (items) {
            const parsed = JSON.parse(items);
            // Basic validation to ensure it's an array of objects with correct shape
            if (Array.isArray(parsed) && (parsed.length === 0 || (parsed[0].type && parsed[0].src))) {
                return parsed;
            }
        }
        return [];
    } catch (e) {
        console.error("Could not parse gallery items from localStorage", e);
        return [];
    }
};

export const useAppStore = create<AppState>((set) => ({
  appView: 'camera',
  imageForChat: null,
  gallery: getInitialGallery(),
  initialChatPrompt: null,
  setView: (view) => set({ appView: view }),
  setImageForChat: (image, initialPrompt = '') => set({ 
    imageForChat: image, 
    appView: 'chat',
    initialChatPrompt: initialPrompt || null,
  }),
  clearImageForChat: () => set({ imageForChat: null }),
  clearInitialChatPrompt: () => set({ initialChatPrompt: null }),
  addToGallery: (item) => set((state) => {
      const newGallery = [item, ...state.gallery];
      try {
          localStorage.setItem('gallery-items', JSON.stringify(newGallery));
      } catch(e) { console.error("Could not save to localStorage", e); }
      return { gallery: newGallery };
  }),
  removeFromGallery: (index) => set((state) => {
      const newGallery = state.gallery.filter((_, i) => i !== index);
       try {
          localStorage.setItem('gallery-items', JSON.stringify(newGallery));
      } catch(e) { console.error("Could not save to localStorage", e); }
      return { gallery: newGallery };
  }),
}));