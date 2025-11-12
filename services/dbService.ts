import type { GalleryItem, AiChatMessage } from '../types';

const DB_NAME = 'AICameraDB';
const DB_VERSION = 2; // Incremented version to add new stores

const SETTINGS_STORE = 'settings';
const GALLERY_STORE = 'gallery';
const CHAT_HISTORY_STORE = 'chatHistory';

class DBManager {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(GALLERY_STORE)) {
          // Use a single entry to store the whole gallery array
          db.createObjectStore(GALLERY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CHAT_HISTORY_STORE)) {
           // Use a single entry to store the whole chat history array
          db.createObjectStore(CHAT_HISTORY_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  public async getSetting<T>(key: string): Promise<T | undefined> {
    const store = await this.getStore(SETTINGS_STORE, 'readonly');
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
    });
  }

  public async setSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore(SETTINGS_STORE, 'readwrite');
    const request = store.put({ key, value });
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  
  public async getGallery(): Promise<GalleryItem[]> {
      const store = await this.getStore(GALLERY_STORE, 'readonly');
      const request = store.get('main');
      return new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result ? request.result.items : []);
      });
  }
  
  public async saveGallery(items: GalleryItem[]): Promise<void> {
      const store = await this.getStore(GALLERY_STORE, 'readwrite');
      const request = store.put({ id: 'main', items });
      return new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
      });
  }

  public async getChatHistory(): Promise<AiChatMessage[]> {
      const store = await this.getStore(CHAT_HISTORY_STORE, 'readonly');
      const request = store.get('main');
      return new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result ? request.result.messages : []);
      });
  }

  public async saveChatHistory(messages: AiChatMessage[]): Promise<void> {
      const store = await this.getStore(CHAT_HISTORY_STORE, 'readwrite');
      const request = store.put({ id: 'main', messages });
      return new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
      });
  }
}

export const dbService = new DBManager();
