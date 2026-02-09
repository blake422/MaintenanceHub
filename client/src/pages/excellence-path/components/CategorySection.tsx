import { ClipboardCheck, CheckCircle2, Target, FileText, Download, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { Step, ChecklistItem, ImprovementAction, AssessmentData, ProgramDocument } from "../types";

interface ChecklistSectionProps {
  checklist: ChecklistItem[];
  stepChecklist: Record<string, boolean>;
  isStepComplete: boolean;
  isPending: boolean;
  onChecklistToggle: (itemId: string) => void;
  hasForm: (itemId: string) => boolean;
  onOpenForm: (itemId: string) => void;
}

export function ChecklistSection({
  checklist,
  stepChecklist,
  isStepComplete,
  isPending,
  onChecklistToggle,
  hasForm,
  onOpenForm
}: ChecklistSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <CardTitle>Implementation Checklist</CardTitle>
          </div>
          {isStepComplete && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border border-border rounded-lg hover-elevate"
            >
              <Checkbox
                checked={stepChecklist[item.id] || false}
                onCheckedChange={() => onChecklistToggle(item.id)}
                disabled={isPending}
                data-testid={`checkbox-${item.id}`}
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${stepChecklist[item.id] ? 'line-through text-muted-foreground' : ''}`}>
                  {item.text}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold">Deliverable:</span> {item.deliverable}
                </p>
              </div>
              {hasForm(item.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenForm(item.id)}
                  data-testid={`button-open-form-${item.id}`}
                  className="shrink-0"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Form
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ImprovementActionsProps {
  actions: ImprovementAction[];
}

export function ImprovementActionsSection({ actions }: ImprovementActionsProps) {
  if (actions.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-amber-700 dark:text-amber-400">
              Assessment-Driven Actions
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
            {actions.length} actions from Process Assessment
          </Badge>
        </div>
        <CardDescription>
          These improvement actions were automatically generated based on gaps identified in your Step 0 Process Assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map(action => (
            <div
              key={action.id}
              className="p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-white dark:bg-background"
            >
              <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                  action.priority === "critical" ? "bg-red-500" :
                  action.priority === "high" ? "bg-orange-500" : "bg-yellow-500"
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={
                        action.priority === "critical" ? "border-red-400 text-red-600 dark:text-red-400" :
                        action.priority === "high" ? "border-orange-400 text-orange-600 dark:text-orange-400" :
                        "border-yellow-400 text-yellow-600 dark:text-yellow-400"
                      }
                    >
                      {action.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary">{action.category}</Badge>
                  </div>
                  <p className="text-sm font-medium">{action.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.rationale}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AssessmentSummaryProps {
  assessmentData: AssessmentData;
}

export function AssessmentSummarySection({ assessmentData }: AssessmentSummaryProps) {
  return (
    <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle className="text-green-700 dark:text-green-400">
              Assessment Completed
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-green-400 text-green-700 dark:text-green-400">
            {assessmentData.percentageScore}% Score
          </Badge>
        </div>
        <CardDescription>
          Your Process Assessment has been saved and improvement actions have been generated
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-white dark:bg-background rounded-lg border">
            <div className="text-2xl font-bold text-primary">{assessmentData.totalScore}</div>
            <div className="text-xs text-muted-foreground">Points Scored</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-background rounded-lg border">
            <div className="text-2xl font-bold">{assessmentData.maxScore}</div>
            <div className="text-xs text-muted-foreground">Points Possible</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-background rounded-lg border">
            <div className="text-2xl font-bold text-amber-600">{assessmentData.improvementActions?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Improvement Actions</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-background rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{assessmentData.percentageScore}%</div>
            <div className="text-xs text-muted-foreground">Maturity Score</div>
          </div>
        </div>
        {assessmentData.improvementActions && assessmentData.improvementActions.length > 0 && (
          <div className="mt-4 p-3 bg-white dark:bg-background rounded-lg border">
            <h4 className="text-sm font-semibold mb-2">Actions by Step:</h4>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(stepNum => {
                const count = assessmentData.improvementActions?.filter(a => a.step === stepNum).length || 0;
                if (count === 0) return null;
                return (
                  <Badge key={stepNum} variant="secondary">
                    Step {stepNum}: {count} actions
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NotesSectionProps {
  notes: string;
  stepNotes: string;
  isPending: boolean;
  onNotesChange: (notes: string) => void;
  onSaveNotes: () => void;
}

export function NotesSection({
  notes,
  stepNotes,
  isPending,
  onNotesChange,
  onSaveNotes
}: NotesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <CardTitle>Implementation Notes</CardTitle>
        </div>
        <CardDescription>
          Document key findings, challenges, and results as you complete this step
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Enter your implementation notes, findings, metrics achieved, challenges encountered, etc."
          value={notes || stepNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-32"
          data-testid="input-notes"
        />
        <Button
          onClick={onSaveNotes}
          disabled={isPending}
          data-testid="button-save-notes"
        >
          Save Notes
        </Button>
      </CardContent>
    </Card>
  );
}

interface StepActionsSectionProps {
  isStepComplete: boolean;
  isPending: boolean;
  calculatedProgress: number;
  selectedStep: number;
  onCompleteStep: () => void;
  onUncompleteStep: () => void;
  onGenerateReport: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
}

export function StepActionsSection({
  isStepComplete,
  isPending,
  calculatedProgress,
  selectedStep,
  onCompleteStep,
  onUncompleteStep,
  onGenerateReport,
  onPreviousStep,
  onNextStep
}: StepActionsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {!isStepComplete ? (
            <Button
              onClick={onCompleteStep}
              disabled={isPending || calculatedProgress < 100}
              className="flex-1"
              data-testid="button-complete-step"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Step & Generate Report
            </Button>
          ) : (
            <>
              <Button
                onClick={onUncompleteStep}
                variant="outline"
                disabled={isPending}
                className="flex-1"
                data-testid="button-uncomplete-step"
              >
                Mark as Incomplete
              </Button>
              <Button
                onClick={onGenerateReport}
                variant="default"
                className="flex-1"
                data-testid="button-download-report"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onPreviousStep}
            disabled={selectedStep === 0}
            className="flex-1"
            data-testid="button-previous-step"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous Step
          </Button>
          <Button
            variant="outline"
            onClick={onNextStep}
            disabled={selectedStep === 6}
            className="flex-1"
            data-testid="button-next-step"
          >
            Next Step
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResourcesSectionProps {
  documents: ProgramDocument[];
  selectedStep: number;
}

export function ResourcesSection({ documents, selectedStep }: ResourcesSectionProps) {
  // Filter documents relevant to current step (or general documents marked with step 0)
  const stepDocs = documents.filter(doc =>
    doc.steps.includes(selectedStep) || doc.steps.includes(0)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          <CardTitle>Program Resources</CardTitle>
        </div>
        <CardDescription>
          Downloadable templates, guides, and tools for this step
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stepDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No specific resources for this step yet.
          </p>
        ) : (
          <div className="space-y-3">
            {stepDocs.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover-elevate"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    doc.type === 'pdf'
                      ? 'bg-red-500/10'
                      : 'bg-green-500/10'
                  }`}>
                    <FileText className={`w-4 h-4 ${
                      doc.type === 'pdf'
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {doc.type.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid={`button-download-${doc.fileName.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  <a
                    href={`/api/excellence-resources/${encodeURIComponent(doc.fileName)}`}
                    download={doc.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
