import { openai } from "../client";
import { aiLogger } from "../../logger";
import { type BreakdownAnalysis } from "@shared/schema";
import { pRetry, isRateLimitError, defaultRetryConfig } from "../retry";

// AI-Powered Import Parser for Downtime Records
export async function parseDowntimeImportFile(
  fileContent: string,
  fileType: string,
  equipment: any[]
): Promise<any[]> {
  return pRetry(
    async () => {
      try {
        const equipmentList = equipment.map(e => e.name).join(", ");

        const prompt = `You are a data extraction expert for an industrial maintenance system. Parse the following ${fileType} data and extract downtime records.

EQUIPMENT IN SYSTEM: ${equipmentList || "No equipment registered yet"}

REQUIRED OUTPUT FORMAT (JSON array):
[
  {
    "equipmentName": "string (match to equipment list above, or use closest match from the data)",
    "startTime": "ISO 8601 date-time string (YYYY-MM-DDTHH:mm:ss)",
    "durationMinutes": "number (duration in minutes)",
    "reason": "string (reason for downtime)",
    "impact": "string (impact/severity description)",
    "notes": "string (any additional notes)"
  }
]

INSTRUCTIONS:
1. Parse ALL dates to ISO 8601 format (e.g., "2025-04-17T23:57:00")
2. Extract equipment name from any column (machine, equipment, line, job description, etc.)
3. Calculate duration in minutes if needed (from start/end times or duration fields)
4. Map reason codes/descriptions to the "reason" field
5. Extract severity, impact, or notes to appropriate fields
6. If end time is missing but duration exists, that's OK (we only need start + duration)
7. Handle various date formats: M/D/YY HH:mm, MM-DD-YYYY, etc.
8. Skip rows with N/A or missing critical data
9. Match equipment names to the system's equipment list when possible
10. For 2-digit years, assume 20xx (e.g., 25 = 2025)

DATA TO PARSE:
${fileContent.substring(0, 50000)}

Return ONLY a valid JSON array of downtime records. No markdown, no explanation.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 16000,
        });

        const content = response.choices[0]?.message?.content || "[]";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          aiLogger.error({ content }, "AI response did not contain valid JSON array");
          return [];
        }

        const records = JSON.parse(jsonMatch[0]);
        return Array.isArray(records) ? records : [];
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

// Downtime Analysis (Legacy - for existing downtime records)
export async function analyzeDowntimeData(
  downtimeRecords: any[],
  equipment: any[]
): Promise<any> {
  return pRetry(
    async () => {
      try {
        const equipmentMap = Object.fromEntries(
          equipment.map(eq => [eq.id, eq.name])
        );

        const downtimeData = downtimeRecords.map(dt => ({
          equipment: equipmentMap[dt.equipmentId] || dt.equipmentId,
          reason: dt.reason,
          impact: dt.impact,
          durationMinutes: dt.durationMinutes,
          durationHours: dt.durationMinutes ? (dt.durationMinutes / 60).toFixed(1) : null,
          startTime: dt.startTime,
          endTime: dt.endTime,
        }));

        const prompt = `Analyze the following downtime records from a manufacturing facility and provide comprehensive insights:

${JSON.stringify(downtimeData, null, 2)}

Please provide a detailed analysis in the following JSON format:
{
  "summary": {
    "totalDowntimeHours": number,
    "mostAffectedEquipment": "equipment name",
    "primaryCauses": ["cause 1", "cause 2", "cause 3"],
    "criticalFindings": "brief summary of most important findings"
  },
  "patterns": [
    {
      "title": "Pattern title",
      "description": "Detailed description of the pattern",
      "severity": "high|medium|low",
      "affectedEquipment": ["equipment 1", "equipment 2"],
      "frequency": "description of how often"
    }
  ],
  "rootCauseAnalysis": [
    {
      "cause": "Identified root cause",
      "evidence": "What in the data supports this",
      "affectedEquipment": ["equipment names"],
      "estimatedImpact": "percentage or hours of downtime",
      "priority": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed actionable recommendation",
      "expectedImpact": "What improvement this would bring",
      "implementation": "How to implement this",
      "priority": "high|medium|low",
      "estimatedCostSavings": "description of potential savings"
    }
  ],
  "preventiveMeasures": [
    {
      "measure": "Specific preventive measure",
      "targetedCause": "What this prevents",
      "implementation": "How to implement",
      "expectedReduction": "Expected reduction in downtime"
    }
  ]
}

Focus on actionable insights, clear patterns, and data-driven recommendations that can reduce future downtime.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 4000,
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

// Generate Comprehensive Downtime Analysis Report from File
export async function generateDowntimeAnalysisReport(
  fileContent: string,
  fileType: string,
  equipment: any[]
): Promise<{ recordCount: number; totalDowntimeHours: number; analysisData: any }> {
  return pRetry(
    async () => {
      try {
        const equipmentList = equipment.map(e => e.name).join(", ");

        const prompt = `You are a world-class maintenance and reliability engineering consultant (CMRP, CRL certified) analyzing manufacturing downtime data from a SHOPLOGIX system. Generate an EXECUTIVE-LEVEL comprehensive analysis report SEGMENTED into four key business areas: SAFETY, QUALITY, OPERATIONS, and MAINTENANCE.

SHOPLOGIX DATA FORMAT RECOGNITION:
- This data contains PRE-CALCULATED totals - USE THEM:
  * "totalRecords" = Total number of downtime events (use this for recordCount)
  * "calculatedTotalDowntimeHours" = EXACT total hours from summing DT Hour column (use this!)
- Key data columns in sampleData array:
  * "Reason Detail" or "Reason" = Equipment/failure type (critical for categorization)
  * "Comment" or "Description" = Detailed failure description
  * "DT Hour" = Downtime hours per event (already summed in calculatedTotalDowntimeHours)
  * "Area" = Production area/line (Ritz, Premium, Oreo, CIB, CA!, DC, IHL, etc.)
  * "Criteria" = Loss type: OL=Operating Loss (operations), BD=Breakdown (maintenance)
  * "% impact on GE" = Percentage impact on Global Efficiency
  * "Week", "Month", "Year", "Day" = Time dimensions for trend analysis
- The "summaryData" object contains pre-aggregated data by Area/Equipment for cross-reference
- CRITICAL: The calculatedTotalDowntimeHours is the ACCURATE total - use it, don't recalculate

DOWNTIME DATA:
${fileContent.substring(0, 100000)}

CRITICAL CONTEXT:
- Segment ALL findings, root causes, and recommendations into the 4 business pillars: Safety, Quality, Operations, Maintenance
- Each segment should have its own complete analysis suitable for a standalone executive report
- SEGMENT CLASSIFICATION RULES (STRICTLY FOLLOW - FAILURE TO COMPLY IS UNACCEPTABLE):
  * SAFETY (RESTRICTIVE - INJURY-ONLY): ONLY use for: actual injuries, near-miss incidents with injury potential, OSHA recordables, lockout/tagout failures, arc flash, fall hazards, chemical exposure, confined space entry violations, PPE failures.
    - SAFETY IS NOT: equipment breakdowns (even severe ones), changeovers, tool changes, material shortages, throughput issues, quality defects, or ANY operational inefficiency. A machine failure is NOT safety unless someone was injured or nearly injured.
    - TEST: Ask "Was someone hurt or nearly hurt?" - if NO, it is NOT safety.
  * QUALITY: Defects, scrap, rework, out-of-spec parts, SPC violations, customer complaints/returns, inspection failures, dimensional non-conformance, contamination (product quality, not worker exposure)
  * OPERATIONS: Changeovers (SMED), tool changes, setup time, material shortages, scheduling conflicts, throughput issues, cycle time losses, capacity constraints, setup delays, line balancing, starved/blocked conditions, OEE losses (availability/performance/quality)
  * MAINTENANCE: Equipment failures, breakdowns, unplanned stops, PM gaps, parts shortages, bearing failures, motor trips, reliability issues, MTBF/MTTR concerns, component wear, calibration drift
- CRITICAL VALIDATION: Before finalizing, review EVERY finding in the Safety segment. If ANY finding does not involve actual/potential human injury, MOVE IT to the correct segment (usually Maintenance or Operations). Equipment failures go to Maintenance. Changeovers/setups go to Operations. Defects go to Quality.

Return a JSON object with this exact structure:
{
  "recordCount": number (total records analyzed),
  "totalDowntimeHours": number (sum of all downtime in hours),
  "summary": {
    "totalDowntimeHours": number,
    "mostAffectedEquipment": "equipment name with most downtime",
    "primaryCauses": ["top 3-5 causes of downtime"],
    "criticalFindings": "2-3 sentence executive summary"
  },
  "segments": {
    "safety": {
      "downtimeHours": number,
      "severity": "critical|high|medium|low",
      "executiveSummary": "2-3 sentence summary of safety-related downtime and risks",
      "keyMetrics": {
        "incidentCount": number,
        "nearMissCount": number,
        "riskScore": "1-10 scale"
      },
      "findings": [
        {
          "title": "Finding title",
          "description": "Detailed description",
          "severity": "critical|high|medium|low",
          "affectedEquipment": ["equipment names"],
          "impact": "Impact description with hours/percentage"
        }
      ],
      "rootCauses": [
        {
          "cause": "Root cause description",
          "evidence": "Supporting evidence from data",
          "riskLevel": "critical|high|medium|low"
        }
      ],
      "recommendations": [
        {
          "title": "Implement CBM on [Equipment Name] - specific action",
          "description": "Detailed 2-3 sentence explanation of what to do and expected results",
          "priority": "immediate",
          "owner": "Reliability Engineer",
          "timeline": "Week 1-2: baseline, Week 3-4: implementation, Week 5-6: validation",
          "expectedOutcome": "Reduce unplanned downtime by 30%, improve MTBF from 100 to 150 hours",
          "measurementsRequired": "Vibration velocity <4.5 mm/s, bearing temp <70C, motor current <10% deviation",
          "conditionBasedPM": "Weekly vibration trending, monthly thermography, quarterly oil analysis",
          "auditRequirements": "Weekly: PM completion >95%, Monthly: MTBF trend review, Quarterly: RCA audit",
          "implementationSteps": ["Reliability Engineer: Install sensors", "Technician: Collect baseline", "Planner: Update PM schedule", "Manager: Review KPIs", "Team: Continuous monitoring"],
          "c4Step": 4,
          "c4StepName": "Preventive Maintenance Excellence",
          "c4StepRationale": "This recommendation requires PM optimization through condition-based monitoring. Step 4 addresses this through its CBM/PdM implementation checklist items."
        }
      ],
      "kpis": [
        {
          "metric": "KPI name",
          "current": "Current value",
          "target": "Target value",
          "gap": "Gap description"
        }
      ]
    },
    "quality": {
      "downtimeHours": number,
      "severity": "critical|high|medium|low",
      "executiveSummary": "2-3 sentence summary of quality-related downtime issues",
      "keyMetrics": {
        "defectRate": "percentage or count",
        "scrapHours": number,
        "reworkHours": number
      },
      "findings": [],
      "rootCauses": [],
      "recommendations": [],
      "kpis": []
    },
    "operations": {
      "downtimeHours": number,
      "severity": "critical|high|medium|low",
      "executiveSummary": "2-3 sentence summary of operations-related downtime",
      "keyMetrics": {
        "oeeImpact": "percentage",
        "throughputLoss": "units or percentage",
        "efficiencyGap": "percentage"
      },
      "findings": [],
      "rootCauses": [],
      "recommendations": [],
      "kpis": []
    },
    "maintenance": {
      "downtimeHours": number,
      "severity": "critical|high|medium|low",
      "executiveSummary": "2-3 sentence summary of maintenance-related downtime",
      "keyMetrics": {
        "mtbf": "Mean time between failures",
        "mttr": "Mean time to repair",
        "pmCompliance": "PM compliance percentage"
      },
      "findings": [],
      "rootCauses": [],
      "recommendations": [],
      "kpis": []
    }
  },
  "patterns": [
    {
      "title": "Pattern name",
      "description": "Detailed description of this pattern",
      "severity": "high|medium|low",
      "segment": "safety|quality|operations|maintenance",
      "affectedEquipment": ["specific equipment names"],
      "frequency": "How often this occurs"
    }
  ],
  "rootCauseAnalysis": [
    {
      "cause": "Root cause",
      "category": "Mechanical|Electrical|Process|Operator Error|Planned Maintenance|Other",
      "segment": "safety|quality|operations|maintenance",
      "evidence": "Specific data supporting this conclusion",
      "estimatedImpact": "X hours or Y% of total downtime",
      "priority": "high|medium|low"
    }
  ],
  "chartData": {
    "paretoByEquipment": [
      { "name": "Equipment name", "hours": number, "percentage": number, "cumulative": number }
    ],
    "paretoByReason": [
      { "name": "Reason category", "hours": number, "percentage": number, "cumulative": number }
    ],
    "downtimeByArea": [
      { "area": "Area name", "hours": number, "percentage": number }
    ],
    "downtimeByCriteria": [
      { "criteria": "OL or BD", "hours": number, "percentage": number, "label": "Operating Loss or Breakdown" }
    ],
    "trendByMonth": [
      { "month": "Month name", "hours": number, "events": number }
    ],
    "topIssues": [
      { "issue": "Issue description", "hours": number, "area": "Area", "frequency": number }
    ]
  }
}

INSTRUCTIONS:
- CRITICAL: Use the pre-calculated "totalRecords" for recordCount and "calculatedTotalDowntimeHours" for totalDowntimeHours
- Use "Criteria" field to segment: BD (Breakdown) -> Maintenance, OL (Operating Loss) -> Operations
- PARETO ANALYSIS: Generate top 10 lists by equipment and by reason for chartData
- Aggregate by Area (Ritz, Premium, Oreo, CIB, CA!, DC, IHL, etc.) for downtimeByArea chart
- Calculate OL vs BD split for downtimeByCriteria chart
- Extract monthly trends for trendByMonth chart (use Month/Week/Year columns)

RECOMMENDATION REQUIREMENTS:
- Generate 3-5 recommendations per segment (quality, operations, maintenance)
- Reference actual equipment names from the data
- Include c4Step (0-5), c4StepName, and c4StepRationale for Path to Excellence integration:
  * 0=Initial Assessment, 1=Criticality, 2=RCA, 3=Storeroom, 4=PM Excellence, 5=Performance Management

POPULATE ALL ARRAYS - DO NOT LEAVE EMPTY:
- findings: At least 3-5 findings per segment with actual equipment and hours
- rootCauses: At least 2-3 root causes per segment  
- recommendations: At least 3-5 recommendations per segment with ALL fields filled
- kpis: At least 2-3 KPIs per segment

- Include realistic KPI targets based on industry benchmarks (e.g., OEE >85%, MTBF improvement targets)
- ALL chartData arrays must have numeric hours values and percentages for visualization
- Return ONLY valid JSON matching the schema above`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 16000,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        aiLogger.debug({ contentPreview: content.substring(0, 1000) }, "AI Response received");

        let result;
        try {
          result = JSON.parse(content);
        } catch (parseError) {
          aiLogger.error({ err: parseError, content }, "Failed to parse AI response as JSON");
          throw new Error("AI returned invalid JSON");
        }

        aiLogger.debug({ keys: Object.keys(result), recordCount: result.recordCount, totalDowntimeHours: result.totalDowntimeHours }, "Parsed AI result");

        // Ensure we have the minimum required structure
        if (!result.recordCount && !result.summary && !result.patterns) {
          aiLogger.error({}, "AI response missing required fields");
          throw new Error("AI response incomplete - missing required analysis fields");
        }

        // Clean up and validate C4 step data in recommendations
        const validC4Steps: Record<number, string> = {
          0: "Initial Process Assessment",
          1: "Equipment Criticality Assessment",
          2: "Root Cause Analysis System",
          3: "Storeroom MRO Optimization",
          4: "Preventive Maintenance Excellence",
          5: "Data-Driven Performance Management"
        };

        const cleanRecommendations = (recs: any[]) => {
          if (!Array.isArray(recs)) return [];
          return recs.map(rec => {
            // Validate and fix c4Step
            let step = typeof rec.c4Step === 'number' ? rec.c4Step : parseInt(rec.c4Step) || 4;
            if (step < 0 || step > 5) step = 4;
            
            // Fix c4StepName if it doesn't match valid options
            const validName = validC4Steps[step];
            const currentName = rec.c4StepName || '';
            const isValidName = Object.values(validC4Steps).includes(currentName);
            
            // Fix c4StepRationale if it contains garbage
            let rationale = rec.c4StepRationale || '';
            if (rationale.length > 500 || /[!@#$%^&*(){}[\]|\\<>?~`+=]/.test(rationale.substring(0, 50))) {
              rationale = `This recommendation aligns with ${validName} because it addresses the identified issue through the step's implementation checklist.`;
            }

            return {
              ...rec,
              c4Step: step,
              c4StepName: isValidName ? currentName : validName,
              c4StepRationale: rationale
            };
          });
        };

        // Clean all segment recommendations
        if (result.segments) {
          for (const segmentKey of ['safety', 'quality', 'operations', 'maintenance']) {
            if (result.segments[segmentKey]?.recommendations) {
              result.segments[segmentKey].recommendations = cleanRecommendations(result.segments[segmentKey].recommendations);
            }
          }
        }

        return {
          recordCount: result.recordCount || 0,
          totalDowntimeHours: result.totalDowntimeHours || result.summary?.totalDowntimeHours || 0,
          analysisData: result,
        };
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

// Generate Breakdown Analysis with 5 Whys and Fishbone for a specific finding
// WORLD-CLASS CONSULTANT-GRADE ANALYSIS with SMART goals, RACI, and step-by-step implementation
export async function generateFindingBreakdown(
  finding: { title?: string; description?: string; value?: string; cause?: string; severity?: string; riskLevel?: string; priority?: string; impact?: string; estimatedImpact?: string; evidence?: string },
  segment: string,
  reportContext: any
): Promise<BreakdownAnalysis> {
  return pRetry(
    async () => {
      try {
        const prompt = `You are a WORLD-CLASS industrial maintenance consultant (Certified Reliability Leader, CMRP) with 30+ years at Fortune 500 plants. Your analysis goes directly to plant managers and VP of Operations. Generic advice will cost the company millions and end your career.

MANDATORY REQUIREMENTS - VIOLATION = REJECTED ANALYSIS:
1. DO NOT INVENT OR SUGGEST SPECIFIC SPECS (temperatures, tolerances, pressures, etc.) - only recommend WHAT to check, not what the values should be
2. Verification evidence should say "Recommend verifying [parameter] against OEM specifications" NOT actual numbers
3. Reference INDUSTRY STANDARDS for methodology (ISO 20816, API 610, etc.) but NOT specific values
4. NO GENERIC PHRASES: "lack of ownership", "needs more training", "improve communication", "better supervision" = AUTOMATIC REJECTION
5. Focus on WHAT to investigate and HOW to verify, not on suggesting spec values that may confuse customers

FINDING TO ANALYZE:
Title: ${finding.title || finding.cause || 'Unknown Finding'}
Description: ${finding.description || finding.evidence || ''}
Severity: ${finding.severity || finding.riskLevel || finding.priority || 'medium'}
Impact: ${finding.impact || finding.estimatedImpact || ''}
Segment: ${segment.toUpperCase()} (${segment === 'safety' ? 'Safety-related' : segment === 'quality' ? 'Quality-related' : segment === 'operations' ? 'Operations-related' : 'Maintenance-related'})

REPORT CONTEXT:
${reportContext?.summary?.criticalFindings || 'Manufacturing downtime analysis'}
Total Downtime: ${reportContext?.summary?.totalDowntimeHours || 0} hours
Primary Causes: ${reportContext?.summary?.primaryCauses?.join(', ') || 'Various causes'}

Return a JSON object with this EXACT structure:
{
  "findingTitle": "Technical title with failure mode (e.g., 'Spindle Bearing Inner Race Fretting Due to Loose Shaft Fit')",
  "segment": "${segment}",
  "executiveSummary": "2-3 sentences with quantified impact. Example: 'CNC spindle failure caused 127 hours unplanned downtime ($63,500 lost production). Root cause: shaft bearing seat undersized by 0.013-0.018mm creating loose fit. Bearing inner race showed classic fretting wear pattern with brown oxide debris.'",

  "verificationEvidence": [
    {
      "observation": "What to look for (e.g., 'Check bearing inner race for fretting wear patterns or discoloration')",
      "measurementRecommendation": "What to measure (e.g., 'Measure shaft diameter at bearing seat location')",
      "specificationSource": "Where to find the spec (e.g., 'Refer to OEM equipment manual for required shaft tolerance')",
      "inspectionMethod": "Tool/technique (e.g., 'Outside micrometer, 3 measurements at 120 deg intervals')",
      "standardReference": "Methodology standard (e.g., 'Follow ISO 286-2 measurement procedures')"
    }
  ],

  "permanentCountermeasures": [
    {
      "action": "Specific fix (e.g., 'Replace spindle cartridge with OEM-specified shaft bearing seat dimensions')",
      "specification": "What to verify (e.g., 'Confirm shaft diameter, surface finish, and roundness meet OEM specifications')",
      "verificationMethod": "How to confirm (e.g., 'Micrometer measurement at 3 points, verify against OEM print')",
      "standardReference": "Where to find requirements (e.g., 'OEM service manual, ISO 286-2 for tolerance methodology')",
      "partNumber": "Parts to source (e.g., 'Order OEM spindle cartridge and bearings per equipment BOM')",
      "torqueSpec": "Where to find (e.g., 'Refer to OEM manual for spindle nut torque specification')"
    }
  ],

  "technicianValidationSteps": [
    "Step 1: Tool and safety prep (e.g., 'Gather required measurement tools, follow lockout/tagout procedures')",
    "Step 2: Access component (e.g., 'Follow equipment SOP to access the component for inspection')",
    "Step 3: Measure critical dimensions (e.g., 'Take measurements at multiple positions and document readings')",
    "Step 4: Compare to OEM specs (e.g., 'Reference equipment manual for acceptable ranges, flag deviations')",
    "Step 5: Document evidence (e.g., 'Photograph damage patterns, record all measurements')",
    "Step 6: Report findings (e.g., 'Complete RCA evidence form, submit to Reliability Engineer')"
  ],

  "fiveWhys": [
    {
      "step": 1,
      "question": "Why did [component] fail?",
      "answer": "Describe the immediate failure mode based on evidence from the data",
      "confidence": "high|medium|low",
      "evidence": "What data/observations support this answer"
    },
    {
      "step": 2,
      "question": "Why did [cause from step 1] occur?",
      "answer": "Dig deeper into the contributing factor - recommend verification against OEM specs if applicable",
      "confidence": "high|medium|low",
      "evidence": "Supporting data or recommended verification steps"
    },
    {
      "step": 3,
      "question": "Why did [cause from step 2] occur?",
      "answer": "Continue to systemic causes - process, procedure, or organizational factors",
      "confidence": "high|medium|low",
      "evidence": "Records, procedures, or interviews to verify"
    },
    {
      "step": 4,
      "question": "Why did [cause from step 3] occur?",
      "answer": "Identify management system gaps or process breakdowns",
      "confidence": "high|medium|low",
      "evidence": "Documentation or audit findings"
    },
    {
      "step": 5,
      "question": "Why did [cause from step 4] occur?",
      "answer": "Root cause - typically a gap in procedures, training, quality controls, or management systems",
      "confidence": "high|medium|low",
      "evidence": "Review applicable procedures, interview relevant personnel"
    }
  ],

  "fishbone": {
    "man": [
      {
        "factor": "Description of man-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 7,
        "likelihood": "high"
      }
    ],
    "machine": [
      {
        "factor": "Description of machine-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 10,
        "likelihood": "confirmed"
      }
    ],
    "method": [
      {
        "factor": "Description of method-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 8,
        "likelihood": "confirmed"
      }
    ],
    "material": [
      {
        "factor": "Description of material-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 9,
        "likelihood": "confirmed"
      }
    ],
    "environment": [
      {
        "factor": "Description of environment-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 6,
        "likelihood": "high"
      }
    ],
    "measurement": [
      {
        "factor": "Description of measurement-related factor",
        "description": "Detailed description",
        "evidence": "Supporting evidence",
        "impactScore": 7,
        "likelihood": "confirmed"
      }
    ]
  },

  "rootCause": {
    "statement": "Complete root cause statement",
    "category": "material",
    "confidence": "high",
    "validationSteps": [
      "Validation step 1",
      "Validation step 2",
      "Validation step 3"
    ]
  },

  "actionPlan": [
    {
      "title": "Action title",
      "description": "Detailed description",
      "priority": "immediate",
      "ownerRole": "Maintenance Supervisor",
      "timeline": "Complete within 48 hours of part arrival",
      "resources": "Required resources",
      "successMetric": "Success metric",
      "estimatedCost": "$X parts + $Y labor = $Z total",
      "implementationSteps": [
        "Step 1",
        "Step 2",
        "Step 3"
      ],
      "raci": {
        "responsible": "Lead Mechanic",
        "accountable": "Maintenance Supervisor",
        "consulted": "Reliability Engineer, OEM Tech Support",
        "informed": "Production Manager, Purchasing"
      }
    }
  ],

  "preventiveMeasures": [
    {
      "measure": "Preventive measure description",
      "frequency": "Monthly, or after any maintenance intervention",
      "responsibility": "Vibration Analyst",
      "expectedOutcome": "6-8 weeks advance warning of bearing degradation"
    }
  ],

  "risks": [
    "Risk statement 1",
    "Risk statement 2"
  ],

  "assumptions": [
    "Assumption 1",
    "Assumption 2"
  ],

  "costBenefitAnalysis": {
    "implementationCost": "$X total",
    "annualSavings": "$Y/year",
    "paybackPeriod": "Less than X months",
    "riskReduction": "Failure probability reduced from X% to Y%"
  }
}

ABSOLUTE REQUIREMENTS - YOUR RESPONSE MUST INCLUDE:
1. verificationEvidence: Minimum 3 physical findings with measured value vs. specification, deviation, and inspection method
2. permanentCountermeasures: Minimum 4 fixes with exact specs (dimensions +/-tolerance, torque Nm, temperatures, chemicals, part numbers)
3. technicianValidationSteps: 5-6 numbered steps a technician can physically perform TODAY
4. All measurements in engineering units with tolerances (mm, Nm, degC, PSI, mm/s, um)
5. At least 3 industry standard references (ISO, API, ASTM, NFPA, OEM manual sections)
6. costBenefitAnalysis with dollar amounts and payback period

REJECTION CRITERIA - Response will be discarded if it contains:
- Generic phrases: "improve training", "better communication", "increase awareness", "needs supervision"
- Missing measurement comparisons (measured vs. spec)
- Missing industry standard references
- Countermeasures without specific part numbers, torque values, or acceptance criteria

Return ONLY valid JSON with no markdown formatting.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 8000,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        let result = JSON.parse(content);

        // Validate and reject generic responses
        const genericPhrases = [
          'lack of ownership', 'needs more training', 'do more pms',
          'improve communication', 'better supervision', 'increase awareness'
        ];

        const contentString = JSON.stringify(result).toLowerCase();
        const hasGenericContent = genericPhrases.some(phrase => contentString.includes(phrase));

        if (hasGenericContent) {
          aiLogger.warn({}, "AI response contained generic phrases, result may need human review");
        }

        return result;
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

// Deep-dive analysis for individual key findings
export async function analyzeKeyFinding(
  finding: any,
  context: string,
  equipment: any[],
  fullAnalysisData: any
): Promise<any> {
  return pRetry(
    async () => {
      try {
        const equipmentNames = equipment.map(e => e.name).join(", ");

        const prompt = `You are an expert industrial maintenance consultant conducting a comprehensive breakdown analysis of a specific downtime finding.

FINDING TO ANALYZE:
${JSON.stringify(finding, null, 2)}

CONTEXT FROM USER: ${context || "No additional context provided"}

AVAILABLE EQUIPMENT: ${equipmentNames}

BROADER ANALYSIS CONTEXT:
${JSON.stringify(fullAnalysisData?.summary || {}, null, 2)}

Provide an extremely detailed, enterprise-grade deep-dive analysis of this finding. Return JSON with this structure:

{
  "executiveSummary": "2-3 sentence high-level summary for management",
  "findingDetails": {
    "title": "Clear title of the finding",
    "severity": "critical|high|medium|low",
    "impactScore": number (1-10),
    "downtimeContribution": "percentage or hours this finding contributes to total downtime"
  },
  "rootCauseBreakdown": {
    "primaryCause": "The main root cause",
    "contributingFactors": ["factor 1", "factor 2", "factor 3"],
    "causeChain": ["immediate cause", "underlying cause", "root cause"],
    "evidenceSummary": "What data supports this analysis"
  },
  "technicalAnalysis": {
    "failureMode": "How the failure manifests",
    "failureMechanism": "Why it fails this way",
    "systemInteractions": ["other systems affected"],
    "criticalParameters": ["key measurements or thresholds to monitor"]
  },
  "impactAssessment": {
    "productionImpact": "Effect on production output",
    "financialImpact": "Estimated cost impact",
    "safetyImplications": "Any safety concerns",
    "qualityImplications": "Effect on product quality",
    "cascadeEffects": ["downstream effects on other equipment/processes"]
  },
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "immediate|short-term|long-term",
      "owner": "Role responsible (e.g., Maintenance Supervisor)",
      "timeline": "When to complete",
      "estimatedCost": "Implementation cost estimate",
      "expectedBenefit": "What improvement this brings",
      "resources": ["Required resources or tools"]
    }
  ],
  "preventiveStrategy": {
    "shortTermMeasures": ["immediate steps to prevent recurrence"],
    "longTermSolutions": ["permanent fixes or improvements"],
    "monitoringPlan": "What to monitor going forward",
    "pmRecommendations": ["preventive maintenance suggestions"],
    "trainingNeeds": ["any training required for staff"]
  },
  "kpiMetrics": {
    "mtbf": "Mean Time Between Failures estimate",
    "mttr": "Mean Time To Repair estimate",
    "availabilityImpact": "Effect on equipment availability",
    "reliabilityTarget": "Target reliability after improvements"
  },
  "riskAssessment": {
    "recurrenceProbability": "high|medium|low",
    "consequenceSeverity": "high|medium|low",
    "riskScore": number (1-25),
    "mitigationPriority": number (1-5)
  }
}

Be specific, actionable, and data-driven. This analysis will be used by maintenance managers to make critical decisions.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 4000,
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
export const generateBreakdownAnalysis = generateFindingBreakdown;
export const generateDeepDiveAnalysis = analyzeKeyFinding;
