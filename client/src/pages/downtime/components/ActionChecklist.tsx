import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Shield,
  Activity,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import { format } from "date-fns";
import type { ActionItem } from "../types";
import { segmentConfig } from "./SegmentOverviewCard";

interface ActionChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionChecklist: ActionItem[];
  onToggleStatus: (actionId: string) => void;
  onRemove: (actionId: string) => void;
  onClearAll: () => void;
  onExportPDF: () => void;
  onCreateWorkOrder: (action: ActionItem) => void;
  creatingWorkOrderForAction: string | null;
}

// Icon mapping for segments
const segmentIcons = {
  safety: Shield,
  quality: CheckCircle2,
  operations: Activity,
  maintenance: Target,
};

export function ActionChecklist({
  open,
  onOpenChange,
  actionChecklist,
  onToggleStatus,
  onRemove,
  onClearAll,
  onExportPDF,
  onCreateWorkOrder,
  creatingWorkOrderForAction,
}: ActionChecklistProps) {
  const completedCount = actionChecklist.filter(
    (a) => a.status === "completed"
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Action Checklist
          </DialogTitle>
          <DialogDescription>
            Track and manage action items from your breakdown analysis.{" "}
            {completedCount} of {actionChecklist.length} completed.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {actionChecklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No actions in checklist yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Run Breakdown Analysis on findings and add actions to your
                checklist
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedCount} / {actionChecklist.length} completed
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(completedCount / actionChecklist.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Group by segment */}
              {(["safety", "quality", "operations", "maintenance"] as const).map(
                (seg) => {
                  const segmentActions = actionChecklist.filter(
                    (a) => a.segment === seg
                  );
                  if (segmentActions.length === 0) return null;

                  const config = segmentConfig[seg];
                  const Icon = segmentIcons[seg];

                  return (
                    <Card key={seg} className={`${config.borderColor} border`}>
                      <CardHeader className="pb-2">
                        <CardTitle
                          className={`text-base flex items-center gap-2 ${config.color}`}
                        >
                          <Icon className="w-5 h-5" />
                          {config.label} Actions ({segmentActions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {segmentActions.map((action) => (
                          <div
                            key={action.id}
                            className={`p-4 border rounded-lg ${
                              action.status === "completed"
                                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                                : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => onToggleStatus(action.id)}
                                className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  action.status === "completed"
                                    ? "bg-green-500 border-green-500 text-white"
                                    : action.status === "in_progress"
                                    ? "bg-amber-500 border-amber-500 text-white"
                                    : "border-muted-foreground"
                                }`}
                                data-testid={`checkbox-action-${action.id}`}
                              >
                                {action.status === "completed" && (
                                  <Check className="w-3 h-3" />
                                )}
                                {action.status === "in_progress" && (
                                  <Clock className="w-3 h-3" />
                                )}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <h4
                                    className={`font-medium ${
                                      action.status === "completed"
                                        ? "line-through text-muted-foreground"
                                        : ""
                                    }`}
                                  >
                                    {action.title}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        action.priority === "immediate"
                                          ? "destructive"
                                          : action.priority === "short-term"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {action.priority}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">
                                      {action.status.replace("_", " ")}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {action.description}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Owner:
                                    </span>
                                    <span className="ml-1 font-medium">
                                      {action.owner}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Timeline:
                                    </span>
                                    <span className="ml-1 font-medium">
                                      {action.timeline}
                                    </span>
                                  </div>
                                  {action.estimatedCost && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Est. Cost:
                                      </span>
                                      <span className="ml-1 font-medium">
                                        {action.estimatedCost}
                                      </span>
                                    </div>
                                  )}
                                  <div className="col-span-2 md:col-span-1">
                                    <span className="text-muted-foreground">
                                      Success Metric:
                                    </span>
                                    <span className="ml-1 font-medium">
                                      {action.successMetric}
                                    </span>
                                  </div>
                                </div>

                                {/* Implementation Steps */}
                                {action.implementationSteps &&
                                  action.implementationSteps.length > 0 && (
                                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                                        Implementation Steps:
                                      </p>
                                      <ol className="space-y-1 text-xs list-decimal list-inside">
                                        {action.implementationSteps.map(
                                          (step, stepIdx) => (
                                            <li
                                              key={stepIdx}
                                              className={
                                                action.status === "completed"
                                                  ? "text-muted-foreground line-through"
                                                  : ""
                                              }
                                            >
                                              {step}
                                            </li>
                                          )
                                        )}
                                      </ol>
                                    </div>
                                  )}

                                {/* RACI Matrix */}
                                {action.raci && (
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <Badge variant="outline" className="text-xs">
                                      R: {action.raci.responsible}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      A: {action.raci.accountable}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      C: {action.raci.consulted}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      I: {action.raci.informed}
                                    </Badge>
                                  </div>
                                )}
                                {action.status === "completed" &&
                                  action.completedDate && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                      Completed{" "}
                                      {format(
                                        new Date(action.completedDate),
                                        "MMM dd, yyyy"
                                      )}
                                    </p>
                                  )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => onCreateWorkOrder(action)}
                                  disabled={
                                    creatingWorkOrderForAction === action.id
                                  }
                                  data-testid={`button-create-wo-${action.id}`}
                                >
                                  {creatingWorkOrderForAction === action.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Wrench className="w-4 h-4 mr-1" />
                                      Create WO
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => onRemove(action.id)}
                                  data-testid={`button-remove-action-${action.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="destructive"
            onClick={onClearAll}
            disabled={actionChecklist.length === 0}
            data-testid="button-clear-checklist"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-checklist"
            >
              Close
            </Button>
            <Button
              onClick={onExportPDF}
              disabled={actionChecklist.length === 0}
              data-testid="button-export-checklist"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
