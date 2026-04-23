import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const artisanService = {
  async generateBio(category: string, experience: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a professional and welcoming bio for a Tunisian artisan who is a ${category}. They have ${experience} years of experience. Keep it under 150 words and mention their commitment to quality and local service.`,
    });
    return response.text;
  }
};
