import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cpu, Upload, FileText, FileSpreadsheet, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SelectAIRecommendation } from "@shared/schema";

interface ManualAnalysisResult {
  success: boolean;
  fileName: string;
  parts: string[];
  pmSchedules: { task: string; frequency: string }[];
}

export default function AIPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [analysisResult, setAnalysisResult] = useState<ManualAnalysisResult | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  // Fetch recommendations
  const { data: recommendations = [], isLoading } = useQuery<SelectAIRecommendation[]>({
    queryKey: ["/api/ai-recommendations"],
    enabled: !!user?.companyId,
  });

  // Generate new recommendations
  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai-recommendations/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
      toast({
        title: "Success",
        description: "New recommendations generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate recommendations",
        variant: "destructive",
      });
    },
  });

  // Approve recommendation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/ai-recommendations/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
      toast({
        title: "Success",
        description: "Recommendation approved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve recommendation",
        variant: "destructive",
      });
    },
  });

  // Reject recommendation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/ai-recommendations/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "User dismissed" }),
      });
      if (!response.ok) throw new Error("Failed to reject");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
      toast({
        title: "Success",
        description: "Recommendation dismissed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss recommendation",
        variant: "destructive",
      });
    },
  });

  // Analyze PDF manual
  const analyzePdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/analyze-manual", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to analyze PDF");
      }
      return response.json() as Promise<ManualAnalysisResult>;
    },
    onSuccess: (result) => {
      setAnalysisResult(result);
      setShowResultsDialog(true);
      toast({
        title: "Analysis Complete",
        description: `Found ${result.parts.length} parts and ${result.pmSchedules.length} PM schedules`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze the PDF file",
        variant: "destructive",
      });
    },
  });

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid File",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
        return;
      }
      analyzePdfMutation.mutate(file);
    }
    // Reset input so same file can be selected again
    event.target.value = "";
  };

  const canUsePlanner = user?.role === "admin" || user?.role === "manager";
  const pendingRecommendations = recommendations.filter(r => r.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">C4 Maintenance Planner</h1>
        <p className="text-muted-foreground">
          Intelligent maintenance planning with CSV import and PDF analysis
        </p>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover-elevate cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6 text-chart-1" />
            </div>
            <CardTitle>Import Work Orders (CSV)</CardTitle>
            <CardDescription>
              Upload CSV file to bulk import work orders with C4 validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" data-testid="button-upload-csv">
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-chart-4" />
            </div>
            <CardTitle>Analyze Equipment Manual (PDF)</CardTitle>
            <CardDescription>
              Extract parts lists and PM schedules from equipment manuals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={pdfInputRef}
              className="hidden"
              accept=".pdf"
              onChange={handlePdfUpload}
            />
            <Button 
              className="w-full" 
              variant="outline" 
              data-testid="button-upload-pdf"
              onClick={() => pdfInputRef.current?.click()}
              disabled={analyzePdfMutation.isPending || !canUsePlanner}
            >
              {analyzePdfMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PDF Analysis Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Analysis Results: {analysisResult?.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Parts Found */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                Parts Found ({analysisResult?.parts.length || 0})
              </h3>
              {analysisResult?.parts && analysisResult.parts.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {analysisResult.parts.map((part, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-chart-3 flex-shrink-0" />
                      {part}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No parts extracted from this document</p>
              )}
            </div>

            {/* PM Schedules Found */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                PM Schedules Found ({analysisResult?.pmSchedules.length || 0})
              </h3>
              {analysisResult?.pmSchedules && analysisResult.pmSchedules.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analysisResult.pmSchedules.map((pm, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded">
                      <div className="font-medium">{pm.task}</div>
                      <div className="text-muted-foreground">Frequency: {pm.frequency}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No PM schedules extracted from this document</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
                C4 Recommendations
              </CardTitle>
              <CardDescription>
                Intelligent suggestions based on your maintenance data
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              data-testid="button-refresh-suggestions"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !canUsePlanner}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate New"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading recommendations...</p>
            </div>
          ) : pendingRecommendations.length === 0 ? (
            <div className="text-center py-8">
              <Cpu className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-2">No recommendations yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Generate New" to get C4 Powered maintenance recommendations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRecommendations.map((recommendation) => (
                <Card key={recommendation.id} className="hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="text-base">{recommendation.title}</CardTitle>
                          <Badge
                            variant="outline"
                            className="bg-accent/50 text-accent-foreground"
                          >
                            {Math.round(recommendation.confidence)}% confidence
                          </Badge>
                          <Badge variant="secondary">
                            {recommendation.type === "pm_schedule" && "PM Schedule"}
                            {recommendation.type === "parts_order" && "Parts Order"}
                            {recommendation.type === "work_order" && "Work Order"}
                          </Badge>
                        </div>
                        <CardDescription>{recommendation.description}</CardDescription>
                        {recommendation.aiReasoning && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">C4 Reasoning:</span> {recommendation.aiReasoning}
                          </p>
                        )}
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Cpu className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        data-testid={`button-apply-${recommendation.id}`}
                        onClick={() => approveMutation.mutate(recommendation.id)}
                        disabled={approveMutation.isPending || !canUsePlanner}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Apply Suggestion
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-dismiss-${recommendation.id}`}
                        onClick={() => rejectMutation.mutate(recommendation.id)}
                        disabled={rejectMutation.isPending || !canUsePlanner}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Status */}
      {generateMutation.isPending && (
        <Card className="border-primary">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <p className="font-medium mb-2">C4 Processing in Progress</p>
            <p className="text-sm text-muted-foreground">
              Analyzing your maintenance data and generating recommendations...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
