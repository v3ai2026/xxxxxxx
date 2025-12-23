
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GenerationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const toPascalCase = (str: string): string => {
  return str.replace(/[-_ ]+/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('').replace(/[^a-zA-Z0-9]/g, '');
};

const FRAMEWORK_MATRIX_CONTEXT = `
Frameworks: Next.js, SvelteKit, Nuxt, Astro, Remix, Vite.
Features: SSR, Edge Routing, Middleware, ISR, Image Optimization.
Design Style: Vercel-inspired, dark mode, high-contrast, professional spacing.
`;

export const generateFrontendProject = async (prompt: string, useThinking: boolean = false): Promise<GenerationResult> => {
  const config: any = {
    systemInstruction: `You are a high-performance Intelligent Compiler. 
    ${FRAMEWORK_MATRIX_CONTEXT}
    When generating a "Modal" component, use Tailwind CSS for smooth animations (opacity/scale transitions) and a backdrop-blur. 
    Ensure it accepts title, content, isOpen, and onClose props.
    Output Format: Pure JSON only.`,
    responseMimeType: "application/json",
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config
  });

  const data = JSON.parse(response.text || '{}');
  if (data.componentName) data.componentName = toPascalCase(data.componentName);
  return data as GenerationResult;
};

export const groundedChat = async (prompt: string, tools: ('search' | 'maps')[]): Promise<{ text: string; links: any[] }> => {
  const toolConfig: any[] = [];
  if (tools.includes('search')) toolConfig.push({ googleSearch: {} });
  if (tools.includes('maps')) toolConfig.push({ googleMaps: {} });

  const response = await ai.models.generateContent({
    model: tools.includes('maps') ? "gemini-2.5-flash" : "gemini-3-flash-preview",
    contents: prompt,
    config: { tools: toolConfig }
  });

  const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => 
    c.web ? { uri: c.web.uri, title: c.web.title } : c.maps ? { uri: c.maps.uri, title: c.maps.title } : null
  ).filter(Boolean) || [];

  return { text: response.text || '', links };
};

export const generateImagePro = async (prompt: string, aspectRatio: string, imageSize: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: { imageConfig: { aspectRatio, imageSize } },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("No image generated.");
};

export const editImage = async (prompt: string, base64Data: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: 'image/png' } },
        { text: prompt }
      ]
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Editing failed.");
};

export const generateVideoVeo = async (prompt: string, aspectRatio: '16:9' | '9:16', sourceImage?: string): Promise<string> => {
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    image: sourceImage ? { imageBytes: sourceImage, mimeType: 'image/png' } : undefined,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  return `${downloadLink}&key=${process.env.API_KEY}`;
};

export const generateSpeech = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};
