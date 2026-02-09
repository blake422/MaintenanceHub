import * as XLSX from "xlsx";
import Papa from "papaparse";
import mammoth from "mammoth";

export interface ParsedEquipment {
  name: string;
  equipmentType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  status?: "operational" | "down" | "maintenance";
  installDate?: string;
  criticalityScore?: number;
  criticalityRanking?: string;
  assetLevel?: "site" | "area" | "line" | "equipment" | "component";
  errors?: string[];
}

export interface ParsedPMSchedule {
  equipmentName: string;
  name: string;
  description: string;
  frequencyDays: number;
  tasks?: string[];
  requiredParts?: string[];
}

export interface ParsedPart {
  name: string;
  partNumber?: string;
  machineType?: string;
  stockLevel?: number;
  minStockLevel?: number;
  location?: string;
}

export interface ImportResult {
  equipment: ParsedEquipment[];
  pmSchedules: ParsedPMSchedule[];
  parts: ParsedPart[];
  fileName: string;
  fileType: string;
  totalRows: number;
  validRows: number;
  errors: string[];
}

function validateEquipment(eq: Partial<ParsedEquipment>): ParsedEquipment {
  const errors: string[] = [];
  
  if (!eq.name || eq.name.trim() === "") {
    errors.push("Equipment name is required");
  }
  
  // Validate status if provided
  if (eq.status && !["operational", "down", "maintenance"].includes(eq.status)) {
    errors.push(`Invalid status: ${eq.status}`);
  }
  
  return {
    name: eq.name || "Unknown Equipment",
    equipmentType: eq.equipmentType,
    manufacturer: eq.manufacturer,
    model: eq.model,
    serialNumber: eq.serialNumber,
    location: eq.location,
    description: eq.description,
    status: eq.status as any,
    installDate: eq.installDate,
    criticalityScore: eq.criticalityScore,
    criticalityRanking: eq.criticalityRanking,
    assetLevel: eq.assetLevel,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function mapRowToEquipment(row: any): Partial<ParsedEquipment> {
  const columnMapping: Record<string, keyof ParsedEquipment> = {
    name: "name",
    equipmentname: "name",
    equipment: "name",
    assetname: "name",
    asset: "name",
    type: "equipmentType",
    equipmenttype: "equipmentType",
    category: "equipmentType",
    manufacturer: "manufacturer",
    make: "manufacturer",
    brand: "manufacturer",
    model: "model",
    serial: "serialNumber",
    serialnumber: "serialNumber",
    serialno: "serialNumber",
    sn: "serialNumber",
    location: "location",
    area: "location",
    department: "location",
    description: "description",
    desc: "description",
    notes: "description",
    status: "status",
    condition: "status",
    installdate: "installDate",
    installed: "installDate",
    dateinstalled: "installDate",
    // Criticality mappings
    criticality: "criticalityScore",
    criticalityscore: "criticalityScore",
    criticalityranking: "criticalityRanking",
    ranking: "criticalityRanking",
    rank: "criticalityRanking",
    priority: "criticalityRanking",
    criticalityrating: "criticalityRanking",
    rating: "criticalityRanking",
    // Asset level mappings
    assetlevel: "assetLevel",
    level: "assetLevel",
    hierarchy: "assetLevel",
    assettype: "assetLevel",
  };

  const equipment: Partial<ParsedEquipment> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnName(key);
    const targetField = columnMapping[normalizedKey];
    
    if (targetField && value !== null && value !== undefined && value !== "") {
      // Handle numeric fields
      if (targetField === "criticalityScore") {
        const numValue = parseInt(String(value), 10);
        if (!isNaN(numValue)) {
          equipment.criticalityScore = numValue;
        } else {
          // Try to map text-based criticality to score
          const textValue = String(value).toLowerCase().trim();
          if (textValue === "critical" || textValue === "a" || textValue === "1") {
            equipment.criticalityScore = 1;
            equipment.criticalityRanking = "Critical";
          } else if (textValue === "high" || textValue === "b" || textValue === "2") {
            equipment.criticalityScore = 2;
            equipment.criticalityRanking = "High";
          } else if (textValue === "medium" || textValue === "c" || textValue === "3") {
            equipment.criticalityScore = 3;
            equipment.criticalityRanking = "Medium";
          } else if (textValue === "low" || textValue === "d" || textValue === "4") {
            equipment.criticalityScore = 4;
            equipment.criticalityRanking = "Low";
          }
        }
      } else if (targetField === "criticalityRanking") {
        const textValue = String(value).trim();
        equipment.criticalityRanking = textValue;
        // Also set score based on ranking if not already set
        const lowerValue = textValue.toLowerCase();
        if (!equipment.criticalityScore) {
          if (lowerValue === "critical" || lowerValue === "a") {
            equipment.criticalityScore = 1;
          } else if (lowerValue === "high" || lowerValue === "b") {
            equipment.criticalityScore = 2;
          } else if (lowerValue === "medium" || lowerValue === "c") {
            equipment.criticalityScore = 3;
          } else if (lowerValue === "low" || lowerValue === "d") {
            equipment.criticalityScore = 4;
          }
        }
      } else if (targetField === "assetLevel") {
        const levelValue = String(value).toLowerCase().trim();
        const validLevels = ["site", "area", "line", "equipment", "component"];
        if (validLevels.includes(levelValue)) {
          equipment.assetLevel = levelValue as any;
        }
      } else {
        equipment[targetField] = String(value).trim() as any;
      }
    }
  }
  
  return equipment;
}

// Parse ABC Classification style Excel with multiple sheets and complex headers
function parseABCClassificationSheet(worksheet: XLSX.WorkSheet, sheetName: string): ParsedEquipment[] {
  const equipment: ParsedEquipment[] = [];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (rawData.length < 3) return equipment;
  
  // Find header row by looking for "Final Classification" or equipment data patterns
  let headerRowIndex = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i];
    if (!row) continue;
    const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('final classification') || rowStr.includes('environment') && rowStr.includes('safety')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').toLowerCase().trim());
      break;
    }
  }
  
  // If no header found, look for rows with equipment data (numeric code + EQUIPMENT/SYSTEM type)
  const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  
  for (let i = dataStartIndex; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 3) continue;
    
    const code = row[0];
    const level = String(row[1] || '').trim();
    const description = String(row[2] || '').trim();
    
    // Skip header rows and summary rows
    if (!description || description === '') continue;
    if (level === 'Level' || level === 'Country' || description.includes('Classification')) continue;
    
    // Check if this looks like equipment data (has a code and level type)
    const validLevels = ['equipment', 'system', 'component', 'fl', 'l1', 'l2', 'l3', 'l4', 'l5'];
    const levelLower = level.toLowerCase();
    const isEquipmentRow = validLevels.some(l => levelLower.includes(l)) || 
                           (typeof code === 'number' && description.length > 0);
    
    if (!isEquipmentRow) continue;
    
    // Extract final classification (usually column 10 or 11 for ABC Classification sheets)
    let finalClassification = '';
    for (let j = row.length - 1; j >= 3; j--) {
      const val = String(row[j] || '').trim().toUpperCase();
      if (val === 'A' || val === 'B' || val === 'C') {
        finalClassification = val;
        break;
      }
    }
    
    // Map ABC to criticality
    let criticalityScore: number | undefined;
    let criticalityRanking: string | undefined;
    if (finalClassification === 'A') {
      criticalityScore = 1;
      criticalityRanking = 'Critical';
    } else if (finalClassification === 'B') {
      criticalityScore = 2;
      criticalityRanking = 'High';
    } else if (finalClassification === 'C') {
      criticalityScore = 3;
      criticalityRanking = 'Medium';
    }
    
    // Map level to assetLevel
    let assetLevel: "site" | "area" | "line" | "equipment" | "component" | undefined;
    if (levelLower.includes('equipment') || levelLower === 'fl') {
      assetLevel = 'equipment';
    } else if (levelLower.includes('system') || levelLower.includes('component')) {
      assetLevel = 'component';
    } else if (levelLower.includes('l1') || levelLower.includes('plant')) {
      assetLevel = 'site';
    } else if (levelLower.includes('l2') || levelLower.includes('area')) {
      assetLevel = 'area';
    } else if (levelLower.includes('l3') || levelLower.includes('l4') || levelLower.includes('line') || levelLower.includes('cell')) {
      assetLevel = 'line';
    }
    
    equipment.push({
      name: description,
      serialNumber: String(code),
      equipmentType: level,
      location: sheetName,
      criticalityScore,
      criticalityRanking,
      assetLevel,
    });
  }
  
  return equipment;
}

export async function parseExcelFile(buffer: Buffer, fileName: string): Promise<ImportResult> {
  const errors: string[] = [];
  let equipment: ParsedEquipment[] = [];
  
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    // Check if this is an ABC Classification file (has characteristic sheet names)
    const isABCFile = workbook.SheetNames.some(name => 
      name.includes('Classification') || name.includes('(L') || name.includes('Plant Status')
    );
    
    if (isABCFile) {
      // Parse all sheets for ABC Classification files
      for (const sheetName of workbook.SheetNames) {
        // Skip summary/meta sheets
        if (sheetName === 'Sheet1' || sheetName === 'Plant Status' || 
            sheetName.includes('Master') || sheetName.includes('Distribution') ||
            sheetName.includes('Sheet2') || sheetName.includes('Sheet3') || sheetName.includes('Sheet4')) {
          continue;
        }
        
        const worksheet = workbook.Sheets[sheetName];
        const sheetEquipment = parseABCClassificationSheet(worksheet, sheetName);
        equipment = equipment.concat(sheetEquipment);
      }
      
      // Validate all equipment
      equipment = equipment.map(eq => validateEquipment(eq));
      
    } else {
      // Standard single-sheet parsing with column mapping
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length === 0) {
        errors.push("No data found in Excel file");
        return {
          equipment: [],
          pmSchedules: [],
          parts: [],
          fileName,
          fileType: "excel",
          totalRows: 0,
          validRows: 0,
          errors,
        };
      }
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const mapped = mapRowToEquipment(row);
        const validated = validateEquipment(mapped);
        equipment.push(validated);
      }
    }
    
    const validRows = equipment.filter(eq => !eq.errors || eq.errors.length === 0).length;
    
    return {
      equipment,
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "excel",
      totalRows: equipment.length,
      validRows,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      equipment: [],
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "excel",
      totalRows: 0,
      validRows: 0,
      errors,
    };
  }
}

export async function parseCSVFile(buffer: Buffer, fileName: string): Promise<ImportResult> {
  const errors: string[] = [];
  const equipment: ParsedEquipment[] = [];
  
  try {
    const csvText = buffer.toString("utf-8");
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => errors.push(`CSV parse error: ${err.message}`));
    }
    
    if (result.data.length === 0) {
      errors.push("No data found in CSV file");
      return {
        equipment: [],
        pmSchedules: [],
        parts: [],
        fileName,
        fileType: "csv",
        totalRows: 0,
        validRows: 0,
        errors,
      };
    }
    
    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i] as any;
      const mapped = mapRowToEquipment(row);
      const validated = validateEquipment(mapped);
      equipment.push(validated);
    }
    
    const validRows = equipment.filter(eq => !eq.errors || eq.errors.length === 0).length;
    
    return {
      equipment,
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "csv",
      totalRows: result.data.length,
      validRows,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to parse CSV file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      equipment: [],
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "csv",
      totalRows: 0,
      validRows: 0,
      errors,
    };
  }
}

export async function parsePDFFile(buffer: Buffer, fileName: string): Promise<ImportResult> {
  const errors: string[] = [];
  const equipment: ParsedEquipment[] = [];
  
  try {
    // Dynamic import for pdf-parse since it doesn't support ES modules properly
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Try to extract equipment information from structured text
    // Look for patterns like "Equipment: Name", "Type: Type", etc.
    const lines = text.split("\n").filter((line: string) => line.trim());
    
    let currentEquipment: Partial<ParsedEquipment> = {};
    let foundEquipment = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect equipment name patterns
      if (/^(equipment|asset|name|item):/i.test(trimmed)) {
        // Save previous equipment if exists
        if (foundEquipment && currentEquipment.name) {
          equipment.push(validateEquipment(currentEquipment));
        }
        // Start new equipment
        currentEquipment = {};
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) {
          currentEquipment.name = match[1].trim();
          foundEquipment = true;
        }
      } else if (/^(type|category):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.equipmentType = match[1].trim();
      } else if (/^(manufacturer|make|brand):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.manufacturer = match[1].trim();
      } else if (/^model:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.model = match[1].trim();
      } else if (/^(serial|serial number|sn):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.serialNumber = match[1].trim();
      } else if (/^location:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.location = match[1].trim();
      } else if (/^(description|notes):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.description = match[1].trim();
      } else if (/^status:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) {
          const status = match[1].trim().toLowerCase();
          if (["operational", "down", "maintenance"].includes(status)) {
            currentEquipment.status = status as any;
          }
        }
      }
    }
    
    // Save last equipment
    if (foundEquipment && currentEquipment.name) {
      equipment.push(validateEquipment(currentEquipment));
    }
    
    if (equipment.length === 0) {
      errors.push("No equipment information found in PDF. Please format as 'Equipment: Name' with fields like 'Type:', 'Location:', etc.");
    }
    
    const validRows = equipment.filter(eq => !eq.errors || eq.errors.length === 0).length;
    
    return {
      equipment,
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "pdf",
      totalRows: equipment.length,
      validRows,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to parse PDF file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      equipment: [],
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "pdf",
      totalRows: 0,
      validRows: 0,
      errors,
    };
  }
}

export async function parseWordFile(buffer: Buffer, fileName: string): Promise<ImportResult> {
  const errors: string[] = [];
  const equipment: ParsedEquipment[] = [];
  
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Similar parsing logic to PDF
    const lines = text.split("\n").filter(line => line.trim());
    
    let currentEquipment: Partial<ParsedEquipment> = {};
    let foundEquipment = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (/^(equipment|asset|name|item):/i.test(trimmed)) {
        if (foundEquipment && currentEquipment.name) {
          equipment.push(validateEquipment(currentEquipment));
        }
        currentEquipment = {};
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) {
          currentEquipment.name = match[1].trim();
          foundEquipment = true;
        }
      } else if (/^(type|category):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.equipmentType = match[1].trim();
      } else if (/^(manufacturer|make|brand):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.manufacturer = match[1].trim();
      } else if (/^model:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.model = match[1].trim();
      } else if (/^(serial|serial number|sn):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.serialNumber = match[1].trim();
      } else if (/^location:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.location = match[1].trim();
      } else if (/^(description|notes):/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) currentEquipment.description = match[1].trim();
      } else if (/^status:/i.test(trimmed)) {
        const match = trimmed.match(/^[^:]+:\s*(.+)/i);
        if (match) {
          const status = match[1].trim().toLowerCase();
          if (["operational", "down", "maintenance"].includes(status)) {
            currentEquipment.status = status as any;
          }
        }
      }
    }
    
    if (foundEquipment && currentEquipment.name) {
      equipment.push(validateEquipment(currentEquipment));
    }
    
    if (equipment.length === 0) {
      errors.push("No equipment information found in Word document. Please format as 'Equipment: Name' with fields like 'Type:', 'Location:', etc.");
    }
    
    const validRows = equipment.filter(eq => !eq.errors || eq.errors.length === 0).length;
    
    return {
      equipment,
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "word",
      totalRows: equipment.length,
      validRows,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to parse Word file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      equipment: [],
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: "word",
      totalRows: 0,
      validRows: 0,
      errors,
    };
  }
}

// Normalize criticality data from AI extraction
function normalizeCriticality(eq: any): Partial<ParsedEquipment> {
  const normalized: Partial<ParsedEquipment> = { ...eq };
  
  // Normalize criticalityScore if it's a string
  if (eq.criticalityScore !== undefined && eq.criticalityScore !== null) {
    if (typeof eq.criticalityScore === 'string') {
      const numValue = parseInt(eq.criticalityScore, 10);
      if (!isNaN(numValue)) {
        normalized.criticalityScore = numValue;
      } else {
        // Try to map text to score
        const textValue = eq.criticalityScore.toLowerCase().trim();
        if (textValue === "critical" || textValue === "a") {
          normalized.criticalityScore = 1;
          normalized.criticalityRanking = normalized.criticalityRanking || "Critical";
        } else if (textValue === "high" || textValue === "b") {
          normalized.criticalityScore = 2;
          normalized.criticalityRanking = normalized.criticalityRanking || "High";
        } else if (textValue === "medium" || textValue === "c") {
          normalized.criticalityScore = 3;
          normalized.criticalityRanking = normalized.criticalityRanking || "Medium";
        } else if (textValue === "low" || textValue === "d") {
          normalized.criticalityScore = 4;
          normalized.criticalityRanking = normalized.criticalityRanking || "Low";
        }
      }
    } else if (typeof eq.criticalityScore === 'number') {
      normalized.criticalityScore = eq.criticalityScore;
    }
  }
  
  // Normalize criticalityRanking and infer score if missing
  if (eq.criticalityRanking && !normalized.criticalityScore) {
    const ranking = String(eq.criticalityRanking).toLowerCase().trim();
    if (ranking === "critical" || ranking === "a") {
      normalized.criticalityScore = 1;
      normalized.criticalityRanking = "Critical";
    } else if (ranking === "high" || ranking === "b") {
      normalized.criticalityScore = 2;
      normalized.criticalityRanking = "High";
    } else if (ranking === "medium" || ranking === "c") {
      normalized.criticalityScore = 3;
      normalized.criticalityRanking = "Medium";
    } else if (ranking === "low" || ranking === "d") {
      normalized.criticalityScore = 4;
      normalized.criticalityRanking = "Low";
    } else {
      normalized.criticalityRanking = eq.criticalityRanking;
    }
  }
  
  // Set ranking text based on score if ranking is missing
  if (normalized.criticalityScore && !normalized.criticalityRanking) {
    const scoreLabels: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };
    normalized.criticalityRanking = scoreLabels[normalized.criticalityScore] || `Score: ${normalized.criticalityScore}`;
  }
  
  // Normalize assetLevel
  if (eq.assetLevel) {
    const levelValue = String(eq.assetLevel).toLowerCase().trim();
    const validLevels = ["site", "area", "line", "equipment", "component"];
    if (validLevels.includes(levelValue)) {
      normalized.assetLevel = levelValue as any;
    }
  }
  
  return normalized;
}

export async function parseImportFile(file: Express.Multer.File): Promise<ImportResult> {
  const fileName = file.originalname;
  const buffer = file.buffer;
  const mimeType = file.mimetype;
  
  // Use direct parsing for Excel and CSV files (faster and handles large files)
  // Only use AI extraction for PDFs and Word docs that need text extraction
  const isExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
                  fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  const isCSV = mimeType.includes('csv') || fileName.endsWith('.csv');
  const isPDF = mimeType.includes('pdf') || fileName.endsWith('.pdf');
  const isWord = mimeType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc');
  
  try {
    // Direct parsing for Excel/CSV (no AI needed, handles large files)
    if (isExcel) {
      return await parseExcelFile(buffer, fileName);
    }
    
    if (isCSV) {
      return await parseCSVFile(buffer, fileName);
    }
    
    // AI extraction for PDFs and Word docs (text extraction needed)
    if (isPDF || isWord) {
      const { extractEquipmentData } = await import('./aiService');
      const extracted = await extractEquipmentData(buffer, fileName, mimeType);
      
      // Normalize and validate equipment (including criticality data)
      const normalizedEquipment = extracted.equipment.map(eq => normalizeCriticality(eq));
      const validatedEquipment = normalizedEquipment.map(eq => validateEquipment(eq));
      const validEquipment = validatedEquipment.filter(eq => !eq.errors || eq.errors.length === 0);
      
      return {
        equipment: validatedEquipment,
        pmSchedules: extracted.pmSchedules,
        parts: extracted.parts,
        fileName,
        fileType: mimeType,
        totalRows: extracted.equipment.length + extracted.pmSchedules.length + extracted.parts.length,
        validRows: validEquipment.length,
        errors: extracted.errors,
      };
    }
    
    // Fallback: try as Excel
    return await parseExcelFile(buffer, fileName);
    
  } catch (error) {
    return {
      equipment: [],
      pmSchedules: [],
      parts: [],
      fileName,
      fileType: mimeType,
      totalRows: 0,
      validRows: 0,
      errors: [`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
