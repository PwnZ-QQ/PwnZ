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
  /** Optional array of sources (e.g., from web or maps grounding) for the bot's response. */
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
  /** A detailed description of the detected object provided by the AI. */
  description?: string;
  /** The category of the object, for classifying into broader groups (e.g., "Animal", "Vehicle"). */
  category?: string;
}