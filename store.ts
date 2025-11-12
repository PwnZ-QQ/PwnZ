
import { create } from 'zustand';
import type { AppView, GalleryItem } from './types';

interface AppState {
  appView: AppView;
  imageForChat: string | null;
  gallery: GalleryItem[];
  setView: (view: AppView) => void;
  setImageForChat: (image: string) => void;
  clearImageForChat: () => void;
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
  setView: (view) => set({ appView: view }),
  setImageForChat: (image) => set({ imageForChat: image, appView: 'chat' }),
  clearImageForChat: () => set({ imageForChat: null }),
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