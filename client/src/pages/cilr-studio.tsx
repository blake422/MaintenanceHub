import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Edit, Sparkles, Droplets, Eye, Wrench, Brush, Camera, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CilrTemplate, CilrTemplateTask, Equipment } from "@shared/schema";

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  equipmentId: z.string().optional(),
  frequency: z.string().optional(),
  estimatedMinutes: z.coerce.number().optional(),
});

const taskFormSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  taskType: z.enum(["clean", "inspect", "lubricate", "repair"]),
  description: z.string().optional(),
  instructions: z.string().optional(),
  photoRequired: z.boolean().default(false),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;
type TaskFormValues = z.infer<typeof taskFormSchema>;

const TASK_TYPES = [
  { value: "clean", label: "Clean", icon: Brush, color: "bg-blue-500" },
  { value: "inspect", label: "Inspect", icon: Eye, color: "bg-green-500" },
  { value: "lubricate", label: "Lubricate", icon: Droplets, color: "bg-amber-500" },
  { value: "repair", label: "Repair", icon: Wrench, color: "bg-red-500" },
];

export default function CilrStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<(CilrTemplate & { tasks?: CilrTemplateTask[] }) | null>(null);
  const [editingTask, setEditingTask] = useState<CilrTemplateTask | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: "", description: "", equipmentId: "", frequency: "daily", estimatedMinutes: 15 },
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { name: "", taskType: "inspect", description: "", instructions: "", photoRequired: false },
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<(CilrTemplate & { tasks?: CilrTemplateTask[] })[]>({
    queryKey: ["/api/cilr/templates"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const cilrTemplates = templates.filter(t => t.templateType === "cilr");

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      return apiRequest("/api/cilr/templates", {
        method: "POST",
        body: JSON.stringify({ ...data, templateType: "cilr", tasks: [] }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTemplateDialog(false);
      templateForm.reset();
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormValues> }) => {
      return apiRequest("PATCH", `/api/cilr/templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      templateForm.reset();
      toast({ title: "Template updated" });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/cilr/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: TaskFormValues }) => {
      return apiRequest("POST", `/api/cilr/templates/${templateId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTaskDialog(false);
      taskForm.reset();
      toast({ title: "Task added" });
    },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormValues> }) => {
      return apiRequest("PATCH", `/api/cilr/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTaskDialog(false);
      setEditingTask(null);
      taskForm.reset();
      toast({ title: "Task updated" });
    },
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/cilr/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      toast({ title: "Task deleted" });
    },
    onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
  });

  const handleTemplateSubmit = (values: TemplateFormValues) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: values });
    } else {
      createTemplateMutation.mutate(values);
    }
  };

  const handleTaskSubmit = (values: TaskFormValues) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: values });
    } else if (selectedTemplateId) {
      createTaskMutation.mutate({ templateId: selectedTemplateId, data: values });
    }
  };

  const handleEditTemplate = (template: CilrTemplate & { tasks?: CilrTemplateTask[] }) => {
    setEditingTemplate(template);
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      equipmentId: template.equipmentId || "",
      frequency: template.frequency || "daily",
      estimatedMinutes: template.estimatedMinutes || 15,
    });
    setShowTemplateDialog(true);
  };

  const handleEditTask = (task: CilrTemplateTask) => {
    setEditingTask(task);
    taskForm.reset({
      name: task.name,
      taskType: task.taskType as "clean" | "inspect" | "lubricate" | "repair",
      description: task.description || "",
      instructions: task.instructions || "",
      photoRequired: task.photoRequired || false,
    });
    setShowTaskDialog(true);
  };

  const handleAddTask = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setEditingTask(null);
    taskForm.reset({ name: "", taskType: "inspect", description: "", instructions: "", photoRequired: false });
    setShowTaskDialog(true);
  };

  const toggleExpanded = (templateId: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedTemplates(newExpanded);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !selectedTemplateId) return;
    setAiLoading(true);
    try {
      const template = cilrTemplates.find(t => t.id === selectedTemplateId);
      const equipmentName = template?.equipmentId ? equipment.find(e => e.id === template.equipmentId)?.name : undefined;
      
      const response = await apiRequest("/api/cilr/ai-generate-tasks", {
        method: "POST",
        body: JSON.stringify({ prompt: aiPrompt, templateType: "cilr", equipmentName }),
      }) as { tasks?: Array<{ name: string; taskType: string; description?: string; instructions?: string; photoRequired?: boolean }> };
      
      if (response.tasks && response.tasks.length > 0) {
        for (const task of response.tasks) {
          if (["clean", "inspect", "lubricate", "repair"].includes(task.taskType)) {
            await createTaskMutation.mutateAsync({
              templateId: selectedTemplateId,
              data: {
                name: task.name,
                taskType: task.taskType as "clean" | "inspect" | "lubricate" | "repair",
                description: task.description || "",
                instructions: task.instructions || "",
                photoRequired: task.photoRequired || false,
              },
            });
          }
        }
        toast({ title: "AI tasks generated and added!" });
        setAiPrompt("");
      }
    } catch (error) {
      toast({ title: "AI generation failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const getTaskIcon = (taskType: string) => {
    const type = TASK_TYPES.find(t => t.value === taskType);
    return type ? type.icon : Eye;
  };

  const getTaskColor = (taskType: string) => {
    const type = TASK_TYPES.find(t => t.value === taskType);
    return type ? type.color : "bg-gray-500";
  };

  if (!user || !["admin", "manager"].includes(user.role || "")) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription className="mt-2">Only managers and admins can access CILR Studio.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-cilr-studio-title">CILR Studio</h1>
          <p className="text-muted-foreground">Create and manage Clean, Inspect, Lubricate, Repair templates</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); templateForm.reset(); setShowTemplateDialog(true); }} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {templatesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : cilrTemplates.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium">No CILR Templates</h3>
          <p className="text-muted-foreground mt-1">Create your first CILR template to get started.</p>
          <Button className="mt-4" onClick={() => { setEditingTemplate(null); templateForm.reset(); setShowTemplateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {cilrTemplates.map((template) => {
            const isExpanded = expandedTemplates.has(template.id);
            const tasks = template.tasks || [];
            const equipmentItem = template.equipmentId ? equipment.find(e => e.id === template.equipmentId) : null;

            return (
              <Card key={template.id} data-testid={`card-template-${template.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Button variant="ghost" size="icon" onClick={() => toggleExpanded(template.id)} data-testid={`button-expand-${template.id}`}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {equipmentItem && <Badge variant="outline">{equipmentItem.name}</Badge>}
                          <Badge variant="secondary">{tasks.length} tasks</Badge>
                          {template.frequency && <Badge variant="outline">{template.frequency}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} data-testid={`button-edit-template-${template.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTemplateMutation.mutate(template.id)} data-testid={`button-delete-template-${template.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-4 space-y-4">
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}

                    <div className="space-y-2">
                      {tasks.map((task, index) => {
                        const TaskIcon = getTaskIcon(task.taskType || "inspect");
                        return (
                          <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30" data-testid={`task-item-${task.id}`}>
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                            <div className={`w-8 h-8 rounded-full ${getTaskColor(task.taskType || "inspect")} flex items-center justify-center`}>
                              <TaskIcon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{task.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="capitalize">{task.taskType}</span>
                                {task.photoRequired && (
                                  <span className="flex items-center gap-1">
                                    <Camera className="h-3 w-3" /> Photo required
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTaskMutation.mutate(task.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleAddTask(template.id)} data-testid={`button-add-task-${template.id}`}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Task
                      </Button>
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          placeholder="Describe tasks to generate with AI..."
                          value={selectedTemplateId === template.id ? aiPrompt : ""}
                          onChange={(e) => { setSelectedTemplateId(template.id); setAiPrompt(e.target.value); }}
                          className="flex-1"
                          data-testid={`input-ai-prompt-${template.id}`}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setSelectedTemplateId(template.id); handleAiGenerate(); }}
                          disabled={aiLoading || !aiPrompt.trim() || selectedTemplateId !== template.id}
                          data-testid={`button-ai-generate-${template.id}`}
                        >
                          {aiLoading && selectedTemplateId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New CILR Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update template details" : "Create a new Clean, Inspect, Lubricate, Repair template"}
            </DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(handleTemplateSubmit)} className="space-y-4">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Daily Machine Inspection" {...field} data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={templateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the purpose of this template..." {...field} data-testid="input-template-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={templateForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "daily"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={templateForm.control}
                  name="estimatedMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. Time (min)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="15" {...field} data-testid="input-estimated-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={templateForm.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment (optional)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-equipment">
                          <SelectValue placeholder="Select equipment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {equipment.map((eq) => (
                          <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending} data-testid="button-save-template">
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingTemplate ? "Save Changes" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update task details" : "Add a new CILR task to this template"}
            </DialogDescription>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(handleTaskSubmit)} className="space-y-4">
              <FormField
                control={taskForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Clean conveyor belt" {...field} data-testid="input-task-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={taskForm.control}
                name="taskType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Type</FormLabel>
                    <div className="grid grid-cols-4 gap-2">
                      {TASK_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isSelected = field.value === type.value;
                        return (
                          <Button
                            key={type.value}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={`flex flex-col h-auto py-3 ${isSelected ? type.color : ""}`}
                            onClick={() => field.onChange(type.value)}
                            data-testid={`button-task-type-${type.value}`}
                          >
                            <Icon className="h-5 w-5 mb-1" />
                            <span className="text-xs">{type.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={taskForm.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Step-by-step instructions for the operator..." {...field} data-testid="input-task-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={taskForm.control}
                name="photoRequired"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Photo Required</FormLabel>
                      <p className="text-xs text-muted-foreground">Require operators to take a photo for this task</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-photo-required" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createTaskMutation.isPending || updateTaskMutation.isPending} data-testid="button-save-task">
                  {(createTaskMutation.isPending || updateTaskMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingTask ? "Save Changes" : "Add Task"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
