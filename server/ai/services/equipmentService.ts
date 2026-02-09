import { openai } from "../client";
import { aiLogger } from "../../logger";
import { pRetry, isRateLimitError, defaultRetryConfig, minimalRetryConfig } from "../retry";

// AI-Powered Equipment Import Parser
export async function parseEquipmentFromFile(
  fileContent: string,
  fileType: string
): Promise<any[]> {
  return pRetry(
    async () => {
      try {
        const prompt = `You are a data extraction expert for an industrial maintenance system. Parse the following ${fileType} data and extract equipment information.

REQUIRED OUTPUT FORMAT (JSON array):
[
  {
    "name": "string (equipment name)",
    "equipmentType": "string (type/category of equipment)",
    "manufacturer": "string (manufacturer name if available, otherwise null)",
    "model": "string (model number if available, otherwise null)",
    "serialNumber": "string (serial number if available, otherwise null)",
    "location": "string (location/area if available, otherwise null)",
    "description": "string (brief description)"
  }
]

INSTRUCTIONS:
1. Extract equipment names from any relevant columns (name, asset, machine, equipment, etc.)
2. Identify equipment types/categories (conveyor, pump, motor, press, etc.)
3. Extract manufacturer and model information if present
4. Extract serial numbers if available
5. Identify location/area information if present
6. Create brief descriptions summarizing key details
7. Return an array of equipment objects
8. If the data is just raw text, extract equipment mentions intelligently

FILE DATA:
${fileContent.substring(0, 15000)}

Return ONLY valid JSON array. Extract ALL equipment items found in the data.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // Using GPT-4o for better structured output
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: 4096,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);

        // Handle different possible response structures
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed.equipment && Array.isArray(parsed.equipment)) {
          return parsed.equipment;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          return parsed.items;
        } else {
          // Try to find any array in the response
          const values = Object.values(parsed);
          const arrayValue = values.find(v => Array.isArray(v));
          return (arrayValue as any[]) || [];
        }
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        aiLogger.error({ err: error }, "Error parsing equipment from file");
        throw error;
      }
    },
    defaultRetryConfig
  );
}

// Extract equipment, PMs, and spare parts from uploaded maintenance documents
export async function extractEquipmentData(fileBuffer: Buffer, fileName: string, fileType: string): Promise<{
  equipment: any[];
  pmSchedules: any[];
  parts: any[];
  errors: string[];
}> {
  return pRetry(
    async () => {
      try {
        let documentText = '';
        let structuredData: any = null;

        // Handle different file types
        if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          // Use XLSX to parse Excel files
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

          // Convert to JSON for AI processing
          const allSheets: any = {};
          workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            allSheets[sheetName] = XLSX.utils.sheet_to_json(worksheet);
          });
          structuredData = allSheets;

          // Also get text representation
          documentText = JSON.stringify(allSheets, null, 2);

        } else if (fileName.endsWith('.csv')) {
          // Use PapaParse for CSV
          const Papa = await import('papaparse');
          const csvText = fileBuffer.toString('utf-8');
          const parsed = Papa.default.parse(csvText, { header: true });
          structuredData = parsed.data;
          documentText = JSON.stringify(parsed.data, null, 2);

        } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
          // Extract text from PDF using pdf-parse v2
          try {
            // Import using createRequire for ESM compatibility
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const { PDFParse } = require('pdf-parse');

            // pdf-parse v2 API: instantiate PDFParse with buffer
            const parser = new PDFParse({ data: fileBuffer });
            const result = await parser.getText();
            documentText = result.text;
            aiLogger.info({ fileName, textLength: documentText.length }, "Processing PDF file");
          } catch (pdfError) {
            aiLogger.error({ err: pdfError, fileName }, "PDF parsing error");
            documentText = `[PDF Document: ${fileName} - Text extraction failed, please provide manual data entry]`;
          }

        } else if (fileType.includes('word') || fileName.endsWith('.docx')) {
          // Use mammoth for Word documents
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          documentText = result.value;
        } else {
          // Try as plain text
          documentText = fileBuffer.toString('utf-8');
        }

        // Use AI to extract structured equipment, PM schedules, and parts data
        // NO CHARACTER LIMITS - process the ENTIRE document
        const fullDocumentText = structuredData
          ? `Extract ALL equipment, PM schedules (every single one), and spare parts (every single one) from this data. Do not summarize or limit - extract everything:\n\n${documentText}`
          : `Extract ALL equipment, PM schedules (every single one), and spare parts (every single one) from this maintenance document. Do not summarize or limit - extract everything:\n\n${documentText}`;

        aiLogger.info({ textLength: documentText.length }, "Processing document - extracting ALL data");

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an exhaustive industrial maintenance data extraction machine. Your ONLY job is to extract EVERY SINGLE piece of information with ZERO omissions.

ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
- DO NOT summarize
- DO NOT sample
- DO NOT limit output
- DO NOT skip any items
- DO NOT combine similar items
- Extract EVERY equipment item (even if there are 100+)
- Extract EVERY PM task and procedure (even if there are 500+)
- Extract EVERY spare part (even if there are 1000+)
- If a manual has 200 maintenance procedures, you WILL extract all 200
- If a parts list has 500 items, you WILL extract all 500
- Completeness = 100% or FAILURE

DATA TO EXTRACT:
1. EQUIPMENT: Every single machine/equipment mentioned
   - Include: name, type, manufacturer, model, serial number, location
   - Include criticality if available: criticalityScore (1=Critical, 2=High, 3=Medium, 4=Low), criticalityRanking (text like "Critical", "High", "Medium", "Low")
   - Include assetLevel if available: "site", "area", "line", "equipment", or "component"

2. PM SCHEDULES: Every single maintenance procedure/task
   - Create ONE separate PM schedule for EACH distinct maintenance procedure
   - For each PM schedule, include:
     * equipmentName: which equipment this PM is for
     * name: name of the PM procedure (e.g., "Monthly Lubrication", "Quarterly Inspection")
     * description: what the PM involves
     * frequencyDays: how often (daily=1, weekly=7, monthly=30, quarterly=90, yearly=365)
     * tasks: array of EVERY step in this procedure with task number, description, and estimated minutes
     * requiredParts: array of EVERY part needed with part name and quantity

3. SPARE PARTS: Every single part mentioned anywhere in the document
   - Include: name, part number, machine type, stock level, min stock level, location

JSON STRUCTURE:
{
  "equipment": [
    {"name": "...", "equipmentType": "...", "manufacturer": "...", "model": "...", "serialNumber": "...", "location": "...", "criticalityScore": 1, "criticalityRanking": "Critical", "assetLevel": "equipment"}
  ],
  "pmSchedules": [
    {
      "equipmentName": "Equipment Name",
      "name": "PM Procedure Name",
      "description": "What this PM does",
      "frequencyDays": 30,
      "tasks": [
        {"taskNumber": 1, "description": "First step", "estimatedMinutes": 10},
        {"taskNumber": 2, "description": "Second step", "estimatedMinutes": 15}
      ],
      "requiredParts": [
        {"partName": "Oil Filter", "quantity": 2},
        {"partName": "Grease", "quantity": 1}
      ]
    }
  ],
  "parts": [
    {"name": "...", "partNumber": "...", "machineType": "...", "stockLevel": 0, "minStockLevel": 0, "location": "..."}
  ]
}

CRITICAL EXAMPLES:
- Manual lists "Daily Check, Weekly Lubrication, Monthly Inspection, Quarterly Service, Annual Overhaul" -> Create 5 SEPARATE PM schedules
- PM procedure has steps 1-25 -> Include ALL 25 tasks in the tasks array
- Parts list shows 300 items -> Extract ALL 300 parts
- DO NOT say "and more" or "etc." - extract EVERYTHING explicitly

YOUR SUCCESS METRIC: Did you extract 100% of all items? If not, you FAILED.`
            },
            {
              role: "user",
              content: fullDocumentText
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        });

        const extractedData = JSON.parse(response.choices[0].message.content || '{}');

        return {
          equipment: extractedData.equipment || [],
          pmSchedules: extractedData.pmSchedules || [],
          parts: extractedData.parts || [],
          errors: []
        };

      } catch (error) {
        aiLogger.error({ err: error }, "Error extracting equipment data");
        throw error;
      }
    },
    minimalRetryConfig
  );
}

// Image-based Part Identification (Google Lens-style feature)
export interface PartIdentification {
  description: string;
  partType: string;
  specifications: string[];
  technicalDetails: string;
  likelyApplications: string[];
  manufacturers?: string[];
  searchKeywords?: string[];
}

export async function identifyPartFromImage(
  base64Image: string,
  mimeType: string
): Promise<PartIdentification> {
  return pRetry(
    async () => {
      try {
        const prompt = `You are an expert industrial parts identifier with comprehensive knowledge of global industrial suppliers and manufacturers.

Analyze this image and identify the mechanical/industrial part shown. Provide:

1. **Part Identification**: Exact type and name (e.g., "6205-2RS Deep Groove Ball Bearing", "Baldor 5HP 3-Phase Motor", "Gates Hi-Power II V-Belt")
2. **Critical Specifications**: All visible markings including:
   - Part numbers, model numbers, serial numbers
   - Manufacturer names and logos
   - Size markings (dimensions, capacity, ratings)
   - Material specifications
   - Any certifications or standards (ISO, ANSI, etc.)
3. **Technical Details**: Detailed observations about construction, materials, condition, design features
4. **Common Suppliers & Manufacturers**: List 3-5 major manufacturers or suppliers who make this type of part globally
5. **Typical Applications**: Where this part is commonly used in industry
6. **Search Keywords**: Best search terms to find this exact part online

Be EXTREMELY specific and technical. Read ALL visible text and numbers. This information will be used to search global suppliers.

Return your analysis in this exact JSON format:
{
  "description": "Precise description including brand/model if visible",
  "partType": "Specific category (e.g., 'Deep Groove Ball Bearing' not just 'bearing')",
  "specifications": ["All visible specs as individual items"],
  "technicalDetails": "Comprehensive technical observations including condition and design",
  "likelyApplications": ["Specific industrial applications"],
  "manufacturers": ["Major manufacturers of this part type"],
  "searchKeywords": ["Optimized search terms for finding this part online"]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // GPT-4o supports vision
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1500,
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

// Web search results for part suppliers
export interface WebPartResult {
  supplier: string;
  searchUrl: string;
  description: string;
}

// Generate web search links for identified part
export function generatePurchaseLinks(identification: PartIdentification): WebPartResult[] {
  // Use search keywords if available, otherwise use specs
  const searchKeywords = identification.searchKeywords?.join(' ') || '';
  const specs = identification.specifications && identification.specifications.length > 0
    ? identification.specifications.join(' ')
    : '';
  const searchQuery = searchKeywords || `${identification.partType} ${specs}`.trim();
  const searchTerm = encodeURIComponent(searchQuery);

  const results: WebPartResult[] = [
    {
      supplier: "Google Search",
      searchUrl: `https://www.google.com/search?q=${searchTerm}`,
      description: "Comprehensive web search for specs, manuals, and suppliers"
    },
    {
      supplier: "Google Shopping",
      searchUrl: `https://www.google.com/search?tbm=shop&q=${searchTerm}`,
      description: "Compare prices across hundreds of online retailers"
    },
    {
      supplier: "Grainger",
      searchUrl: `https://www.grainger.com/search?searchQuery=${searchTerm}`,
      description: "Leading industrial supply & MRO products - Fast delivery"
    },
    {
      supplier: "McMaster-Carr",
      searchUrl: `https://www.mcmaster.com/#${searchTerm}`,
      description: "Comprehensive mechanical components catalog - Same-day shipping"
    },
    {
      supplier: "MSC Direct",
      searchUrl: `https://www.mscdirect.com/browse/search?q=${searchTerm}`,
      description: "Metalworking & MRO supplies - Volume pricing"
    },
    {
      supplier: "Fastenal",
      searchUrl: `https://www.fastenal.com/search/${searchTerm}`,
      description: "Industrial & construction supplies - Local branches"
    },
    {
      supplier: "Motion Industries",
      searchUrl: `https://www.motionindustries.com/search?searchTerm=${searchTerm}`,
      description: "Industrial parts distributor - Technical support"
    },
    {
      supplier: "Applied Industrial Technologies",
      searchUrl: `https://www.applied.com/search?text=${searchTerm}`,
      description: "Engineered solutions & industrial products"
    },
    {
      supplier: "Amazon Business",
      searchUrl: `https://www.amazon.com/s?k=${searchTerm}`,
      description: "Quick shipping for common parts - Prime delivery"
    },
  ];

  // If it's a bearing, add bearing-specific suppliers
  if (identification.partType.toLowerCase().includes('bearing')) {
    results.splice(5, 0, {
      supplier: "Bearing Headquarters",
      searchUrl: `https://www.bearinghq.com/search?q=${searchTerm}`,
      description: "Specialized bearing distributor - Expert technical support"
    });
  }

  // If it's a motor, add motor-specific suppliers
  if (identification.partType.toLowerCase().includes('motor')) {
    results.push({
      supplier: "AutomationDirect",
      searchUrl: `https://www.automationdirect.com/adc/shopping/catalog/search?searchText=${searchTerm}`,
      description: "Motors & automation components"
    });
  }

  return results;
}

// Fuzzy matching to find similar parts in inventory
export interface MatchedPart {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  machineType: string | null;
  stockLevel: number;
  minStockLevel: number;
  unitCost: number;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  confidence: number;
  matchReason: string;
}

export function matchPartsToInventory(
  identification: PartIdentification,
  inventoryParts: any[]
): MatchedPart[] {
  const searchTerms = [
    identification.partType.toLowerCase(),
    ...identification.specifications.map(s => s.toLowerCase()),
    ...identification.description.toLowerCase().split(' '),
  ];

  const matches: MatchedPart[] = [];

  for (const part of inventoryParts) {
    let score = 0;
    let matchReasons: string[] = [];

    const partText = [
      part.name,
      part.partNumber,
      part.description,
      part.machineType,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Check for part type match
    if (partText.includes(identification.partType.toLowerCase())) {
      score += 40;
      matchReasons.push(`Matches part type: ${identification.partType}`);
    }

    // Check for specification matches
    for (const spec of identification.specifications) {
      if (partText.includes(spec.toLowerCase())) {
        score += 20;
        matchReasons.push(`Matches spec: ${spec}`);
      }
    }

    // Check for keyword matches
    for (const term of searchTerms) {
      if (term.length > 3 && partText.includes(term)) {
        score += 5;
      }
    }

    // Machine type alignment
    if (part.machineType && identification.likelyApplications.some(app =>
      app.toLowerCase().includes(part.machineType.toLowerCase()) ||
      part.machineType.toLowerCase().includes(app.toLowerCase())
    )) {
      score += 15;
      matchReasons.push('Matches application type');
    }

    // Normalize score to 0-1 confidence range
    const confidence = Math.min(score / 100, 1);

    // Only include parts with confidence > 20%
    if (confidence > 0.2) {
      matches.push({
        ...part,
        confidence,
        matchReason: matchReasons.length > 0
          ? matchReasons.join('; ')
          : 'Partial keyword match',
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
