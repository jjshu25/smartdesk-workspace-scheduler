
import { GoogleGenAI, Type } from "@google/genai";
import { Desk, User, DeskStatus } from '../types';

// The API key is now handled by the environment variable `process.env.API_KEY`
// as per the best practices. The UI for key management has been removed.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });


export const optimizeSeatArrangement = async (desks: Desk[], users: User[], constraints: string): Promise<any> => {
  const availableDesks = desks.filter(d => d.status === DeskStatus.Available);

  const prompt = `
    You are a workspace seat arrangement optimizer. Your goal is to assign users to available desks based on a set of constraints.
    
    Available Desks:
    ${JSON.stringify(availableDesks.map(d => ({ id: d.id, location: d.location, noiseLevel: d.noiseLevel, temperature: d.temperature })), null, 2)}

    Users to be seated:
    ${JSON.stringify(users.map(u => ({ id: u.id, name: u.name, team: u.team })), null, 2)}

    Constraints:
    "${constraints}"

    Based on all the provided information, generate an optimal seating arrangement.
    Return the result as a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            arrangement: {
              type: Type.ARRAY,
              description: "The list of desk assignments.",
              items: {
                type: Type.OBJECT,
                properties: {
                  userId: { type: Type.STRING },
                  deskId: { type: Type.STRING },
                },
                required: ["userId", "deskId"],
              },
            },
            explanation: {
              type: Type.STRING,
              description: "A brief explanation of why this arrangement is optimal based on the constraints."
            }
          },
          required: ["arrangement", "explanation"],
        },
      },
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Improved error message for user
    if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('permission'))) {
       throw new Error("The API key is not valid or has insufficient permissions. Please check your configuration.");
    }
    throw new Error("Failed to get optimized arrangement. This feature requires an internet connection and a valid API key.");
  }
};
