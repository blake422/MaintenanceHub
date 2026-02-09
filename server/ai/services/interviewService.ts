import { openai, openaiAudio, isAudioTranscriptionAvailable } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, minimalRetryConfig } from "../retry";

// Check if audio transcription is available
export { isAudioTranscriptionAvailable };

// Whisper API has a 25MB file size limit
const WHISPER_MAX_SIZE = 25 * 1024 * 1024;

// Interview Transcription using Whisper API
// Requires a direct OpenAI API key (OPENAI_API_KEY) - Replit AI Integrations doesn't support audio endpoints
export async function transcribeInterviewAudio(audioBuffer: Buffer, mimeType: string = "audio/webm"): Promise<string> {
  if (!openaiAudio) {
    throw new Error(
      "Audio transcription is not available. Please add your OpenAI API key (OPENAI_API_KEY) in the Secrets tab to enable audio transcription. Alternatively, you can enter the transcript manually."
    );
  }

  const fileSizeMB = audioBuffer.length / (1024 * 1024);
  aiLogger.info({ fileSizeMB: fileSizeMB.toFixed(2) }, "Starting audio transcription");

  // Check file size - Whisper has a 25MB limit
  if (audioBuffer.length > WHISPER_MAX_SIZE) {
    const errorMsg = `Audio file is too large for automatic transcription (${fileSizeMB.toFixed(1)}MB, limit is 25MB). ` +
      `Your recording has been saved. Please enter the transcript manually or try recording with shorter sessions.`;
    aiLogger.warn({ fileSizeMB: fileSizeMB.toFixed(2) }, "Audio file exceeds Whisper size limit");
    throw new Error(errorMsg);
  }

  return pRetry(
    async () => {
      try {
        const extension = mimeType.includes('webm') ? 'webm' : 
                         mimeType.includes('mp4') ? 'mp4' :
                         mimeType.includes('wav') ? 'wav' : 'webm';
        const file = new File([audioBuffer], `interview.${extension}`, { type: mimeType });

        const transcription = await openaiAudio!.audio.transcriptions.create({
          file: file,
          model: "whisper-1",
          language: "en",
          response_format: "text",
        });

        return transcription;
      } catch (error: any) {
        aiLogger.error({ err: error }, "Transcription error");
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new Error(`Transcription failed: ${error.message}`);
      }
    },
    minimalRetryConfig
  );
}

// Alias for backward compatibility
export const transcribeAudio = transcribeInterviewAudio;

// Interview Summarization and Pain Point Extraction
export interface InterviewSummaryResult {
  summary: string;
  painPoints: {
    theme: string;
    severity: "critical" | "major" | "minor";
    quote: string;
    suggestedActions: string[];
  }[];
  themes: string[];
}

export async function summarizeInterview(
  transcript: string,
  intervieweeRole: string,
  intervieweeName?: string
): Promise<InterviewSummaryResult> {
  return pRetry(
    async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert maintenance consultant analyzing interview transcripts to identify improvement opportunities.

Your task is to:
1. Summarize the key points from the interview (2-3 paragraphs)
2. Extract specific pain points with supporting quotes
3. Identify recurring themes
4. Suggest actionable improvements

Focus on:
- Equipment reliability issues
- Maintenance process gaps
- Training and skill gaps
- Communication problems
- Resource constraints
- Safety concerns
- Scheduling challenges

Return valid JSON only.`
            },
            {
              role: "user",
              content: `Analyze this interview transcript from a ${intervieweeRole}${intervieweeName ? ` named ${intervieweeName}` : ""}:

---
${transcript}
---

Return JSON with this exact structure:
{
  "summary": "<2-3 paragraph summary of key insights>",
  "painPoints": [
    {
      "theme": "<brief theme name>",
      "severity": "critical|major|minor",
      "quote": "<direct quote or paraphrase from transcript>",
      "suggestedActions": ["<action 1>", "<action 2>"]
    }
  ],
  "themes": ["<theme 1>", "<theme 2>"]
}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        return {
          summary: result.summary || "No summary available",
          painPoints: result.painPoints || [],
          themes: result.themes || [],
        };
      } catch (error: any) {
        aiLogger.error({ err: error }, "Summarize interview error");
        if (isRateLimitError(error)) {
          throw error;
        }
        return {
          summary: "Unable to generate summary",
          painPoints: [],
          themes: [],
        };
      }
    },
    minimalRetryConfig
  );
}

// Aggregate multiple interview summaries into a rollup report
export async function generateInterviewRollup(
  interviews: Array<{
    role: string;
    name?: string;
    summary: string;
    painPoints: Array<{ theme: string; severity: string; quote: string }>;
    themes: string[];
  }>
): Promise<{
  executiveSummary: string;
  topPainPoints: Array<{ theme: string; frequency: number; severity: string; examples: string[] }>;
  actionPriorities: string[];
  stakeholderInsights: Array<{ role: string; keyTakeaway: string }>;
}> {
  return pRetry(
    async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a senior maintenance consultant preparing an executive briefing based on multiple stakeholder interviews.

Synthesize the interview data into actionable insights that will help prioritize improvement efforts.`
            },
            {
              role: "user",
              content: `Synthesize these ${interviews.length} interview summaries into a comprehensive rollup:

${JSON.stringify(interviews, null, 2)}

Return JSON with this structure:
{
  "executiveSummary": "<1-2 paragraph executive summary of findings>",
  "topPainPoints": [
    {
      "theme": "<consolidated pain point theme>",
      "frequency": <number of interviews mentioning this>,
      "severity": "critical|major|minor",
      "examples": ["<specific example from interviews>"]
    }
  ],
  "actionPriorities": [
    "<prioritized action item 1>",
    "<prioritized action item 2>"
  ],
  "stakeholderInsights": [
    {
      "role": "<role>",
      "keyTakeaway": "<key insight from this stakeholder group>"
    }
  ]
}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        return {
          executiveSummary: result.executiveSummary || "",
          topPainPoints: result.topPainPoints || [],
          actionPriorities: result.actionPriorities || [],
          stakeholderInsights: result.stakeholderInsights || [],
        };
      } catch (error: any) {
        aiLogger.error({ err: error }, "Interview rollup error");
        return {
          executiveSummary: "Unable to generate rollup",
          topPainPoints: [],
          actionPriorities: [],
          stakeholderInsights: [],
        };
      }
    },
    minimalRetryConfig
  );
}
