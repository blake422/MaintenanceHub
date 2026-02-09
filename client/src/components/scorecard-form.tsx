import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Save, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface KPIMetric {
  id: string;
  category: string;
  name: string;
  unit: string;
  baseline: number;
  target: number;
  actual: number;
  worldClass: number;
  notes: string;
}

interface ScorecardData {
  periodStart: string;
  periodEnd: string;
  facilityName: string;
  metrics: KPIMetric[];
}

interface ScorecardFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const defaultMetrics: KPIMetric[] = [
  { id: "1", category: "Reliability", name: "PM Compliance", unit: "%", baseline: 0, target: 95, actual: 0, worldClass: 99, notes: "" },
  { id: "2", category: "Reliability", name: "Reactive Work", unit: "%", baseline: 0, target: 20, actual: 0, worldClass: 10, notes: "" },
  { id: "3", category: "Reliability", name: "MTBF (Critical Assets)", unit: "hours", baseline: 0, target: 0, actual: 0, worldClass: 0, notes: "" },
  { id: "4", category: "Reliability", name: "MTTR", unit: "hours", baseline: 0, target: 0, actual: 0, worldClass: 0, notes: "" },
  { id: "5", category: "Efficiency", name: "OEE", unit: "%", baseline: 0, target: 85, actual: 0, worldClass: 90, notes: "" },
  { id: "6", category: "Efficiency", name: "Schedule Compliance", unit: "%", baseline: 0, target: 90, actual: 0, worldClass: 95, notes: "" },
  { id: "7", category: "Efficiency", name: "Wrench Time", unit: "%", baseline: 0, target: 55, actual: 0, worldClass: 65, notes: "" },
  { id: "8", category: "Inventory", name: "Parts Availability", unit: "%", baseline: 0, target: 97, actual: 0, worldClass: 99, notes: "" },
  { id: "9", category: "Inventory", name: "Inventory Turnover", unit: "turns/yr", baseline: 0, target: 2, actual: 0, worldClass: 3, notes: "" },
  { id: "10", category: "Inventory", name: "Stockout Rate", unit: "%", baseline: 0, target: 3, actual: 0, worldClass: 1, notes: "" },
  { id: "11", category: "Safety", name: "Safety Incidents", unit: "count", baseline: 0, target: 0, actual: 0, worldClass: 0, notes: "" },
  { id: "12", category: "Safety", name: "Near Miss Reports", unit: "count", baseline: 0, target: 0, actual: 0, worldClass: 0, notes: "" },
  { id: "13", category: "Cost", name: "Maintenance Cost/RAV", unit: "%", baseline: 0, target: 3, actual: 0, worldClass: 2, notes: "" },
  { id: "14", category: "Cost", name: "Downtime Cost", unit: "$/month", baseline: 0, target: 0, actual: 0, worldClass: 0, notes: "" },
  { id: "15", category: "People", name: "Training Hours/Tech", unit: "hrs/yr", baseline: 0, target: 40, actual: 0, worldClass: 80, notes: "" }
];

export function ScorecardForm({ step, checklistItemId, onDismiss }: ScorecardFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<ScorecardData>({
    periodStart: "",
    periodEnd: "",
    facilityName: "",
    metrics: defaultMetrics
  });
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "maintenance_scorecard"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as ScorecardData;
        setData(payload || { periodStart: "", periodEnd: "", facilityName: "", metrics: defaultMetrics });
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: ScorecardData): Promise<ExcellenceDeliverable> => {
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "maintenance_scorecard",
          title: "Maintenance Process Scorecard",
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (response) => {
      setDeliverableId(response.id);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "Scorecard saved",
        description: "Maintenance scorecard saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save scorecard. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateMetric = (id: string, field: keyof KPIMetric, value: any) => {
    setData(prev => ({
      ...prev,
      metrics: prev.metrics.map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  const getStatus = (metric: KPIMetric) => {
    if (metric.actual === 0 && metric.target === 0) return "neutral";
    
    // For metrics where lower is better (like Reactive Work, Stockout Rate, MTTR)
    const lowerIsBetter = ["Reactive Work", "Stockout Rate", "MTTR", "Maintenance Cost/RAV", "Downtime Cost", "Safety Incidents"].includes(metric.name);
    
    if (lowerIsBetter) {
      if (metric.actual <= metric.target) return "good";
      if (metric.actual <= metric.baseline) return "warning";
      return "bad";
    } else {
      if (metric.actual >= metric.target) return "good";
      if (metric.actual >= metric.baseline) return "warning";
      return "bad";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "good": return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "warning": return <Minus className="w-4 h-4 text-yellow-600" />;
      case "bad": return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "good": return <Badge className="bg-green-100 text-green-800">On Target</Badge>;
      case "warning": return <Badge className="bg-yellow-100 text-yellow-800">Below Target</Badge>;
      case "bad": return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge variant="outline">No Data</Badge>;
    }
  };

  const calculateProgress = (metric: KPIMetric) => {
    if (metric.target === 0) return 0;
    const lowerIsBetter = ["Reactive Work", "Stockout Rate", "MTTR", "Maintenance Cost/RAV", "Downtime Cost", "Safety Incidents"].includes(metric.name);
    
    if (lowerIsBetter) {
      // For lower is better, progress = 100 - (actual/target * 100)
      return Math.min(100, Math.max(0, 100 - ((metric.actual / metric.target) * 100) + 100));
    } else {
      return Math.min(100, Math.max(0, (metric.actual / metric.target) * 100));
    }
  };

  // Group metrics by category
  const groupedMetrics = data.metrics.reduce((acc, metric) => {
    if (!acc[metric.category]) acc[metric.category] = [];
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, KPIMetric[]>);

  // Calculate overall score
  const overallScore = () => {
    const metricsWithData = data.metrics.filter(m => m.actual > 0 || m.target > 0);
    if (metricsWithData.length === 0) return 0;
    const good = metricsWithData.filter(m => getStatus(m) === "good").length;
    return Math.round((good / metricsWithData.length) * 100);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Maintenance Process Scorecard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track KPIs against baseline, target, and world-class benchmarks
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(data)}
          disabled={saveMutation.isPending}
          data-testid="button-save-scorecard"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Scorecard
        </Button>
      </div>

      {/* Header Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Facility Name</Label>
              <Input
                value={data.facilityName}
                onChange={(e) => setData(prev => ({ ...prev, facilityName: e.target.value }))}
                placeholder="Plant name"
                data-testid="input-facility"
              />
            </div>
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                value={data.periodStart}
                onChange={(e) => setData(prev => ({ ...prev, periodStart: e.target.value }))}
                data-testid="input-period-start"
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                value={data.periodEnd}
                onChange={(e) => setData(prev => ({ ...prev, periodEnd: e.target.value }))}
                data-testid="input-period-end"
              />
            </div>
            <div>
              <Label>Overall Score</Label>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={overallScore()} className="flex-1 h-3" />
                <span className="font-bold text-lg">{overallScore()}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics by Category */}
      {Object.entries(groupedMetrics).map(([category, metrics]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead className="text-center">Baseline</TableHead>
                  <TableHead className="text-center">Target</TableHead>
                  <TableHead className="text-center">Actual</TableHead>
                  <TableHead className="text-center">World Class</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map(metric => {
                  const status = getStatus(metric);
                  return (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.name}</TableCell>
                      <TableCell className="text-center text-muted-foreground text-sm">{metric.unit}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={metric.baseline}
                          onChange={(e) => updateMetric(metric.id, "baseline", parseFloat(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-baseline-${metric.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={metric.target}
                          onChange={(e) => updateMetric(metric.id, "target", parseFloat(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid={`input-target-${metric.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={metric.actual}
                          onChange={(e) => updateMetric(metric.id, "actual", parseFloat(e.target.value) || 0)}
                          className={`w-20 text-center ${
                            status === "good" ? "border-green-500" :
                            status === "warning" ? "border-yellow-500" :
                            status === "bad" ? "border-red-500" : ""
                          }`}
                          data-testid={`input-actual-${metric.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {metric.worldClass}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={metric.notes}
                          onChange={(e) => updateMetric(metric.id, "notes", e.target.value)}
                          placeholder="Notes"
                          className="w-full"
                          data-testid={`input-notes-${metric.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
