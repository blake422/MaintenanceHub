// Re-export all AI services for backward compatibility

// Troubleshooting Service
export { getTroubleshootingGuidance } from "./services/troubleshootingService";

// RCA Service
export { suggestNextWhy, analyzeRootCause } from "./services/rcaService";

// Equipment Service
export {
  parseEquipmentFromFile,
  extractEquipmentData,
  identifyPartFromImage,
  generatePurchaseLinks,
  matchPartsToInventory,
  type PartIdentification,
  type WebPartResult,
  type MatchedPart,
} from "./services/equipmentService";

// Downtime Service
export {
  parseDowntimeImportFile,
  analyzeDowntimeData,
  generateDowntimeAnalysisReport,
  generateFindingBreakdown,
  analyzeKeyFinding,
  generateBreakdownAnalysis,
  generateDeepDiveAnalysis,
} from "./services/downtimeService";

// PM Service
export {
  analyzePDFManual,
  getMaintenanceSuggestions,
  generateMaintenanceRecommendations,
  generatePMRecommendations,
  optimizePMSchedules,
} from "./services/pmService";

// Corrective Service
export {
  getCorrectiveGuidance,
  type CorrectiveGuidanceStep,
  type CorrectiveGuidanceResult,
} from "./services/correctiveService";

// Interview Service
export {
  transcribeInterviewAudio,
  transcribeAudio,
  summarizeInterview,
  generateInterviewRollup,
  isAudioTranscriptionAvailable,
  type InterviewSummaryResult,
} from "./services/interviewService";

// Training Service
export {
  generateDowntimeScenario,
  generateQuizQuestions,
  generateTrainingCaseStudy,
} from "./services/trainingService";

// Client and utilities (for advanced usage)
export { openai } from "./client";
export { isRateLimitError, pRetry, defaultRetryConfig, shortRetryConfig, minimalRetryConfig } from "./retry";
