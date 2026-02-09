import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface PartsABCEntry {
  id: string;
  partNumber: string;
  description: string;
  annualUsageDollars: number;
  category: "A" | "B" | "C" | "";
  eoq: number;
  minLevel: number;
  maxLevel: number;
  leadTimeDays: number;
}

interface PartsABCFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function PartsABCForm({ step, checklistItemId, onDismiss, onDirtyChange }: PartsABCFormProps) {
  const { toast } = useToast();
  const [parts, setParts] = useState<PartsABCEntry[]>([]);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "parts_abc_analysis"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as { parts: PartsABCEntry[] };
        setParts(payload.parts || []);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (partsToSave: PartsABCEntry[]): Promise<ExcellenceDeliverable> => {
      const payload = { parts: partsToSave };
      
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "parts_abc_analysis",
          title: "Parts ABC Analysis",
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (data, savedParts) => {
      setDeliverableId(data.id);
      onDirtyChange?.(false);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "Parts ABC analysis saved",
        description: `${savedParts.length} parts categorized.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save parts ABC analysis. Please try again.",
        variant: "destructive",
      });
    }
  });

  const calculateCategory = (partId: string, allParts: PartsABCEntry[]): "A" | "B" | "C" => {
    const sortedParts = [...allParts].sort((a, b) => b.annualUsageDollars - a.annualUsageDollars);
    const totalValue = sortedParts.reduce((sum, p) => sum + p.annualUsageDollars, 0);
    
    let cumulativeValue = 0;
    for (let i = 0; i < sortedParts.length; i++) {
      cumulativeValue += sortedParts[i].annualUsageDollars;
      const cumulativePercent = (cumulativeValue / totalValue) * 100;
      
      if (sortedParts[i].id === partId) {
        if (cumulativePercent <= 80) return "A";
        if (cumulativePercent <= 95) return "B";
        return "C";
      }
    }
    return "C";
  };

  const updatePart = (id: string, field: keyof PartsABCEntry, value: any) => {
    const newParts = parts.map(part => {
      if (part.id === id) {
        return { ...part, [field]: value };
      }
      return part;
    });

    const withCategories = newParts.map(part => ({
      ...part,
      category: calculateCategory(part.id, newParts)
    }));

    setParts(withCategories);
    onDirtyChange?.(true);
  };

  const addPart = () => {
    const newPart: PartsABCEntry = {
      id: crypto.randomUUID(),
      partNumber: "",
      description: "",
      annualUsageDollars: 0,
      category: "",
      eoq: 0,
      minLevel: 0,
      maxLevel: 0,
      leadTimeDays: 0,
    };
    setParts([...parts, newPart]);
    onDirtyChange?.(true);
  };

  const removePart = (id: string) => {
    setParts(parts.filter(p => p.id !== id));
    onDirtyChange?.(true);
  };

  const handleSave = () => {
    const sanitizedParts = parts.filter(p => p.partNumber.trim()).map(part => ({
      ...part,
      category: calculateCategory(part.id, parts.filter(p => p.partNumber.trim()))
    }));
    setParts(sanitizedParts);
    saveMutation.mutate(sanitizedParts);
  };

  const aCount = parts.filter(p => p.category === "A").length;
  const bCount = parts.filter(p => p.category === "B").length;
  const cCount = parts.filter(p => p.category === "C").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-medium">{parts.length}</span> parts analyzed
          </div>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-red-500">A-Items (80% value): {aCount}</Badge>
            <Badge variant="default" className="bg-yellow-500">B-Items (15% value): {bCount}</Badge>
            <Badge variant="default" className="bg-green-500">C-Items (5% value): {cCount}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" data-testid="button-save-parts">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Analysis"}
          </Button>
          <Button onClick={addPart} size="sm" data-testid="button-add-part">
            <Plus className="w-4 h-4 mr-2" />
            Add Part
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Part Number</TableHead>
              <TableHead className="w-64">Description</TableHead>
              <TableHead className="w-32 text-right">Annual $ Usage</TableHead>
              <TableHead className="w-20 text-center">ABC</TableHead>
              <TableHead className="w-24 text-right">EOQ</TableHead>
              <TableHead className="w-24 text-right">Min Level</TableHead>
              <TableHead className="w-24 text-right">Max Level</TableHead>
              <TableHead className="w-32 text-right">Lead Time (days)</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No parts added yet. Click "Add Part" to get started.
                </TableCell>
              </TableRow>
            ) : (
              parts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell>
                    <Input
                      value={part.partNumber}
                      onChange={(e) => updatePart(part.id, "partNumber", e.target.value)}
                      placeholder="Part #"
                      className="h-8"
                      data-testid={`input-part-number-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={part.description}
                      onChange={(e) => updatePart(part.id, "description", e.target.value)}
                      placeholder="Description"
                      className="h-8"
                      data-testid={`input-description-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={part.annualUsageDollars}
                      onChange={(e) => updatePart(part.id, "annualUsageDollars", parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="h-8 text-right"
                      data-testid={`input-annual-usage-${part.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {part.category && (
                      <Badge
                        variant="default"
                        className={
                          part.category === "A"
                            ? "bg-red-500"
                            : part.category === "B"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }
                      >
                        {part.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={part.eoq}
                      onChange={(e) => updatePart(part.id, "eoq", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="h-8 text-right"
                      data-testid={`input-eoq-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={part.minLevel}
                      onChange={(e) => updatePart(part.id, "minLevel", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="h-8 text-right"
                      data-testid={`input-min-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={part.maxLevel}
                      onChange={(e) => updatePart(part.id, "maxLevel", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="h-8 text-right"
                      data-testid={`input-max-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={part.leadTimeDays}
                      onChange={(e) => updatePart(part.id, "leadTimeDays", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="h-8 text-right"
                      data-testid={`input-lead-time-${part.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePart(part.id)}
                      data-testid={`button-delete-${part.id}`}
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
            <p className="font-medium">ABC Analysis Guide:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><strong>A-Items:</strong> Top 80% of annual $ value (typically 10-20% of SKUs) - Tight control, frequent counts</li>
              <li><strong>B-Items:</strong> Next 15% of $ value (typically 20-30% of SKUs) - Moderate control, quarterly counts</li>
              <li><strong>C-Items:</strong> Bottom 5% of $ value (typically 50-70% of SKUs) - Loose control, annual counts</li>
              <li><strong>EOQ:</strong> Economic Order Quantity = √((2 × Annual Demand × Order Cost) / Holding Cost)</li>
              <li><strong>Min/Max:</strong> Min = Lead Time Demand + Safety Stock | Max = Min + EOQ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
