import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface CriticalityScore {
  id: string;
  equipmentName: string;
  assetTag: string;
  safetyScore: number;
  environmentScore: number;
  productionScore: number;
  qualityScore: number;
  mttrScore: number;
  costScore: number;
  totalScore: number;
  classification: "A" | "B" | "C" | "";
}

interface CriticalityMatrixFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function CriticalityMatrixForm({ step, checklistItemId, onDismiss, onDirtyChange }: CriticalityMatrixFormProps) {
  const { toast } = useToast();
  const [scores, setScores] = useState<CriticalityScore[]>([]);
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
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "criticality_matrix"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as { scores: CriticalityScore[] };
        setScores(payload.scores || []);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (scoresToSave: CriticalityScore[]): Promise<ExcellenceDeliverable> => {
      const payload = { scores: scoresToSave };
      
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "criticality_matrix",
          title: "Criticality Scoring Matrix",
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (data, savedScores) => {
      setDeliverableId(data.id);
      onDirtyChange?.(false);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "Criticality matrix saved",
        description: `${savedScores.length} equipment items scored successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save criticality matrix. Please try again.",
        variant: "destructive",
      });
    }
  });

  const calculateTotalScore = (score: CriticalityScore): number => {
    return (
      score.safetyScore +
      score.environmentScore +
      score.productionScore +
      score.qualityScore +
      score.mttrScore +
      score.costScore
    );
  };

  const calculateClassification = (scoreId: string, allScores: CriticalityScore[]): "A" | "B" | "C" => {
    const sortedScores = [...allScores].sort((a, b) => b.totalScore - a.totalScore);
    const index = sortedScores.findIndex(s => s.id === scoreId);
    const percentile = (index / sortedScores.length) * 100;
    
    if (percentile <= 15) return "A";
    if (percentile <= 45) return "B";
    return "C";
  };

  const updateScore = (id: string, field: keyof CriticalityScore, value: any) => {
    const newScores = scores.map(score => {
      if (score.id === id) {
        const updated = { ...score, [field]: value };
        updated.totalScore = calculateTotalScore(updated);
        return updated;
      }
      return score;
    });

    const withClassifications = newScores.map(score => ({
      ...score,
      classification: calculateClassification(score.id, newScores)
    }));

    setScores(withClassifications);
    onDirtyChange?.(true);
  };

  const addEquipment = () => {
    const newScore: CriticalityScore = {
      id: crypto.randomUUID(),
      equipmentName: "",
      assetTag: "",
      safetyScore: 0,
      environmentScore: 0,
      productionScore: 0,
      qualityScore: 0,
      mttrScore: 0,
      costScore: 0,
      totalScore: 0,
      classification: "",
    };
    setScores([...scores, newScore]);
    onDirtyChange?.(true);
  };

  const loadFromEquipmentList = () => {
    if (!equipmentList || equipmentList.length === 0) {
      toast({
        title: "No equipment found",
        description: "Please add equipment to your inventory first.",
        variant: "destructive",
      });
      return;
    }

    const newScores: CriticalityScore[] = equipmentList.map(eq => ({
      id: crypto.randomUUID(),
      equipmentName: eq.name || "",
      assetTag: eq.assetTag || "",
      safetyScore: 0,
      environmentScore: 0,
      productionScore: 0,
      qualityScore: 0,
      mttrScore: 0,
      costScore: 0,
      totalScore: 0,
      classification: "",
    }));

    setScores(newScores);
    onDirtyChange?.(true);
    toast({
      title: "Equipment loaded",
      description: `${newScores.length} equipment items loaded from inventory.`,
    });
  };

  const removeScore = (id: string) => {
    setScores(scores.filter(s => s.id !== id));
    onDirtyChange?.(true);
  };

  const handleSave = () => {
    const sanitizedScores = scores.filter(s => s.equipmentName.trim()).map(score => ({
      ...score,
      classification: calculateClassification(score.id, scores.filter(s => s.equipmentName.trim()))
    }));
    setScores(sanitizedScores);
    saveMutation.mutate(sanitizedScores);
  };

  const aCount = scores.filter(s => s.classification === "A").length;
  const bCount = scores.filter(s => s.classification === "B").length;
  const cCount = scores.filter(s => s.classification === "C").length;

  return (
    <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium">{scores.length}</span> equipment items scored
                </div>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-red-500">A-Critical: {aCount}</Badge>
                  <Badge variant="default" className="bg-yellow-500">B-Important: {bCount}</Badge>
                  <Badge variant="default" className="bg-green-500">C-Non-critical: {cCount}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadFromEquipmentList} variant="outline" size="sm" data-testid="button-load-equipment">
                  Load from Inventory
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" data-testid="button-save-matrix">
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Matrix"}
                </Button>
                <Button onClick={addEquipment} size="sm" data-testid="button-add-equipment">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Equipment Name</TableHead>
                    <TableHead className="w-32">Asset Tag</TableHead>
                    <TableHead className="w-24 text-center">Safety (1-5)</TableHead>
                    <TableHead className="w-24 text-center">Environment (1-5)</TableHead>
                    <TableHead className="w-24 text-center">Production (1-5)</TableHead>
                    <TableHead className="w-24 text-center">Quality (1-5)</TableHead>
                    <TableHead className="w-24 text-center">MTTR (1-5)</TableHead>
                    <TableHead className="w-24 text-center">Cost (1-5)</TableHead>
                    <TableHead className="w-20 text-center">Total</TableHead>
                    <TableHead className="w-20 text-center">ABC</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        No equipment scored yet. Click "Load from Inventory" or "Add Equipment" to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    scores.map((score) => (
                      <TableRow key={score.id}>
                        <TableCell>
                          <Input
                            value={score.equipmentName}
                            onChange={(e) => updateScore(score.id, "equipmentName", e.target.value)}
                            placeholder="Equipment name"
                            className="h-8"
                            data-testid={`input-equipment-name-${score.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={score.assetTag}
                            onChange={(e) => updateScore(score.id, "assetTag", e.target.value)}
                            placeholder="Tag"
                            className="h-8"
                            data-testid={`input-asset-tag-${score.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.safetyScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "safetyScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-safety-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.environmentScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "environmentScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-environment-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.productionScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "productionScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-production-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.qualityScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "qualityScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-quality-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.mttrScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "mttrScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-mttr-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={score.costScore.toString()}
                            onValueChange={(val) => updateScore(score.id, "costScore", parseInt(val))}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-cost-${score.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {score.totalScore}
                        </TableCell>
                        <TableCell className="text-center">
                          {score.classification && (
                            <Badge
                              variant="default"
                              className={
                                score.classification === "A"
                                  ? "bg-red-500"
                                  : score.classification === "B"
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            >
                              {score.classification}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeScore(score.id)}
                            data-testid={`button-delete-${score.id}`}
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
                  <p className="font-medium">Scoring Guide:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    <li><strong>Safety:</strong> 5=Life-threatening, 1=Minor injury risk</li>
                    <li><strong>Environment:</strong> 5=Major spill/emissions, 1=Minimal impact</li>
                    <li><strong>Production:</strong> 5=Complete shutdown, 1=Minor slowdown</li>
                    <li><strong>Quality:</strong> 5=Scraps entire batch, 1=Cosmetic only</li>
                    <li><strong>MTTR:</strong> 5=Days to repair, 1=Minutes to repair</li>
                    <li><strong>Cost:</strong> 5=$100K+ to fix, 1=&lt;$1K to fix</li>
                  </ul>
                  <p className="mt-2"><strong>ABC Classification (Pareto):</strong> A=Top 10-15% (Critical), B=Next 20-30% (Important), C=Bottom 55-70% (Non-critical)</p>
                </div>
              </div>
            </div>
    </div>
  );
}
