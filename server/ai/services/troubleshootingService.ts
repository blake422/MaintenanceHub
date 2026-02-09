import OpenAI from "openai";
import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, defaultRetryConfig } from "../retry";

// Enhanced Universal Troubleshooting Coach - Guides thinking through 6 steps
export async function getTroubleshootingGuidance(
  problemDescription: string,
  currentStep: number,
  conversation: { role: string; content: string }[]
): Promise<string> {
  return pRetry(
    async () => {
      try {
        const stepDefinitions = {
          1: {
            name: "Identify the Problem",
            goal: "Help the tech clearly define what's wrong",
            coaching: "Ask 3-4 probing questions to help them describe symptoms, when it started, what changed, and impact. Don't give solutions yet - help them articulate the problem clearly."
          },
          2: {
            name: "Gather Information",
            goal: "Collect all relevant data and observations",
            coaching: "Guide them to gather: error codes, measurements (temps, voltages, pressures), visual observations, sounds/smells, recent changes. Ask what data they've collected and what else they should check."
          },
          3: {
            name: "Analyze the Data",
            goal: "Help them think through what the data means",
            coaching: "Ask questions that make them analyze patterns, compare to normal operation, identify what's different. Search web for similar issues. Guide their analytical thinking - don't just give the answer."
          },
          4: {
            name: "Plan the Solution",
            goal: "Develop a systematic approach to fix it",
            coaching: "Help them brainstorm possible causes, prioritize testing steps, plan safety measures. Ask: What's most likely? What should we test first? What tools/parts are needed?"
          },
          5: {
            name: "Implement the Fix",
            goal: "Guide execution of the repair plan",
            coaching: "Walk through the fix step-by-step. Ask about safety prep, what they're doing, what they're observing. Provide specific technical guidance from web searches when needed."
          },
          6: {
            name: "Observe",
            goal: "Verify the fix works and document learnings",
            coaching: "Ask: Is it running normal now? What parameters should we check? How can we prevent this? What did we learn? Help them close out properly."
          }
        };

        const currentStepInfo = stepDefinitions[currentStep as keyof typeof stepDefinitions];

        // If this is the first message in a step, automatically initiate coaching
        const isFirstMessageInStep = conversation.length === 0 ||
          !conversation[conversation.length - 1]?.content.includes(currentStepInfo.name);

        let systemPrompt = `You are an expert troubleshooting COACH helping a technician solve a problem. Your role is to guide their THINKING, not just give answers.

CURRENT STEP: ${currentStep}. ${currentStepInfo.name}
GOAL: ${currentStepInfo.goal}
COACHING APPROACH: ${currentStepInfo.coaching}

Problem being worked on: ${problemDescription || "Not yet defined"}

YOUR COACHING PRINCIPLES:
1. ASK QUESTIONS that make them think - don't just tell them what to do
2. Guide them through the systematic 6-step process: Identify → Gather → Analyze → Plan → Implement → Observe
3. Use Socratic method - help them discover solutions through guided questioning
4. Be a coach, not a lecturer. Make it conversational and supportive.
5. Search the web for relevant technical information when needed, but present it as options for them to consider
6. Praise good thinking and gently redirect when they miss something
7. CRITICAL: Ask MULTIPLE follow-up questions with each response. Build information progressively by diving deeper into what they tell you.
8. Each response should explore MORE about the breakdown - ask about details, conditions, timing, patterns, measurements.

${isFirstMessageInStep ? `THIS IS THE START OF STEP ${currentStep}. Greet them briefly and immediately ask 2-3 specific coaching questions for this step. Be concise and focused.` : 'Continue the coaching conversation. Respond to what they said, acknowledge it, then ask 2-3 MORE follow-up questions to dig deeper. Build the complete picture by asking about details they haven\'t mentioned yet.'}

Remember: You're building their troubleshooting SKILLS through iterative questioning. Each answer they give should spark MORE questions from you about the breakdown!`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...conversation.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ];

        // If it's the first message, automatically initiate the coaching for this step
        if (isFirstMessageInStep && conversation.length === 0) {
          messages.push({
            role: "user",
            content: `I'm ready to work on step ${currentStep}: ${currentStepInfo.name}`
          });
        }

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          max_completion_tokens: 800,
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
