import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  BarChart2,
  ChevronRight,
  CheckCircle2,
  Download,
  Loader2,
  Search,
  Shield,
  Zap,
  Activity,
} from "lucide-react";
import type { DeepDiveResult, DeepDiveDialogState } from "../types";

interface DeepDiveDialogProps {
  dialogState: DeepDiveDialogState;
  onClose: () => void;
  result: DeepDiveResult | null;
  isLoading: boolean;
  onExportPDF: () => void;
}

export function DeepDiveDialog({
  dialogState,
  onClose,
  result,
  isLoading,
  onExportPDF,
}: DeepDiveDialogProps) {
  return (
    <Dialog
      open={dialogState.open}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Comprehensive Breakdown Analysis
          </DialogTitle>
          <DialogDescription>
            {dialogState.finding?.cause ||
              dialogState.finding?.title ||
              "Deep-dive analysis"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Generating comprehensive breakdown analysis...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 15-30 seconds
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6 pb-4">
              {/* Executive Summary */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-lg mb-2">Executive Summary</h3>
                <p className="text-sm">{result.executiveSummary}</p>
              </div>

              {/* Finding Details */}
              {result.findingDetails && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Severity</p>
                    <Badge
                      variant={
                        result.findingDetails.severity === "critical" ||
                        result.findingDetails.severity === "high"
                          ? "destructive"
                          : "default"
                      }
                      className="mt-1"
                    >
                      {result.findingDetails.severity}
                    </Badge>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Impact Score</p>
                    <p className="font-bold text-lg">
                      {result.findingDetails.impactScore}/10
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Downtime Contribution
                    </p>
                    <p className="font-medium text-sm">
                      {result.findingDetails.downtimeContribution}
                    </p>
                  </div>
                </div>
              )}

              {/* Root Cause Breakdown */}
              {result.rootCauseBreakdown && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Root Cause Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        PRIMARY CAUSE
                      </p>
                      <p className="font-medium">
                        {result.rootCauseBreakdown.primaryCause}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        CAUSE CHAIN
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {result.rootCauseBreakdown.causeChain?.map(
                          (cause: string, i: number) => (
                            <div key={i} className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {cause}
                              </Badge>
                              {i <
                                (result.rootCauseBreakdown?.causeChain?.length ||
                                  0) -
                                  1 && <ChevronRight className="w-3 h-3" />}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        CONTRIBUTING FACTORS
                      </p>
                      <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                        {result.rootCauseBreakdown.contributingFactors?.map(
                          (f: string, i: number) => (
                            <li key={i}>{f}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Impact Assessment */}
              {result.impactAssessment && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-500" />
                      Impact Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          PRODUCTION
                        </p>
                        <p>{result.impactAssessment.productionImpact}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          FINANCIAL
                        </p>
                        <p>{result.impactAssessment.financialImpact}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          SAFETY
                        </p>
                        <p>{result.impactAssessment.safetyImplications}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          QUALITY
                        </p>
                        <p>{result.impactAssessment.qualityImplications}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommended Actions */}
              {result.recommendedActions && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Recommended Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.recommendedActions.map((action, i) => (
                        <div key={i} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-sm">{action.action}</p>
                            <Badge
                              variant={
                                action.priority === "immediate"
                                  ? "destructive"
                                  : action.priority === "short-term"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs shrink-0 ml-2"
                            >
                              {action.priority}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <div>
                              <strong>Owner:</strong> {action.owner}
                            </div>
                            <div>
                              <strong>Timeline:</strong> {action.timeline}
                            </div>
                            <div>
                              <strong>Cost:</strong> {action.estimatedCost}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risk Assessment */}
              {result.riskAssessment && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-500" />
                      Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Recurrence</p>
                        <Badge
                          variant={
                            result.riskAssessment.recurrenceProbability === "high"
                              ? "destructive"
                              : "secondary"
                          }
                          className="mt-1"
                        >
                          {result.riskAssessment.recurrenceProbability}
                        </Badge>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Consequence</p>
                        <Badge
                          variant={
                            result.riskAssessment.consequenceSeverity === "high"
                              ? "destructive"
                              : "secondary"
                          }
                          className="mt-1"
                        >
                          {result.riskAssessment.consequenceSeverity}
                        </Badge>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                        <p className="font-bold text-lg">
                          {result.riskAssessment.riskScore}
                        </p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Priority</p>
                        <p className="font-bold text-lg">
                          {result.riskAssessment.mitigationPriority}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* KPI Metrics */}
              {result.kpiMetrics && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-500" />
                      KPI Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">MTBF</p>
                        <p className="font-medium text-sm">
                          {result.kpiMetrics.mtbf}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">MTTR</p>
                        <p className="font-medium text-sm">
                          {result.kpiMetrics.mttr}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Availability Impact
                        </p>
                        <p className="font-medium text-sm">
                          {result.kpiMetrics.availabilityImpact}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Reliability Target
                        </p>
                        <p className="font-medium text-sm">
                          {result.kpiMetrics.reliabilityTarget}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Analysis will appear here</p>
            </div>
          )}
        </ScrollArea>

        {result && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-close-deep-dive"
            >
              Close
            </Button>
            <Button onClick={onExportPDF} data-testid="button-export-finding-pdf">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
