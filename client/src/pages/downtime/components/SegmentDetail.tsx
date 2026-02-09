import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BarChart2,
  Download,
  GitBranch,
  Lightbulb,
  Loader2,
  Search,
} from "lucide-react";
import type { SegmentData, BreakdownDialogState, Finding, RootCause } from "../types";
import { segmentConfig } from "./SegmentOverviewCard";

interface SegmentDetailProps {
  segmentKey: string;
  segment: SegmentData;
  onExportPDF: () => void;
  onGenerateBreakdown: (finding: Finding | RootCause, segment: string) => void;
  isGeneratingBreakdown: boolean;
  breakdownDialog: BreakdownDialogState;
}

export function SegmentDetail({
  segmentKey,
  segment,
  onExportPDF,
  onGenerateBreakdown,
  isGeneratingBreakdown,
  breakdownDialog,
}: SegmentDetailProps) {
  const config = segmentConfig[segmentKey as keyof typeof segmentConfig];
  if (!config || !segment) return null;

  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Segment Header */}
      <div
        className={`p-6 rounded-lg ${config.bgColor} ${config.borderColor} border`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2
              className={`text-2xl font-bold flex items-center gap-2 ${config.color}`}
            >
              <Icon className="w-6 h-6" />
              {config.label} Analysis
            </h2>
            <p className="mt-2 text-muted-foreground">
              {segment.executiveSummary}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {segment.downtimeHours?.toFixed(1) || 0}
            </div>
            <div className="text-sm text-muted-foreground">hours downtime</div>
          </div>
        </div>

        {/* Key Metrics */}
        {segment.keyMetrics && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {Object.entries(segment.keyMetrics).map(([key, value]) => (
              <div key={key} className="text-center p-3 bg-background rounded-lg">
                <div className="text-lg font-bold">{String(value)}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Findings */}
      {segment.findings?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Key Findings ({segment.findings.length})
            </CardTitle>
            <CardDescription>
              Click "Generate Breakdown Analysis" to get AI-powered 5 Whys and
              Fishbone analysis for each finding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {segment.findings.map((finding, idx) => (
              <div key={idx} className="p-4 border rounded-lg hover-elevate">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{finding.title}</h4>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        finding.severity === "critical" ||
                        finding.severity === "high"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {finding.severity}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {segmentKey}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {finding.description}
                </p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Impact: {finding.impact}
                    </span>
                    {finding.affectedEquipment?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {finding.affectedEquipment
                          .slice(0, 3)
                          .map((eq: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {eq}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    data-testid={`button-breakdown-analysis-${segmentKey}-${idx}`}
                    onClick={() => onGenerateBreakdown(finding, segmentKey)}
                    disabled={isGeneratingBreakdown}
                  >
                    {isGeneratingBreakdown &&
                    breakdownDialog.finding === finding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <GitBranch className="w-4 h-4 mr-2" />
                        Generate Breakdown Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Root Causes */}
      {segment.rootCauses?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Root Causes ({segment.rootCauses.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {segment.rootCauses.map((cause, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{cause.cause}</h4>
                  <Badge
                    variant={
                      cause.riskLevel === "critical" ||
                      cause.riskLevel === "high"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {cause.riskLevel} risk
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{cause.evidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {segment.recommendations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Recommended Actions ({segment.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {segment.recommendations.map((rec, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{rec.title}</h4>
                  <Badge
                    variant={
                      rec.priority === "immediate"
                        ? "destructive"
                        : rec.priority === "short-term"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {rec.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {rec.description}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Owner:</span>
                    <p className="font-medium">{rec.owner}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Timeline:</span>
                    <p className="font-medium">{rec.timeline}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Outcome:</span>
                    <p className="font-medium">{rec.expectedOutcome}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Est. Cost:</span>
                    <p className="font-medium">{rec.estimatedCost || "TBD"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {segment.kpis && segment.kpis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Key Performance Indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {segment.kpis.map((kpi, idx: number) => (
                <div
                  key={idx}
                  className="p-4 border rounded-lg text-center"
                >
                  <div className="text-sm font-medium text-muted-foreground">
                    {kpi.metric}
                  </div>
                  <div className="text-xl font-bold mt-1">{kpi.current}</div>
                  <div className="text-xs text-muted-foreground">
                    Target: {kpi.target}
                  </div>
                  <div className="text-xs text-amber-600 mt-1">{kpi.gap}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <Button
          onClick={onExportPDF}
          data-testid={`button-export-${segmentKey}-pdf`}
        >
          <Download className="w-4 h-4 mr-2" />
          Export {config.label} Report
        </Button>
      </div>
    </div>
  );
}
