import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, shortRetryConfig } from "../retry";

export interface CorrectiveGuidanceStep {
  step: number;
  title: string;
  whatToLookFor: string[];
  likelyCauses: string[];
  actions: string[];
  safetyNotes: string[];
}

export interface CorrectiveGuidanceResult {
  summary: string;
  estimatedDifficulty: "simple" | "moderate" | "complex";
  steps: CorrectiveGuidanceStep[];
}

// AI-powered corrective work order guidance using 6-step troubleshooting approach
export async function getCorrectiveGuidance(
  description: string,
  equipmentName?: string,
  equipmentType?: string
): Promise<CorrectiveGuidanceResult> {
  return pRetry(
    async () => {
      try {
        const systemPrompt = `You are an expert industrial maintenance advisor helping technicians quickly diagnose and repair equipment issues. Generate actionable troubleshooting guidance based on the work order description.

Use the 6-step troubleshooting methodology:
1. IDENTIFY - Define the problem clearly
2. GATHER - What information/measurements to collect
3. ANALYZE - How to interpret findings and identify root cause
4. PLAN - Systematic repair approach
5. IMPLEMENT - Step-by-step repair actions
6. OBSERVE - Verify fix and prevent recurrence

For each step, provide:
- whatToLookFor: Specific symptoms, indicators, or data points to check
- likelyCauses: Most probable causes based on the symptoms described
- actions: Prioritized troubleshooting/repair steps (most likely fixes first)
- safetyNotes: Any safety precautions specific to this step (only if applicable)

Be CONCISE and PRACTICAL. Focus on the quickest path to repair.
Prioritize common causes first - 80% of problems come from 20% of causes.
Include specific measurements, values, or checks when possible.

Respond in JSON format:
{
  "summary": "Brief 1-2 sentence summary of the likely issue and recommended approach",
  "estimatedDifficulty": "simple" | "moderate" | "complex",
  "steps": [
    {
      "step": 1,
      "title": "Identify the Problem",
      "whatToLookFor": ["item1", "item2"],
      "likelyCauses": ["cause1", "cause2"],
      "actions": ["action1", "action2"],
      "safetyNotes": ["note1"] // only if safety-critical
    }
    // ... steps 2-6
  ]
}`;

        const userPrompt = `Work Order Description: ${description}
${equipmentName ? `Equipment: ${equipmentName}` : ""}
${equipmentType ? `Equipment Type: ${equipmentType}` : ""}

Generate practical troubleshooting guidance to help the technician resolve this issue quickly.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_completion_tokens: 2000,
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        return {
          summary: result.summary || "Unable to generate summary",
          estimatedDifficulty: result.estimatedDifficulty || "moderate",
          steps: (result.steps || []).map((s: any) => ({
            step: s.step || 0,
            title: s.title || "",
            whatToLookFor: s.whatToLookFor || [],
            likelyCauses: s.likelyCauses || [],
            actions: s.actions || [],
            safetyNotes: s.safetyNotes || [],
          })),
        };
      } catch (error: any) {
        aiLogger.error({ err: error }, "Corrective guidance error");
        if (isRateLimitError(error)) {
          throw error;
        }
        throw error;
      }
    },
    shortRetryConfig
  );
}
