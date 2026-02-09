import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface FMEAEntry {
  id: string;
  equipmentName: string;
  failureMode: string;
  effect: string;
  severity: number;
  occurrence: number;
  detection: number;
  rpn: number;
  recommendedAction: string;
}

interface FMEAFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function FMEAForm({ step, checklistItemId, onDismiss, onDirtyChange }: FMEAFormProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<FMEAEntry[]>([]);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  const { data: equipmentList } = useQuery<any[]>({
    queryKey: ["/api/equipment"],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "fmea_analysis"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as { entries: FMEAEntry[] };
        setEntries(payload.entries || []);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (entriesToSave: FMEAEntry[]): Promise<ExcellenceDeliverable> => {
      const payload = { entries: entriesToSave };
      
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "fmea_analysis",
          title: "FMEA Analysis",
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (data, savedEntries) => {
      setDeliverableId(data.id);
      onDirtyChange?.(false);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "FMEA analysis saved",
        description: `${savedEntries.length} failure modes documented.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save FMEA analysis. Please try again.",
        variant: "destructive",
      });
    }
  });

  const calculateRPN = (severity: number, occurrence: number, detection: number): number => {
    return severity * occurrence * detection;
  };

  const updateEntry = (id: string, field: keyof FMEAEntry, value: any) => {
    const newEntries = entries.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, [field]: value };
        updated.rpn = calculateRPN(updated.severity, updated.occurrence, updated.detection);
        return updated;
      }
      return entry;
    });
    setEntries(newEntries);
    onDirtyChange?.(true);
  };

  const addEntry = () => {
    const newEntry: FMEAEntry = {
      id: crypto.randomUUID(),
      equipmentName: "",
      failureMode: "",
      effect: "",
      severity: 1,
      occurrence: 1,
      detection: 1,
      rpn: 1,
      recommendedAction: "",
    };
    setEntries([...entries, newEntry]);
    onDirtyChange?.(true);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    onDirtyChange?.(true);
  };

  const handleSave = () => {
    const sanitizedEntries = entries.filter(e => e.equipmentName.trim() && e.failureMode.trim());
    setEntries(sanitizedEntries);
    saveMutation.mutate(sanitizedEntries);
  };

  const highRiskCount = entries.filter(e => e.rpn >= 100).length;
  const mediumRiskCount = entries.filter(e => e.rpn >= 50 && e.rpn < 100).length;
  const lowRiskCount = entries.filter(e => e.rpn < 50).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-medium">{entries.length}</span> failure modes analyzed
          </div>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-red-500">High Risk (RPN≥100): {highRiskCount}</Badge>
            <Badge variant="default" className="bg-yellow-500">Medium Risk (50-99): {mediumRiskCount}</Badge>
            <Badge variant="default" className="bg-green-500">Low Risk (&lt;50): {lowRiskCount}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" data-testid="button-save-fmea">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save FMEA"}
          </Button>
          <Button onClick={addEntry} size="sm" data-testid="button-add-failure">
            <Plus className="w-4 h-4 mr-2" />
            Add Failure Mode
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Equipment</TableHead>
              <TableHead className="w-48">Failure Mode</TableHead>
              <TableHead className="w-48">Effect</TableHead>
              <TableHead className="w-24 text-center">Severity (1-10)</TableHead>
              <TableHead className="w-28 text-center">Occurrence (1-10)</TableHead>
              <TableHead className="w-24 text-center">Detection (1-10)</TableHead>
              <TableHead className="w-20 text-center">RPN</TableHead>
              <TableHead className="w-56">Recommended Action</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No failure modes analyzed yet. Click "Add Failure Mode" to get started.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className={entry.rpn >= 100 ? "bg-red-50 dark:bg-red-950/20" : ""}>
                  <TableCell>
                    <Input
                      value={entry.equipmentName}
                      onChange={(e) => updateEntry(entry.id, "equipmentName", e.target.value)}
                      placeholder="Equipment"
                      className="h-8"
                      data-testid={`input-equipment-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={entry.failureMode}
                      onChange={(e) => updateEntry(entry.id, "failureMode", e.target.value)}
                      placeholder="Failure mode"
                      className="h-8"
                      data-testid={`input-failure-mode-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={entry.effect}
                      onChange={(e) => updateEntry(entry.id, "effect", e.target.value)}
                      placeholder="Effect"
                      className="h-8"
                      data-testid={`input-effect-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entry.severity.toString()}
                      onValueChange={(val) => updateEntry(entry.id, "severity", parseInt(val))}
                    >
                      <SelectTrigger className="h-8" data-testid={`select-severity-${entry.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entry.occurrence.toString()}
                      onValueChange={(val) => updateEntry(entry.id, "occurrence", parseInt(val))}
                    >
                      <SelectTrigger className="h-8" data-testid={`select-occurrence-${entry.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entry.detection.toString()}
                      onValueChange={(val) => updateEntry(entry.id, "detection", parseInt(val))}
                    >
                      <SelectTrigger className="h-8" data-testid={`select-detection-${entry.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="default"
                      className={
                        entry.rpn >= 100
                          ? "bg-red-500"
                          : entry.rpn >= 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }
                    >
                      {entry.rpn}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={entry.recommendedAction}
                      onChange={(e) => updateEntry(entry.id, "recommendedAction", e.target.value)}
                      placeholder="Action"
                      className="h-8"
                      data-testid={`input-action-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(entry.id)}
                      data-testid={`button-delete-${entry.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">FMEA Scoring Guide:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><strong>Severity (S):</strong> Impact of failure (1=Minor inconvenience, 10=Hazardous/Safety)</li>
              <li><strong>Occurrence (O):</strong> Frequency of failure (1=Rare, 10=Very frequent)</li>
              <li><strong>Detection (D):</strong> Ability to detect before impact (1=Certain, 10=Cannot detect)</li>
              <li><strong>RPN = S × O × D:</strong> Risk Priority Number (max 1000)</li>
            </ul>
            <p className="mt-2"><strong>Action Thresholds:</strong> RPN ≥100 = Immediate action, 50-99 = Medium priority, &lt;50 = Monitor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
