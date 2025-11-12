import { create } from 'zustand';
import type { AppView, GalleryItem, AiChatMessage } from './types';
import { dbService } from './services/dbService';

interface AppState {
  appView: AppView;
  imageForChat: string | null;
  gallery: GalleryItem[];
  chatHistory: AiChatMessage[];
  initialChatPrompt: string | null;
  isStoreInitialized: boolean;
  
  // Actions
  initStore: () => Promise<void>;
  setView: (view: AppView) => void;
  setImageForChat: (image: string, initialPrompt?: string) => void;
  clearImageForChat: () => void;
  clearInitialChatPrompt: () => void;
  addChatMessage: (message: AiChatMessage) => void;
  addToGallery: (item: GalleryItem) => void;
  removeFromGallery: (index: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  appView: 'camera',
  imageForChat: null,
  gallery: [],
  chatHistory: [],
  initialChatPrompt: null,
  isStoreInitialized: false,

  initStore: async () => {
    try {
      const [gallery, chatHistory] = await Promise.all([
        dbService.getGallery(),
        dbService.getChatHistory(),
      ]);
      set({ gallery, chatHistory, isStoreInitialized: true });
    } catch (e) {
      console.error("Failed to initialize store from IndexedDB", e);
      set({ isStoreInitialized: true }); // Still finish, even if empty
    }
  },

  setView: (view) => set({ appView: view }),

  setImageForChat: (image, initialPrompt = '') => set({ 
    imageForChat: image, 
    appView: 'chat',
    initialChatPrompt: initialPrompt || null,
  }),

  clearImageForChat: () => set({ imageForChat: null }),

  clearInitialChatPrompt: () => set({ initialChatPrompt: null }),

  addChatMessage: (message) => {
    const updatedHistory = [...get().chatHistory, message];
    set({ chatHistory: updatedHistory });
    dbService.saveChatHistory(updatedHistory).catch(e => console.error("Failed to save chat history:", e));
  },
  
  addToGallery: (item) => {
    const updatedGallery = [item, ...get().gallery]; // Prepend new item
    set({ gallery: updatedGallery });
    dbService.saveGallery(updatedGallery).catch(e => console.error("Failed to save gallery:", e));
  },
  
  removeFromGallery: (index) => {
    const updatedGallery = get().gallery.filter((_, i) => i !== index);
    set({ gallery: updatedGallery });
    dbService.saveGallery(updatedGallery).catch(e => console.error("Failed to save gallery:", e));
  },
}));
