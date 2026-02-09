import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, defaultRetryConfig } from "../retry";

// Generate training downtime scenarios
export async function generateDowntimeScenario(moduleTitle: string, moduleTopic: string): Promise<any> {
  return pRetry(
    async () => {
      try {
        const prompt = `Generate a realistic industrial machinery downtime scenario for a training module on "${moduleTitle}" focusing on "${moduleTopic}".

Create a detailed scenario with:
1. Initial situation (what happened, time of day, production impact)
2. Observable symptoms (3-4 specific symptoms)
3. Measurements taken (actual numbers with units)
4. Multiple decision points where the trainee must choose actions
5. Correct solution path with explanation
6. Lessons learned

Return JSON format:
{
  "title": "scenario title",
  "situation": "detailed situation description",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "measurements": {"measurement name": "value with units"},
  "decisionPoints": [
    {
      "question": "What should you do first?",
      "options": ["option 1", "option 2", "option 3"],
      "correctAnswer": 0,
      "explanation": "why this is correct"
    }
  ],
  "solution": "step by step solution",
  "lessonsLearned": ["lesson 1", "lesson 2"]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 3000,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content);
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

// Generate fresh quiz questions for training modules
export async function generateQuizQuestions(moduleTitle: string, moduleTopic: string, count: number = 5): Promise<any[]> {
  return pRetry(
    async () => {
      try {
        const prompt = `Generate ${count} challenging quiz questions for a training module on "${moduleTitle}" focusing on "${moduleTopic}".

Questions should test:
- Technical knowledge and understanding
- Practical application and troubleshooting
- Safety procedures and standards
- Measurements and calculations

Return JSON format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "correctAnswer": 0,
      "explanation": "why this is correct and why others are wrong"
    }
  ]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 2048,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);
        return parsed.questions || [];
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

// Generate training case study
export async function generateTrainingCaseStudy(topic: string, difficultyLevel: string = "intermediate"): Promise<any> {
  return pRetry(
    async () => {
      try {
        const prompt = `Generate a detailed industrial maintenance case study on "${topic}" at ${difficultyLevel} difficulty level.

Create a comprehensive case study with:
1. Background (equipment, plant setting, history)
2. The problem (detailed description with timeline)
3. Investigation steps (what technicians checked)
4. Findings (measurements, observations, test results)
5. Root cause identified
6. Solution implemented
7. Results and verification
8. Prevention measures for the future

Return JSON format:
{
  "title": "case study title",
  "background": "equipment and setting",
  "problem": "detailed problem description",
  "investigation": ["step 1", "step 2", "step 3"],
  "findings": {"finding 1": "details", "finding 2": "details"},
  "rootCause": "identified root cause",
  "solution": "solution implemented",
  "results": "outcome and verification",
  "prevention": ["prevention measure 1", "prevention measure 2"]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 3000,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content);
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
