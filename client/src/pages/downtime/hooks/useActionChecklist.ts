import { useState, useCallback } from "react";
import type { ActionItem, BreakdownAnalysis } from "../types";
import { sanitizeText } from "../utils/sanitizeText";

type ToastFunction = (options: { title: string; description: string; variant?: "destructive" }) => void;

/**
 * Hook for managing action checklist state
 */
export function useActionChecklist(toast: ToastFunction) {
  const [actionChecklist, setActionChecklist] = useState<ActionItem[]>([]);
  const [showActionChecklist, setShowActionChecklist] = useState(false);

  const addActionsFromBreakdown = useCallback((
    breakdownResult: BreakdownAnalysis,
    segment: string
  ) => {
    const newActions = (breakdownResult.actionPlan || []).map((action, idx) => ({
      id: `${Date.now()}-${idx}`,
      title: sanitizeText(action.title),
      description: sanitizeText(action.description),
      priority: action.priority,
      owner: action.ownerRole,
      timeline: action.timeline,
      successMetric: sanitizeText(action.successMetric),
      estimatedCost: action.estimatedCost,
      resources: action.resources,
      implementationSteps: action.implementationSteps?.map(s => sanitizeText(s)),
      raci: action.raci,
      status: 'pending' as const,
      notes: '',
      segment,
      findingTitle: breakdownResult.findingTitle,
    }));
    setActionChecklist(prev => [...prev, ...newActions]);
    setShowActionChecklist(true);
    toast({
      title: "Actions Added",
      description: `${newActions.length} actions added to checklist`,
    });
  }, [toast]);

  const toggleActionStatus = useCallback((actionId: string) => {
    setActionChecklist(prev => prev.map(a =>
      a.id === actionId
        ? {
            ...a,
            status: a.status === 'completed' ? 'pending' : a.status === 'in_progress' ? 'completed' : 'in_progress',
            completedDate: a.status === 'in_progress' ? new Date().toISOString() : undefined
          }
        : a
    ));
  }, []);

  const removeAction = useCallback((actionId: string) => {
    setActionChecklist(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const clearChecklist = useCallback(() => {
    setActionChecklist([]);
    toast({
      title: "Checklist Cleared",
      description: "All actions have been removed from the checklist",
    });
  }, [toast]);

  return {
    actionChecklist,
    setActionChecklist,
    showActionChecklist,
    setShowActionChecklist,
    addActionsFromBreakdown,
    toggleActionStatus,
    removeAction,
    clearChecklist,
  };
}
