
export type CameraMode = 'photo' | 'video' | 'ai';

export interface AiChatMessage {
  sender: 'user' | 'bot';
  text: string;
}
