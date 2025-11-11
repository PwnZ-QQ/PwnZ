
export type CameraMode = 'photo' | 'video' | 'vision';
export type AppView = 'camera' | 'chat';
export type FlashMode = 'off' | 'on' | 'auto';

export interface AiChatMessage {
  sender: 'user' | 'bot';
  text: string;
  sources?: GroundingSource[];
}

export interface GroundingSource {
    uri: string;
    title: string;
}