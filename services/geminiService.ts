
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { OrderRecord, AppSettings } from "../types";

export class GourmetAI {
  private ai: GoogleGenAI;
  private settings: AppSettings;

  constructor(apiKey: string, settings: AppSettings) {
    this.ai = new GoogleGenAI({ apiKey });
    this.settings = settings;
  }

  async extractHistoryFromImage(base64Image: string): Promise<OrderRecord[]> {
    const response = await this.ai.models.generateContent({
      model: this.settings.modelName,
      contents: [
        {
          parts: [
            { text: "Extract food order history from this screenshot (Meituan/Eleme). List orders: restaurant name, dishes, total price, platform. Return JSON array." },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              restaurant: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } },
              total: { type: Type.NUMBER },
              platform: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["restaurant", "items", "total", "platform", "date"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse history JSON", e);
      return [];
    }
  }

  async decideOrder(command: string, history: OrderRecord[], location: string): Promise<any> {
    const prompt = `
      USER COMMAND: "${command}"
      CURRENT LOCATION: "${location}"
      USER HISTORY: ${JSON.stringify(history)}
      
      TASK:
      1. Analyze the command and match with order habits.
      2. If location is far from common addresses, suggest creating a new address verbally.
      
      OUTPUT FORMAT (JSON ONLY):
      { 
        "suggestedMeal": "String", 
        "restaurant": "String", 
        "spokenResponse": "A friendly short sentence for the user describing the choice.",
        "isNewLocation": boolean 
      }
    `;

    const response = await this.ai.models.generateContent({
      model: this.settings.modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: this.settings.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedMeal: { type: Type.STRING },
            restaurant: { type: Type.STRING },
            spokenResponse: { type: Type.STRING },
            isNewLocation: { type: Type.BOOLEAN }
          },
          required: ["suggestedMeal", "restaurant", "spokenResponse", "isNewLocation"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  }

  async generateSpeech(text: string): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (e) {
      console.error("TTS Error:", e);
      return undefined;
    }
  }
}
