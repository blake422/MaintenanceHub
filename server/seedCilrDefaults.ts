import { storage } from "./storage";
import { apiLogger } from "./logger";

const DEFAULT_CILR_TASKS = [
  {
    name: "Clean Equipment",
    taskType: "clean" as const,
    description: "Thoroughly clean all accessible surfaces and components",
    instructions: "1. Power down equipment\n2. Remove debris and buildup\n3. Wipe down surfaces with approved cleaner\n4. Ensure no residue remains",
    photoRequired: true,
    sortOrder: 1,
  },
  {
    name: "Inspect Components",
    taskType: "inspect" as const,
    description: "Visual inspection of all critical components",
    instructions: "1. Check for wear, damage, or corrosion\n2. Verify guards and covers are in place\n3. Look for leaks or unusual conditions\n4. Document any findings",
    photoRequired: true,
    sortOrder: 2,
  },
  {
    name: "Lubricate Moving Parts",
    taskType: "lubricate" as const,
    description: "Apply appropriate lubrication to all specified points",
    instructions: "1. Identify all lubrication points\n2. Clean grease fittings before application\n3. Apply correct lubricant type and amount\n4. Wipe excess lubricant",
    photoRequired: true,
    sortOrder: 3,
  },
  {
    name: "Repair/Adjust as Needed",
    taskType: "repair" as const,
    description: "Make minor repairs or adjustments identified during inspection",
    instructions: "1. Address any issues found during inspection\n2. Tighten loose fasteners\n3. Replace worn components if available\n4. Document repairs made",
    photoRequired: true,
    sortOrder: 4,
  },
];

const DEFAULT_CENTERLINE_TASKS = [
  {
    name: "Verify Speed Settings",
    taskType: "measure" as const,
    description: "Measure and record current speed settings",
    instructions: "1. Check control panel display\n2. Record current RPM/speed setting\n3. Compare to centerline specification\n4. Adjust if out of tolerance",
    targetValue: "100",
    minValue: "95",
    maxValue: "105",
    unit: "RPM",
    photoRequired: true,
    sortOrder: 1,
  },
  {
    name: "Check Temperature",
    taskType: "measure" as const,
    description: "Measure operating temperature at specified point",
    instructions: "1. Use calibrated thermometer\n2. Measure at designated location\n3. Record reading\n4. Flag if outside tolerance",
    targetValue: "150",
    minValue: "140",
    maxValue: "160",
    unit: "°F",
    photoRequired: true,
    sortOrder: 2,
  },
  {
    name: "Verify Pressure Settings",
    taskType: "measure" as const,
    description: "Check and record system pressure",
    instructions: "1. Locate pressure gauge\n2. Record current reading\n3. Compare to centerline specification\n4. Adjust regulator if needed",
    targetValue: "80",
    minValue: "75",
    maxValue: "85",
    unit: "PSI",
    photoRequired: true,
    sortOrder: 3,
  },
  {
    name: "Check Alignment",
    taskType: "verify" as const,
    description: "Verify component alignment is within specification",
    instructions: "1. Use alignment tools as specified\n2. Check belt tension and alignment\n3. Verify shaft alignment\n4. Document any adjustments",
    photoRequired: true,
    sortOrder: 4,
  },
  {
    name: "Confirm Settings Match Centerline",
    taskType: "verify" as const,
    description: "Final verification that all settings match centerline specifications",
    instructions: "1. Review all recorded measurements\n2. Confirm all values are within tolerance\n3. Sign off on centerline verification\n4. Report any deviations",
    photoRequired: true,
    sortOrder: 5,
  },
];

export async function seedDefaultCilrTemplates(companyId: string, createdBy: string): Promise<void> {
  try {
    const existingTemplates = await storage.getCilrTemplatesByCompany(companyId);
    
    const hasCilrTemplate = existingTemplates.some(t => t.name === "Standard CILR Checklist" && t.templateType === "cilr");
    const hasCenterlineTemplate = existingTemplates.some(t => t.name === "Standard Centerline Verification" && t.templateType === "centerline");

    if (!hasCilrTemplate) {
      const cilrTemplate = await storage.createCilrTemplate({
        name: "Standard CILR Checklist",
        description: "Clean, Inspect, Lubricate, Repair - Standard maintenance checklist for equipment upkeep",
        templateType: "cilr",
        companyId,
        createdBy,
        isActive: true,
        frequency: "weekly",
        estimatedMinutes: 30,
      });

      for (const task of DEFAULT_CILR_TASKS) {
        await storage.createCilrTemplateTask({
          ...task,
          templateId: cilrTemplate.id,
        });
      }

      apiLogger.info({ companyId, templateId: cilrTemplate.id }, "Created default CILR template");
    }

    if (!hasCenterlineTemplate) {
      const centerlineTemplate = await storage.createCilrTemplate({
        name: "Standard Centerline Verification",
        description: "Verify all equipment settings match centerline specifications for optimal operation",
        templateType: "centerline",
        companyId,
        createdBy,
        isActive: true,
        frequency: "shift",
        estimatedMinutes: 20,
      });

      for (const task of DEFAULT_CENTERLINE_TASKS) {
        await storage.createCilrTemplateTask({
          ...task,
          templateId: centerlineTemplate.id,
        });
      }

      apiLogger.info({ companyId, templateId: centerlineTemplate.id }, "Created default Centerline template");
    }
  } catch (error) {
    apiLogger.error({ err: error, companyId }, "Failed to seed default CILR templates");
    throw error;
  }
}

export async function seedDefaultTemplatesForAllCompanies(): Promise<void> {
  try {
    const companies = await storage.getAllCompanies();
    
    for (const company of companies) {
      const users = await storage.getUsersByCompany(company.id);
      const adminUser = users.find(u => u.role === "admin") || users[0];
      
      if (adminUser) {
        await seedDefaultCilrTemplates(company.id, adminUser.id);
      }
    }
    
    apiLogger.info({ companyCount: companies.length }, "Seeded default CILR templates for all companies");
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to seed templates for all companies");
    throw error;
  }
}
