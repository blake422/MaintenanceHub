import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { upload } from "../uploadHandlers";
import * as aiService from "../aiService";
import { insertDowntimeRecordSchema, breakdownAnalysisRequestSchema } from "@shared/schema";
import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { loadCurrentUser, type AuthRequest } from "../middleware/rowLevelSecurity";
import { apiLogger, importLogger, aiLogger } from "../logger";

export function registerDowntimeRoutes(app: Express): void {
  // Get all downtime analysis reports for the company
  app.get("/api/downtime/reports", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const reports = await storage.getDowntimeReportsByCompany(currentUser.companyId);
      res.json(reports);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching downtime reports");
      res.status(500).json({ message: "Failed to fetch downtime reports" });
    }
  });

  // Get a specific downtime analysis report
  app.get("/api/downtime/reports/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(req.params.id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching downtime report");
      res.status(500).json({ message: "Failed to fetch downtime report" });
    }
  });

  // Archive a downtime report
  app.patch("/api/downtime/reports/:id/archive", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(req.params.id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      const updatedReport = await storage.updateDowntimeReport(req.params.id, { archived: true });
      res.json(updatedReport);
    } catch (error) {
      apiLogger.error({ err: error }, "Error archiving report");
      res.status(500).json({ message: "Failed to archive report" });
    }
  });

  // Unarchive a downtime report
  app.patch("/api/downtime/reports/:id/unarchive", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(req.params.id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      const updatedReport = await storage.updateDowntimeReport(req.params.id, { archived: false });
      res.json(updatedReport);
    } catch (error) {
      apiLogger.error({ err: error }, "Error unarchiving report");
      res.status(500).json({ message: "Failed to unarchive report" });
    }
  });

  // Delete a downtime report
  app.delete("/api/downtime/reports/:id", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(req.params.id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      await storage.deleteDowntimeReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      apiLogger.error({ err: error }, "Error deleting report");
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Get all downtime records
  app.get("/api/downtime", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const records = await storage.getDowntimeRecordsByCompany(currentUser.companyId);
      res.json(records);
    } catch (error) {
      apiLogger.error({ err: error }, "Error fetching downtime records");
      res.status(500).json({ message: "Failed to fetch downtime records" });
    }
  });

  // Create a downtime record
  app.post("/api/downtime", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const recordData = insertDowntimeRecordSchema.parse({
        ...req.body,
        companyId: currentUser.companyId,
      });

      const record = await storage.createDowntimeRecord(recordData);
      res.status(201).json(record);
    } catch (error) {
      apiLogger.error({ err: error }, "Error creating downtime record");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create downtime record" });
    }
  });

  // AI-Powered Downtime Analysis - Generate professional reports from imported data
  app.post("/api/downtime/import", isAuthenticated, loadCurrentUser, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      importLogger.info({ userId, email: currentUser?.email }, "Downtime import request received");

      if (!currentUser?.companyId) {
        importLogger.warn({ userId, email: currentUser?.email }, "User has no company assigned");
        return res.status(403).json({ message: "No company assigned to your account. Please contact an administrator to be added to a company." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileType = req.file.originalname.split('.').pop()?.toUpperCase() || "CSV";

      importLogger.info({ fileType, fileName: req.file.originalname }, "Generating AI analysis report");

      const equipment = await storage.getEquipmentByCompany(currentUser.companyId);

      // Parse file data based on type
      let parsedData: any[] = [];

      if (fileType === "CSV") {
        const fileContent = req.file.buffer.toString("utf-8");
        const parseResult = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });

        if (parseResult.data && parseResult.data.length > 0) {
          parsedData = parseResult.data;
          importLogger.debug({ recordCount: parsedData.length }, "Parsed CSV records");
        }
      } else if (fileType === "XLSX" || fileType === "XLS") {
        // Parse Excel files - ShopLogix optimized
        try {
          importLogger.debug({ bufferSize: req.file.buffer.length }, "Parsing Excel file");
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ message: "Excel file contains no sheets" });
          }

          importLogger.debug({ sheets: workbook.SheetNames }, "Available Excel sheets");

          // ShopLogix Priority: Look for raw data sheets first (Modified Equipment has full data)
          const prioritySheets = ['Modified Equipment', 'Raw Data', 'Data', 'Detail', 'All Data'];
          let targetSheet = workbook.SheetNames.find(name =>
            prioritySheets.some(p => name.toLowerCase().includes(p.toLowerCase()))
          );

          // If no priority sheet found, use the sheet with most rows
          if (!targetSheet) {
            let maxRows = 0;
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const data = XLSX.utils.sheet_to_json(sheet);
              if (data.length > maxRows) {
                maxRows = data.length;
                targetSheet = sheetName;
              }
            }
          }

          const worksheet = workbook.Sheets[targetSheet || workbook.SheetNames[0]];

          if (!worksheet) {
            return res.status(400).json({ message: "Could not read worksheet from Excel file" });
          }

          parsedData = XLSX.utils.sheet_to_json(worksheet);
          importLogger.debug({ recordCount: parsedData.length, sheet: targetSheet }, "Parsed Excel records");

          // Also gather summary data from other sheets for context
          const allSheetsData: any = { mainData: parsedData, summaries: {} };
          for (const sheetName of workbook.SheetNames) {
            if (sheetName !== targetSheet) {
              const sheet = workbook.Sheets[sheetName];
              const sheetData = XLSX.utils.sheet_to_json(sheet);
              if (sheetData.length > 0 && sheetData.length <= 100) {
                allSheetsData.summaries[sheetName] = sheetData;
              }
            }
          }

          // Calculate total downtime hours from raw data
          let totalHours = 0;
          const hourColumns = ['DT Hour', 'DT_Hour', 'Downtime Hours', 'Duration', 'Hours', 'Sum of DT Hour'];
          for (const row of parsedData as any[]) {
            for (const col of hourColumns) {
              if (row[col] && typeof row[col] === 'number') {
                totalHours += row[col];
                break;
              }
            }
          }
          importLogger.debug({ totalHours: totalHours.toFixed(2) }, "Calculated total downtime hours from raw data");

          // Include sheet context in parsed data for AI
          (parsedData as any).sheetContext = {
            totalSheets: workbook.SheetNames.length,
            sheetNames: workbook.SheetNames,
            primarySheet: targetSheet,
            calculatedTotalHours: totalHours,
            summaries: allSheetsData.summaries
          };

          if (parsedData.length === 0) {
            parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
            importLogger.debug({ recordCount: parsedData.length }, "Retry with different options");
          }
        } catch (xlsError) {
          const err = xlsError instanceof Error ? xlsError : new Error(String(xlsError));
          importLogger.error({ err }, "Excel parsing error");
          return res.status(400).json({
            message: `Failed to parse Excel file: ${err.message}. Please ensure the file is a valid Excel format.`
          });
        }
      } else {
        // For other file types, try as text
        const fileContent = req.file.buffer.toString("utf-8");
        parsedData = [{ rawContent: fileContent }];
      }

      if (parsedData.length === 0) {
        return res.status(400).json({ message: "No data found in uploaded file" });
      }

      // Sample intelligently - analyze more records for comprehensive analysis
      const sampleSize = Math.min(2000, parsedData.length);
      const dataToAnalyze = parsedData.slice(0, sampleSize);
      importLogger.info({ totalRecords: parsedData.length, sampleSize: dataToAnalyze.length }, "Analyzing records");

      // Get pre-calculated totals from sheet context
      const sheetContext = (parsedData as any).sheetContext || {};
      const calculatedTotalHours = sheetContext.calculatedTotalHours || 0;

      // Build comprehensive data package for AI
      const analysisPackage = {
        totalRecords: parsedData.length,
        calculatedTotalDowntimeHours: calculatedTotalHours,
        sheetInfo: sheetContext,
        sampleData: dataToAnalyze,
        summaryData: sheetContext.summaries || {}
      };

      // Format as compact JSON for AI parsing
      const formattedData = JSON.stringify(analysisPackage);
      importLogger.debug({ dataSize: formattedData.length, totalHours: calculatedTotalHours.toFixed(2) }, "Formatted data for AI analysis");

      // Generate comprehensive AI analysis report
      const reportData = await aiService.generateDowntimeAnalysisReport(formattedData, fileType, equipment);

      // Use calculated total hours if AI underreported
      if (calculatedTotalHours > 0 && reportData.totalDowntimeHours < calculatedTotalHours * 0.5) {
        importLogger.info({ aiReported: reportData.totalDowntimeHours, calculated: calculatedTotalHours }, "Correcting total hours from AI");
        reportData.totalDowntimeHours = calculatedTotalHours;
        if (reportData.analysisData?.summary) {
          reportData.analysisData.summary.totalDowntimeHours = calculatedTotalHours;
        }
      }

      // Use actual record count
      if (parsedData.length > reportData.recordCount) {
        reportData.recordCount = parsedData.length;
      }

      aiLogger.info({ recordCount: reportData.recordCount, totalHours: reportData.totalDowntimeHours.toFixed(2) }, "AI generated report");

      // Store the analysis report
      const report = await storage.createDowntimeReport({
        companyId: currentUser.companyId,
        createdById: userId,
        fileName: req.file.originalname,
        fileType,
        recordCount: reportData.recordCount,
        totalDowntimeHours: reportData.totalDowntimeHours,
        analysisData: reportData.analysisData,
      });

      importLogger.info({ reportId: report.id }, "Report saved successfully");

      res.json({
        success: true,
        reportId: report.id,
        recordCount: reportData.recordCount,
        totalDowntimeHours: reportData.totalDowntimeHours,
        summary: reportData.analysisData.summary,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      importLogger.error({ err }, "Error generating downtime analysis");
      res.status(500).json({ message: "Failed to generate downtime analysis report. Please try again." });
    }
  });

  // Analyze downtime with AI
  app.post("/api/downtime/analyze", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.companyId) {
        apiLogger.warn({ userId }, "User has no company assigned");
        return res.status(403).json({ message: "No company assigned to your account. Please contact an administrator." });
      }

      aiLogger.info({ companyId: currentUser.companyId, email: currentUser.email }, "Analyzing downtime");

      const downtimeRecords = await storage.getDowntimeRecordsByCompany(currentUser.companyId);
      const equipment = await storage.getEquipmentByCompany(currentUser.companyId);

      aiLogger.debug({ recordCount: downtimeRecords.length, equipmentCount: equipment.length }, "Found downtime data");

      if (downtimeRecords.length === 0) {
        return res.status(400).json({ message: "No downtime records available for analysis. Please add downtime records first." });
      }

      const analysis = await aiService.analyzeDowntimeData(downtimeRecords, equipment);
      res.json(analysis);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      aiLogger.error({ err }, "Error analyzing downtime");
      res.status(500).json({ message: "Failed to analyze downtime data. Please try again." });
    }
  });

  // Deep-dive analysis for individual key findings
  app.post("/api/downtime/reports/:id/analyze-finding", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);
      const { id } = req.params;
      const { finding, context } = req.body;

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (!finding) {
        return res.status(400).json({ message: "Finding data is required" });
      }

      // Get equipment for context
      const equipment = await storage.getEquipmentByCompany(currentUser.companyId);

      // Generate comprehensive deep-dive analysis using AI
      const deepDive = await aiService.analyzeKeyFinding(finding, context, equipment, report.analysisData);

      res.json(deepDive);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      aiLogger.error({ err }, "Error generating deep-dive analysis");
      res.status(500).json({ message: "Failed to generate deep-dive analysis. Please try again." });
    }
  });

  // Generate comprehensive breakdown analysis with 5 Whys and Fishbone
  app.post("/api/downtime/reports/:id/breakdown-analysis", isAuthenticated, loadCurrentUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUser(userId);
      const { id } = req.params;

      if (!currentUser?.companyId) {
        return res.status(403).json({ message: "No company assigned" });
      }

      const report = await storage.getDowntimeReportById(id);
      if (!report || report.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Validate request body with zod schema
      const validationResult = breakdownAnalysisRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: validationResult.error.errors
        });
      }

      const { finding, segment } = validationResult.data;

      // Generate breakdown analysis with 5 Whys and Fishbone
      aiLogger.info({ finding: finding.title || finding.cause, segment }, "Generating breakdown");
      const breakdown = await aiService.generateFindingBreakdown(finding, segment, report.analysisData);
      aiLogger.debug({
        resultKeys: Object.keys(breakdown),
        fiveWhysCount: breakdown.fiveWhys?.length,
        hasFishbone: !!breakdown.fishbone
      }, "Breakdown generated");

      res.json(breakdown);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      aiLogger.error({ err }, "Error generating breakdown analysis");
      res.status(500).json({ message: "Failed to generate breakdown analysis. Please try again." });
    }
  });
}
