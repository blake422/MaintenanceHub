import type {
  User,
  UpsertUser,
  Company,
  InsertCompany,
  Invitation,
  InsertInvitation,
  AccessKey,
  InsertAccessKey,
  SignupRequest,
  InsertSignupRequest,
  PasswordResetToken,
  Equipment,
  InsertEquipment,
  EquipmentDocument,
  InsertEquipmentDocument,
  WorkOrder,
  InsertWorkOrder,
  Part,
  InsertPart,
  PMSchedule,
  InsertPMSchedule,
  PMTask,
  InsertPMTask,
  PMRequiredPart,
  InsertPMRequiredPart,
  DowntimeRecord,
  InsertDowntimeRecord,
  DowntimeReport,
  InsertDowntimeReport,
  RCA,
  InsertRCA,
  TroubleshootingSession,
  InsertTroubleshootingSession,
  TrainingModule,
  InsertTrainingModule,
  TrainingProgress,
  InsertTrainingProgress,
  Badge,
  InsertBadge,
  UserBadge,
  InsertUserBadge,
  Certification,
  InsertCertification,
  Schematic,
  InsertSchematic,
  SchematicProgress,
  InsertSchematicProgress,
  TimeEntry,
  InsertTimeEntry,
  WorkOrderTemplate,
  InsertWorkOrderTemplate,
  AIRecommendation,
  InsertAIRecommendation,
  ExcellenceProgress,
  InsertExcellenceProgress,
  ExcellenceDeliverable,
  InsertExcellenceDeliverable,
  ClientCompany,
  InsertClientCompany,
  InterviewSession,
  InsertInterviewSession,
  Integration,
  InsertIntegration,
  IntegrationLog,
  InsertIntegrationLog,
  CilrTemplate,
  InsertCilrTemplate,
  CilrTemplateTask,
  InsertCilrTemplateTask,
  CilrRun,
  InsertCilrRun,
  CilrTaskCompletion,
  InsertCilrTaskCompletion,
  CilrTaskMedia,
  InsertCilrTaskMedia,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User | undefined>;

  // Invitation operations
  getInvitationsByCompany(companyId: string): Promise<Invitation[]>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationByEmail(email: string): Promise<Invitation | undefined>;
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  updateInvitation(id: string, invitation: Partial<InsertInvitation>): Promise<Invitation | undefined>;
  deleteInvitation(id: string): Promise<void>;

  // Access Key operations
  getAccessKeyByKey(key: string): Promise<AccessKey | undefined>;
  getAllAccessKeys(): Promise<AccessKey[]>;
  createAccessKey(accessKey: InsertAccessKey): Promise<AccessKey>;
  updateAccessKey(id: string, data: Partial<InsertAccessKey>): Promise<AccessKey | undefined>;
  deleteAccessKey(id: string): Promise<void>;
  markAccessKeyUsed(id: string, userId: string): Promise<void>;

  // Signup Request operations
  createSignupRequest(request: InsertSignupRequest): Promise<SignupRequest>;
  getSignupRequestByEmail(email: string): Promise<SignupRequest | undefined>;
  getPendingSignupRequests(): Promise<SignupRequest[]>;
  updateSignupRequest(id: string, data: Partial<InsertSignupRequest>): Promise<SignupRequest | undefined>;
  deleteSignupRequest(id: string): Promise<void>;

  // Password Reset Token operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  deleteExpiredPasswordResetTokens(userId: string): Promise<void>;

  // Company operations
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;
  completeOnboarding(companyId: string): Promise<void>;
  updateCompanyStripeInfo(companyId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<void>;
  updateCompanyLicenses(companyId: string, licenses: { purchasedManagerSeats: number; purchasedTechSeats: number }): Promise<void>;
  updateCompanyPackageSettings(companyId: string, settings: { packageType?: "full_access" | "operations" | "troubleshooting" | "demo"; isLive?: boolean; demoExpiresAt?: Date | null; enabledModules?: string[]; purchasedManagerSeats?: number; purchasedTechSeats?: number }): Promise<void>;
  getCompanySeatCounts(companyId: string): Promise<{ techSeats: number; managerSeats: number; totalSeats: number }>;

  // Equipment operations
  getEquipmentByCompany(companyId: string): Promise<Equipment[]>;
  getEquipment(id: string): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;

  // Equipment Document operations
  getEquipmentDocumentsByEquipment(equipmentId: string): Promise<EquipmentDocument[]>;
  getEquipmentDocument(id: string): Promise<EquipmentDocument | undefined>;
  createEquipmentDocument(document: InsertEquipmentDocument): Promise<EquipmentDocument>;
  deleteEquipmentDocument(id: string): Promise<void>;
  deleteEquipment(id: string): Promise<void>;

  // Work Order operations
  getWorkOrdersByCompany(companyId: string): Promise<WorkOrder[]>;
  getWorkOrdersByUser(userId: string): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, workOrder: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;

  // Work Order Template operations
  getWorkOrderTemplatesByCompany(companyId: string): Promise<WorkOrderTemplate[]>;
  getWorkOrderTemplate(id: string): Promise<WorkOrderTemplate | undefined>;
  createWorkOrderTemplate(template: InsertWorkOrderTemplate): Promise<WorkOrderTemplate>;
  updateWorkOrderTemplate(id: string, template: Partial<InsertWorkOrderTemplate>): Promise<WorkOrderTemplate | undefined>;
  deleteWorkOrderTemplate(id: string): Promise<void>;
  deleteWorkOrder(id: string): Promise<void>;

  // Parts operations
  getPartsByCompany(companyId: string): Promise<Part[]>;
  getPart(id: string): Promise<Part | undefined>;
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<void>;

  // PM Schedule operations
  getPMSchedulesByCompany(companyId: string): Promise<PMSchedule[]>;
  getPMSchedule(id: string): Promise<PMSchedule | undefined>;
  createPMSchedule(schedule: InsertPMSchedule): Promise<PMSchedule>;
  updatePMSchedule(id: string, schedule: Partial<InsertPMSchedule>): Promise<PMSchedule | undefined>;
  deletePMSchedule(id: string): Promise<void>;

  // PM Task operations
  getPMTasksBySchedule(scheduleId: string): Promise<PMTask[]>;
  createPMTask(task: InsertPMTask): Promise<PMTask>;

  // PM Required Parts operations
  getPMRequiredPartsBySchedule(scheduleId: string): Promise<PMRequiredPart[]>;
  createPMRequiredPart(part: InsertPMRequiredPart): Promise<PMRequiredPart>;

  // Downtime operations
  getDowntimeRecordsByCompany(companyId: string): Promise<DowntimeRecord[]>;
  createDowntimeRecord(record: InsertDowntimeRecord): Promise<DowntimeRecord>;

  // Downtime Reports operations
  getDowntimeReportsByCompany(companyId: string): Promise<DowntimeReport[]>;
  getDowntimeReportById(id: string): Promise<DowntimeReport | undefined>;
  createDowntimeReport(report: InsertDowntimeReport): Promise<DowntimeReport>;
  updateDowntimeReport(id: string, report: Partial<InsertDowntimeReport>): Promise<DowntimeReport | undefined>;
  deleteDowntimeReport(id: string): Promise<void>;

  // RCA operations
  getRCARecordsByCompany(companyId: string): Promise<RCA[]>;
  getRCARecord(id: string): Promise<RCA | undefined>;
  createRCARecord(record: InsertRCA): Promise<RCA>;
  updateRCARecord(id: string, record: Partial<InsertRCA>): Promise<RCA | undefined>;

  // Troubleshooting operations
  getTroubleshootingSessionsByCompany(companyId: string): Promise<TroubleshootingSession[]>;
  getTroubleshootingSession(id: string): Promise<TroubleshootingSession | undefined>;
  createTroubleshootingSession(session: InsertTroubleshootingSession): Promise<TroubleshootingSession>;
  updateTroubleshootingSession(id: string, session: Partial<InsertTroubleshootingSession>): Promise<TroubleshootingSession | undefined>;

  // Training operations
  getTrainingModulesByCompany(companyId: string): Promise<TrainingModule[]>;
  getTrainingModule(id: string): Promise<TrainingModule | undefined>;
  createTrainingModule(module: InsertTrainingModule): Promise<TrainingModule>;
  updateTrainingModule(id: string, updates: Partial<InsertTrainingModule>): Promise<TrainingModule | undefined>;
  getTrainingProgressByUser(userId: string): Promise<TrainingProgress[]>;
  createOrUpdateTrainingProgress(progress: InsertTrainingProgress): Promise<TrainingProgress>;

  // Badge operations
  getAllBadges(): Promise<Badge[]>;
  getUserBadges(userId: string): Promise<UserBadge[]>;
  awardBadge(userBadge: InsertUserBadge): Promise<UserBadge>;

  // Certification operations
  getUserCertifications(userId: string): Promise<Certification[]>;
  createCertification(certification: InsertCertification): Promise<Certification>;

  // Schematic operations
  getSchematicsByCompany(companyId: string): Promise<Schematic[]>;
  getSchematicProgress(userId: string): Promise<SchematicProgress[]>;
  createOrUpdateSchematicProgress(progress: InsertSchematicProgress): Promise<SchematicProgress>;

  // AI Recommendations operations
  getAIRecommendationsByCompany(companyId: string): Promise<AIRecommendation[]>;
  getAIRecommendation(id: string): Promise<AIRecommendation | undefined>;
  createAIRecommendation(recommendation: InsertAIRecommendation): Promise<AIRecommendation>;
  updateAIRecommendation(id: string, recommendation: Partial<InsertAIRecommendation>): Promise<AIRecommendation | undefined>;
  approveAIRecommendation(id: string, userId: string): Promise<AIRecommendation | undefined>;
  rejectAIRecommendation(id: string, userId: string, reason: string): Promise<AIRecommendation | undefined>;

  // Excellence Progress operations
  getExcellenceProgress(id: string): Promise<ExcellenceProgress | undefined>;
  getExcellenceProgressByCompany(companyId: string, clientCompanyId?: string): Promise<ExcellenceProgress | undefined>;
  createExcellenceProgress(progress: InsertExcellenceProgress): Promise<ExcellenceProgress>;
  updateExcellenceProgress(id: string, progress: Partial<InsertExcellenceProgress>): Promise<ExcellenceProgress | undefined>;

  // Excellence Deliverables operations
  getExcellenceDeliverables(companyId: string, step?: number, clientCompanyId?: string): Promise<ExcellenceDeliverable[]>;
  getExcellenceDeliverable(id: string): Promise<ExcellenceDeliverable | undefined>;
  createExcellenceDeliverable(deliverable: InsertExcellenceDeliverable): Promise<ExcellenceDeliverable>;
  updateExcellenceDeliverable(id: string, deliverable: Partial<InsertExcellenceDeliverable>): Promise<ExcellenceDeliverable | undefined>;
  deleteExcellenceDeliverable(id: string): Promise<void>;

  // Client Company operations (for consultant-managed clients)
  getClientCompaniesByCompany(companyId: string): Promise<ClientCompany[]>;
  getClientCompany(id: string): Promise<ClientCompany | undefined>;
  createClientCompany(clientCompany: InsertClientCompany): Promise<ClientCompany>;
  updateClientCompany(id: string, clientCompany: Partial<InsertClientCompany>): Promise<ClientCompany | undefined>;
  deleteClientCompany(id: string): Promise<void>;

  // Interview Session operations
  getInterviewSessionsByCompany(companyId: string): Promise<InterviewSession[]>;
  getInterviewSessionsByClientCompany(clientCompanyId: string): Promise<InterviewSession[]>;
  getInterviewSessionsByAssessment(assessmentDeliverableId: string): Promise<InterviewSession[]>;
  getInterviewSession(id: string): Promise<InterviewSession | undefined>;
  createInterviewSession(session: InsertInterviewSession): Promise<InterviewSession>;
  updateInterviewSession(id: string, session: Partial<InsertInterviewSession>): Promise<InterviewSession | undefined>;
  deleteInterviewSession(id: string): Promise<void>;

  // Integration operations
  getIntegrationsByCompany(companyId: string): Promise<Integration[]>;
  getIntegration(id: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, integration: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(id: string): Promise<void>;

  // Integration Log operations
  getIntegrationLogs(integrationId: string): Promise<IntegrationLog[]>;
  createIntegrationLog(log: InsertIntegrationLog): Promise<IntegrationLog>;
  deleteIntegrationLogsByIntegration(integrationId: string): Promise<void>;

  // Timer lifecycle operations
  startTimer(workOrderId: string, technicianId: string, companyId: string): Promise<{ workOrder: WorkOrder; timeEntry: TimeEntry }>;
  pauseTimer(workOrderId: string, technicianId: string, breakReason: string, notes?: string): Promise<{ workOrder: WorkOrder; workEntry: TimeEntry; breakEntry: TimeEntry }>;
  resumeTimer(workOrderId: string, technicianId: string): Promise<{ workOrder: WorkOrder; timeEntry: TimeEntry }>;
  stopTimer(workOrderId: string, technicianId: string): Promise<WorkOrder>;
  getActiveTimeEntry(technicianId: string): Promise<(TimeEntry & { workOrder?: WorkOrder }) | undefined>;
  getTimeEntriesByWorkOrder(workOrderId: string): Promise<TimeEntry[]>;

  // CILR Template operations
  getCilrTemplatesByCompany(companyId: string): Promise<CilrTemplate[]>;
  getCilrTemplate(id: string): Promise<CilrTemplate | undefined>;
  createCilrTemplate(template: InsertCilrTemplate): Promise<CilrTemplate>;
  updateCilrTemplate(id: string, updates: Partial<InsertCilrTemplate>): Promise<CilrTemplate | undefined>;
  deleteCilrTemplate(id: string): Promise<void>;

  // CILR Template Task operations
  getCilrTemplateTasksByTemplate(templateId: string): Promise<CilrTemplateTask[]>;
  getCilrTemplateTask(id: string): Promise<CilrTemplateTask | undefined>;
  createCilrTemplateTask(task: InsertCilrTemplateTask): Promise<CilrTemplateTask>;
  updateCilrTemplateTask(id: string, updates: Partial<InsertCilrTemplateTask>): Promise<CilrTemplateTask | undefined>;
  deleteCilrTemplateTask(id: string): Promise<void>;

  // CILR Run operations
  getCilrRunsByCompany(companyId: string): Promise<CilrRun[]>;
  getCilrRunsByEquipment(equipmentId: string): Promise<CilrRun[]>;
  getCilrRunsByUser(userId: string): Promise<CilrRun[]>;
  getCilrRun(id: string): Promise<CilrRun | undefined>;
  createCilrRun(run: InsertCilrRun): Promise<CilrRun>;
  updateCilrRun(id: string, updates: Partial<InsertCilrRun>): Promise<CilrRun | undefined>;
  completeCilrRun(id: string): Promise<CilrRun | undefined>;

  // CILR Task Completion operations
  getCilrTaskCompletionsByRun(runId: string): Promise<CilrTaskCompletion[]>;
  getCilrTaskCompletion(id: string): Promise<CilrTaskCompletion | undefined>;
  createOrUpdateCilrTaskCompletion(completion: InsertCilrTaskCompletion): Promise<CilrTaskCompletion>;

  // CILR Media operations
  getCilrTaskMediaByCompletion(completionId: string): Promise<CilrTaskMedia[]>;
  getCilrTaskMediaByRun(runId: string): Promise<CilrTaskMedia[]>;
  createCilrTaskMedia(media: InsertCilrTaskMedia): Promise<CilrTaskMedia>;
  deleteCilrTaskMedia(id: string): Promise<void>;
}

// Re-export types for convenience
export type {
  User,
  UpsertUser,
  Company,
  InsertCompany,
  Invitation,
  InsertInvitation,
  AccessKey,
  InsertAccessKey,
  SignupRequest,
  InsertSignupRequest,
  PasswordResetToken,
  Equipment,
  InsertEquipment,
  EquipmentDocument,
  InsertEquipmentDocument,
  WorkOrder,
  InsertWorkOrder,
  Part,
  InsertPart,
  PMSchedule,
  InsertPMSchedule,
  PMTask,
  InsertPMTask,
  PMRequiredPart,
  InsertPMRequiredPart,
  DowntimeRecord,
  InsertDowntimeRecord,
  DowntimeReport,
  InsertDowntimeReport,
  RCA,
  InsertRCA,
  TroubleshootingSession,
  InsertTroubleshootingSession,
  TrainingModule,
  InsertTrainingModule,
  TrainingProgress,
  InsertTrainingProgress,
  Badge,
  InsertBadge,
  UserBadge,
  InsertUserBadge,
  Certification,
  InsertCertification,
  Schematic,
  InsertSchematic,
  SchematicProgress,
  InsertSchematicProgress,
  TimeEntry,
  InsertTimeEntry,
  WorkOrderTemplate,
  InsertWorkOrderTemplate,
  AIRecommendation,
  InsertAIRecommendation,
  ExcellenceProgress,
  InsertExcellenceProgress,
  ExcellenceDeliverable,
  InsertExcellenceDeliverable,
  ClientCompany,
  InsertClientCompany,
  InterviewSession,
  InsertInterviewSession,
  Integration,
  InsertIntegration,
  IntegrationLog,
  InsertIntegrationLog,
  CilrTemplate,
  InsertCilrTemplate,
  CilrTemplateTask,
  InsertCilrTemplateTask,
  CilrRun,
  InsertCilrRun,
  CilrTaskCompletion,
  InsertCilrTaskCompletion,
  CilrTaskMedia,
  InsertCilrTaskMedia,
};
