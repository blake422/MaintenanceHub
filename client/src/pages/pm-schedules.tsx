import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar, Plus, Settings, CheckCircle2, AlertCircle, FileText, ChevronDown, ChevronUp, Package, ListChecks, Upload, Sparkles, TrendingUp, DollarSign, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPMScheduleSchema, type PMSchedule, type Equipment, type PMTask, type PMRequiredPart, type InsertPMSchedule } from "@shared/schema";
import { z } from "zod";
import { format, addDays, isPast, isWithinInterval, startOfDay } from "date-fns";

const pmScheduleFormSchema = insertPMScheduleSchema.omit({ companyId: true });

// Helper to safely parse measurements (handles string JSON from DB or already-parsed array)
function parseMeasurements(measurements: unknown): string[] {
  if (Array.isArray(measurements)) {
    return measurements;
  }
  if (typeof measurements === 'string' && measurements.trim()) {
    try {
      const parsed = JSON.parse(measurements);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function PMScheduleDetails({ scheduleId }: { scheduleId: string }) {
  const [showTasks, setShowTasks] = useState(false);
  const [showParts, setShowParts] = useState(false);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PMTask[]>({
    queryKey: [`/api/pm-schedules/${scheduleId}/tasks`],
    enabled: showTasks,
  });

  const { data: requiredParts = [], isLoading: partsLoading } = useQuery<(PMRequiredPart & { partName?: string })[]>({
    queryKey: [`/api/pm-schedules/${scheduleId}/required-parts`],
    enabled: showTasks,
  });

  return (
    <div className="space-y-2 border-t pt-3 mt-3">
      <Collapsible open={showTasks} onOpenChange={setShowTasks}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-toggle-tasks-${scheduleId}`}>
            <span className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Tasks {tasks.length > 0 && `(${tasks.length})`}
            </span>
            {showTasks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {tasksLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks defined for this PM schedule</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex gap-3 p-3 bg-accent/30 rounded-lg" data-testid={`task-${task.id}`}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {task.taskNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{task.description}</p>
                    {task.estimatedMinutes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Est. time: {task.estimatedMinutes} minutes
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={showParts} onOpenChange={setShowParts}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-toggle-parts-${scheduleId}`}>
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Required Parts {requiredParts.length > 0 && `(${requiredParts.length})`}
            </span>
            {showParts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {partsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : requiredParts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No parts required for this PM schedule</p>
          ) : (
            <div className="space-y-2">
              {requiredParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg" data-testid={`required-part-${part.id}`}>
                  <span className="text-sm font-medium">{part.partName}</span>
                  <Badge variant="secondary">Qty: {part.quantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function PMSchedules() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [optimizationResults, setOptimizationResults] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [selectedPMs, setSelectedPMs] = useState<string[]>([]);
  const [applyingRecommendation, setApplyingRecommendation] = useState<{scheduleId: string, newFrequency: number} | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: pmSchedules = [], isLoading } = useQuery<PMSchedule[]>({
    queryKey: ["/api/pm-schedules"],
    enabled: !!user,
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    enabled: !!user && showCreateDialog,
  });

  const createPMSchedule = useMutation({
    mutationFn: async (data: z.infer<typeof pmScheduleFormSchema>) => {
      const frequencyDays = data.frequencyDays ?? 30;
      const nextDue = addDays(new Date(), frequencyDays);
      return await apiRequest("POST", "/api/pm-schedules", {
        ...data,
        frequencyDays,
        nextDueDate: nextDue.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: "Success", description: "PM schedule created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create PM schedule",
        variant: "destructive",
      });
    },
  });

  const deletePMSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      return await apiRequest(`/api/pm-schedules/${scheduleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      toast({ title: "Success", description: "PM schedule deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete PM schedule",
        variant: "destructive",
      });
    },
  });

  const importPMSchedules = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/pm-schedules/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Import failed");
      return response.json();
    },
    onSuccess: (data) => {
      setImportPreview(data);
      setSelectedFile(null);
      toast({
        title: "Import Complete",
        description: `Found ${data.totalRecords || 0} PM schedules. Review and save them below.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import PM schedules",
        variant: "destructive",
      });
    },
  });

  const savePMSchedules = useMutation({
    mutationFn: async (schedules: any[]) => {
      return await apiRequest("/api/pm-schedules/bulk-create", {
        method: "POST",
        body: JSON.stringify({ schedules }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      setShowImportDialog(false);
      setImportPreview(null);
      toast({
        title: "Success",
        description: "PM schedules saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save PM schedules",
        variant: "destructive",
      });
    },
  });

  const deletePMSchedules = useMutation({
    mutationFn: async (scheduleIds: string[]) => {
      return await Promise.all(
        scheduleIds.map(id =>
          apiRequest(`/api/pm-schedules/${id}`, {
            method: "DELETE",
          })
        )
      );
    },
    onSuccess: (_, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      setSelectedPMs([]);
      toast({
        title: "Success",
        description: `Deleted ${deletedIds.length} PM schedule(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete PM schedules",
        variant: "destructive",
      });
    },
  });

  const optimizePMSchedules = useMutation({
    mutationFn: async (scheduleIds: string[]) => {
      const response = await apiRequest("/api/pm-schedules/optimize", {
        method: "POST",
        body: JSON.stringify({ pmScheduleIds: scheduleIds }),
        headers: { "Content-Type": "application/json" },
      });
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('[Frontend] Received optimization data:', data);
      console.log('[Frontend] Optimizations array:', data.optimizations);
      console.log('[Frontend] Array length:', data.optimizations?.length);
      
      const results = data.optimizations || [];
      setOptimizationResults(results);
      setShowOptimizeDialog(true);
      
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${results.length} PM schedule(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization Failed",
        description: error.message || "Failed to optimize PM schedules",
        variant: "destructive",
      });
    },
  });

  const applyRecommendation = useMutation({
    mutationFn: async ({ scheduleId, frequencyDays }: { scheduleId: string; frequencyDays: number }) => {
      const response = await apiRequest(`/api/pm-schedules/${scheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ frequencyDays }),
        headers: { "Content-Type": "application/json" },
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      setApplyingRecommendation(null);
      toast({
        title: "Recommendation Applied",
        description: "PM schedule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update PM schedule",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof pmScheduleFormSchema>>({
    resolver: zodResolver(pmScheduleFormSchema),
    defaultValues: {
      equipmentId: "",
      name: "",
      description: "",
      frequencyDays: 30,
      measurements: "",
      instructions: "",
    },
  });

  const updatePMSchedule = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<InsertPMSchedule> }) => {
      return await apiRequest("PATCH", `/api/pm-schedules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      setShowCreateDialog(false);
      setEditingId(null);
      form.reset();
      toast({ title: "Success", description: "PM schedule updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update PM schedule",
        variant: "destructive",
      });
    },
  });

  const completePMSchedule = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/pm-schedules/${id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm-schedules"] });
      toast({ title: "Success", description: "PM schedule marked as complete" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete PM schedule",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof pmScheduleFormSchema>) => {
    if (editingId) {
      updatePMSchedule.mutate({ id: editingId, data });
    } else {
      createPMSchedule.mutate(data);
    }
  };

  // Calculate status for each PM schedule
  const getScheduleStatus = (schedule: PMSchedule) => {
    if (!schedule.nextDueDate) return "scheduled";
    const nextDue = new Date(schedule.nextDueDate);
    const today = startOfDay(new Date());
    const weekFromNow = addDays(today, 7);
    
    if (isPast(nextDue) && nextDue < today) return "overdue";
    if (isWithinInterval(nextDue, { start: today, end: weekFromNow })) return "upcoming";
    return "scheduled";
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "overdue":
        return "destructive";
      case "upcoming":
        return "default";
      default:
        return "secondary";
    }
  };

  // Calculate stats
  const overduePMs = pmSchedules.filter(pm => getScheduleStatus(pm) === "overdue").length;
  const upcomingPMs = pmSchedules.filter(pm => getScheduleStatus(pm) === "upcoming").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Preventative Maintenance</h1>
          <p className="text-muted-foreground">
            Schedule and track preventive maintenance
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {pmSchedules.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedPMs.length === pmSchedules.length) {
                    setSelectedPMs([]);
                  } else {
                    setSelectedPMs(pmSchedules.map(pm => pm.id));
                  }
                }}
                data-testid="button-select-all"
              >
                {selectedPMs.length === pmSchedules.length ? "Deselect All" : "Select All"}
              </Button>
            )}
            {selectedPMs.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm(`Delete ${selectedPMs.length} PM schedule(s)?`)) {
                    deletePMSchedules.mutate(selectedPMs);
                  }
                }}
                disabled={deletePMSchedules.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {selectedPMs.length}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-pm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                optimizePMSchedules.mutate(selectedPMs.length > 0 ? selectedPMs : pmSchedules.map(pm => pm.id));
              }} 
              disabled={pmSchedules.length === 0 || optimizePMSchedules.isPending}
              data-testid="button-optimize-pm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {optimizePMSchedules.isPending ? "Analyzing..." : `Optimize${selectedPMs.length > 0 ? ` (${selectedPMs.length})` : " All"}`}
            </Button>
            <Button 
              onClick={() => {
                setEditingId(null);
                form.reset({
                  equipmentId: "",
                  name: "",
                  description: "",
                  frequencyDays: 30,
                  measurements: "",
                  instructions: "",
                });
                setShowCreateDialog(true);
              }} 
              data-testid="button-create-pm-schedule"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-overdue-pm">
              {isLoading ? <Skeleton className="h-8 w-16" /> : overduePMs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-upcoming-pm">
              {isLoading ? <Skeleton className="h-8 w-16" /> : upcomingPMs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-pm">
              {isLoading ? <Skeleton className="h-8 w-16" /> : pmSchedules.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PM Schedules List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : pmSchedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No PM schedules found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create schedules to start preventive maintenance
              </p>
            </CardContent>
          </Card>
        ) : (
          pmSchedules.map((pm) => {
            const status = getScheduleStatus(pm);
            const equipmentName = equipment.find(e => e.id === pm.equipmentId)?.name || pm.equipmentId;
            return (
              <Card
                key={pm.id}
                className={status === "overdue" ? "border-destructive" : "hover-elevate"}
                data-testid={`card-pm-${pm.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    {canManage && (
                      <Checkbox
                        checked={selectedPMs.includes(pm.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPMs([...selectedPMs, pm.id]);
                          } else {
                            setSelectedPMs(selectedPMs.filter(id => id !== pm.id));
                          }
                        }}
                        data-testid={`checkbox-pm-${pm.id}`}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="text-base">{pm.name}</CardTitle>
                        <Badge variant={getStatusVariant(status)} className="capitalize">
                          {status}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">{equipmentName}</CardDescription>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Frequency</p>
                      <p className="font-medium">Every {pm.frequencyDays} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Next Due</p>
                      <p className="font-medium">
                        {pm.nextDueDate ? format(new Date(pm.nextDueDate), "MMM d, yyyy") : "Not scheduled"}
                      </p>
                    </div>
                  </div>

                  {parseMeasurements(pm.measurements).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Required Measurements:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {parseMeasurements(pm.measurements).map((measurement, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {measurement}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <PMScheduleDetails scheduleId={pm.id} />

                  {canManage && (
                    <div className="flex gap-2 pt-3 border-t mt-3">
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => {
                          if (confirm("Mark this PM as complete and schedule the next one?")) {
                            completePMSchedule.mutate(pm.id);
                          }
                        }}
                        disabled={completePMSchedule.isPending}
                        data-testid={`button-complete-${pm.id}`}
                      >
                        Mark Complete
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          const measurements = parseMeasurements(pm.measurements).join(", ");
                          form.reset({
                            equipmentId: pm.equipmentId || "",
                            name: pm.name,
                            description: pm.description || "",
                            frequencyDays: pm.frequencyDays || 30,
                            measurements: measurements,
                            instructions: pm.instructions || "",
                          });
                          setEditingId(pm.id);
                          setShowCreateDialog(true);
                        }}
                        data-testid={`button-edit-${pm.id}`}
                      >
                        Edit Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${pm.name}"?`)) {
                            deletePMSchedule.mutate(pm.id);
                          }
                        }}
                        disabled={deletePMSchedule.isPending}
                        data-testid={`button-delete-${pm.id}`}
                      >
                        {deletePMSchedule.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Import PM Schedules Dialog */}
      {showImportDialog && (
        <Dialog open={showImportDialog} onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open) {
            setSelectedFile(null);
            setImportPreview(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Preventative Maintenance</DialogTitle>
            </DialogHeader>
            
            {!importPreview ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-2">Upload maintenance document</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supports PDF, Excel (.xlsx), and Word (.docx) files
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.docx,.doc"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="max-w-xs mx-auto"
                    data-testid="input-import-file"
                  />
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-accent/30 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm flex-1">{selectedFile.name}</span>
                    <Badge variant="secondary">{(selectedFile.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowImportDialog(false);
                    setSelectedFile(null);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedFile && importPMSchedules.mutate(selectedFile)}
                    disabled={!selectedFile || importPMSchedules.isPending}
                    data-testid="button-submit-import"
                  >
                    {importPMSchedules.isPending ? "Importing..." : "Import Schedules"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-accent/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold">Import Preview</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Found {importPreview.totalRecords} PM schedule{importPreview.totalRecords !== 1 ? 's' : ''} in {importPreview.fileName}
                  </p>
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {importPreview.pmSchedules?.map((schedule: any, index: number) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{schedule.name}</h4>
                            {schedule.description && (
                              <p className="text-sm text-muted-foreground mt-1">{schedule.description}</p>
                            )}
                          </div>
                          <Badge variant="outline">{schedule.frequencyDays} days</Badge>
                        </div>
                        {schedule.equipmentName && (
                          <p className="text-xs text-muted-foreground">
                            Equipment: {schedule.equipmentName}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setImportPreview(null)}>
                    Upload Different File
                  </Button>
                  <Button
                    onClick={() => savePMSchedules.mutate(importPreview.pmSchedules)}
                    disabled={savePMSchedules.isPending}
                    data-testid="button-save-imported"
                  >
                    {savePMSchedules.isPending ? "Saving..." : `Save ${importPreview.totalRecords} Schedules`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog for Applying Recommendation */}
      {applyingRecommendation && (
        <Dialog open={!!applyingRecommendation} onOpenChange={() => setApplyingRecommendation(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Apply Recommendation</DialogTitle>
              <DialogDescription>
                Review and approve the changes to this PM schedule
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const schedule = pmSchedules.find(pm => pm.id === applyingRecommendation.scheduleId);
              const optimization = optimizationResults.find(r => r.id === applyingRecommendation.scheduleId);
              if (!schedule || !optimization) return null;
              const opt = optimization.optimizations;
              
              return (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">{schedule.name}</p>
                    <p className="text-sm text-muted-foreground">{schedule.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Current Frequency</p>
                      <p className="text-lg font-semibold">Every {schedule.frequencyDays} days</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">New Frequency</p>
                      <p className="text-lg font-semibold text-primary">Every {applyingRecommendation.newFrequency} days</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {opt.costSavings > 0 && (
                      <div className="flex items-center justify-between p-2 bg-accent/30 rounded">
                        <span className="text-sm">Annual Cost Savings</span>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${opt.costSavings}
                        </Badge>
                      </div>
                    )}
                    {opt.reliabilityImprovement > 0 && (
                      <div className="flex items-center justify-between p-2 bg-accent/30 rounded">
                        <span className="text-sm">Reliability Improvement</span>
                        <Badge variant="default" className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          +{opt.reliabilityImprovement}%
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setApplyingRecommendation(null)}
                      data-testid="button-cancel-apply"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => applyRecommendation.mutate({
                        scheduleId: applyingRecommendation.scheduleId,
                        frequencyDays: applyingRecommendation.newFrequency
                      })}
                      disabled={applyRecommendation.isPending}
                      data-testid="button-confirm-apply"
                    >
                      {applyRecommendation.isPending ? "Applying..." : "Approve & Apply"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* Optimization Results Dialog */}
      {showOptimizeDialog && (
        <Dialog open={showOptimizeDialog} onOpenChange={setShowOptimizeDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                PM Optimization Analysis
              </DialogTitle>
              <DialogDescription>
                AI-powered recommendations based on RCM and TPM principles
              </DialogDescription>
            </DialogHeader>
            {optimizePMSchedules.isPending ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-muted-foreground">Analyzing PM schedules with AI...</p>
              </div>
            ) : optimizationResults.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No optimization results available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {optimizationResults.map((result) => {
                  const schedule = pmSchedules.find(pm => pm.id === result.id);
                  if (!schedule) return null;
                  const opt = result.optimizations;
                  
                  return (
                    <Card key={result.id} className="hover-elevate">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <CardTitle className="text-base">{schedule.name}</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Current: Every {schedule.frequencyDays} days
                              {opt.suggestedFrequency !== schedule.frequencyDays && (
                                <span className="text-primary ml-2">
                                  → Suggested: Every {opt.suggestedFrequency} days
                                </span>
                              )}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {opt.reliabilityImprovement > 0 && (
                              <Badge variant="default" className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                +{opt.reliabilityImprovement}%
                              </Badge>
                            )}
                            {opt.costSavings > 0 && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${opt.costSavings}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {opt.reliabilityImprovement > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Reliability Improvement</p>
                            <Progress value={opt.reliabilityImprovement} className="h-2" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium mb-2">Analysis</p>
                          <p className="text-sm text-muted-foreground">{opt.reasoning}</p>
                        </div>
                        {opt.suggestions && opt.suggestions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Recommendations</p>
                            <ul className="space-y-1">
                              {opt.suggestions.map((suggestion: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                  <span className="text-muted-foreground">{suggestion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {canManage && opt.suggestedFrequency !== schedule.frequencyDays && (
                          <div className="flex justify-end pt-3 border-t">
                            <Button
                              onClick={() => setApplyingRecommendation({ scheduleId: result.id, newFrequency: opt.suggestedFrequency })}
                              data-testid={`button-apply-recommendation-${result.id}`}
                            >
                              Apply Recommendation
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setShowOptimizeDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit PM Schedule Dialog */}
      {showCreateDialog && (
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingId(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit PM Schedule" : "Create PM Schedule"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update the details for this maintenance schedule." : "Schedule a new preventive maintenance task for your equipment."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="equipmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-equipment">
                            <SelectValue placeholder="Select equipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {equipment.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Monthly Inspection" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the maintenance tasks..." {...field} value={field.value || ""} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="frequencyDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          data-testid="input-frequency"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Step-by-step instructions..." {...field} value={field.value || ""} data-testid="textarea-instructions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPMSchedule.isPending} data-testid="button-submit-pm">
                    {createPMSchedule.isPending ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
