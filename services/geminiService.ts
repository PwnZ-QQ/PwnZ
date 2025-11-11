
import { GoogleGenAI } from '@google/genai';

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface ImagePart {
  mimeType: string;
  data: string; // base64 encoded string without header
}

export const analyzeCapturedImage = async (prompt: string, image: ImagePart): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ inlineData: image }, { text: prompt }] },
    });
    return response.text;
};

// Functions like generateImage, generateVideo, editImage can be added back here
// when a gallery/editing feature is implemented.
