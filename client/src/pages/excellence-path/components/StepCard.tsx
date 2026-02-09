import { CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Step } from "../types";

interface StepCardProps {
  step: Step;
  isSelected: boolean;
  isCompleted: boolean;
  progress: number;
  onClick: () => void;
}

export function StepCard({
  step,
  isSelected,
  isCompleted,
  progress,
  onClick
}: StepCardProps) {
  const Icon = step.icon;

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 transition-all hover-elevate text-left ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border"
      }`}
      data-testid={`step-nav-${step.id}`}
    >
      <div className="flex flex-col gap-2">
        <div className={`${step.bgColor} p-2 rounded-lg self-start`}>
          <Icon className={`w-5 h-5 ${step.color}`} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">Step {step.id}</span>
            {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
          <p className="text-xs font-medium line-clamp-2">{step.title}</p>
          <Progress value={progress} className="h-1 mt-2" />
        </div>
      </div>
    </button>
  );
}
