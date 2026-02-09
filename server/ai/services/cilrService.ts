import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, defaultRetryConfig } from "../retry";

interface TaskSuggestion {
  name: string;
  taskType: "clean" | "inspect" | "lubricate" | "repair" | "measure" | "verify";
  description: string;
  instructions: string;
  photoRequired: boolean;
  targetValue?: string;
  minValue?: string;
  maxValue?: string;
  unit?: string;
}

interface AIGuidance {
  suggestion: string;
  safetyTips: string[];
  commonIssues: string[];
  bestPractices: string[];
}

export async function generateCilrTasks(
  prompt: string,
  templateType: "cilr" | "centerline",
  equipmentContext?: string
): Promise<TaskSuggestion[]> {
  return pRetry(
    async () => {
      try {
        const systemPrompt = `You are an expert reliability engineer and maintenance professional. Generate specific, actionable ${templateType === "centerline" ? "centerline verification" : "CILR (Clean, Inspect, Lubricate, Repair)"} tasks based on the user's request.

${templateType === "centerline" ? `
For CENTERLINE tasks:
- Focus on measurable parameters: pressure, temperature, vibration, alignment, levels, flow rates, speeds, etc.
- Always include target values, min/max acceptable ranges, and units
- Use task types: "measure" for numerical readings, "verify" for pass/fail checks
- Be specific about measurement locations and methods
` : `
For CILR tasks:
- Clean: Remove contaminants, debris, buildup
- Inspect: Visual checks for damage, wear, leaks, abnormalities  
- Lubricate: Apply specified lubricants to designated points
- Repair: Fix or adjust identified issues
- All tasks should require photo documentation for QA
`}

${equipmentContext ? `Equipment context: ${equipmentContext}` : ""}

Return a JSON array of tasks with this structure:
{
  "tasks": [
    {
      "name": "Brief descriptive name",
      "taskType": "${templateType === "centerline" ? "measure or verify" : "clean, inspect, lubricate, or repair"}",
      "description": "What to check/do",
      "instructions": "Step-by-step how to perform",
      "photoRequired": true,
      "targetValue": "100" (for measure/verify only),
      "minValue": "95" (for measure/verify only),
      "maxValue": "105" (for measure/verify only),
      "unit": "PSI" (for measure/verify only)
    }
  ]
}

Generate 3-6 relevant, practical tasks. Be specific with values typical for industrial equipment.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from AI");
        }

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (parseError) {
          aiLogger.warn({ content: content.substring(0, 200) }, "AI returned non-JSON response for task generation");
          return [{
            name: "General Inspection",
            taskType: templateType === "centerline" ? "measure" as const : "inspect" as const,
            description: "Inspect equipment condition",
            instructions: "Perform visual inspection and document findings",
            photoRequired: true,
          }];
        }
        
        const tasks = parsed.tasks || [];
        
        return tasks.map((task: TaskSuggestion) => ({
          name: task.name || "Unnamed Task",
          taskType: task.taskType || (templateType === "centerline" ? "measure" : "inspect"),
          description: task.description || "",
          instructions: task.instructions || "",
          photoRequired: task.photoRequired !== false,
          targetValue: task.targetValue,
          minValue: task.minValue,
          maxValue: task.maxValue,
          unit: task.unit,
        }));
      } catch (error) {
        aiLogger.error({ err: error }, "Error generating CILR tasks with AI");
        throw error;
      }
    },
    {
      ...defaultRetryConfig,
      retries: 2,
    }
  );
}

export async function getCilrTaskGuidance(
  taskType: string,
  taskName: string,
  description?: string,
  instructions?: string,
  equipmentContext?: string
): Promise<AIGuidance> {
  return pRetry(
    async () => {
      try {
        const systemPrompt = `You are an expert maintenance technician and safety advisor. Provide practical, actionable guidance for completing maintenance tasks safely and effectively.

For the given task, provide:
1. A helpful suggestion specific to this task (2-3 sentences)
2. Safety tips relevant to this type of work (3-4 items)
3. Common issues technicians encounter with this task type (2-3 items)
4. Best practices for quality completion (3-4 items)

Return a JSON object:
{
  "suggestion": "Main guidance for this specific task...",
  "safetyTips": ["Safety tip 1", "Safety tip 2", ...],
  "commonIssues": ["Common issue 1", "Common issue 2", ...],
  "bestPractices": ["Best practice 1", "Best practice 2", ...]
}

Be specific and practical. Focus on what a technician needs to know right now to do this task well.`;

        const userMessage = `Task Type: ${taskType}
Task Name: ${taskName}
${description ? `Description: ${description}` : ""}
${instructions ? `Instructions: ${instructions}` : ""}
${equipmentContext ? `Equipment: ${equipmentContext}` : ""}

Provide specific guidance for completing this ${taskType} task.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No response from AI");
        }

        try {
          return JSON.parse(content);
        } catch (parseError) {
          aiLogger.warn({ content: content.substring(0, 200) }, "AI returned non-JSON response for task guidance");
          return {
            suggestion: `For ${taskType} task "${taskName}", follow standard maintenance procedures and safety guidelines.`,
            safetyTips: ["Wear appropriate PPE", "Follow lockout/tagout procedures", "Report hazards immediately"],
            commonIssues: ["Incomplete documentation", "Improper equipment preparation"],
            bestPractices: ["Document all findings", "Follow manufacturer specifications", "Take photos for records"]
          };
        }
      } catch (error) {
        aiLogger.error({ err: error }, "Error getting CILR task guidance with AI");
        throw error;
      }
    },
    {
      ...defaultRetryConfig,
      retries: 2,
    }
  );
}

export async function analyzeCenterlineReading(
  taskName: string,
  targetValue: string,
  minValue: string,
  maxValue: string,
  measuredValue: string,
  unit: string
): Promise<{ isInSpec: boolean; analysis: string; recommendation: string }> {
  return pRetry(
    async () => {
      try {
        const numMeasured = parseFloat(measuredValue);
        const numMin = parseFloat(minValue);
        const numMax = parseFloat(maxValue);
        const isInSpec = !isNaN(numMeasured) && numMeasured >= numMin && numMeasured <= numMax;

        if (isInSpec) {
          return {
            isInSpec: true,
            analysis: `Reading of ${measuredValue}${unit} is within acceptable range (${minValue}-${maxValue}${unit}).`,
            recommendation: "No action required. Continue with next task."
          };
        }

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "You are an expert reliability engineer. Analyze out-of-spec readings and provide concise, actionable recommendations. Return JSON with 'analysis' (1-2 sentences) and 'recommendation' (2-3 sentences)."
            },
            { 
              role: "user", 
              content: `Parameter: ${taskName}
Target: ${targetValue}${unit}
Acceptable Range: ${minValue}-${maxValue}${unit}
Actual Reading: ${measuredValue}${unit}
Deviation: ${(numMeasured - parseFloat(targetValue)).toFixed(2)}${unit}

What does this indicate and what should be done?` 
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 500,
        });

        const content = response.choices[0]?.message?.content;
        let parsed: { analysis?: string; recommendation?: string } = {};
        try {
          parsed = content ? JSON.parse(content) : {};
        } catch (parseError) {
          aiLogger.warn({ content: content?.substring(0, 200) }, "AI returned non-JSON response for centerline analysis");
        }

        return {
          isInSpec: false,
          analysis: parsed.analysis || `Reading of ${measuredValue}${unit} is outside acceptable range (${minValue}-${maxValue}${unit}).`,
          recommendation: parsed.recommendation || "Investigate the cause and take corrective action. Consider creating a work order."
        };
      } catch (error) {
        aiLogger.error({ err: error }, "Error analyzing centerline reading");
        const numMeasured = parseFloat(measuredValue);
        const numMin = parseFloat(minValue);
        const numMax = parseFloat(maxValue);
        return {
          isInSpec: !isNaN(numMeasured) && numMeasured >= numMin && numMeasured <= numMax,
          analysis: `Reading: ${measuredValue}${unit}, Range: ${minValue}-${maxValue}${unit}`,
          recommendation: "Review the reading and take appropriate action."
        };
      }
    },
    {
      ...defaultRetryConfig,
      retries: 1,
    }
  );
}
