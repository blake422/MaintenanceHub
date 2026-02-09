import { userRepository } from "./repositories/userRepository";
import { companyRepository } from "./repositories/companyRepository";
import { equipmentRepository } from "./repositories/equipmentRepository";
import { workOrderRepository } from "./repositories/workOrderRepository";
import { partsRepository } from "./repositories/partsRepository";
import { pmRepository } from "./repositories/pmRepository";
import { downtimeRepository } from "./repositories/downtimeRepository";
import { rcaRepository } from "./repositories/rcaRepository";
import { troubleshootingRepository } from "./repositories/troubleshootingRepository";
import { trainingRepository } from "./repositories/trainingRepository";
import { schematicRepository } from "./repositories/schematicRepository";
import { aiRepository } from "./repositories/aiRepository";
import { excellenceRepository } from "./repositories/excellenceRepository";
import { integrationRepository } from "./repositories/integrationRepository";
import { cilrRepository } from "./repositories/cilrRepository";

// Re-export types
export type { IStorage } from "./types";

// Unified storage object that delegates to domain-specific repositories
// Maintains backward compatibility with the original storage.ts interface
export const storage = {
  // User operations
  getUser: userRepository.getUser,
  getUserByEmail: userRepository.getUserByEmail,
  upsertUser: userRepository.upsertUser,
  getAllUsers: userRepository.getAllUsers,
  getUsersByCompany: userRepository.getUsersByCompany,
  updateUser: userRepository.updateUser,

  // Invitation operations
  getInvitationsByCompany: userRepository.getInvitationsByCompany,
  getInvitationByToken: userRepository.getInvitationByToken,
  getInvitationByEmail: userRepository.getInvitationByEmail,
  createInvitation: userRepository.createInvitation,
  updateInvitation: userRepository.updateInvitation,
  deleteInvitation: userRepository.deleteInvitation,

  // Atomic license-checked operations (prevents race conditions)
  addUserToCompanyWithLicenseCheck: userRepository.addUserToCompanyWithLicenseCheck,
  createInvitationWithLicenseCheck: userRepository.createInvitationWithLicenseCheck,

  // Access Key operations
  getAccessKeyByKey: userRepository.getAccessKeyByKey,
  getAllAccessKeys: userRepository.getAllAccessKeys,
  createAccessKey: userRepository.createAccessKey,
  updateAccessKey: userRepository.updateAccessKey,
  deleteAccessKey: userRepository.deleteAccessKey,
  markAccessKeyUsed: userRepository.markAccessKeyUsed,

  // Signup Request operations
  createSignupRequest: userRepository.createSignupRequest,
  getSignupRequestByEmail: userRepository.getSignupRequestByEmail,
  getPendingSignupRequests: userRepository.getPendingSignupRequests,
  updateSignupRequest: userRepository.updateSignupRequest,
  deleteSignupRequest: userRepository.deleteSignupRequest,

  // Password Reset Token operations
  createPasswordResetToken: userRepository.createPasswordResetToken,
  getPasswordResetToken: userRepository.getPasswordResetToken,
  markPasswordResetTokenUsed: userRepository.markPasswordResetTokenUsed,
  deleteExpiredPasswordResetTokens: userRepository.deleteExpiredPasswordResetTokens,

  // Company operations
  getAllCompanies: companyRepository.getAllCompanies,
  getCompany: companyRepository.getCompany,
  createCompany: companyRepository.createCompany,
  updateCompany: companyRepository.updateCompany,
  deleteCompany: companyRepository.deleteCompany,
  completeOnboarding: companyRepository.completeOnboarding,
  updateCompanyStripeInfo: companyRepository.updateCompanyStripeInfo,
  updateCompanyLicenses: companyRepository.updateCompanyLicenses,
  updateCompanyPackageSettings: companyRepository.updateCompanyPackageSettings,
  getCompanySeatCounts: companyRepository.getCompanySeatCounts,
  getCompanyByStripeCustomerId: companyRepository.getCompanyByStripeCustomerId,
  updateCompanyOnboardingStage: companyRepository.updateCompanyOnboardingStage,
  getStripeConfig: companyRepository.getStripeConfig,
  setStripeConfig: companyRepository.setStripeConfig,

  // Seat-based billing operations
  updatePurchasedSeats: companyRepository.updatePurchasedSeats,
  getSeatBreakdown: companyRepository.getSeatBreakdown,
  setPaymentRestriction: companyRepository.setPaymentRestriction,

  // Equipment operations
  getEquipmentByCompany: equipmentRepository.getEquipmentByCompany,
  getEquipment: equipmentRepository.getEquipment,
  createEquipment: equipmentRepository.createEquipment,
  updateEquipment: equipmentRepository.updateEquipment,

  // Equipment Document operations
  getEquipmentDocumentsByEquipment: equipmentRepository.getEquipmentDocumentsByEquipment,
  getEquipmentDocument: equipmentRepository.getEquipmentDocument,
  createEquipmentDocument: equipmentRepository.createEquipmentDocument,
  deleteEquipmentDocument: equipmentRepository.deleteEquipmentDocument,
  deleteEquipment: equipmentRepository.deleteEquipment,

  // Work Order operations
  getWorkOrdersByCompany: workOrderRepository.getWorkOrdersByCompany,
  getWorkOrdersByUser: workOrderRepository.getWorkOrdersByUser,
  getWorkOrder: workOrderRepository.getWorkOrder,
  createWorkOrder: workOrderRepository.createWorkOrder,
  updateWorkOrder: workOrderRepository.updateWorkOrder,

  // Work Order Template operations
  getWorkOrderTemplatesByCompany: workOrderRepository.getWorkOrderTemplatesByCompany,
  getWorkOrderTemplate: workOrderRepository.getWorkOrderTemplate,
  createWorkOrderTemplate: workOrderRepository.createWorkOrderTemplate,
  updateWorkOrderTemplate: workOrderRepository.updateWorkOrderTemplate,
  deleteWorkOrderTemplate: workOrderRepository.deleteWorkOrderTemplate,
  deleteWorkOrder: workOrderRepository.deleteWorkOrder,

  // Parts operations
  getPartsByCompany: partsRepository.getPartsByCompany,
  getPart: partsRepository.getPart,
  createPart: partsRepository.createPart,
  updatePart: partsRepository.updatePart,
  deletePart: partsRepository.deletePart,

  // PM Schedule operations
  getPMSchedulesByCompany: pmRepository.getPMSchedulesByCompany,
  getPMSchedule: pmRepository.getPMSchedule,
  createPMSchedule: pmRepository.createPMSchedule,
  updatePMSchedule: pmRepository.updatePMSchedule,
  deletePMSchedule: pmRepository.deletePMSchedule,

  // PM Task operations
  getPMTasksBySchedule: pmRepository.getPMTasksBySchedule,
  createPMTask: pmRepository.createPMTask,

  // PM Required Parts operations
  getPMRequiredPartsBySchedule: pmRepository.getPMRequiredPartsBySchedule,
  createPMRequiredPart: pmRepository.createPMRequiredPart,

  // Downtime operations
  getDowntimeRecordsByCompany: downtimeRepository.getDowntimeRecordsByCompany,
  createDowntimeRecord: downtimeRepository.createDowntimeRecord,

  // Downtime Reports operations
  getDowntimeReportsByCompany: downtimeRepository.getDowntimeReportsByCompany,
  getDowntimeReportById: downtimeRepository.getDowntimeReportById,
  createDowntimeReport: downtimeRepository.createDowntimeReport,
  updateDowntimeReport: downtimeRepository.updateDowntimeReport,
  deleteDowntimeReport: downtimeRepository.deleteDowntimeReport,

  // RCA operations
  getRCARecordsByCompany: rcaRepository.getRCARecordsByCompany,
  getRCARecord: rcaRepository.getRCARecord,
  createRCARecord: rcaRepository.createRCARecord,
  updateRCARecord: rcaRepository.updateRCARecord,

  // Troubleshooting operations
  getTroubleshootingSessionsByCompany: troubleshootingRepository.getTroubleshootingSessionsByCompany,
  getTroubleshootingSession: troubleshootingRepository.getTroubleshootingSession,
  createTroubleshootingSession: troubleshootingRepository.createTroubleshootingSession,
  updateTroubleshootingSession: troubleshootingRepository.updateTroubleshootingSession,

  // Training operations
  getTrainingModulesByCompany: trainingRepository.getTrainingModulesByCompany,
  getTrainingModule: trainingRepository.getTrainingModule,
  createTrainingModule: trainingRepository.createTrainingModule,
  updateTrainingModule: trainingRepository.updateTrainingModule,
  getTrainingProgressByUser: trainingRepository.getTrainingProgressByUser,
  createOrUpdateTrainingProgress: trainingRepository.createOrUpdateTrainingProgress,

  // Badge operations
  getAllBadges: trainingRepository.getAllBadges,
  getUserBadges: trainingRepository.getUserBadges,
  awardBadge: trainingRepository.awardBadge,

  // Certification operations
  getUserCertifications: trainingRepository.getUserCertifications,
  createCertification: trainingRepository.createCertification,

  // Schematic operations
  getSchematicsByCompany: schematicRepository.getSchematicsByCompany,
  getSchematicProgress: schematicRepository.getSchematicProgress,
  createOrUpdateSchematicProgress: schematicRepository.createOrUpdateSchematicProgress,

  // AI Recommendations operations
  getAIRecommendationsByCompany: aiRepository.getAIRecommendationsByCompany,
  getAIRecommendation: aiRepository.getAIRecommendation,
  createAIRecommendation: aiRepository.createAIRecommendation,
  updateAIRecommendation: aiRepository.updateAIRecommendation,
  approveAIRecommendation: aiRepository.approveAIRecommendation,
  rejectAIRecommendation: aiRepository.rejectAIRecommendation,

  // Excellence Progress operations
  getExcellenceProgress: excellenceRepository.getExcellenceProgress,
  getExcellenceProgressByCompany: excellenceRepository.getExcellenceProgressByCompany,
  createExcellenceProgress: excellenceRepository.createExcellenceProgress,
  updateExcellenceProgress: excellenceRepository.updateExcellenceProgress,

  // Excellence Deliverables operations
  getExcellenceDeliverables: excellenceRepository.getExcellenceDeliverables,
  getExcellenceDeliverable: excellenceRepository.getExcellenceDeliverable,
  createExcellenceDeliverable: excellenceRepository.createExcellenceDeliverable,
  updateExcellenceDeliverable: excellenceRepository.updateExcellenceDeliverable,
  deleteExcellenceDeliverable: excellenceRepository.deleteExcellenceDeliverable,

  // Client Company operations
  getClientCompaniesByCompany: excellenceRepository.getClientCompaniesByCompany,
  getClientCompany: excellenceRepository.getClientCompany,
  createClientCompany: excellenceRepository.createClientCompany,
  updateClientCompany: excellenceRepository.updateClientCompany,
  deleteClientCompany: excellenceRepository.deleteClientCompany,

  // Interview Session operations
  getInterviewSessionsByCompany: excellenceRepository.getInterviewSessionsByCompany,
  getInterviewSessionsByClientCompany: excellenceRepository.getInterviewSessionsByClientCompany,
  getInterviewSessionsByAssessment: excellenceRepository.getInterviewSessionsByAssessment,
  getInterviewSession: excellenceRepository.getInterviewSession,
  createInterviewSession: excellenceRepository.createInterviewSession,
  updateInterviewSession: excellenceRepository.updateInterviewSession,
  deleteInterviewSession: excellenceRepository.deleteInterviewSession,

  // Integration operations
  getIntegrationsByCompany: integrationRepository.getIntegrationsByCompany,
  getIntegration: integrationRepository.getIntegration,
  createIntegration: integrationRepository.createIntegration,
  updateIntegration: integrationRepository.updateIntegration,
  deleteIntegration: integrationRepository.deleteIntegration,

  // Integration Log operations
  getIntegrationLogs: integrationRepository.getIntegrationLogs,
  createIntegrationLog: integrationRepository.createIntegrationLog,
  deleteIntegrationLogsByIntegration: integrationRepository.deleteIntegrationLogsByIntegration,

  // Timer lifecycle operations
  startTimer: workOrderRepository.startTimer,
  pauseTimer: workOrderRepository.pauseTimer,
  resumeTimer: workOrderRepository.resumeTimer,
  stopTimer: workOrderRepository.stopTimer,
  getActiveTimeEntry: workOrderRepository.getActiveTimeEntry,
  getTimeEntriesByWorkOrder: workOrderRepository.getTimeEntriesByWorkOrder,

  // CILR Template operations
  getCilrTemplatesByCompany: cilrRepository.getCilrTemplatesByCompany,
  getCilrTemplate: cilrRepository.getCilrTemplate,
  createCilrTemplate: cilrRepository.createCilrTemplate,
  updateCilrTemplate: cilrRepository.updateCilrTemplate,
  deleteCilrTemplate: cilrRepository.deleteCilrTemplate,

  // CILR Template Task operations
  getCilrTemplateTasksByTemplate: cilrRepository.getCilrTemplateTasksByTemplate,
  getCilrTemplateTask: cilrRepository.getCilrTemplateTask,
  createCilrTemplateTask: cilrRepository.createCilrTemplateTask,
  updateCilrTemplateTask: cilrRepository.updateCilrTemplateTask,
  deleteCilrTemplateTask: cilrRepository.deleteCilrTemplateTask,

  // CILR Run operations
  getCilrRunsByCompany: cilrRepository.getCilrRunsByCompany,
  getCilrRunsByEquipment: cilrRepository.getCilrRunsByEquipment,
  getCilrRunsByUser: cilrRepository.getCilrRunsByUser,
  getCilrRun: cilrRepository.getCilrRun,
  createCilrRun: cilrRepository.createCilrRun,
  updateCilrRun: cilrRepository.updateCilrRun,
  completeCilrRun: cilrRepository.completeCilrRun,

  // CILR Task Completion operations
  getCilrTaskCompletionsByRun: cilrRepository.getCilrTaskCompletionsByRun,
  getCilrTaskCompletion: cilrRepository.getCilrTaskCompletion,
  createOrUpdateCilrTaskCompletion: cilrRepository.createOrUpdateCilrTaskCompletion,

  // CILR Media operations
  getCilrTaskMediaByCompletion: cilrRepository.getCilrTaskMediaByCompletion,
  getCilrTaskMediaByRun: cilrRepository.getCilrTaskMediaByRun,
  createCilrTaskMedia: cilrRepository.createCilrTaskMedia,
  deleteCilrTaskMedia: cilrRepository.deleteCilrTaskMedia,

  // CILR Consolidated run details
  getCilrRunDetails: cilrRepository.getCilrRunDetails,
  getCilrRunDetailsList: cilrRepository.getCilrRunDetailsList,
};

// Export individual repositories for direct access if needed
export {
  userRepository,
  companyRepository,
  equipmentRepository,
  workOrderRepository,
  partsRepository,
  pmRepository,
  downtimeRepository,
  rcaRepository,
  troubleshootingRepository,
  trainingRepository,
  schematicRepository,
  aiRepository,
  excellenceRepository,
  integrationRepository,
  cilrRepository,
};
