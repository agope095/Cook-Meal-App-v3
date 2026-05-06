import { GoogleGenAI } from "@google/genai";

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemma-3-27b-it",
      contents: "Hello"
    });
    console.log("Success with gemma-3-27b-it");
  } catch (e) {
    console.error("Error with gemma-3-27b-it:", e.message);
  }
}
run();
