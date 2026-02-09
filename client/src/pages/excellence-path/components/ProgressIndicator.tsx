import { Trophy, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight } from "lucide-react";
import type { Step } from "../types";

interface HeaderProgressProps {
  overallProgress: number;
  onGenerateFullReport: () => void;
}

export function HeaderProgress({ overallProgress, onGenerateFullReport }: HeaderProgressProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Path to Excellence</CardTitle>
              <CardDescription>Consultant-guided implementation of world-class maintenance systems</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={onGenerateFullReport}
              variant="outline"
              data-testid="button-full-report"
            >
              <FileText className="w-4 h-4 mr-2" />
              Full Report
            </Button>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Overall Progress</div>
              <div className="text-2xl font-bold">{overallProgress}%</div>
            </div>
            <Progress value={overallProgress} className="w-32" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface StepOverviewProps {
  step: Step;
  calculatedProgress: number;
  completedCount: number;
  totalCount: number;
}

export function StepOverview({ step, calculatedProgress, completedCount, totalCount }: StepOverviewProps) {
  const Icon = step.icon;

  return (
    <Card className="lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`${step.bgColor} p-3 rounded-lg`}>
            <Icon className={`w-6 h-6 ${step.color}`} />
          </div>
          <div>
            <CardTitle className="text-lg">Step {step.id}</CardTitle>
            <CardDescription className="text-sm">{step.title}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTION</div>
          <p className="text-sm">{step.description}</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1">OBJECTIVE</div>
          <p className="text-sm text-muted-foreground">{step.objective}</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1">TIMELINE</div>
          <p className="text-sm font-medium">{step.timeline}</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">KEY DELIVERABLES</div>
          <div className="space-y-2">
            {step.keyDeliverables.map((deliverable, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{deliverable}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">PROGRESS</div>
            <div className="text-sm font-bold">{calculatedProgress}%</div>
          </div>
          <Progress value={calculatedProgress} />
          <p className="text-xs text-muted-foreground mt-2">
            {completedCount} of {totalCount} tasks complete
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
