import { GoogleGenAI, Modality, GenerateContentResponse, Content, Type } from '@google/genai';
import type { DetectedObject } from '../types';

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

export const detectObjectsInImage = async (image: ImagePart): Promise<DetectedObject[]> => {
    const ai = getAiClient();

    const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: {
              type: Type.STRING,
              description: 'A short, descriptive label for the detected object (e.g., "blue car", "dog").',
            },
            box: {
              type: Type.OBJECT,
              properties: {
                  x1: { type: Type.NUMBER, description: 'Normalized top-left x-coordinate (0-1).' },
                  y1: { type: Type.NUMBER, description: 'Normalized top-left y-coordinate (0-1).' },
                  x2: { type: Type.NUMBER, description: 'Normalized bottom-right x-coordinate (0-1).' },
                  y2: { type: Type.NUMBER, description: 'Normalized bottom-right y-coordinate (0-1).' },
              },
              required: ['x1', 'y1', 'x2', 'y2'],
            },
            score: {
                type: Type.NUMBER,
                description: 'A confidence score for the detection, from 0.0 to 1.0.'
            },
            category: {
                type: Type.STRING,
                description: 'A broad category for the object (e.g., "Vehicle", "Animal", "Food").'
            },
            description: {
                type: Type.STRING,
                description: 'A detailed, one-sentence description of the object.'
            },
          },
          required: ['label', 'box', 'score'],
        },
      };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: image },
                { text: 'Detect all distinct objects in the image. For each object, provide a descriptive label, a precise bounding box with normalized coordinates, a confidence score, a broad category (e.g., "Vehicle", "Animal", "Food"), and a detailed one-sentence description.' },
            ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema,
            systemInstruction: 'You are an expert object detection model. Your task is to identify objects in an image and return their labels, categories, bounding boxes, and confidence scores in JSON format according to the provided schema. Only return objects you are confident about.',
        },
    });

    try {
        const jsonString = response.text.trim();
        const cleanedJson = jsonString.replace(/^```json\s*|```$/g, '');
        const parsed = JSON.parse(cleanedJson);
        if (Array.isArray(parsed)) {
            return parsed.filter(item => 
                item.label && typeof item.label === 'string' &&
                item.box && typeof item.box.x1 === 'number' &&
                typeof item.score === 'number'
            );
        }
        return [];
    } catch (e) {
        console.error("Failed to parse object detection JSON:", e, "Raw response:", response.text);
        return [];
    }
};