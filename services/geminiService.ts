import { GoogleGenAI, Modality, GenerateContentResponse, Content } from '@google/genai';

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface ImagePart {
  mimeType: string;
  data: string; // base64 encoded string without header
}

interface GroundingOptions {
  useSearch: boolean;
  useMaps: boolean;
  location?: { latitude: number; longitude: number };
}

export const generateChatResponse = async (prompt: string, image: ImagePart | null, grounding: GroundingOptions): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';
    
    const textPart = { text: prompt };
    const parts: any[] = [textPart];
    if (image) {
        parts.unshift({ inlineData: image });
    }
    const contents: Content = { parts };

    const tools: any[] = [];
    if (grounding.useSearch) {
        tools.push({ googleSearch: {} });
    }
    if (grounding.useMaps) {
        tools.push({ googleMaps: {} });
    }
    
    const config: any = {};
    if (tools.length > 0) {
        config.tools = tools;
    }
    if (grounding.useMaps && grounding.location) {
        config.toolConfig = { retrievalConfig: { latLng: grounding.location } };
    }

    const response = await ai.models.generateContent({
        model,
        contents,
        ...(Object.keys(config).length > 0 && { config })
    });

    return response;
};

export const editImageWithPrompt = async (prompt: string, image: ImagePart): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: image },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data; // base64 string
        }
    }
    throw new Error("No image was generated.");
};


export const textToSpeech = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Failed to generate speech.");
    }
    
    // The Gemini API for TTS returns raw PCM audio data.
    return base64Audio;
};