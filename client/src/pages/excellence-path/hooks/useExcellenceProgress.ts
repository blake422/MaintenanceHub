import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceProgress, ClientCompany } from "@shared/schema";
import type { AssessmentData, Step } from "../types";
import {
  calculateOverallProgress,
  getStepProgressData,
  calculateStepProgress,
} from "../utils/progressCalculations";

export function useClientCompanies() {
  const { user } = useAuth();
  
  const { data: clientCompanies = [], isLoading } = useQuery<ClientCompany[]>({
    queryKey: ["/api/client-companies"],
    enabled: !!user,
  });
  
  return { clientCompanies, isLoading };
}

export function useExcellenceProgress(clientCompanyId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();

  const queryUrl = clientCompanyId 
    ? `/api/excellence-progress?clientCompanyId=${clientCompanyId}`
    : "/api/excellence-progress";

  const { data: progress, isLoading } = useQuery<ExcellenceProgress>({
    queryKey: ["/api/excellence-progress", clientCompanyId],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: !!user,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (updates: Partial<ExcellenceProgress>) => {
      if (!progress?.id) {
        return apiRequest("POST", "/api/excellence-progress", { ...updates, clientCompanyId });
      }
      return apiRequest("PUT", `/api/excellence-progress/${progress.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress", clientCompanyId] });
      toast({
        title: "Progress saved",
        description: "Your progress has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save progress. Please try again.",
        variant: "destructive"
      });
    }
  });

  const overallProgress = calculateOverallProgress(progress);

  return {
    progress,
    isLoading,
    updateProgressMutation,
    overallProgress,
    user,
    toast,
    clientCompanyId
  };
}

export function useStepDeliverables(stepId: number, clientCompanyId?: string) {
  const { user } = useAuth();

  const queryUrl = clientCompanyId 
    ? `/api/excellence-deliverables?step=${stepId}&clientCompanyId=${clientCompanyId}`
    : `/api/excellence-deliverables?step=${stepId}`;

  const { data: deliverables } = useQuery<Array<{
    deliverableType: string;
    payload: Record<string, unknown>;
  }>>({
    queryKey: ["/api/excellence-deliverables", stepId, clientCompanyId],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deliverables");
      return res.json();
    },
    enabled: !!user,
  });

  // Extract assessment data from Step 0
  const assessmentDeliverable = deliverables?.find(
    (d) => d.deliverableType === "process_assessment"
  );
  const assessmentData = assessmentDeliverable?.payload as AssessmentData | undefined;

  return {
    deliverables,
    assessmentData
  };
}

interface UseStepProgressActionsProps {
  progress: ExcellenceProgress | undefined;
  updateProgressMutation: ReturnType<typeof useExcellenceProgress>["updateProgressMutation"];
  selectedStep: number;
  currentStepData: Step;
  toast: ReturnType<typeof useToast>["toast"];
  generateStepReport: () => void;
}

export function useStepProgressActions({
  progress,
  updateProgressMutation,
  selectedStep,
  currentStepData,
  toast,
  generateStepReport
}: UseStepProgressActionsProps) {
  const stepData = getStepProgressData(progress, selectedStep);
  const calculatedProgress = calculateStepProgress(
    currentStepData.checklist,
    stepData.checklist
  );

  const stepKey = `step${selectedStep}`;
  const checklistKey = `${stepKey}Checklist`;
  const progressKey = `${stepKey}Progress`;
  const completedKey = `${stepKey}Completed`;
  const notesKey = `${stepKey}Notes`;

  const handleChecklistToggle = async (itemId: string) => {
    const newChecklist = {
      ...stepData.checklist,
      [itemId]: !stepData.checklist[itemId]
    };
    const newProgress = calculateStepProgress(currentStepData.checklist, newChecklist);

    await updateProgressMutation.mutateAsync({
      [checklistKey]: newChecklist,
      [progressKey]: newProgress
    });
  };

  const handleSaveNotes = async (notes: string) => {
    await updateProgressMutation.mutateAsync({
      [notesKey]: notes
    });
  };

  const handleCompleteStep = async () => {
    if (calculatedProgress < 100) {
      toast({
        title: "Step not complete",
        description: "Please complete all checklist items before marking this step as complete.",
        variant: "destructive"
      });
      return;
    }

    await updateProgressMutation.mutateAsync({
      [completedKey]: true,
      [`${stepKey}CompletedAt`]: new Date().toISOString(),
      currentStep: selectedStep < 6 ? selectedStep + 1 : selectedStep
    });

    generateStepReport();
  };

  const handleUncompleteStep = async () => {
    await updateProgressMutation.mutateAsync({
      [completedKey]: false,
      [`${stepKey}CompletedAt`]: null
    });
  };

  return {
    stepData,
    calculatedProgress,
    handleChecklistToggle,
    handleSaveNotes,
    handleCompleteStep,
    handleUncompleteStep
  };
}
