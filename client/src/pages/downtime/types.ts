import { type DowntimeReport, type BreakdownAnalysis } from "@shared/schema";

/**
 * Action item for the action checklist
 */
export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  owner: string;
  timeline: string;
  successMetric: string;
  estimatedCost?: string;
  resources?: string;
  implementationSteps?: string[];
  raci?: {
    responsible: string;
    accountable: string;
    consulted: string;
    informed: string;
  };
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  dueDate?: string;
  completedDate?: string;
  segment: string;
  findingTitle: string;
}

/**
 * Deep dive analysis result from AI
 */
export interface DeepDiveResult {
  executiveSummary: string;
  findingDetails?: {
    title: string;
    severity: string;
    impactScore: number;
    downtimeContribution: string;
  };
  rootCauseBreakdown?: {
    primaryCause: string;
    causeChain?: string[];
    contributingFactors?: string[];
  };
  impactAssessment?: {
    productionImpact: string;
    financialImpact: string;
    safetyImplications: string;
    qualityImplications: string;
  };
  recommendedActions?: Array<{
    action: string;
    priority: string;
    owner: string;
    timeline: string;
    estimatedCost?: string;
  }>;
  riskAssessment?: {
    recurrenceProbability: string;
    consequenceSeverity: string;
    riskScore: number;
    mitigationPriority: string;
  };
  kpiMetrics?: {
    mtbf: string;
    mttr: string;
    availabilityImpact: string;
    reliabilityTarget: string;
  };
}

/**
 * Finding from segment analysis
 */
export interface Finding {
  title: string;
  description?: string;
  severity: string;
  impact: string;
  affectedEquipment?: string[];
}

/**
 * Root cause from analysis
 */
export interface RootCause {
  cause: string;
  evidence: string;
  riskLevel: string;
}

/**
 * Recommendation from analysis
 */
export interface Recommendation {
  title: string;
  description: string;
  priority: string;
  owner: string;
  timeline: string;
  expectedOutcome?: string;
  estimatedCost?: string;
}

/**
 * Pattern from analysis
 */
export interface AnalysisPattern {
  title: string;
  description: string;
  severity?: string;
  evidence?: string;
  affectedEquipment?: string[];
}

/**
 * Breakdown dialog state
 */
export interface BreakdownDialogState {
  open: boolean;
  finding: Finding | RootCause | null;
  segment: string;
}

/**
 * Deep dive dialog state
 */
export interface DeepDiveDialogState {
  open: boolean;
  finding: Finding | RootCause | Recommendation | null;
  type: string;
}

/**
 * Segment configuration
 */
export interface SegmentConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeVariant: 'destructive' | 'default' | 'secondary' | 'outline';
}

/**
 * KPI data
 */
export interface KPI {
  metric: string;
  current: string;
  target: string;
  gap: string;
}

/**
 * Segment data structure
 */
export interface SegmentData {
  downtimeHours: number;
  severity: string;
  executiveSummary: string;
  keyMetrics?: Record<string, string | number>;
  findings: Finding[];
  rootCauses: RootCause[];
  recommendations: Recommendation[];
  kpis?: KPI[];
}

/**
 * All segments
 */
export interface Segments {
  safety: SegmentData;
  quality: SegmentData;
  operations: SegmentData;
  maintenance: SegmentData;
}

/**
 * Re-export shared types
 */
export type { DowntimeReport, BreakdownAnalysis };
