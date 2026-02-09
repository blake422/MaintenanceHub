import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, defaultRetryConfig, minimalRetryConfig } from "../retry";

// PDF Manual Analysis
export async function analyzePDFManual(
  pdfText: string
): Promise<{
  parts: string[];
  pmSchedules: { task: string; frequency: string }[];
}> {
  return pRetry(
    async () => {
      try {
        const prompt = `Analyze this equipment manual and extract:

1. List of spare parts mentioned
2. Preventive maintenance schedules with frequency

Manual text:
${pdfText.substring(0, 10000)} // Limit to avoid token limits

Return JSON with:
{
  "parts": ["part1", "part2"],
  "pmSchedules": [{"task": "task name", "frequency": "every X days"}]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 2048,
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

// AI Maintenance Planning Suggestions
export async function getMaintenanceSuggestions(
  equipmentData: any[],
  workOrderHistory: any[],
  partsInventory: any[]
): Promise<any[]> {
  return pRetry(
    async () => {
      try {
        const prompt = `Based on this maintenance data, suggest proactive maintenance actions:

Equipment: ${JSON.stringify(equipmentData).substring(0, 2000)}
Work Order History: ${JSON.stringify(workOrderHistory).substring(0, 2000)}
Parts Inventory: ${JSON.stringify(partsInventory).substring(0, 2000)}

Provide suggestions in JSON format:
{
  "suggestions": [
    {
      "type": "pm_schedule" | "parts_order" | "work_order",
      "title": "suggestion title",
      "description": "detailed description",
      "confidence": 0-100
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
        return parsed.suggestions || [];
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

// AI Planner - Generate maintenance recommendations
export async function generateMaintenanceRecommendations(
  equipmentData: any[],
  partsData: any[],
  workOrderHistory: any[]
): Promise<{
  pmSchedules: Array<{
    title: string;
    description: string;
    confidence: number;
    reasoning: string;
    suggestedData: any;
  }>;
  partsOrders: Array<{
    title: string;
    description: string;
    confidence: number;
    reasoning: string;
    suggestedData: any;
  }>;
  workOrders: Array<{
    title: string;
    description: string;
    confidence: number;
    reasoning: string;
    suggestedData: any;
  }>;
}> {
  return pRetry(
    async () => {
      try {
        const prompt = `You are an industrial maintenance planning AI. Analyze the following data and generate actionable maintenance recommendations.

Equipment Data: ${JSON.stringify(equipmentData.slice(0, 10), null, 2)}
Parts Inventory: ${JSON.stringify(partsData.slice(0, 10), null, 2)}
Recent Work Orders: ${JSON.stringify(workOrderHistory.slice(0, 10), null, 2)}

Generate recommendations for:
1. PM Schedules - Based on manufacturer specs and equipment usage
2. Parts Orders - Based on stock levels and usage patterns
3. Work Orders - Based on equipment age and maintenance history

Return JSON format with 2-3 recommendations per category:
{
  "pmSchedules": [{
    "title": "recommendation title",
    "description": "clear description",
    "confidence": 85,
    "reasoning": "why this recommendation",
    "suggestedData": {
      "equipmentId": "id",
      "name": "PM schedule name",
      "frequencyDays": 30,
      "description": "what to do",
      "measurements": ["measurement 1", "measurement 2"]
    }
  }],
  "partsOrders": [{
    "title": "recommendation title",
    "description": "clear description",
    "confidence": 90,
    "reasoning": "why this recommendation",
    "suggestedData": {
      "partId": "id",
      "quantityToOrder": 10,
      "urgency": "normal"
    }
  }],
  "workOrders": [{
    "title": "recommendation title",
    "description": "clear description",
    "confidence": 88,
    "reasoning": "why this recommendation",
    "suggestedData": {
      "equipmentId": "id",
      "title": "work order title",
      "description": "what needs to be done",
      "type": "preventive",
      "priority": "medium"
    }
  }]
}

Focus on high-impact, data-driven recommendations with clear justification.`;

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

// Alias for backward compatibility
export const generatePMRecommendations = generateMaintenanceRecommendations;

export async function optimizePMSchedules(schedules: any[]): Promise<any[]> {
  return pRetry(
    async () => {
      try {
        const schedulesData = schedules.map(s => ({
          id: s.id,
          name: s.name,
          equipmentId: s.equipmentId,
          frequencyDays: s.frequencyDays,
          description: s.description,
          instructions: s.instructions,
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a certified reliability engineer and preventive maintenance optimization expert with 20+ years of industrial experience. You specialize in Reliability-Centered Maintenance (RCM), Total Productive Maintenance (TPM), and condition-based maintenance strategies.

Your expertise includes:
- Failure mode analysis and criticality assessment
- Optimizing PM intervals based on equipment failure patterns
- Cost-benefit analysis of maintenance strategies
- Risk-based maintenance prioritization
- Industry standards (ISO 55000, SAE JA1011, NFPA 70B)

Analyze each PM schedule critically and provide specific, actionable recommendations based on the actual task descriptions.`
            },
            {
              role: "user",
              content: `Analyze these preventive maintenance schedules for an industrial manufacturing facility and provide detailed optimization recommendations:

${JSON.stringify(schedulesData, null, 2)}

For EACH schedule, perform a detailed analysis:

1. **Frequency Optimization**:
   - Analyze the task description and current frequency
   - Apply RCM principles: Is this time-based, condition-based, or run-to-failure appropriate?
   - Consider industry standards for similar tasks
   - Suggest optimal frequency in days (or keep current if already optimal)

2. **Cost-Benefit Analysis**:
   - Estimate realistic annual cost savings from optimized frequency
   - Consider: labor hours saved/added, parts consumption, production impact
   - Calculate over-maintenance costs vs. failure prevention value

3. **Reliability Impact**:
   - Score reliability improvement on 0-100 scale
   - Explain how changes affect equipment uptime

4. **Specific Actionable Suggestions**:
   - Provide 3-5 concrete, implementable recommendations
   - Base on actual task description (e.g., if it's lubrication, suggest specific lubricant types/intervals)
   - Include technical details relevant to the specific task
   - Suggest condition monitoring where applicable
   - Identify consolidation opportunities

BE SPECIFIC. Use the actual task names and descriptions. Don't give generic advice.

Return ONLY valid JSON with this EXACT structure (use the actual schedule IDs as keys):

{
  "optimizations": {
    "actual-schedule-id-1": {
      "suggestedFrequency": <number>,
      "reasoning": "<specific detailed explanation referencing the actual task>",
      "costSavings": <realistic number>,
      "reliabilityImprovement": <0-100>,
      "suggestions": [
        "<specific suggestion based on actual task 1>",
        "<specific suggestion based on actual task 2>",
        "<specific suggestion based on actual task 3>"
      ]
    }
  }
}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        aiLogger.debug({ result, scheduleIds: schedules.map(s => s.id) }, "PM Optimize AI Response");

        return schedules.map(schedule => ({
          id: schedule.id,
          name: schedule.name,
          optimizations: result.optimizations?.[schedule.id] || {
            suggestedFrequency: schedule.frequencyDays,
            reasoning: "No optimization needed - current schedule is optimal",
            costSavings: 0,
            reliabilityImprovement: 0,
            suggestions: []
          }
        }));

      } catch (error) {
        aiLogger.error({ err: error }, "Error optimizing PM schedules");
        return schedules.map(s => ({
          id: s.id,
          optimizations: {
            suggestedFrequency: s.frequencyDays,
            reasoning: "Optimization unavailable",
            costSavings: 0,
            reliabilityImprovement: 0,
            suggestions: []
          }
        }));
      }
    },
    minimalRetryConfig
  );
}
