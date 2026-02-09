import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { 
  Plus, 
  Target,
  Wrench,
  Clock,
  Edit2,
  Trash2,
  Copy,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  Sparkles,
  Loader2,
  Eye,
  Droplet,
  Hammer,
  Ruler,
  CheckSquare,
  Camera,
  FileText,
  ChevronRight,
  ChevronDown,
  Settings,
  TrendingUp,
  BarChart3,
  List,
  Archive,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { CilrTemplate, CilrTemplateTask, Equipment } from "@shared/schema";

interface TemplateWithTasks extends CilrTemplate {
  tasks?: CilrTemplateTask[];
}

const taskTypeOptions = [
  { value: "clean", label: "Clean", icon: Droplet, color: "text-blue-600" },
  { value: "inspect", label: "Inspect", icon: Eye, color: "text-purple-600" },
  { value: "lubricate", label: "Lubricate", icon: Droplet, color: "text-amber-600" },
  { value: "repair", label: "Repair", icon: Hammer, color: "text-red-600" },
  { value: "measure", label: "Measure", icon: Ruler, color: "text-green-600" },
  { value: "verify", label: "Verify", icon: CheckSquare, color: "text-teal-600" },
];

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  templateType: z.enum(["cilr", "centerline"]),
  equipmentId: z.string().optional(),
  frequency: z.string().optional(),
  estimatedMinutes: z.coerce.number().optional(),
});

const taskFormSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  taskType: z.enum(["clean", "inspect", "lubricate", "repair", "measure", "verify"]),
  description: z.string().optional(),
  instructions: z.string().optional(),
  photoRequired: z.boolean().default(false),
  targetValue: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
  unit: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;
type TaskFormValues = z.infer<typeof taskFormSchema>;

export default function CenterlineStudio() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithTasks | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CilrTemplate | null>(null);
  const [editingTask, setEditingTask] = useState<CilrTemplateTask | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<TaskFormValues[]>([]);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateWithTasks[]>({
    queryKey: ["/api/cilr/templates"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      templateType: "centerline",
      frequency: "",
      estimatedMinutes: undefined,
    },
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: "",
      taskType: "verify",
      description: "",
      instructions: "",
      photoRequired: true,
      targetValue: "",
      minValue: "",
      maxValue: "",
      unit: "",
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const res = await apiRequest("/api/cilr/templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTemplateDialog(false);
      templateForm.reset();
      toast({ title: "Template created", description: "Your new template is ready for tasks" });
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormValues> }) => {
      const res = await apiRequest(`/api/cilr/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      templateForm.reset();
      toast({ title: "Template updated" });
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/cilr/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      if (selectedTemplate?.id === editingTemplate?.id) {
        setSelectedTemplate(null);
      }
      toast({ title: "Template deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ templateId, data, sortOrder }: { templateId: string; data: TaskFormValues; sortOrder: number }) => {
      const res = await apiRequest("/api/cilr/tasks", {
        method: "POST",
        body: JSON.stringify({ ...data, templateId, sortOrder }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTaskDialog(false);
      taskForm.reset();
      toast({ title: "Task added" });
    },
    onError: () => {
      toast({ title: "Failed to add task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormValues> }) => {
      const res = await apiRequest(`/api/cilr/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      setShowTaskDialog(false);
      setEditingTask(null);
      taskForm.reset();
      toast({ title: "Task updated" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/cilr/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      toast({ title: "Task deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  const handleTemplateSubmit = (data: TemplateFormValues) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleTaskSubmit = (data: TaskFormValues) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
    } else if (selectedTemplate) {
      const sortOrder = (selectedTemplate.tasks?.length || 0) + 1;
      createTaskMutation.mutate({ templateId: selectedTemplate.id, data, sortOrder });
    }
  };

  const openEditTemplate = (template: CilrTemplate) => {
    setEditingTemplate(template);
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      templateType: template.templateType || "centerline",
      equipmentId: template.equipmentId || "",
      frequency: template.frequency || "",
      estimatedMinutes: template.estimatedMinutes || undefined,
    });
    setShowTemplateDialog(true);
  };

  const openEditTask = (task: CilrTemplateTask) => {
    setEditingTask(task);
    taskForm.reset({
      name: task.name,
      taskType: task.taskType || "verify",
      description: task.description || "",
      instructions: task.instructions || "",
      photoRequired: task.photoRequired || false,
      targetValue: task.targetValue || "",
      minValue: task.minValue || "",
      maxValue: task.maxValue || "",
      unit: task.unit || "",
    });
    setShowTaskDialog(true);
  };

  const generateAITasks = async () => {
    if (!aiPrompt.trim() || !selectedTemplate) return;
    
    setAILoading(true);
    try {
      const equipmentName = selectedTemplate.equipmentId 
        ? equipment.find(e => e.id === selectedTemplate.equipmentId)?.name 
        : undefined;

      const response = await apiRequest("/api/cilr/ai-generate-tasks", {
        method: "POST",
        body: JSON.stringify({
          prompt: aiPrompt,
          templateType: selectedTemplate.templateType || "centerline",
          equipmentContext: equipmentName,
        }),
      });
      
      const data = await response.json();
      
      if (data.tasks && Array.isArray(data.tasks)) {
        setAISuggestions(data.tasks.map((task: TaskFormValues) => ({
          name: task.name || "Unnamed Task",
          taskType: task.taskType || "verify",
          description: task.description || "",
          instructions: task.instructions || "",
          photoRequired: task.photoRequired !== false,
          targetValue: task.targetValue || "",
          minValue: task.minValue || "",
          maxValue: task.maxValue || "",
          unit: task.unit || "",
        })));
        toast({ title: `Generated ${data.tasks.length} task suggestions`, description: "Review and add the tasks you want" });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      toast({ title: "Failed to generate suggestions", description: "Please try again or create tasks manually", variant: "destructive" });
    }
    setAILoading(false);
  };

  const addAISuggestion = (suggestion: TaskFormValues) => {
    if (selectedTemplate) {
      const sortOrder = (selectedTemplate.tasks?.length || 0) + 1;
      createTaskMutation.mutate({ templateId: selectedTemplate.id, data: suggestion, sortOrder });
    }
    setAISuggestions(suggestions => suggestions.filter(s => s.name !== suggestion.name));
  };

  const cilrTemplates = templates.filter(t => t.templateType === "cilr");
  const centerlineTemplates = templates.filter(t => t.templateType === "centerline");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 md:p-6 border-b">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Centerline Studio</h1>
            <p className="text-muted-foreground">Build and manage CILR checklists and centerline templates</p>
          </div>
          <Button
            onClick={() => {
              setEditingTemplate(null);
              templateForm.reset({
                name: "",
                description: "",
                templateType: "centerline",
                frequency: "",
                estimatedMinutes: undefined,
              });
              setShowTemplateDialog(true);
            }}
            data-testid="button-create-template"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Template list sidebar */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
              <TabsTrigger value="templates" className="gap-2">
                <Target className="h-4 w-4" />
                Centerline
              </TabsTrigger>
              <TabsTrigger value="cilr" className="gap-2">
                <Wrench className="h-4 w-4" />
                CILR
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="templates" className="m-0 px-4 pb-4 space-y-2">
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : centerlineTemplates.length === 0 ? (
                  <Card className="text-center">
                    <CardContent className="p-6">
                      <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No centerline templates yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  centerlineTemplates.map((template) => (
                    <TemplateListItem
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onClick={() => setSelectedTemplate(template)}
                      onEdit={() => openEditTemplate(template)}
                      onDelete={() => deleteTemplateMutation.mutate(template.id)}
                      equipment={equipment}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="cilr" className="m-0 px-4 pb-4 space-y-2">
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cilrTemplates.length === 0 ? (
                  <Card className="text-center">
                    <CardContent className="p-6">
                      <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No CILR templates yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  cilrTemplates.map((template) => (
                    <TemplateListItem
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onClick={() => setSelectedTemplate(template)}
                      onEdit={() => openEditTemplate(template)}
                      onDelete={() => deleteTemplateMutation.mutate(template.id)}
                      equipment={equipment}
                    />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Task editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              {/* Template header */}
              <div className="p-4 border-b bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={selectedTemplate.templateType === "centerline" ? "default" : "secondary"}>
                        {selectedTemplate.templateType === "centerline" ? "Centerline" : "CILR"}
                      </Badge>
                      {selectedTemplate.isActive ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold">{selectedTemplate.name}</h2>
                    {selectedTemplate.description && (
                      <p className="text-muted-foreground mt-1">{selectedTemplate.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {selectedTemplate.frequency && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {selectedTemplate.frequency}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <List className="h-4 w-4" />
                        {selectedTemplate.tasks?.length || 0} tasks
                      </div>
                      {selectedTemplate.estimatedMinutes && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          ~{selectedTemplate.estimatedMinutes} min
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openEditTemplate(selectedTemplate)} data-testid="button-edit-template">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingTask(null);
                        taskForm.reset({
                          name: "",
                          taskType: selectedTemplate.templateType === "centerline" ? "measure" : "inspect",
                          description: "",
                          instructions: "",
                          photoRequired: true,
                          targetValue: "",
                          minValue: "",
                          maxValue: "",
                          unit: "",
                        });
                        setShowTaskDialog(true);
                      }}
                      data-testid="button-add-task"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                </div>
              </div>

              {/* AI suggestions bar */}
              <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <Input
                      placeholder="Describe what you want to measure (e.g., 'pump pressure and temperature')"
                      value={aiPrompt}
                      onChange={(e) => setAIPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && generateAITasks()}
                      className="flex-1 bg-white dark:bg-background"
                      data-testid="input-ai-prompt"
                    />
                  </div>
                  <Button
                    onClick={generateAITasks}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-generate-tasks"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Tasks
                      </>
                    )}
                  </Button>
                </div>

                {/* AI suggestions */}
                {aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">AI Suggestions:</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {aiSuggestions.map((suggestion, idx) => (
                        <Card key={idx} className="bg-white dark:bg-card">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{suggestion.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{suggestion.description}</p>
                                {suggestion.targetValue && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Target: {suggestion.targetValue} ({suggestion.minValue}-{suggestion.maxValue}) {suggestion.unit}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => addAISuggestion(suggestion)}
                                disabled={createTaskMutation.isPending}
                                data-testid={`button-add-suggestion-${idx}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Task list */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {!selectedTemplate.tasks || selectedTemplate.tasks.length === 0 ? (
                    <Card className="text-center">
                      <CardContent className="p-8">
                        <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Add tasks manually or use AI to generate them based on your requirements
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    selectedTemplate.tasks.map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={idx}
                        onEdit={() => openEditTask(task)}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">Select a template</h3>
                <p className="text-muted-foreground">Choose a template from the list to view and edit its tasks</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update the template details" : "Create a new CILR or Centerline template"}
            </DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(handleTemplateSubmit)} className="space-y-4">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pump Station Daily Check" {...field} data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={templateForm.control}
                name="templateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-template-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="centerline">Centerline Verification</SelectItem>
                        <SelectItem value="cilr">CILR Checklist</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Centerline for measurements, CILR for Clean/Inspect/Lubricate/Repair tasks
                    </FormDescription>
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
                      <Textarea placeholder="Brief description of this template" {...field} data-testid="input-template-description" />
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
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-frequency">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="shift">Every Shift</SelectItem>
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
                        <Input type="number" placeholder="15" {...field} data-testid="input-template-time" />
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
                        <SelectTrigger data-testid="select-template-equipment">
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
                <Button type="button" variant="outline" onClick={() => setShowTemplateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  data-testid="button-save-template"
                >
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingTemplate ? "Save Changes" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update the task details" : "Add a new task to this template"}
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
                      <Input placeholder="e.g., Check oil pressure" {...field} data-testid="input-task-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="taskType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taskTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <opt.icon className={`h-4 w-4 ${opt.color}`} />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="photoRequired"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photo Required</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2 h-9 pt-1">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-photo-required"
                          />
                          <span className="text-sm text-muted-foreground">
                            {field.value ? "Yes" : "No"}
                          </span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What should be checked" rows={2} {...field} data-testid="input-task-description" />
                    </FormControl>
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
                      <Textarea placeholder="Step-by-step instructions" rows={2} {...field} data-testid="input-task-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(taskForm.watch("taskType") === "measure" || taskForm.watch("taskType") === "verify") && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Centerline Specifications</p>
                  <div className="grid grid-cols-4 gap-3">
                    <FormField
                      control={taskForm.control}
                      name="targetValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Target</FormLabel>
                          <FormControl>
                            <Input placeholder="100" {...field} data-testid="input-task-target" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="minValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Min</FormLabel>
                          <FormControl>
                            <Input placeholder="95" {...field} data-testid="input-task-min" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="maxValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Max</FormLabel>
                          <FormControl>
                            <Input placeholder="105" {...field} data-testid="input-task-max" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Unit</FormLabel>
                          <FormControl>
                            <Input placeholder="PSI" {...field} data-testid="input-task-unit" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTaskDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                  data-testid="button-save-task"
                >
                  {(createTaskMutation.isPending || updateTaskMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
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

function TemplateListItem({
  template,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  equipment,
}: {
  template: TemplateWithTasks;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  equipment: Equipment[];
}) {
  const equipmentItem = equipment.find(e => e.id === template.equipmentId);
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover-elevate"}`}
      onClick={onClick}
      data-testid={`card-template-list-${template.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{template.name}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{template.tasks?.length || 0} tasks</span>
              {template.frequency && (
                <>
                  <span>·</span>
                  <span className="capitalize">{template.frequency}</span>
                </>
              )}
            </div>
            {equipmentItem && (
              <p className="text-xs text-muted-foreground truncate mt-1">{equipmentItem.name}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  index,
  onEdit,
  onDelete,
}: {
  task: CilrTemplateTask;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeOption = taskTypeOptions.find(t => t.value === task.taskType);
  const Icon = typeOption?.icon || Eye;
  
  return (
    <Card className="hover-elevate" data-testid={`card-task-${task.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground font-medium w-6 text-center">{index + 1}</div>
            <div className={`p-2 rounded-lg bg-muted ${typeOption?.color || ""}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium">{task.name}</p>
              <Badge variant="outline" className="capitalize text-xs">
                {task.taskType}
              </Badge>
              {task.photoRequired && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  <Camera className="h-3 w-3 mr-1" />
                  Photo
                </Badge>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
            )}
            
            {(task.targetValue || task.minValue || task.maxValue) && (
              <div className="flex items-center gap-3 mt-2 text-sm">
                {task.targetValue && (
                  <span className="font-mono">
                    Target: <span className="font-medium">{task.targetValue}{task.unit || ""}</span>
                  </span>
                )}
                {(task.minValue || task.maxValue) && (
                  <span className="font-mono text-muted-foreground">
                    Range: {task.minValue || "—"} to {task.maxValue || "—"}{task.unit || ""}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-task-${task.id}`}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive" data-testid={`button-delete-task-${task.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
