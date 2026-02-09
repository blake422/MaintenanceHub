import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, defaultRetryConfig } from "../retry";

// C4 Powered Why Suggestion for RCA
export async function suggestNextWhy(
  problemStatement: string,
  previousWhys: string[],
  whyLevel: number
): Promise<string> {
  return pRetry(
    async () => {
      try {
        let prompt = `You are an industrial maintenance root cause analysis expert. You're helping with a 5 Whys analysis.

Problem Statement: ${problemStatement}

`;

        if (previousWhys.length > 0) {
          prompt += `Previous Why Analysis:\n`;
          previousWhys.forEach((why, idx) => {
            prompt += `Why #${idx + 1}: ${why}\n`;
          });
          prompt += `\n`;
        }

        prompt += `Based on the problem statement${previousWhys.length > 0 ? ' and the previous why answers' : ''}, suggest an answer for Why #${whyLevel}.

This should dig deeper into the ${previousWhys.length > 0 ? 'previous answer' : 'problem'} to identify the underlying cause. Be specific and technical.

Return ONLY the suggested answer as plain text (no labels, no "Why #X:", just the answer).`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // Using GPT-4o for better reasoning
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 256,
        });

        return response.choices[0]?.message?.content?.trim() || "";
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw error;
      }
    },
    defaultRetryConfig
  );
}

// RCA Analysis
export async function analyzeRootCause(
  problemStatement: string,
  fiveWhys: { question: string; answer: string }[]
): Promise<string> {
  return pRetry(
    async () => {
      try {
        const prompt = `Analyze this root cause analysis:

Problem: ${problemStatement}

5 Whys Analysis:
${fiveWhys.map((w, i) => `${i + 1}. Q: ${w.question}\n   A: ${w.answer}`).join("\n")}

Provide:
1. Identified root causes
2. Recommended corrective actions
3. Prevention strategies
4. Similar failure patterns to watch for

Be specific and actionable.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 2048,
        });

        return response.choices[0]?.message?.content || "";
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw error;
      }
    },
    defaultRetryConfig
  );
}
