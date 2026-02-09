import OpenAI from "openai";

// Using Replit AI Integrations - no personal API key needed
// This client supports chat completions but NOT audio transcription
export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Separate client for audio services (Whisper) - requires direct OpenAI API key
// Replit AI Integrations doesn't support the audio/transcriptions endpoint
export const openaiAudio = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export const isAudioTranscriptionAvailable = (): boolean => {
  return !!openaiAudio;
};
