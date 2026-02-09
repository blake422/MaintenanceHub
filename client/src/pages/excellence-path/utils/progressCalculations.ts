import type { ExcellenceProgress } from "@shared/schema";
import type { Step, ChecklistItem } from "../types";

/**
 * Calculate the progress percentage for a step based on completed checklist items
 */
export function calculateStepProgress(
  checklist: ChecklistItem[],
  completedItems: Record<string, boolean>
): number {
  const totalCount = checklist.length;
  if (totalCount === 0) return 0;

  const completedCount = Object.values(completedItems).filter(Boolean).length;
  return Math.round((completedCount / totalCount) * 100);
}

/**
 * Calculate the overall progress across all steps
 */
export function calculateOverallProgress(progress: ExcellenceProgress | undefined): number {
  if (!progress) return 0;

  return Math.round(
    ((progress.step1Progress || 0) +
     (progress.step2Progress || 0) +
     (progress.step3Progress || 0) +
     (progress.step4Progress || 0) +
     (progress.step5Progress || 0) +
     (progress.step6Progress || 0)) / 6
  );
}

/**
 * Get the progress data for a specific step from the ExcellenceProgress object
 */
export function getStepProgressData(
  progress: ExcellenceProgress | undefined,
  stepId: number
): {
  completed: boolean;
  notes: string;
  checklist: Record<string, boolean>;
  progressValue: number;
  completedAt?: string | null;
} {
  if (!progress) {
    return {
      completed: false,
      notes: "",
      checklist: {},
      progressValue: 0,
      completedAt: null
    };
  }

  const stepKey = `step${stepId}`;
  const progressAny = progress as Record<string, unknown>;

  return {
    completed: (progressAny[`${stepKey}Completed`] as boolean) || false,
    notes: (progressAny[`${stepKey}Notes`] as string) || "",
    checklist: (progressAny[`${stepKey}Checklist`] as Record<string, boolean>) || {},
    progressValue: (progressAny[`${stepKey}Progress`] as number) || 0,
    completedAt: progressAny[`${stepKey}CompletedAt`] as string | null | undefined
  };
}

/**
 * Count completed tasks for a step
 */
export function countCompletedTasks(
  checklist: ChecklistItem[],
  completedItems: Record<string, boolean>
): { completed: number; total: number } {
  const total = checklist.length;
  const completed = checklist.filter(item => completedItems[item.id]).length;
  return { completed, total };
}

/**
 * Calculate total tasks and completed tasks across all steps
 */
export function calculateTotalTaskProgress(
  steps: Step[],
  progress: ExcellenceProgress | undefined
): { completedTasks: number; totalTasks: number } {
  const totalTasks = steps.reduce((acc, step) => acc + step.checklist.length, 0);

  const completedTasks = steps.reduce((acc, step) => {
    const stepData = getStepProgressData(progress, step.id);
    return acc + step.checklist.filter(item => stepData.checklist[item.id]).length;
  }, 0);

  return { completedTasks, totalTasks };
}

/**
 * Count how many steps are fully completed
 */
export function countCompletedSteps(
  steps: Step[],
  progress: ExcellenceProgress | undefined
): number {
  return steps.filter(step => {
    const stepData = getStepProgressData(progress, step.id);
    return stepData.completed;
  }).length;
}

/**
 * Get implementation phase description based on completed steps
 */
export function getImplementationPhase(completedSteps: number): string {
  if (completedSteps === 6) return "Maintenance Excellence";
  if (completedSteps >= 4) return "Advanced Implementation";
  if (completedSteps >= 2) return "Foundation Building";
  return "Assessment Phase";
}
