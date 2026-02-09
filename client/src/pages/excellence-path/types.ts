import type { LucideIcon } from "lucide-react";

export interface ChecklistItem {
  id: string;
  text: string;
  deliverable: string;
}

export interface Step {
  id: number;
  title: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
  objective: string;
  timeline: string;
  keyDeliverables: string[];
  checklist: ChecklistItem[];
}

export interface ProgramDocument {
  name: string;
  fileName: string;
  description: string;
  type: "pdf" | "xlsx" | "xltx";
  steps: number[]; // Which steps this document applies to (0 = general/all steps)
}

export interface ImprovementAction {
  id: string;
  step: number;
  priority: "critical" | "high" | "medium";
  action: string;
  rationale: string;
  category: string;
}

export interface AssessmentData {
  plantName?: string;
  assessorName?: string;
  assessmentDate?: string;
  totalScore?: number;
  maxScore?: number;
  percentageScore?: number;
  improvementActions?: ImprovementAction[];
}

export interface OpenFormDrawer {
  checklistItemId: string;
  formType: string;
}

export interface StepProgress {
  completed: boolean;
  notes: string;
  checklist: Record<string, boolean>;
  progress: number;
  completedAt?: string | null;
}
