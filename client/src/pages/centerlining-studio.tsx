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
import { Loader2, Plus, Trash2, Edit, Sparkles, Target, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CenterlineTemplate, CenterlineParameter, Equipment } from "@shared/schema";

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  equipmentId: z.string().optional(),
  frequency: z.string().optional(),
  estimatedMinutes: z.coerce.number().optional(),
});

const parameterFormSchema = z.object({
  name: z.string().min(1, "Parameter name is required"),
  description: z.string().optional(),
  targetValue: z.string().min(1, "Target value is required"),
  minValue: z.string().min(1, "Minimum value is required"),
  maxValue: z.string().min(1, "Maximum value is required"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;
type ParameterFormValues = z.infer<typeof parameterFormSchema>;

type TemplateWithParams = CenterlineTemplate & { parameters?: CenterlineParameter[] };

export default function CenterliningStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showParameterDialog, setShowParameterDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithParams | null>(null);
  const [editingParameter, setEditingParameter] = useState<CenterlineParameter | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: "", description: "", equipmentId: "", frequency: "daily", estimatedMinutes: 15 },
  });

  const parameterForm = useForm<ParameterFormValues>({
    resolver: zodResolver(parameterFormSchema),
    defaultValues: { name: "", description: "", targetValue: "", minValue: "", maxValue: "", unit: "", category: "" },
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateWithParams[]>({
    queryKey: ["/api/centerlining/templates"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      return apiRequest("/api/centerlining/templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      setShowTemplateDialog(false);
      templateForm.reset();
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormValues> }) => {
      return apiRequest(`/api/centerlining/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      templateForm.reset();
      toast({ title: "Template updated" });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/centerlining/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const createParameterMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: ParameterFormValues }) => {
      return apiRequest(`/api/centerlining/templates/${templateId}/parameters`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      setShowParameterDialog(false);
      parameterForm.reset();
      toast({ title: "Parameter added" });
    },
    onError: () => toast({ title: "Failed to add parameter", variant: "destructive" }),
  });

  const updateParameterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ParameterFormValues> }) => {
      return apiRequest(`/api/centerlining/parameters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      setShowParameterDialog(false);
      setEditingParameter(null);
      parameterForm.reset();
      toast({ title: "Parameter updated" });
    },
    onError: () => toast({ title: "Failed to update parameter", variant: "destructive" }),
  });

  const deleteParameterMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/centerlining/parameters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/templates"] });
      toast({ title: "Parameter deleted" });
    },
    onError: () => toast({ title: "Failed to delete parameter", variant: "destructive" }),
  });

  const handleTemplateSubmit = (values: TemplateFormValues) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: values });
    } else {
      createTemplateMutation.mutate(values);
    }
  };

  const handleParameterSubmit = (values: ParameterFormValues) => {
    if (editingParameter) {
      updateParameterMutation.mutate({ id: editingParameter.id, data: values });
    } else if (selectedTemplateId) {
      createParameterMutation.mutate({ templateId: selectedTemplateId, data: values });
    }
  };

  const handleEditTemplate = (template: TemplateWithParams) => {
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

  const handleEditParameter = (param: CenterlineParameter) => {
    setEditingParameter(param);
    parameterForm.reset({
      name: param.name,
      description: param.description || "",
      targetValue: param.targetValue,
      minValue: param.minValue,
      maxValue: param.maxValue,
      unit: param.unit,
      category: param.category || "",
    });
    setShowParameterDialog(true);
  };

  const handleAddParameter = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setEditingParameter(null);
    parameterForm.reset({ name: "", description: "", targetValue: "", minValue: "", maxValue: "", unit: "", category: "" });
    setShowParameterDialog(true);
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
      const template = templates.find(t => t.id === selectedTemplateId);
      const equipmentName = template?.equipmentId ? equipment.find(e => e.id === template.equipmentId)?.name : undefined;
      
      const response = await apiRequest("/api/centerlining/ai-generate-parameters", {
        method: "POST",
        body: JSON.stringify({ prompt: aiPrompt, equipmentName }),
      }) as { parameters?: Array<{ name: string; description?: string; targetValue?: string; minValue?: string; maxValue?: string; unit?: string; category?: string }> };
      
      if (response.parameters && response.parameters.length > 0) {
        for (const param of response.parameters) {
          await createParameterMutation.mutateAsync({
            templateId: selectedTemplateId,
            data: {
              name: param.name,
              description: param.description || "",
              targetValue: param.targetValue || "0",
              minValue: param.minValue || "0",
              maxValue: param.maxValue || "0",
              unit: param.unit || "",
              category: param.category || "",
            },
          });
        }
        toast({ title: "AI parameters generated and added!" });
        setAiPrompt("");
      }
    } catch (error) {
      toast({ title: "AI generation failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch full template with parameters when expanded
  const fetchTemplateDetails = async (templateId: string) => {
    try {
      const response = await apiRequest(`/api/centerlining/templates/${templateId}`);
      return response;
    } catch (error) {
      return null;
    }
  };

  if (!user || !["admin", "manager"].includes(user.role || "")) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription className="mt-2">Only managers and admins can access Centerlining Studio.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-centerlining-studio-title">Centerlining Studio</h1>
          <p className="text-muted-foreground">Define equipment parameters with target values and tolerances</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); templateForm.reset(); setShowTemplateDialog(true); }} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" />
          New Spec Sheet
        </Button>
      </div>

      {templatesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Centerline Spec Sheets</h3>
          <p className="text-muted-foreground mt-1">Create your first spec sheet to define equipment parameters.</p>
          <Button className="mt-4" onClick={() => { setEditingTemplate(null); templateForm.reset(); setShowTemplateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Spec Sheet
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const isExpanded = expandedTemplates.has(template.id);
            const parameters = template.parameters || [];
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
                          <Badge variant="secondary">{parameters.length} parameters</Badge>
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

                    {parameters.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Parameter</th>
                              <th className="text-center p-3 font-medium">Target</th>
                              <th className="text-center p-3 font-medium">Min</th>
                              <th className="text-center p-3 font-medium">Max</th>
                              <th className="text-center p-3 font-medium">Unit</th>
                              <th className="text-right p-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parameters.map((param) => (
                              <tr key={param.id} className="border-t" data-testid={`row-parameter-${param.id}`}>
                                <td className="p-3">
                                  <div className="font-medium">{param.name}</div>
                                  {param.description && <div className="text-xs text-muted-foreground">{param.description}</div>}
                                </td>
                                <td className="p-3 text-center font-mono">{param.targetValue}</td>
                                <td className="p-3 text-center font-mono text-amber-600">{param.minValue}</td>
                                <td className="p-3 text-center font-mono text-amber-600">{param.maxValue}</td>
                                <td className="p-3 text-center">{param.unit}</td>
                                <td className="p-3 text-right">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditParameter(param)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteParameterMutation.mutate(param.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        No parameters defined yet. Add parameters manually or use AI to generate them.
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleAddParameter(template.id)} data-testid={`button-add-parameter-${template.id}`}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Parameter
                      </Button>
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          placeholder="Describe parameters to generate with AI..."
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
            <DialogTitle>{editingTemplate ? "Edit Spec Sheet" : "New Centerline Spec Sheet"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update spec sheet details" : "Create a new centerline specification sheet for equipment parameters"}
            </DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(handleTemplateSubmit)} className="space-y-4">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spec Sheet Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pump Station Parameters" {...field} data-testid="input-template-name" />
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
                      <Textarea placeholder="Describe the equipment and parameters..." {...field} data-testid="input-template-description" />
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
                      <FormLabel>Check Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "daily"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="per_shift">Per Shift</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
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
                        <Input type="number" placeholder="10" {...field} data-testid="input-estimated-time" />
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
                    <FormLabel>Equipment</FormLabel>
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
                  {editingTemplate ? "Save Changes" : "Create Spec Sheet"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Parameter Dialog */}
      <Dialog open={showParameterDialog} onOpenChange={setShowParameterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingParameter ? "Edit Parameter" : "Add Parameter"}</DialogTitle>
            <DialogDescription>
              {editingParameter ? "Update parameter specifications" : "Define a new parameter with target value and tolerances"}
            </DialogDescription>
          </DialogHeader>
          <Form {...parameterForm}>
            <form onSubmit={parameterForm.handleSubmit(handleParameterSubmit)} className="space-y-4">
              <FormField
                control={parameterForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parameter Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Inlet Pressure" {...field} data-testid="input-parameter-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={parameterForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Additional details about this parameter..." {...field} data-testid="input-parameter-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-4 gap-3">
                <FormField
                  control={parameterForm.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target</FormLabel>
                      <FormControl>
                        <Input placeholder="100" {...field} className="font-mono" data-testid="input-target-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={parameterForm.control}
                  name="minValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min</FormLabel>
                      <FormControl>
                        <Input placeholder="95" {...field} className="font-mono" data-testid="input-min-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={parameterForm.control}
                  name="maxValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max</FormLabel>
                      <FormControl>
                        <Input placeholder="105" {...field} className="font-mono" data-testid="input-max-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={parameterForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="PSI" {...field} data-testid="input-unit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={parameterForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pressure, Temperature, Flow" {...field} data-testid="input-category" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowParameterDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createParameterMutation.isPending || updateParameterMutation.isPending} data-testid="button-save-parameter">
                  {(createParameterMutation.isPending || updateParameterMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingParameter ? "Save Changes" : "Add Parameter"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
