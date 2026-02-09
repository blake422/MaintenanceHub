import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, Activity, Target } from "lucide-react";
import type { SegmentData } from "../types";

const segmentConfig = {
  safety: {
    label: "Safety",
    icon: Shield,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    badgeVariant: "destructive" as const,
  },
  quality: {
    label: "Quality",
    icon: CheckCircle2,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeVariant: "default" as const,
  },
  operations: {
    label: "Operations",
    icon: Activity,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeVariant: "secondary" as const,
  },
  maintenance: {
    label: "Maintenance",
    icon: Target,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    badgeVariant: "outline" as const,
  },
};

interface SegmentOverviewCardProps {
  segmentKey: string;
  segment: SegmentData;
  onSelect: (segmentKey: string) => void;
}

export function SegmentOverviewCard({
  segmentKey,
  segment,
  onSelect,
}: SegmentOverviewCardProps) {
  const config = segmentConfig[segmentKey as keyof typeof segmentConfig];
  if (!config || !segment) return null;

  const Icon = config.icon;

  return (
    <Card
      className={`cursor-pointer hover-elevate ${config.borderColor} border-2`}
      onClick={() => onSelect(segmentKey)}
      data-testid={`card-segment-${segmentKey}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`flex items-center gap-2 text-base ${config.color}`}
          >
            <Icon className="w-5 h-5" />
            {config.label}
          </CardTitle>
          <Badge
            variant={
              segment.severity === "critical"
                ? "destructive"
                : segment.severity === "high"
                ? "destructive"
                : "secondary"
            }
          >
            {segment.severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">
          {segment.downtimeHours?.toFixed(1) || 0} hrs
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {segment.executiveSummary}
        </p>
        <div className="flex items-center gap-1 text-xs text-primary">
          <span>{segment.findings?.length || 0} findings</span>
          <span>-</span>
          <span>{segment.recommendations?.length || 0} actions</span>
        </div>
      </CardContent>
    </Card>
  );
}

export { segmentConfig };
