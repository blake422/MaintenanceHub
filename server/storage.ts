// Re-export from new modular storage structure for backward compatibility
export { storage } from "./storage/index";
export type { IStorage } from "./storage/types";

// Re-export individual repositories for direct access if needed
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
} from "./storage/index";
