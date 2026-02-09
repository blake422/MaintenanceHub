import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Wrench, Calendar, User, Image, Upload, Package, Sparkles, Loader2, AlertTriangle, CheckCircle2, Target, ClipboardList, Lightbulb, Settings, Eye, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertWorkOrderSchema, insertWorkOrderTemplateSchema, type WorkOrder, type Equipment, type User as UserType, type Part, type WorkOrderTemplate } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";

const workOrderFormSchema = insertWorkOrderSchema
  .omit({ companyId: true, createdById: true })
  .extend({
    equipmentId: z.string().optional(),
    assignedToId: z.string().optional(),
    description: z.string().optional(),
  });

interface CorrectiveGuidanceStep {
  step: number;
  title: string;
  whatToLookFor: string[];
  likelyCauses: string[];
  actions: string[];
  safetyNotes: string[];
}

interface CorrectiveGuidanceResult {
  summary: string;
  estimatedDifficulty: "simple" | "moderate" | "complex";
  steps: CorrectiveGuidanceStep[];
}

export default function WorkOrders() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createMode, setCreateMode] = useState<"quick" | "full">("quick");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<CorrectiveGuidanceResult | null>(null);

  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user,
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    enabled: !!user && showCreateDialog,
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: !!user && showCreateDialog && canManage,
  });

  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery<WorkOrderTemplate[]>({
    queryKey: ["/api/work-order-templates"],
    enabled: !!user && showCreateDialog && canManage,
  });

  const createWorkOrder = useMutation({
    mutationFn: async (data: z.infer<typeof workOrderFormSchema>) => {
      return await apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: "Success", description: "Work order created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: async ({ workOrderId, files }: { workOrderId: string; files: FileList }) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("photos", file);
      });
      return await apiRequest("POST", `/api/work-orders/${workOrderId}/photos`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Success", description: "Photos uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  // Approval workflow mutations
  const submitForApproval = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest(`/api/work-orders/${workOrderId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setSelectedWorkOrder(null);
      toast({ title: "Success", description: "Work order submitted for approval" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit work order",
        variant: "destructive",
      });
    },
  });

  const approveWorkOrder = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest(`/api/work-orders/${workOrderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setSelectedWorkOrder(null);
      toast({ title: "Success", description: "Work order approved" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve work order",
        variant: "destructive",
      });
    },
  });

  const rejectWorkOrder = useMutation({
    mutationFn: async ({ workOrderId, reason }: { workOrderId: string; reason?: string }) => {
      return await apiRequest(`/api/work-orders/${workOrderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setSelectedWorkOrder(null);
      toast({ title: "Success", description: "Work order rejected" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject work order",
        variant: "destructive",
      });
    },
  });

  // AI Suggestions mutation
  const getAiSuggestions = useMutation({
    mutationFn: async (workOrderId: string): Promise<CorrectiveGuidanceResult> => {
      const response = await apiRequest("POST", `/api/work-orders/${workOrderId}/ai-suggestions`);
      return await response.json() as CorrectiveGuidanceResult;
    },
    onSuccess: (data) => {
      setAiSuggestions(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate AI suggestions",
        variant: "destructive",
      });
    },
  });

  const deleteWorkOrder = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest(`/api/work-orders/${workOrderId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setSelectedWorkOrder(null);
      toast({ title: "Success", description: "Work order deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete work order",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof workOrderFormSchema>>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: {
      title: "",
      description: "",
      equipmentId: "",
      assignedToId: "",
      priority: "medium",
      status: "open",
      type: "corrective",
      estimatedDuration: 0,
    },
  });

  // Smart defaults: detect urgency keywords and auto-set priority
  const applySmartDefaults = (title: string) => {
    const urgentKeywords = ["urgent", "critical", "emergency", "broken", "down", "leak", "fire", "safety"];
    const highKeywords = ["repair", "fix", "issue", "problem", "failure"];
    
    const titleLower = title.toLowerCase();
    
    if (urgentKeywords.some(keyword => titleLower.includes(keyword))) {
      form.setValue("priority", "critical");
    } else if (highKeywords.some(keyword => titleLower.includes(keyword))) {
      form.setValue("priority", "high");
    }
  };

  // Auto-assign: find tech with lowest workload
  const getSuggestedTech = () => {
    if (!users || users.length === 0) return "";
    
    const techs = users.filter(u => u.role === "tech");
    if (techs.length === 0) return "";
    
    // Count active work orders per tech
    const techWorkload = techs.map(tech => ({
      id: tech.id,
      activeCount: workOrders.filter(wo => wo.assignedToId === tech.id && wo.status !== "completed").length
    }));
    
    // Find tech with least workload
    const leastLoadedTech = techWorkload.reduce((min, current) => 
      current.activeCount < min.activeCount ? current : min
    );
    
    return leastLoadedTech.id;
  };

  // Template selection: pre-fill form from template
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      form.setValue("title", template.titlePattern || "");
      form.setValue("description", template.descriptionTemplate || "");
      form.setValue("priority", template.defaultPriority || "medium");
      form.setValue("type", template.defaultType || "corrective");
      form.setValue("estimatedDuration", template.defaultDuration || 60);
      
      toast({
        title: "Template applied",
        description: `Using "${template.name}" template`,
      });
    }
  };

  const onSubmit = (data: z.infer<typeof workOrderFormSchema>) => {
    const payload = {
      ...data,
      equipmentId: data.equipmentId || undefined,
      assignedToId: data.assignedToId || undefined,
      description: data.description || undefined,
    };
    createWorkOrder.mutate(payload);
  };

  const filteredWorkOrders = workOrders
    .filter((wo) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "draft") {
        // Show only user's own drafts
        return wo.status === "draft" && wo.createdById === user?.id;
      }
      return wo.status === statusFilter;
    })
    .filter((wo) =>
      wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "corrective":
        return "bg-chart-1/10 text-chart-1";
      case "preventive":
        return "bg-chart-3/10 text-chart-3";
      case "inspection":
        return "bg-chart-2/10 text-chart-2";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "outline";
      case "pending_approval":
        return "secondary";
      case "open":
        return "default";
      case "in_progress":
        return "default";
      case "completed":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "pending_approval":
        return "Pending Approval";
      case "in_progress":
        return "In Progress";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Work Orders</h1>
          <p className="text-muted-foreground">Create and manage maintenance work orders</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-work-order">
              <Plus className="w-4 h-4 mr-2" />
              Create Work Order
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Work Order</DialogTitle>
              </DialogHeader>
              
              <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as "quick" | "full")} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="quick" data-testid="tab-quick-capture">Quick Capture</TabsTrigger>
                  <TabsTrigger value="full" data-testid="tab-full-form">Full Form</TabsTrigger>
                </TabsList>

                {/* Quick Capture Mode */}
                <TabsContent value="quick">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title *</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                data-testid="input-wo-title"
                                onChange={(e) => {
                                  field.onChange(e);
                                  applySmartDefaults(e.target.value);
                                }}
                              />
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
                              <Textarea {...field} value={field.value || ""} rows={4} data-testid="input-wo-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                        <span className="text-muted-foreground">Smart defaults will auto-detect priority and type from your title</span>
                      </div>

                      {users.filter(u => u.role === "tech").length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const bestTech = getSuggestedTech();
                            form.setValue("assignedToId", bestTech);
                            toast({ title: "Auto-assigned to available technician" });
                          }}
                          data-testid="button-auto-assign"
                        >
                          Auto-Assign Technician
                        </Button>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createWorkOrder.isPending} data-testid="button-submit-wo">
                          {createWorkOrder.isPending ? "Creating..." : "Create Work Order"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>

                {/* Full Form Mode */}
                <TabsContent value="full">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      {templates.length > 0 && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">Template</label>
                          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                            <SelectTrigger data-testid="select-template">
                              <SelectValue placeholder="Choose a template (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-wo-title" />
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
                              <Textarea {...field} value={field.value || ""} rows={3} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="equipmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Equipment</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="corrective">Corrective</SelectItem>
                                  <SelectItem value="preventive">Preventive</SelectItem>
                                  <SelectItem value="inspection">Inspection</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="assignedToId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.filter(u => u.role === "tech").map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName}
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
                        name="estimatedDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Duration (hours)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.5"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createWorkOrder.isPending} data-testid="button-submit-wo">
                          {createWorkOrder.isPending ? "Creating..." : "Create Work Order"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-work-orders"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs by Status */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({workOrders.length})</TabsTrigger>
          {!canManage && (
            <TabsTrigger value="draft" data-testid="tab-draft">
              My Drafts ({workOrders.filter(wo => wo.status === "draft" && wo.createdById === user?.id).length})
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger value="pending_approval" data-testid="tab-pending-approval">
              Pending Approval ({workOrders.filter(wo => wo.status === "pending_approval").length})
            </TabsTrigger>
          )}
          <TabsTrigger value="open" data-testid="tab-open">
            Open ({workOrders.filter(wo => wo.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress">
            In Progress ({workOrders.filter(wo => wo.status === "in_progress").length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({workOrders.filter(wo => wo.status === "completed").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {filteredWorkOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No work orders found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm ? "Try adjusting your search" : "Create work orders to get started"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredWorkOrders.map((wo) => (
              <Card key={wo.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedWorkOrder(wo)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="text-base">#{wo.id.slice(0, 8)}</CardTitle>
                        <Badge variant={getStatusVariant(wo.status)} data-testid={`badge-status-${wo.id}`}>
                          {getStatusLabel(wo.status)}
                        </Badge>
                        <Badge variant={getPriorityVariant(wo.priority)} className="capitalize">
                          {wo.priority}
                        </Badge>
                        <Badge variant="outline" className={getTypeColor(wo.type)}>
                          {wo.type}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm font-medium text-foreground">
                        {wo.title}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">
                        {wo.equipmentId || "No equipment"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">
                        {wo.assignedToId ? "Assigned" : "Unassigned"}
                      </span>
                    </div>
                    {wo.dueDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Due: {format(new Date(wo.dueDate), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                  {wo.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{wo.description}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Work Order Detail Dialog */}
      {selectedWorkOrder && (
        <Dialog open={!!selectedWorkOrder} onOpenChange={() => { setSelectedWorkOrder(null); setAiSuggestions(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Work Order #{selectedWorkOrder.workOrderNumber}</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="details" className="w-full">
              <TabsList className={`grid w-full ${selectedWorkOrder.type === "corrective" ? "grid-cols-4" : "grid-cols-3"}`}>
                <TabsTrigger value="details">Details</TabsTrigger>
                {selectedWorkOrder.type === "corrective" && (
                  <TabsTrigger value="ai-suggestions" data-testid="tab-ai-suggestions">
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Guide
                  </TabsTrigger>
                )}
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="parts">Parts Used</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">Title</h4>
                    <p className="text-sm text-foreground">{selectedWorkOrder.title}</p>
                  </div>
                  {selectedWorkOrder.description && (
                    <div>
                      <h4 className="font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedWorkOrder.description}</p>
                    </div>
                  )}
                  {selectedWorkOrder.notes && (
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span>Notes / Feedback</span>
                        {selectedWorkOrder.status === "draft" && (
                          <Badge variant="outline" className="text-xs">From Manager</Badge>
                        )}
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-wo-notes">
                        {selectedWorkOrder.notes}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge variant={getStatusVariant(selectedWorkOrder.status)} className="ml-2">
                        {getStatusLabel(selectedWorkOrder.status)}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priority:</span>{" "}
                      <Badge variant={getPriorityVariant(selectedWorkOrder.priority)} className="ml-2 capitalize">
                        {selectedWorkOrder.priority}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <Badge variant="outline" className={`ml-2 ${getTypeColor(selectedWorkOrder.type)}`}>
                        {selectedWorkOrder.type}
                      </Badge>
                    </div>
                    {selectedWorkOrder.dueDate && (
                      <div>
                        <span className="text-muted-foreground">Due Date:</span>{" "}
                        <span className="font-medium">{format(new Date(selectedWorkOrder.dueDate), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <div className="pt-4 border-t mt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete work order #${selectedWorkOrder.workOrderNumber}?`)) {
                            deleteWorkOrder.mutate(selectedWorkOrder.id);
                          }
                        }}
                        disabled={deleteWorkOrder.isPending}
                        data-testid="button-delete-work-order"
                      >
                        {deleteWorkOrder.isPending ? "Deleting..." : "Delete Work Order"}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* AI Suggestions Tab - Only for corrective work orders */}
              {selectedWorkOrder.type === "corrective" && (
                <TabsContent value="ai-suggestions" className="space-y-4">
                  {!aiSuggestions && !getAiSuggestions.isPending && (
                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-lg">
                      <Sparkles className="w-12 h-12 text-primary mb-4" />
                      <h3 className="font-semibold text-lg mb-2">AI Repair Guide</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                        Get AI-powered troubleshooting suggestions based on the work order description. 
                        Follow the 6-step process for the quickest path to repair.
                      </p>
                      <Button 
                        onClick={() => getAiSuggestions.mutate(selectedWorkOrder.id)}
                        data-testid="button-get-ai-suggestions"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Suggestions
                      </Button>
                    </div>
                  )}

                  {getAiSuggestions.isPending && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground">Analyzing work order and generating suggestions...</p>
                    </div>
                  )}

                  {aiSuggestions && (
                    <div className="space-y-4">
                      {/* Summary and refresh */}
                      <div className="flex items-start justify-between gap-4 p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-primary" />
                            <span className="font-semibold">Quick Assessment</span>
                            <Badge 
                              variant={aiSuggestions.estimatedDifficulty === "simple" ? "default" : 
                                       aiSuggestions.estimatedDifficulty === "moderate" ? "secondary" : "destructive"}
                            >
                              {aiSuggestions.estimatedDifficulty}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{aiSuggestions.summary}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => { setAiSuggestions(null); getAiSuggestions.mutate(selectedWorkOrder.id); }}
                          data-testid="button-refresh-ai-suggestions"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* 6-Step Troubleshooting Guide */}
                      <div className="space-y-3">
                        {aiSuggestions.steps.map((step) => {
                          const stepIcons: Record<number, typeof Target> = {
                            1: Target,
                            2: ClipboardList,
                            3: Lightbulb,
                            4: Settings,
                            5: Wrench,
                            6: Eye,
                          };
                          const StepIcon = stepIcons[step.step] || Target;
                          
                          return (
                            <div key={step.step} className="border rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                                  <StepIcon className="w-4 h-4" />
                                </div>
                                <span className="font-semibold">Step {step.step}: {step.title}</span>
                              </div>
                              
                              <div className="grid gap-3 pl-10">
                                {step.whatToLookFor.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-muted-foreground mb-1">What to Look For:</h5>
                                    <ul className="text-sm space-y-1">
                                      {step.whatToLookFor.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {step.likelyCauses.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-muted-foreground mb-1">Likely Causes:</h5>
                                    <ul className="text-sm space-y-1">
                                      {step.likelyCauses.map((cause, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <Target className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                          <span>{cause}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {step.actions.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-muted-foreground mb-1">Actions:</h5>
                                    <ol className="text-sm space-y-1 list-decimal list-inside">
                                      {step.actions.map((action, i) => (
                                        <li key={i} className="pl-1">{action}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                
                                {step.safetyNotes.length > 0 && (
                                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                      <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Safety Notes:</h5>
                                    </div>
                                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                                      {step.safetyNotes.map((note, i) => (
                                        <li key={i}>{note}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="photos" className="space-y-4">
                {(canManage || selectedWorkOrder.assignedToId === user?.id) && (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          uploadPhotos.mutate({
                            workOrderId: selectedWorkOrder.id,
                            files: e.target.files,
                          });
                        }
                      }}
                      data-testid="input-upload-wo-photos"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Select up to 5 images to upload
                    </p>
                  </div>
                )}
                {selectedWorkOrder.photoUrls && selectedWorkOrder.photoUrls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedWorkOrder.photoUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Work order photo ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                        data-testid={`image-wo-${index}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                    <Image className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="parts" className="space-y-4">
                {selectedWorkOrder.partsUsed && selectedWorkOrder.partsUsed.length > 0 ? (
                  <div className="space-y-2">
                    {selectedWorkOrder.partsUsed.map((partUsage, index) => {
                      const part = parts.find(p => p.id === partUsage.partId);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{part?.name || "Unknown Part"}</p>
                              <p className="text-xs text-muted-foreground">{part?.partNumber || "N/A"}</p>
                            </div>
                          </div>
                          <Badge variant="outline">Qty: {partUsage.quantity}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                    <Package className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No parts used yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Approval Workflow Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {/* Submit for Approval (Techs on their own drafts) */}
              {selectedWorkOrder.status === "draft" && selectedWorkOrder.createdById === user?.id && !canManage && (
                <Button
                  onClick={() => submitForApproval.mutate(selectedWorkOrder.id)}
                  disabled={submitForApproval.isPending}
                  data-testid="button-submit-approval"
                >
                  {submitForApproval.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              )}

              {/* Approve/Reject (Managers on pending approvals) */}
              {selectedWorkOrder.status === "pending_approval" && canManage && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={rejectWorkOrder.isPending}
                    data-testid="button-reject-wo"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveWorkOrder.mutate(selectedWorkOrder.id)}
                    disabled={approveWorkOrder.isPending}
                    data-testid="button-approve-wo"
                  >
                    {approveWorkOrder.isPending ? "Approving..." : "Approve"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rejection Reason (Optional)</label>
              <Textarea
                placeholder="Provide feedback on why this work order is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedWorkOrder) {
                    rejectWorkOrder.mutate({
                      workOrderId: selectedWorkOrder.id,
                      reason: rejectionReason || undefined,
                    });
                    setShowRejectDialog(false);
                    setRejectionReason("");
                  }
                }}
                disabled={rejectWorkOrder.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectWorkOrder.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
