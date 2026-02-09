import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, AlertCircle, Clock, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface WhyAnalysis {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  rootCause: string;
}

interface Countermeasure {
  id: string;
  action: string;
  responsible: string;
  targetDate: string;
  status: "pending" | "in_progress" | "complete";
}

interface BDAData {
  // Event Information
  eventDate: string;
  eventTime: string;
  shiftNumber: string;
  lineArea: string;
  equipmentName: string;
  assetTag: string;
  
  // Symptoms
  symptoms: string;
  initialObservations: string;
  
  // Timeline
  breakdownStartTime: string;
  restorationStartTime: string;
  restorationEndTime: string;
  totalDowntimeMinutes: number;
  
  // Failure Details
  failureMode: string;
  directCause: string;
  componentFailed: string;
  
  // Why-Why Analysis
  whyAnalysis: WhyAnalysis;
  
  // 4M Analysis
  analysis4M: {
    man: string;
    machine: string;
    method: string;
    material: string;
  };
  
  // Countermeasures
  countermeasures: Countermeasure[];
  
  // Impact
  productionLossUnits: number;
  estimatedCost: number;
  
  // Sign-off
  technicianName: string;
  supervisorName: string;
  notes: string;
}

interface BDAFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const emptyBDA: BDAData = {
  eventDate: "",
  eventTime: "",
  shiftNumber: "",
  lineArea: "",
  equipmentName: "",
  assetTag: "",
  symptoms: "",
  initialObservations: "",
  breakdownStartTime: "",
  restorationStartTime: "",
  restorationEndTime: "",
  totalDowntimeMinutes: 0,
  failureMode: "",
  directCause: "",
  componentFailed: "",
  whyAnalysis: {
    why1: "",
    why2: "",
    why3: "",
    why4: "",
    why5: "",
    rootCause: ""
  },
  analysis4M: {
    man: "",
    machine: "",
    method: "",
    material: ""
  },
  countermeasures: [],
  productionLossUnits: 0,
  estimatedCost: 0,
  technicianName: "",
  supervisorName: "",
  notes: ""
};

export function BDAForm({ step, checklistItemId, onDismiss }: BDAFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<BDAData>(emptyBDA);
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
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "bda_analysis"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as BDAData;
        setData(payload || emptyBDA);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: BDAData): Promise<ExcellenceDeliverable> => {
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "bda_analysis",
          title: "Breakdown Analysis Report",
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (response) => {
      setDeliverableId(response.id);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "BDA Report saved",
        description: "Breakdown Analysis report saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save BDA report. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateField = (field: keyof BDAData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateWhyAnalysis = (field: keyof WhyAnalysis, value: string) => {
    setData(prev => ({
      ...prev,
      whyAnalysis: { ...prev.whyAnalysis, [field]: value }
    }));
  };

  const update4M = (field: keyof BDAData["analysis4M"], value: string) => {
    setData(prev => ({
      ...prev,
      analysis4M: { ...prev.analysis4M, [field]: value }
    }));
  };

  const addCountermeasure = () => {
    const newCM: Countermeasure = {
      id: crypto.randomUUID(),
      action: "",
      responsible: "",
      targetDate: "",
      status: "pending"
    };
    setData(prev => ({
      ...prev,
      countermeasures: [...prev.countermeasures, newCM]
    }));
  };

  const updateCountermeasure = (id: string, field: keyof Countermeasure, value: any) => {
    setData(prev => ({
      ...prev,
      countermeasures: prev.countermeasures.map(cm =>
        cm.id === id ? { ...cm, [field]: value } : cm
      )
    }));
  };

  const removeCountermeasure = (id: string) => {
    setData(prev => ({
      ...prev,
      countermeasures: prev.countermeasures.filter(cm => cm.id !== id)
    }));
  };

  const calculateDowntime = () => {
    if (data.breakdownStartTime && data.restorationEndTime) {
      const start = new Date(`2000-01-01T${data.breakdownStartTime}`);
      const end = new Date(`2000-01-01T${data.restorationEndTime}`);
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.round(diffMs / 60000);
      updateField("totalDowntimeMinutes", diffMins > 0 ? diffMins : 0);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Breakdown Analysis (BDA) Report
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Document breakdown events with root cause analysis and countermeasures
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(data)}
          disabled={saveMutation.isPending}
          data-testid="button-save-bda"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Report
        </Button>
      </div>

      <Tabs defaultValue="event" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="event">Event Info</TabsTrigger>
          <TabsTrigger value="failure">Failure Details</TabsTrigger>
          <TabsTrigger value="why">Why-Why Analysis</TabsTrigger>
          <TabsTrigger value="4m">4M Analysis</TabsTrigger>
          <TabsTrigger value="actions">Countermeasures</TabsTrigger>
        </TabsList>

        <TabsContent value="event" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Information</CardTitle>
              <CardDescription>Fill this form on the shop floor during or just after breakdown restoration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Event Date</Label>
                  <Input
                    type="date"
                    value={data.eventDate}
                    onChange={(e) => updateField("eventDate", e.target.value)}
                    data-testid="input-event-date"
                  />
                </div>
                <div>
                  <Label>Event Time</Label>
                  <Input
                    type="time"
                    value={data.eventTime}
                    onChange={(e) => updateField("eventTime", e.target.value)}
                    data-testid="input-event-time"
                  />
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select value={data.shiftNumber} onValueChange={(v) => updateField("shiftNumber", v)}>
                    <SelectTrigger data-testid="select-shift">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Shift 1 (Day)</SelectItem>
                      <SelectItem value="2">Shift 2 (Evening)</SelectItem>
                      <SelectItem value="3">Shift 3 (Night)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Line/Area</Label>
                  <Input
                    value={data.lineArea}
                    onChange={(e) => updateField("lineArea", e.target.value)}
                    placeholder="e.g., Line 3, Packaging"
                    data-testid="input-line-area"
                  />
                </div>
                <div>
                  <Label>Equipment Name</Label>
                  <Select value={data.equipmentName} onValueChange={(v) => {
                    updateField("equipmentName", v);
                    const eq = equipmentList?.find(e => e.name === v);
                    if (eq) updateField("assetTag", eq.assetTag || "");
                  }}>
                    <SelectTrigger data-testid="select-equipment">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentList?.map(eq => (
                        <SelectItem key={eq.id} value={eq.name}>{eq.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Asset Tag</Label>
                  <Input
                    value={data.assetTag}
                    onChange={(e) => updateField("assetTag", e.target.value)}
                    placeholder="Asset ID"
                    data-testid="input-asset-tag"
                  />
                </div>
              </div>

              <div>
                <Label>Symptoms of the Failure</Label>
                <Textarea
                  value={data.symptoms}
                  onChange={(e) => updateField("symptoms", e.target.value)}
                  placeholder="Describe what was observed when the breakdown occurred..."
                  className="min-h-24"
                  data-testid="input-symptoms"
                />
              </div>

              <div>
                <Label>Initial Observations</Label>
                <Textarea
                  value={data.initialObservations}
                  onChange={(e) => updateField("initialObservations", e.target.value)}
                  placeholder="What did operators/technicians notice first?"
                  className="min-h-24"
                  data-testid="input-observations"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timeline & Downtime
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Breakdown Start</Label>
                  <Input
                    type="time"
                    value={data.breakdownStartTime}
                    onChange={(e) => {
                      updateField("breakdownStartTime", e.target.value);
                      setTimeout(calculateDowntime, 0);
                    }}
                    data-testid="input-breakdown-start"
                  />
                </div>
                <div>
                  <Label>Restoration Start</Label>
                  <Input
                    type="time"
                    value={data.restorationStartTime}
                    onChange={(e) => updateField("restorationStartTime", e.target.value)}
                    data-testid="input-restoration-start"
                  />
                </div>
                <div>
                  <Label>Restoration End</Label>
                  <Input
                    type="time"
                    value={data.restorationEndTime}
                    onChange={(e) => {
                      updateField("restorationEndTime", e.target.value);
                      setTimeout(calculateDowntime, 0);
                    }}
                    data-testid="input-restoration-end"
                  />
                </div>
                <div>
                  <Label>Total Downtime (minutes)</Label>
                  <Input
                    type="number"
                    value={data.totalDowntimeMinutes}
                    onChange={(e) => updateField("totalDowntimeMinutes", parseInt(e.target.value) || 0)}
                    data-testid="input-downtime"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Production Loss (units)</Label>
                  <Input
                    type="number"
                    value={data.productionLossUnits}
                    onChange={(e) => updateField("productionLossUnits", parseInt(e.target.value) || 0)}
                    placeholder="Estimated units lost"
                    data-testid="input-production-loss"
                  />
                </div>
                <div>
                  <Label>Estimated Cost ($)</Label>
                  <Input
                    type="number"
                    value={data.estimatedCost}
                    onChange={(e) => updateField("estimatedCost", parseFloat(e.target.value) || 0)}
                    placeholder="Total cost impact"
                    data-testid="input-cost"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failure Mode & Direct Cause</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Failure Mode</Label>
                <Select value={data.failureMode} onValueChange={(v) => updateField("failureMode", v)}>
                  <SelectTrigger data-testid="select-failure-mode">
                    <SelectValue placeholder="Select failure mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mechanical">Mechanical Failure</SelectItem>
                    <SelectItem value="electrical">Electrical Failure</SelectItem>
                    <SelectItem value="pneumatic">Pneumatic Failure</SelectItem>
                    <SelectItem value="hydraulic">Hydraulic Failure</SelectItem>
                    <SelectItem value="instrumentation">Instrumentation Failure</SelectItem>
                    <SelectItem value="process">Process Deviation</SelectItem>
                    <SelectItem value="material">Material Issue</SelectItem>
                    <SelectItem value="operator">Operator Error</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Direct Cause</Label>
                <Textarea
                  value={data.directCause}
                  onChange={(e) => updateField("directCause", e.target.value)}
                  placeholder="What directly caused the failure? (e.g., bearing seized, belt broke)"
                  className="min-h-24"
                  data-testid="input-direct-cause"
                />
              </div>

              <div>
                <Label>Component Failed</Label>
                <Input
                  value={data.componentFailed}
                  onChange={(e) => updateField("componentFailed", e.target.value)}
                  placeholder="Which specific component failed?"
                  data-testid="input-component-failed"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="why" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>5 Why Analysis</CardTitle>
              <CardDescription>Ask "Why?" repeatedly to find the root cause</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0">Why 1</Badge>
                  <div className="flex-1">
                    <Textarea
                      value={data.whyAnalysis.why1}
                      onChange={(e) => updateWhyAnalysis("why1", e.target.value)}
                      placeholder="Why did the failure occur?"
                      data-testid="input-why1"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0">Why 2</Badge>
                  <div className="flex-1">
                    <Textarea
                      value={data.whyAnalysis.why2}
                      onChange={(e) => updateWhyAnalysis("why2", e.target.value)}
                      placeholder="Why did that happen?"
                      data-testid="input-why2"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0">Why 3</Badge>
                  <div className="flex-1">
                    <Textarea
                      value={data.whyAnalysis.why3}
                      onChange={(e) => updateWhyAnalysis("why3", e.target.value)}
                      placeholder="Why did that happen?"
                      data-testid="input-why3"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0">Why 4</Badge>
                  <div className="flex-1">
                    <Textarea
                      value={data.whyAnalysis.why4}
                      onChange={(e) => updateWhyAnalysis("why4", e.target.value)}
                      placeholder="Why did that happen?"
                      data-testid="input-why4"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0">Why 5</Badge>
                  <div className="flex-1">
                    <Textarea
                      value={data.whyAnalysis.why5}
                      onChange={(e) => updateWhyAnalysis("why5", e.target.value)}
                      placeholder="Why did that happen?"
                      data-testid="input-why5"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="text-primary font-semibold">Root Cause Identified</Label>
                <Textarea
                  value={data.whyAnalysis.rootCause}
                  onChange={(e) => updateWhyAnalysis("rootCause", e.target.value)}
                  placeholder="Based on the 5 Whys, what is the root cause?"
                  className="min-h-24 mt-2"
                  data-testid="input-root-cause"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="4m" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>4M Analysis</CardTitle>
              <CardDescription>Analyze the failure across Man, Machine, Method, and Material categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <Badge>Man</Badge>
                    Human Factors
                  </Label>
                  <Textarea
                    value={data.analysis4M.man}
                    onChange={(e) => update4M("man", e.target.value)}
                    placeholder="Training gaps, skill issues, fatigue, communication..."
                    className="min-h-32 mt-2"
                    data-testid="input-4m-man"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Badge>Machine</Badge>
                    Equipment Factors
                  </Label>
                  <Textarea
                    value={data.analysis4M.machine}
                    onChange={(e) => update4M("machine", e.target.value)}
                    placeholder="Equipment condition, maintenance history, design issues..."
                    className="min-h-32 mt-2"
                    data-testid="input-4m-machine"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Badge>Method</Badge>
                    Process Factors
                  </Label>
                  <Textarea
                    value={data.analysis4M.method}
                    onChange={(e) => update4M("method", e.target.value)}
                    placeholder="SOPs, procedures, work instructions, scheduling..."
                    className="min-h-32 mt-2"
                    data-testid="input-4m-method"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Badge>Material</Badge>
                    Material Factors
                  </Label>
                  <Textarea
                    value={data.analysis4M.material}
                    onChange={(e) => update4M("material", e.target.value)}
                    placeholder="Raw materials, spare parts quality, consumables..."
                    className="min-h-32 mt-2"
                    data-testid="input-4m-material"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Countermeasures & Actions</CardTitle>
              <CardDescription>Define corrective and preventive actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={addCountermeasure} variant="outline" size="sm" data-testid="button-add-countermeasure">
                <Plus className="w-4 h-4 mr-2" />
                Add Countermeasure
              </Button>

              {data.countermeasures.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Action</TableHead>
                      <TableHead>Responsible</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.countermeasures.map(cm => (
                      <TableRow key={cm.id}>
                        <TableCell>
                          <Input
                            value={cm.action}
                            onChange={(e) => updateCountermeasure(cm.id, "action", e.target.value)}
                            placeholder="Describe action..."
                            data-testid={`input-cm-action-${cm.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={cm.responsible}
                            onChange={(e) => updateCountermeasure(cm.id, "responsible", e.target.value)}
                            placeholder="Name"
                            data-testid={`input-cm-responsible-${cm.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={cm.targetDate}
                            onChange={(e) => updateCountermeasure(cm.id, "targetDate", e.target.value)}
                            data-testid={`input-cm-date-${cm.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={cm.status}
                            onValueChange={(v) => updateCountermeasure(cm.id, "status", v)}
                          >
                            <SelectTrigger data-testid={`select-cm-status-${cm.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCountermeasure(cm.id)}
                            data-testid={`button-remove-cm-${cm.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sign-off</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Technician Name</Label>
                  <Input
                    value={data.technicianName}
                    onChange={(e) => updateField("technicianName", e.target.value)}
                    placeholder="Who completed restoration?"
                    data-testid="input-technician"
                  />
                </div>
                <div>
                  <Label>Supervisor Name</Label>
                  <Input
                    value={data.supervisorName}
                    onChange={(e) => updateField("supervisorName", e.target.value)}
                    placeholder="Supervisor sign-off"
                    data-testid="input-supervisor"
                  />
                </div>
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={data.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Any additional observations or follow-up notes..."
                  className="min-h-24"
                  data-testid="input-notes"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
