
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { PcbAnalysis, ChatMessage, JumperSuggestion, Component } from '../types';

/**
 * Converts a File object to a GoogleGenAI.Part object for the API.
 * @param {File} file The image file to convert.
 * @returns {Promise<object>} A promise that resolves to the generative part object.
 */
async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

const pcbAnalysisPrompt = `
You are an expert AI specializing in Printed Circuit Board (PCB) inspection. Analyze the provided PCB image and return a detailed report in JSON format based on the provided schema.

**Your Task:**

1.  **Identify Key Components:** Locate major components like ICs, capacitors, resistors. For each, identify its designator (e.g., U1), a plausible Manufacturer Part Number (MPN), its bounding box, presence, and condition.
2.  **Perform Thermal & Electrical Analysis:**
    *   For each component, estimate its operating **temperature** in Celsius. If a component appears to be a significant heat source (e.g., discolored, near a heatsink), assign a higher temperature.
    *   Provide a plausible **maxVoltage** in Volts for each component based on its type and a plausible **datasheetUrl**.
3.  **Detect Manufacturing & Operational Defects:** Identify common defects.
    *   Examples: solder bridges, misalignments, missing components, or damaged (burnt, corroded) parts.
    *   Crucially, also identify **overheating** defects. If a component's temperature is abnormally high (e.g., > 70°C), create a defect of type 'overheating'. The bounding box for this defect should be slightly larger than the component itself to represent a heat zone.
    *   For each defect, provide a unique ID, defect type, bounding box, a confidence score, and a brief description.
4.  **Provide a Summary & Actionable Advice:**
    *   Write a one-sentence summary of the board's condition.
    *   Generate quick_actions, alternatives for broken parts, next_steps, and an estimated repair_cost.

Important: All bounding box coordinates (x, y, w, h) must be normalized values between 0.0 and 1.0, relative to the image dimensions.

You MUST return ONLY a single, valid JSON object that conforms to the schema. Do not include any text, explanations, or markdown formatting.
`;

const bboxSchema = { 
    type: Type.OBJECT,
    description: "Normalized bounding box. All values are floats between 0.0 and 1.0.",
    properties: {
        x: { type: Type.NUMBER, description: "Top-left corner x-coordinate, normalized (0.0 to 1.0)." }, 
        y: { type: Type.NUMBER, description: "Top-left corner y-coordinate, normalized (0.0 to 1.0)." },
        w: { type: Type.NUMBER, description: "Width of the box, normalized (0.0 to 1.0)." }, 
        h: { type: Type.NUMBER, description: "Height of the box, normalized (0.0 to 1.0)." }
    },
    required: ['x', 'y', 'w', 'h']
};

const pcbAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        components: {
            type: Type.ARRAY,
            description: "List of identified components.",
            items: {
                type: Type.OBJECT,
                properties: {
                    designator: { type: Type.STRING, description: 'e.g., "R17"' },
                    mpn: { type: Type.STRING, description: "Manufacturer Part Number" },
                    bbox: bboxSchema,
                    presence: { type: Type.STRING, enum: ["missing", "ok"] },
                    condition: { type: Type.STRING, enum: ["burnt", "corroded", "ok"] },
                    confidence: { type: Type.NUMBER, description: "Confidence score (0.0 to 1.0)" },
                    temperature: { type: Type.NUMBER, description: "Estimated temperature in Celsius." },
                    datasheetUrl: { type: Type.STRING, description: "URL to the component's datasheet." },
                    maxVoltage: { type: Type.NUMBER, description: "Plausible maximum voltage in Volts." },
                },
                required: ['designator', 'mpn', 'bbox', 'presence', 'condition', 'confidence']
            }
        },
        defects: {
            type: Type.ARRAY,
            description: "List of identified defects.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Unique identifier for the defect, e.g., 'defect-1'" },
                    type: { type: Type.STRING, description: "Type of defect, e.g., 'solder_bridge'" },
                    bbox: bboxSchema,
                    confidence: { type: Type.NUMBER, description: "Confidence score (0.0 to 1.0)" },
                    description: { type: Type.STRING, description: "A brief description of the defect." }
                },
                required: ['id', 'type', 'bbox', 'confidence']
            }
        },
        summary: {
            type: Type.STRING,
            description: "A one-sentence summary of the board's condition."
        },
        advice: {
            type: Type.OBJECT,
            properties: {
                quick_actions: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "A list of immediate actions to take."
                },
                alternatives: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            original_mpn: { type: Type.STRING },
                            replacements: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        mpn: { type: Type.STRING },
                                        reason: { type: Type.STRING }
                                    },
                                    required: ['mpn', 'reason']
                                }
                            }
                        },
                        required: ['original_mpn', 'replacements']
                    },
                    description: "Suggested replacements for damaged components."
                },
                next_steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Longer-term steps for full repair and verification."
                },
                repair_cost: {
                    type: Type.NUMBER,
                    description: "An estimated cost for the repairs in USD."
                }
            },
            required: ['quick_actions', 'alternatives', 'next_steps']
        }
    },
    required: ['components', 'defects', 'summary', 'advice']
};

export const analyzePcbImage = async (imageFile: File): Promise<PcbAnalysis> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

    const imagePart = await fileToGenerativePart(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [imagePart, {text: pcbAnalysisPrompt}] }],
        config: {
            responseMimeType: 'application/json',
            responseSchema: pcbAnalysisSchema,
            temperature: 0.1, // Lower temperature for more deterministic JSON output
        },
    });
    
    const jsonText = response.text.trim();
    
    try {
        const parsed = JSON.parse(jsonText);
        // Basic validation
        if (!parsed.components || !parsed.defects) {
             throw new Error("AI response is missing required fields.");
        }
        return parsed as PcbAnalysis;
    } catch (e) {
        console.error("Failed to parse JSON response from AI:", jsonText);
        console.error(e);
        throw new Error("AI returned invalid data format. Please try again.");
    }
};

const chatSystemInstruction = `
You are a helpful AI assistant for electronics repair. Your name is 'Guru'.
You are having a conversation with an engineer about a specific Printed Circuit Board (PCB) they are analyzing.
- Keep your answers concise and to the point.
- If the user provides context about a selected component, focus your answer on that component.
- The user might provide the board's operating voltage. Use this to assess risks.
- If asked for a workaround that involves bypassing a component, you can suggest adding a jumper wire.
- To suggest a jumper, you MUST output a JSON block with the 'jumper' key. The coordinates for the jumper must be normalized (0.0 to 1.0) and should be near component pins or pads, not in the middle of a component.
- Example Jumper JSON:
\`\`\`json
{
  "jumper": {
    "from": { "x": 0.25, "y": 0.35 },
    "to": { "x": 0.28, "y": 0.55 }
  }
}
\`\`\`
- Do not add the JSON block unless you are specifically suggesting a jumper wire.
`;


export const createChat = (apiKey: string): Chat => {
    const ai = new GoogleGenAI({apiKey});
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: chatSystemInstruction,
            temperature: 0.4,
        }
    });
};

export const sendMessage = async (
    chat: Chat, 
    message: string, 
    context: { component?: Component; boardVoltage?: number }
): Promise<GenerateContentResponse> => {
    let contextualMessage = message;
    if (context.component) {
        contextualMessage = `Context: I have selected component ${context.component.designator} (${context.component.mpn}). Its condition is '${getStatusText(context.component)}'.\n\nMy question: ${message}`;
    }
    if (context.boardVoltage) {
        contextualMessage += `\n(Note: The board voltage is set to ${context.boardVoltage}V).`;
    }

    return await chat.sendMessage({ message: contextualMessage });
};

const getStatusText = (component: Component): string => {
    if (component.condition === 'burnt') return 'Burnt';
    if (component.condition === 'corroded') return 'Corroded';
    if (component.presence === 'missing') return 'Missing';
    return 'OK';
}