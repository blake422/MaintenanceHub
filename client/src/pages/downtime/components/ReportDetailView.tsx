import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Search,
  Shield,
  Activity,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import type { DowntimeReport, BreakdownDialogState, DeepDiveDialogState, BreakdownAnalysis, ActionItem, Segments, Finding, RootCause, Recommendation, DeepDiveResult, AnalysisPattern } from "../types";
import { constructSegmentsFromLegacyData } from "../utils/segmentHelpers";
import { exportReportToPDF, exportSegmentToPDF, exportFindingToPDF, exportBreakdownToPDF, exportActionChecklistToPDF } from "../utils/exportPdf";
import { SegmentOverviewCard } from "./SegmentOverviewCard";
import { SegmentDetail } from "./SegmentDetail";
import { DeepDiveDialog } from "./DeepDiveDialog";
import { BreakdownDialog } from "./BreakdownDialog";
import { ActionChecklist } from "./ActionChecklist";

type ToastFunction = (options: { title: string; description: string; variant?: "destructive" }) => void;

type FindingType = Finding | RootCause | Recommendation | AnalysisPattern;

interface ReportDetailViewProps {
  report: DowntimeReport;
  onBack: () => void;
  toast: ToastFunction;
  // Deep dive hooks
  analyzeKeyFinding: {
    mutate: (params: { finding: FindingType; context?: unknown; findingId: string }) => void;
    isPending: boolean;
    data?: DeepDiveResult;
  };
  // Breakdown hooks
  generateBreakdownAnalysis: {
    mutate: (params: { finding: FindingType; segment: string }) => void;
    isPending: boolean;
    data?: BreakdownAnalysis;
  };
  // Action checklist state
  actionChecklist: ActionItem[];
  setActionChecklist: React.Dispatch<React.SetStateAction<ActionItem[]>>;
  showActionChecklist: boolean;
  setShowActionChecklist: (show: boolean) => void;
  addActionsFromBreakdown: (breakdown: BreakdownAnalysis, segment: string) => void;
  toggleActionStatus: (actionId: string) => void;
  removeAction: (actionId: string) => void;
  clearChecklist: () => void;
  // Work order mutation
  createWorkOrderFromAction: {
    mutate: (action: {
      id: string;
      title: string;
      description: string;
      priority: string;
      timeline: string;
      segment: string;
      findingTitle: string;
    }) => void;
  };
  creatingWorkOrderForAction: string | null;
}

export function ReportDetailView({
  report,
  onBack,
  toast,
  analyzeKeyFinding,
  generateBreakdownAnalysis,
  actionChecklist,
  setActionChecklist,
  showActionChecklist,
  setShowActionChecklist,
  addActionsFromBreakdown,
  toggleActionStatus,
  removeAction,
  clearChecklist,
  createWorkOrderFromAction,
  creatingWorkOrderForAction,
}: ReportDetailViewProps) {
  const analysis = report.analysisData;
  const segments = constructSegmentsFromLegacyData(analysis);

  // Local state for dialogs and views
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [deepDiveDialog, setDeepDiveDialog] = useState<DeepDiveDialogState>({
    open: false,
    finding: null,
    type: "",
  });
  const [breakdownDialog, setBreakdownDialog] = useState<BreakdownDialogState>({
    open: false,
    finding: null,
    segment: "",
  });

  // Use data from the mutation hooks
  const deepDiveResult = analyzeKeyFinding.data;
  const breakdownResult = generateBreakdownAnalysis.data;

  // Handler for generating breakdown analysis
  const handleGenerateBreakdown = (finding: Finding | RootCause, segment: string) => {
    setBreakdownDialog({ open: true, finding, segment });
    generateBreakdownAnalysis.mutate({ finding, segment });
  };

  // Handler for generating deep dive analysis
  const handleDeepDive = (finding: FindingType, type: string) => {
    setDeepDiveDialog({ open: true, finding: finding as Finding | RootCause | Recommendation, type });
    analyzeKeyFinding.mutate({
      finding,
      context: report.analysisData,
      findingId: `${type}-${Date.now()}`,
    });
  };

  // Get the currently selected segment data
  const currentSegment = selectedSegment && segments
    ? segments[selectedSegment as keyof Segments]
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back-to-reports"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">{report.fileName}</h1>
            <Badge variant="outline">{report.fileType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Generated {report.createdAt ? format(new Date(report.createdAt), "MMM dd, yyyy") : "Date unknown"} -{" "}
            {report.recordCount} records analyzed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowActionChecklist(true)}
            data-testid="button-open-checklist"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Checklist ({actionChecklist.length})
          </Button>
          <Button
            variant="default"
            onClick={() => exportReportToPDF(report, toast)}
            data-testid="button-export-report"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Full Report
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Executive Summary */}
          <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border">
            <h2 className="text-lg font-bold mb-3">Executive Summary</h2>
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div className="text-center p-4 bg-background rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {report.totalDowntimeHours?.toFixed(1) || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <div className="text-3xl font-bold">
                  {report.recordCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Records Analyzed
                </div>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <div className="text-xl font-bold text-destructive truncate">
                  {analysis?.summary?.mostAffectedEquipment || "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Most Affected
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {analysis?.summary?.criticalFindings ||
                "Analysis complete. Review the segments below for detailed insights."}
            </p>
          </div>

          {/* Segment Navigation */}
          <Tabs
            value={selectedSegment || "overview"}
            onValueChange={(v) => setSelectedSegment(v === "overview" ? null : v)}
            className="space-y-4"
          >
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger
                value="overview"
                className="gap-2"
                data-testid="tab-overview"
              >
                <FileText className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="safety"
                className="gap-2"
                data-testid="tab-safety"
              >
                <Shield className="w-4 h-4" />
                Safety
              </TabsTrigger>
              <TabsTrigger
                value="quality"
                className="gap-2"
                data-testid="tab-quality"
              >
                <CheckCircle2 className="w-4 h-4" />
                Quality
              </TabsTrigger>
              <TabsTrigger
                value="operations"
                className="gap-2"
                data-testid="tab-operations"
              >
                <Activity className="w-4 h-4" />
                Operations
              </TabsTrigger>
              <TabsTrigger
                value="maintenance"
                className="gap-2"
                data-testid="tab-maintenance"
              >
                <Target className="w-4 h-4" />
                Maintenance
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Segment Cards Grid */}
              {segments && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(Object.keys(segments) as Array<keyof Segments>).map(
                    (segmentKey) => (
                      <SegmentOverviewCard
                        key={segmentKey}
                        segmentKey={segmentKey}
                        segment={segments[segmentKey]}
                        onSelect={(key) => setSelectedSegment(key)}
                      />
                    )
                  )}
                </div>
              )}

              {/* Legacy Analysis Data (if no segments) */}
              {!segments && analysis && (
                <div className="space-y-4">
                  {/* Patterns */}
                  {analysis.patterns && analysis.patterns.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Patterns Identified
                      </h3>
                      <div className="space-y-2">
                        {analysis.patterns.map((pattern: AnalysisPattern, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 border rounded-lg hover-elevate"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium">{pattern.title}</h4>
                              <Badge
                                variant={
                                  pattern.severity === "critical" ||
                                  pattern.severity === "high"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {pattern.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pattern.description}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => handleDeepDive(pattern, "pattern")}
                            >
                              <Search className="w-4 h-4 mr-2" />
                              Deep Dive
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Segment Detail Tabs */}
            {(["safety", "quality", "operations", "maintenance"] as const).map(
              (segmentKey) => (
                <TabsContent key={segmentKey} value={segmentKey}>
                  {segments && segments[segmentKey] && (
                    <SegmentDetail
                      segmentKey={segmentKey}
                      segment={segments[segmentKey]}
                      onExportPDF={() =>
                        exportSegmentToPDF(
                          segmentKey,
                          segments[segmentKey],
                          report,
                          toast
                        )
                      }
                      onGenerateBreakdown={handleGenerateBreakdown}
                      isGeneratingBreakdown={generateBreakdownAnalysis.isPending}
                      breakdownDialog={breakdownDialog}
                    />
                  )}
                </TabsContent>
              )
            )}
          </Tabs>
        </div>
      </ScrollArea>

      {/* Dialogs */}
      <DeepDiveDialog
        dialogState={deepDiveDialog}
        onClose={() => {
          setDeepDiveDialog({ open: false, finding: null, type: "" });
        }}
        result={deepDiveResult}
        isLoading={analyzeKeyFinding.isPending}
        onExportPDF={() =>
          deepDiveResult &&
          exportFindingToPDF(deepDiveResult, deepDiveDialog.finding, toast)
        }
      />

      <BreakdownDialog
        dialogState={breakdownDialog}
        onClose={() => {
          setBreakdownDialog({ open: false, finding: null, segment: "" });
        }}
        result={breakdownResult || null}
        isLoading={generateBreakdownAnalysis.isPending}
        onAddToChecklist={() => {
          if (breakdownResult) {
            addActionsFromBreakdown(breakdownResult, breakdownDialog.segment);
          }
        }}
        onExportPDF={() =>
          breakdownResult && exportBreakdownToPDF(breakdownResult, toast)
        }
      />

      <ActionChecklist
        open={showActionChecklist}
        onOpenChange={setShowActionChecklist}
        actionChecklist={actionChecklist}
        onToggleStatus={toggleActionStatus}
        onRemove={removeAction}
        onClearAll={clearChecklist}
        onExportPDF={() => exportActionChecklistToPDF(actionChecklist, toast)}
        onCreateWorkOrder={(action) => {
          createWorkOrderFromAction.mutate({
            id: action.id,
            title: action.title,
            description: action.description,
            priority: action.priority,
            timeline: action.timeline,
            segment: action.segment,
            findingTitle: action.findingTitle,
          });
        }}
        creatingWorkOrderForAction={creatingWorkOrderForAction}
      />
    </div>
  );
}
