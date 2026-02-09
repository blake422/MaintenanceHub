import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BreakdownAnalysis, DowntimeReport, Finding, RootCause, DeepDiveResult } from "../types";

type FindingType = Finding | RootCause;

type ToastFunction = (options: { title: string; description: string; variant?: "destructive" }) => void;

/**
 * Hook for generating a new analysis report from file upload
 */
export function useGenerateAnalysisReport(
  toast: ToastFunction,
  onSuccess: () => void
) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/downtime/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate analysis report");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      onSuccess();
      toast({
        title: "Analysis Complete!",
        description: `Analyzed ${data.recordCount} records (${data.totalDowntimeHours.toFixed(1)} hours). Report generated successfully.`,
      });
    },
    onError: (error: Error) => {
      let errorMessage = error.message || "Failed to generate downtime analysis report";
      if (errorMessage.includes("413") || errorMessage.includes("Too Large") || errorMessage.includes("Request Entity")) {
        errorMessage = "File is too large for the server. Please try a smaller file (under 25MB) or split your data into smaller chunks.";
      }
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for archiving a report
 */
export function useArchiveReport(toast: ToastFunction) {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/downtime/reports/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Archived",
        description: "Report has been archived successfully",
      });
    },
  });
}

/**
 * Hook for unarchiving a report
 */
export function useUnarchiveReport(toast: ToastFunction) {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/downtime/reports/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Restored",
        description: "Report has been restored from archive",
      });
    },
  });
}

/**
 * Hook for deleting a report
 */
export function useDeleteReport(toast: ToastFunction) {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/downtime/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Deleted",
        description: "Report has been permanently deleted",
      });
    },
  });
}

/**
 * Hook for analyzing a key finding (deep dive)
 */
export function useAnalyzeKeyFinding(
  selectedReport: DowntimeReport | null,
  toast: ToastFunction,
  onSuccess: (data: DeepDiveResult) => void
) {
  return useMutation({
    mutationFn: async ({ finding, context, findingId }: { finding: FindingType; context?: unknown; findingId: string }) => {
      if (!selectedReport) throw new Error("No report selected");
      const response = await apiRequest("POST", `/api/downtime/reports/${selectedReport.id}/key-findings/${findingId}/analyze`, { finding, context });
      return await response.json() as DeepDiveResult;
    },
    onSuccess: (data) => {
      onSuccess(data);
      toast({
        title: "Analysis Complete",
        description: "Deep-dive breakdown has been generated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate deep-dive analysis",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for generating breakdown analysis (5 Whys + Fishbone)
 */
export function useGenerateBreakdownAnalysis(
  selectedReport: DowntimeReport | null,
  toast: ToastFunction,
  onSuccess: (data: BreakdownAnalysis) => void
) {
  return useMutation({
    mutationFn: async ({ finding, segment }: { finding: FindingType; segment: string }) => {
      if (!selectedReport) throw new Error("No report selected");
      const response = await apiRequest("POST", `/api/downtime/reports/${selectedReport.id}/breakdown-analysis`, { finding, segment });
      const data = await response.json();
      return data as BreakdownAnalysis;
    },
    onSuccess: (data: BreakdownAnalysis) => {
      onSuccess(data);
      toast({
        title: "Breakdown Analysis Complete",
        description: "5 Whys and Fishbone diagram have been generated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate breakdown analysis",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for creating a work order from an action item
 */
export function useCreateWorkOrderFromAction(
  toast: ToastFunction,
  setCreatingWorkOrderForAction: (id: string | null) => void
) {
  return useMutation({
    mutationFn: async (action: {
      id: string;
      title: string;
      description: string;
      priority: string;
      timeline: string;
      segment: string;
      findingTitle: string;
    }) => {
      setCreatingWorkOrderForAction(action.id);
      const priorityMap: Record<string, string> = {
        'immediate': 'critical',
        'short-term': 'high',
        'medium-term': 'medium',
        'long-term': 'low'
      };
      const workOrderData = {
        title: `[RCA] ${action.title}`,
        description: `${action.description}\n\nGenerated from RCA Finding: ${action.findingTitle}\nSegment: ${action.segment}\nTimeline: ${action.timeline}`,
        priority: priorityMap[action.priority] || 'medium',
        type: 'corrective',
        status: 'open',
      };
      const response = await apiRequest("POST", "/api/work-orders", workOrderData);
      return await response.json();
    },
    onSuccess: () => {
      setCreatingWorkOrderForAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work Order Created",
        description: "A new work order has been created from this action",
      });
    },
    onError: (error: Error) => {
      setCreatingWorkOrderForAction(null);
      toast({
        title: "Failed to Create Work Order",
        description: error.message || "Could not create work order",
        variant: "destructive",
      });
    },
  });
}
