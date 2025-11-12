
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

export interface DetectedObject {
  label: string;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  score?: number;
  manual?: boolean;
}
