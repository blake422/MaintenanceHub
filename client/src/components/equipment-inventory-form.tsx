import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface EquipmentEntry {
  id: string;
  name: string;
  assetTag: string;
  hierarchyLevel: "site" | "area" | "line" | "equipment" | "component";
  parentId: string | null;
  type: string;
  manufacturer: string;
  model: string;
  commissioningYear: number | null;
  maintenanceOwner: string;
  isCritical: boolean;
}

interface EquipmentInventoryFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const getHierarchyLevel = (level: string): number => {
  const levels: Record<string, number> = {
    site: 1,
    area: 2,
    line: 3,
    equipment: 4,
    component: 5,
  };
  return levels[level] || 0;
};

export function EquipmentInventoryForm({ step, checklistItemId, onDismiss, onDirtyChange }: EquipmentInventoryFormProps) {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<EquipmentEntry[]>([]);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "equipment_inventory"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as { equipment: EquipmentEntry[] };
        setEquipment(payload.equipment || []);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (equipmentToSave: EquipmentEntry[]): Promise<ExcellenceDeliverable> => {
      const payload = { equipment: equipmentToSave };
      
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "equipment_inventory",
          title: "Equipment Inventory",
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (data, savedEquipment) => {
      setDeliverableId(data.id);
      setEquipment(savedEquipment);
      onDirtyChange?.(false);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "Equipment inventory saved",
        description: `${savedEquipment.length} equipment items registered successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save equipment inventory. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateEntry = (id: string, field: keyof EquipmentEntry, value: any) => {
    setEquipment(equipment.map(item => item.id === id ? { ...item, [field]: value } : item));
    onDirtyChange?.(true);
  };

  const addEntry = () => {
    const newEntry: EquipmentEntry = {
      id: crypto.randomUUID(),
      name: "",
      assetTag: "",
      hierarchyLevel: "equipment",
      parentId: null,
      type: "",
      manufacturer: "",
      model: "",
      commissioningYear: null,
      maintenanceOwner: "",
      isCritical: false,
    };
    setEquipment([...equipment, newEntry]);
    onDirtyChange?.(true);
  };

  const removeEntry = (id: string) => {
    setEquipment(equipment.filter(e => e.id !== id));
    onDirtyChange?.(true);
  };

  const handleSave = () => {
    const sanitizedEquipment = equipment.filter(e => e.name.trim() && e.assetTag.trim());
    setEquipment(sanitizedEquipment);
    saveMutation.mutate(sanitizedEquipment);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{equipment.length}</span> equipment items registered
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" data-testid="button-save-inventory">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Inventory"}
          </Button>
          <Button onClick={addEntry} size="sm" data-testid="button-add-equipment">
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
              <TableHead className="w-36">Hierarchy Level</TableHead>
              <TableHead className="w-48">Parent Asset</TableHead>
              <TableHead className="w-36">Type/Category</TableHead>
              <TableHead className="w-36">Manufacturer</TableHead>
              <TableHead className="w-32">Model</TableHead>
              <TableHead className="w-24">Year</TableHead>
              <TableHead className="w-32">Owner</TableHead>
              <TableHead className="w-20 text-center">Critical</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No equipment added yet. Click "Add Equipment" to get started.
                </TableCell>
              </TableRow>
            ) : (
              equipment.map((item) => {
                const potentialParents = equipment.filter(
                  e => e.id !== item.id && getHierarchyLevel(e.hierarchyLevel) < getHierarchyLevel(item.hierarchyLevel)
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.name}
                        onChange={(e) => updateEntry(item.id, "name", e.target.value)}
                        placeholder="Equipment name"
                        className="h-8"
                        data-testid={`input-equipment-name-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.assetTag}
                        onChange={(e) => updateEntry(item.id, "assetTag", e.target.value)}
                        placeholder="Tag ID"
                        className="h-8"
                        data-testid={`input-asset-tag-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.hierarchyLevel}
                        onValueChange={(value: any) => updateEntry(item.id, "hierarchyLevel", value)}
                      >
                        <SelectTrigger className="h-8" data-testid={`select-level-${item.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="site">Site</SelectItem>
                          <SelectItem value="area">Area</SelectItem>
                          <SelectItem value="line">Line</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="component">Component</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.parentId || "none"}
                        onValueChange={(value) => updateEntry(item.id, "parentId", value === "none" ? null : value)}
                        disabled={item.hierarchyLevel === "site"}
                      >
                        <SelectTrigger className="h-8" data-testid={`select-parent-${item.id}`}>
                          <SelectValue placeholder={item.hierarchyLevel === "site" ? "N/A" : "Select parent"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {potentialParents.map(parent => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name} ({parent.assetTag})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.type}
                        onChange={(e) => updateEntry(item.id, "type", e.target.value)}
                        placeholder="Type"
                        className="h-8"
                        data-testid={`input-type-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.manufacturer}
                        onChange={(e) => updateEntry(item.id, "manufacturer", e.target.value)}
                        placeholder="Manufacturer"
                        className="h-8"
                        data-testid={`input-manufacturer-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.model}
                        onChange={(e) => updateEntry(item.id, "model", e.target.value)}
                        placeholder="Model"
                        className="h-8"
                        data-testid={`input-model-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.commissioningYear || ""}
                        onChange={(e) => updateEntry(item.id, "commissioningYear", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Year"
                        className="h-8"
                        data-testid={`input-year-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.maintenanceOwner}
                        onChange={(e) => updateEntry(item.id, "maintenanceOwner", e.target.value)}
                        placeholder="Owner"
                        className="h-8"
                        data-testid={`input-owner-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={item.isCritical}
                          onCheckedChange={(checked) => updateEntry(item.id, "isCritical", checked as boolean)}
                          data-testid={`checkbox-critical-${item.id}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(item.id)}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Equipment Registry Instructions:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><strong>Hierarchy:</strong> Build structure from Site → Area → Line → Equipment → Component</li>
              <li><strong>Asset Tag:</strong> Unique identifier (e.g., PUMP-001, MOTOR-042)</li>
              <li><strong>Parent Asset:</strong> Select parent from higher level (Area selects Site, Equipment selects Line, etc.)</li>
              <li><strong>Critical Flag:</strong> Mark if failure significantly impacts safety, production, or quality</li>
              <li><strong>Owner:</strong> Person or team responsible for maintenance</li>
              <li><strong>Year:</strong> Commissioning year for age tracking and lifecycle planning</li>
            </ul>
            <p className="mt-2">This inventory feeds into criticality scoring, PM optimization, and FMEA analysis in later steps.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
