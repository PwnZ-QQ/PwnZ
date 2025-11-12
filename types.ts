
export type CameraMode = 'photo' | 'video' | 'vision';
export type AppView = 'camera' | 'chat' | 'gallery';
export type FlashMode = 'off' | 'on' | 'auto';
export type MediaType = 'photo' | 'video';

export interface GalleryItem {
  type: MediaType;
  src: string;
}

export interface AiChatMessage {
  sender: 'user' | 'bot';
  text: string;
  sources?: GroundingSource[];
}

export interface GroundingSource {
    type: 'web' | 'maps';
    uri: string;
    title: string;
}