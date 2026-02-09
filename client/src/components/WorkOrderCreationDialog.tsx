import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, User, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CorrectiveAction {
  action: string;
  responsible: string;
  dueDate: string;
  completed: boolean;
}

interface TechAvailability {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  workloadHours: number;
  openWorkOrdersCount: number;
}

interface WorkOrderCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcaId: string;
  equipmentId?: string;
  correctiveActions: CorrectiveAction[];
  onComplete?: () => void;
}

export function WorkOrderCreationDialog({
  open,
  onOpenChange,
  rcaId,
  equipmentId,
  correctiveActions,
  onComplete,
}: WorkOrderCreationDialogProps) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<number, string>>({});

  // Fetch available technicians
  const { data: technicians = [], isLoading: loadingTechs } = useQuery<TechAvailability[]>({
    queryKey: ["/api/users/technicians/availability"],
    enabled: open,
  });

  // Reset assignments when dialog opens or closes
  useEffect(() => {
    if (!open) {
      setAssignments({});
    }
  }, [open]);

  // Auto-assign to least busy tech for each action
  useEffect(() => {
    if (open && technicians.length > 0 && Object.keys(assignments).length === 0) {
      const newAssignments: Record<number, string> = {};
      correctiveActions.forEach((_, index) => {
        // Find tech with lowest workload
        const leastBusyTech = [...technicians].sort((a, b) => a.workloadHours - b.workloadHours)[0];
        if (leastBusyTech) {
          newAssignments[index] = leastBusyTech.id;
        }
      });
      setAssignments(newAssignments);
    }
  }, [open, technicians, correctiveActions, assignments]);

  const createWorkOrders = useMutation({
    mutationFn: async () => {
      const workOrdersToCreate = correctiveActions.map((action, index) => ({
        title: action.action,
        description: `Corrective action from RCA analysis. Responsible: ${action.responsible}`,
        assignedToId: assignments[index],
        dueDate: action.dueDate ? new Date(action.dueDate) : null,
        priority: "high" as const,
        type: "corrective" as const,
        status: "open" as const,
        rcaId: rcaId,
        equipmentId: equipmentId || null,
      }));

      // Create all work orders
      const responses = await Promise.all(
        workOrdersToCreate.map(wo => 
          apiRequest("POST", "/api/work-orders", wo).then(r => r.json())
        )
      );

      return responses;
    },
    onSuccess: (workOrders) => {
      toast({
        title: "Work Orders Created!",
        description: `Successfully created ${workOrders.length} work order${workOrders.length !== 1 ? 's' : ''} from RCA corrective actions.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      onComplete?.();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create work orders. Please try again.",
      });
    },
  });

  const getTechName = (techId: string) => {
    const tech = technicians.find(t => t.id === techId);
    if (!tech) return "Unknown";
    return `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.email;
  };

  const getTechWorkload = (techId: string) => {
    const tech = technicians.find(t => t.id === techId);
    return tech || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Orders from RCA Actions</DialogTitle>
          <DialogDescription>
            Assign technicians to complete the corrective actions identified in the RCA analysis.
            Technicians are automatically assigned based on current workload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Technician Availability Summary */}
          {technicians.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Technician Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {technicians.map((tech) => (
                    <Badge
                      key={tech.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      <span>{tech.firstName || tech.email}</span>
                      <span className="text-muted-foreground">·</span>
                      <Clock className="w-3 h-3" />
                      <span>{tech.workloadHours}h ({tech.openWorkOrdersCount} WO)</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Orders to Create */}
          <div className="space-y-3">
            {correctiveActions.map((action, index) => {
              const assignedTech = getTechWorkload(assignments[index]);
              
              return (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Work Order #{index + 1}
                        </CardTitle>
                        <p className="text-sm mt-1">{action.action}</p>
                      </div>
                      <Badge variant="outline">High Priority</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Responsible:</span>
                        <span className="ml-2 font-medium">{action.responsible}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date:</span>
                        <span className="ml-2 font-medium">
                          {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : "Not set"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assign to Technician</label>
                      <div className="flex gap-2 items-start">
                        <Select
                          value={assignments[index] || ""}
                          onValueChange={(value) => setAssignments(prev => ({ ...prev, [index]: value }))}
                        >
                          <SelectTrigger data-testid={`select-tech-${index}`}>
                            <SelectValue placeholder="Select technician..." />
                          </SelectTrigger>
                          <SelectContent>
                            {technicians.map((tech) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                <div className="flex items-center justify-between gap-4 w-full">
                                  <span>{getTechName(tech.id)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {tech.workloadHours}h | {tech.openWorkOrdersCount} WO
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {assignedTech && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {assignedTech.workloadHours}h workload
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createWorkOrders.isPending}
            >
              Skip for Now
            </Button>
            <Button
              onClick={() => createWorkOrders.mutate()}
              disabled={
                createWorkOrders.isPending ||
                loadingTechs ||
                Object.keys(assignments).length !== correctiveActions.length
              }
              data-testid="button-create-work-orders"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Create {correctiveActions.length} Work Order{correctiveActions.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
