import { Sheet, SheetContent } from "@/components/ui/sheet";
import { EquipmentInventoryForm } from "@/components/equipment-inventory-form";
import { CriticalityMatrixForm } from "@/components/criticality-matrix-form";
import { FMEAForm } from "@/components/fmea-form";
import { PartsABCForm } from "@/components/parts-abc-form";
import { BDAForm } from "@/components/bda-form";
import { RAILForm } from "@/components/rail-form";
import { RoadmapForm } from "@/components/roadmap-form";
import { ChangeAgentForm } from "@/components/change-agent-form";
import { LeadershipForm } from "@/components/leadership-form";
import { ScorecardForm } from "@/components/scorecard-form";
import { ProcessAssessmentForm } from "@/components/process-assessment-form";
import type { OpenFormDrawer } from "../types";

interface StepDetailDialogProps {
  openFormDrawer: OpenFormDrawer | null;
  selectedStep: number;
  onClose: () => void;
}

export function StepDetailDialog({
  openFormDrawer,
  selectedStep,
  onClose
}: StepDetailDialogProps) {
  return (
    <Sheet open={!!openFormDrawer} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[90vw] overflow-y-auto p-0">
        {openFormDrawer?.formType === "equipment_inventory" && (
          <div className="h-full flex flex-col">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Equipment Inventory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Build a hierarchical equipment registry (Site - Area - Line - Equipment - Component)
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EquipmentInventoryForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "criticality_matrix" && (
          <div className="h-full flex flex-col">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Equipment Criticality Scoring Matrix</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Score each equipment on 6 criteria (1-5 scale). System auto-calculates total and assigns ABC classification.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CriticalityMatrixForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "fmea_analysis" && (
          <div className="h-full flex flex-col">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">FMEA (Failure Mode & Effects Analysis)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Document failure modes with Severity, Occurrence, Detection scores. System auto-calculates RPN (Risk Priority Number).
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FMEAForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "parts_abc_analysis" && (
          <div className="h-full flex flex-col">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Parts ABC Analysis</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Categorize parts by annual $ usage (Pareto 80/20). Set EOQ, Min/Max levels, and lead times.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PartsABCForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "bda_analysis" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <BDAForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "rail_tracker" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <RAILForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "roadmap_init" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <RoadmapForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "change_agent" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ChangeAgentForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "leadership_interview" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <LeadershipForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                formType="interview"
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "leadership_observation" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <LeadershipForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                formType="observation"
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "scorecard" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ScorecardForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
        {openFormDrawer?.formType === "process_assessment" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ProcessAssessmentForm
                step={selectedStep}
                checklistItemId={openFormDrawer.checklistItemId}
                onDismiss={onClose}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
