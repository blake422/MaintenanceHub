import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  GitBranch,
  Lightbulb,
  Loader2,
  Search,
  Shield,
  Target,
  Wrench,
} from "lucide-react";
import type { BreakdownAnalysis, BreakdownDialogState } from "../types";
import { sanitizeText } from "../utils/sanitizeText";

interface BreakdownDialogProps {
  dialogState: BreakdownDialogState;
  onClose: () => void;
  result: BreakdownAnalysis | null;
  isLoading: boolean;
  onAddToChecklist: () => void;
  onExportPDF: () => void;
}

export function BreakdownDialog({
  dialogState,
  onClose,
  result,
  isLoading,
  onAddToChecklist,
  onExportPDF,
}: BreakdownDialogProps) {
  return (
    <Dialog
      open={dialogState.open}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Breakdown Analysis - 5 Whys & Fishbone
          </DialogTitle>
          <DialogDescription>
            {dialogState.finding?.title || "AI-powered root cause analysis"}
            {dialogState.segment && (
              <Badge variant="outline" className="ml-2 capitalize">
                {dialogState.segment}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing root cause...</p>
            </div>
          ) : result ? (
            <div className="space-y-4 pb-4">
              {/* Problem & Root Cause - The headline */}
              <div className="p-4 bg-destructive/10 rounded-lg border-l-4 border-destructive">
                <h3 className="font-bold text-base">
                  {sanitizeText(result.findingTitle)}
                </h3>
                {result.executiveSummary && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    {sanitizeText(result.executiveSummary)}
                  </p>
                )}
                {result.rootCause && (
                  <p className="text-sm mt-2">
                    <span className="font-semibold">Root Cause:</span>{" "}
                    {sanitizeText(result.rootCause.statement)}
                  </p>
                )}
              </div>

              {/* Key Metrics Bar */}
              {result.costBenefitAnalysis && (
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs text-muted-foreground">Annual Savings</p>
                    <p className="font-bold text-green-600">
                      {sanitizeText(result.costBenefitAnalysis.annualSavings)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Implementation Cost
                    </p>
                    <p className="font-bold">
                      {sanitizeText(result.costBenefitAnalysis.implementationCost)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-muted-foreground">Payback Period</p>
                    <p className="font-bold text-blue-600">
                      {sanitizeText(result.costBenefitAnalysis.paybackPeriod)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Risk Reduction</p>
                    <p className="font-bold">
                      {sanitizeText(result.costBenefitAnalysis.riskReduction)}
                    </p>
                  </div>
                </div>
              )}

              {/* Verification Evidence */}
              {result.verificationEvidence && result.verificationEvidence.length > 0 && (
                <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-amber-600" />
                    Verification Evidence (What Team Should Find)
                  </h4>
                  <div className="space-y-3">
                    {result.verificationEvidence.map((evidence, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-background rounded border text-sm"
                      >
                        <p className="font-medium">
                          {sanitizeText(evidence.observation)}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Measured:</span>{" "}
                            <span className="font-mono text-destructive">
                              {evidence.measuredValue}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Spec:</span>{" "}
                            <span className="font-mono text-green-600">
                              {evidence.specificationRange}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Deviation:</span>{" "}
                            <span className="font-mono font-semibold">
                              {evidence.deviation}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Method:</span>{" "}
                            {evidence.inspectionMethod}
                          </div>
                        </div>
                        <p className="text-xs mt-1 text-muted-foreground">
                          <span className="font-medium">Ref:</span>{" "}
                          {evidence.standardReference}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Permanent Countermeasures */}
              {result.permanentCountermeasures &&
                result.permanentCountermeasures.length > 0 && (
                  <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      Permanent Countermeasures
                    </h4>
                    <div className="space-y-3">
                      {result.permanentCountermeasures.map((cm, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-background rounded border"
                        >
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="shrink-0">
                              {idx + 1}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {sanitizeText(cm.action)}
                              </p>
                              <p className="text-xs mt-1">
                                <span className="text-muted-foreground">Spec:</span>{" "}
                                <span className="font-mono">{cm.specification}</span>
                              </p>
                              {cm.torqueSpec && cm.torqueSpec !== "N/A" && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">
                                    Torque:
                                  </span>{" "}
                                  <span className="font-mono font-semibold text-primary">
                                    {cm.torqueSpec}
                                  </span>
                                </p>
                              )}
                              {cm.partNumber && cm.partNumber !== "N/A" && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">
                                    Parts:
                                  </span>{" "}
                                  <span className="font-mono">{cm.partNumber}</span>
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Verify:</span>{" "}
                                {cm.verificationMethod} |{" "}
                                <span className="font-medium">Ref:</span>{" "}
                                {cm.standardReference}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Technician Validation Steps */}
              {result.technicianValidationSteps &&
                result.technicianValidationSteps.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Technician Validation Steps
                    </h4>
                    <div className="space-y-2">
                      {result.technicianValidationSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {idx + 1}
                          </div>
                          <p>{sanitizeText(step)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Priority Actions */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Action Plan ({result.actionPlan?.length || 0})
                </h4>
                <div className="space-y-2">
                  {result.actionPlan?.slice(0, 5).map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-2 bg-muted/50 rounded"
                    >
                      <Badge
                        variant={
                          action.priority === "immediate"
                            ? "destructive"
                            : action.priority === "short-term"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs shrink-0 mt-0.5"
                      >
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {sanitizeText(action.title)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {action.ownerRole} - {action.timeline}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expandable Details Section */}
              <Accordion type="single" collapsible className="w-full">
                {/* 5 Whys Detail */}
                <AccordionItem value="fivewhys">
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      5 Whys Analysis
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {result.fiveWhys?.map((why, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                            {why.step}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">
                              {sanitizeText(why.question)}
                            </p>
                            <p className="text-sm">{sanitizeText(why.answer)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Fishbone Detail */}
                <AccordionItem value="fishbone">
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Fishbone Categories
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {result.fishbone?.man?.length ? (
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <p className="text-xs font-semibold text-blue-600 mb-1">
                            Man
                          </p>
                          {result.fishbone.man.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {result.fishbone?.machine?.length ? (
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                          <p className="text-xs font-semibold text-orange-600 mb-1">
                            Machine
                          </p>
                          {result.fishbone.machine.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {result.fishbone?.method?.length ? (
                        <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <p className="text-xs font-semibold text-green-600 mb-1">
                            Method
                          </p>
                          {result.fishbone.method.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {result.fishbone?.material?.length ? (
                        <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                          <p className="text-xs font-semibold text-purple-600 mb-1">
                            Material
                          </p>
                          {result.fishbone.material.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {result.fishbone?.measurement?.length ? (
                        <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded">
                          <p className="text-xs font-semibold text-cyan-600 mb-1">
                            Measurement
                          </p>
                          {result.fishbone.measurement.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {result.fishbone?.environment?.length ? (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                          <p className="text-xs font-semibold text-amber-600 mb-1">
                            Environment
                          </p>
                          {result.fishbone.environment.map((c, i) => (
                            <p key={i} className="text-xs">
                              {sanitizeText(c.factor)}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Full Action Details */}
                <AccordionItem value="actions">
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Full Action Details & RACI
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {result.actionPlan?.map((action, idx) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <p className="font-medium text-sm">
                              {sanitizeText(action.title)}
                            </p>
                            <Badge
                              variant={
                                action.priority === "immediate"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {action.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {sanitizeText(action.description)}
                          </p>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Owner:</span>{" "}
                              {action.ownerRole}
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Timeline:
                              </span>{" "}
                              {action.timeline}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Metric:</span>{" "}
                              {sanitizeText(action.successMetric)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cost:</span>{" "}
                              {action.estimatedCost || "TBD"}
                            </div>
                          </div>
                          {(action as any).raci && (
                            <div className="mt-2 pt-2 border-t flex gap-2 text-xs">
                              <Badge variant="outline">
                                R: {(action as any).raci.responsible}
                              </Badge>
                              <Badge variant="outline">
                                A: {(action as any).raci.accountable}
                              </Badge>
                              <Badge variant="outline">
                                C: {(action as any).raci.consulted}
                              </Badge>
                              <Badge variant="outline">
                                I: {(action as any).raci.informed}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Risks & Preventive Measures */}
                {(result.risks?.length || result.preventiveMeasures?.length) ? (
                  <AccordionItem value="risks">
                    <AccordionTrigger className="text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Risks & Prevention
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {result.risks?.length ? (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-amber-600 mb-1">
                            Risks if Not Addressed
                          </p>
                          <ul className="space-y-1">
                            {result.risks.map((risk, idx) => (
                              <li
                                key={idx}
                                className="text-xs flex items-start gap-1"
                              >
                                <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                                {sanitizeText(risk)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.preventiveMeasures?.length ? (
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-1">
                            Preventive Measures
                          </p>
                          <ul className="space-y-1">
                            {result.preventiveMeasures.map((pm, idx) => (
                              <li key={idx} className="text-xs">
                                {sanitizeText(pm.measure)} ({pm.frequency},{" "}
                                {pm.responsibility})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Analysis will appear here</p>
            </div>
          )}
        </ScrollArea>

        {result && (
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={onAddToChecklist}
              data-testid="button-add-to-checklist"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Add to Checklist
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-close-breakdown"
              >
                Close
              </Button>
              <Button onClick={onExportPDF} data-testid="button-export-rca">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
