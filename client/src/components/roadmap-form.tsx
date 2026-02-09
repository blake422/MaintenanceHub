import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Save, Map, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface Activity {
  id: string;
  description: string;
  owner: string;
  targetDate: string;
  completed: boolean;
}

interface Phase {
  id: string;
  name: string;
  objectives: string;
  activities: Activity[];
  toolsResources: string;
  timeline: string;
  roadblocksMitigations: string;
}

interface RoadmapData {
  projectName: string;
  facilityName: string;
  startDate: string;
  phases: Phase[];
}

interface RoadmapFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const defaultPhases: Phase[] = [
  {
    id: "1",
    name: "Phase 1: Preparation and Entry",
    objectives: "Establish rapport, align scope, gather intel",
    activities: [],
    toolsResources: "",
    timeline: "Week 1-2",
    roadblocksMitigations: ""
  },
  {
    id: "2",
    name: "Phase 2: Initial Assessment and Baseline",
    objectives: "Capture baseline across teams, diagnose current state",
    activities: [],
    toolsResources: "",
    timeline: "Week 2-4",
    roadblocksMitigations: ""
  },
  {
    id: "3",
    name: "Phase 3: Roadblock Analysis",
    objectives: "Pinpoint barriers through deep-dive root causes",
    activities: [],
    toolsResources: "",
    timeline: "Week 4-6",
    roadblocksMitigations: ""
  },
  {
    id: "4",
    name: "Phase 4: Plan Development",
    objectives: "Co-create strategies and design phased plans",
    activities: [],
    toolsResources: "",
    timeline: "Week 6-8",
    roadblocksMitigations: ""
  },
  {
    id: "5",
    name: "Phase 5: Implementation and Support",
    objectives: "Execute changes with guidance and on-floor coaching",
    activities: [],
    toolsResources: "",
    timeline: "Week 8-12+",
    roadblocksMitigations: ""
  },
  {
    id: "6",
    name: "Phase 6: Evaluation and Handover",
    objectives: "Measure impact, solidify gains, transition ownership",
    activities: [],
    toolsResources: "",
    timeline: "Final weeks",
    roadblocksMitigations: ""
  }
];

const emptyRoadmap: RoadmapData = {
  projectName: "Maintenance Excellence Implementation",
  facilityName: "",
  startDate: "",
  phases: defaultPhases
};

export function RoadmapForm({ step, checklistItemId, onDismiss }: RoadmapFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<RoadmapData>(emptyRoadmap);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "roadmap_initialization"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as RoadmapData;
        setData(payload || emptyRoadmap);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: RoadmapData): Promise<ExcellenceDeliverable> => {
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "roadmap_initialization",
          title: "Roadmap for Initialization",
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
        title: "Roadmap saved",
        description: "Implementation roadmap saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save roadmap. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updatePhase = (phaseId: string, field: keyof Phase, value: any) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map(phase =>
        phase.id === phaseId ? { ...phase, [field]: value } : phase
      )
    }));
  };

  const addActivity = (phaseId: string) => {
    const newActivity: Activity = {
      id: crypto.randomUUID(),
      description: "",
      owner: "",
      targetDate: "",
      completed: false
    };
    setData(prev => ({
      ...prev,
      phases: prev.phases.map(phase =>
        phase.id === phaseId
          ? { ...phase, activities: [...phase.activities, newActivity] }
          : phase
      )
    }));
  };

  const updateActivity = (phaseId: string, activityId: string, field: keyof Activity, value: any) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map(phase =>
        phase.id === phaseId
          ? {
              ...phase,
              activities: phase.activities.map(act =>
                act.id === activityId ? { ...act, [field]: value } : act
              )
            }
          : phase
      )
    }));
  };

  const removeActivity = (phaseId: string, activityId: string) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map(phase =>
        phase.id === phaseId
          ? { ...phase, activities: phase.activities.filter(act => act.id !== activityId) }
          : phase
      )
    }));
  };

  const calculatePhaseProgress = (phase: Phase) => {
    if (phase.activities.length === 0) return 0;
    const completed = phase.activities.filter(a => a.completed).length;
    return Math.round((completed / phase.activities.length) * 100);
  };

  const overallProgress = () => {
    const allActivities = data.phases.flatMap(p => p.activities);
    if (allActivities.length === 0) return 0;
    const completed = allActivities.filter(a => a.completed).length;
    return Math.round((completed / allActivities.length) * 100);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            Roadmap for Initialization
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Plan and track your maintenance excellence implementation journey
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(data)}
          disabled={saveMutation.isPending}
          data-testid="button-save-roadmap"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Roadmap
        </Button>
      </div>

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Project Name</Label>
              <Input
                value={data.projectName}
                onChange={(e) => setData(prev => ({ ...prev, projectName: e.target.value }))}
                placeholder="Implementation project name"
                data-testid="input-project-name"
              />
            </div>
            <div>
              <Label>Facility Name</Label>
              <Input
                value={data.facilityName}
                onChange={(e) => setData(prev => ({ ...prev, facilityName: e.target.value }))}
                placeholder="Plant/facility name"
                data-testid="input-facility-name"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={data.startDate}
                onChange={(e) => setData(prev => ({ ...prev, startDate: e.target.value }))}
                data-testid="input-start-date"
              />
            </div>
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Overall Progress</Label>
              <span className="text-sm font-bold">{overallProgress()}%</span>
            </div>
            <Progress value={overallProgress()} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      <Accordion type="multiple" defaultValue={["1"]} className="space-y-4">
        {data.phases.map((phase) => {
          const progress = calculatePhaseProgress(phase);
          return (
            <AccordionItem key={phase.id} value={phase.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={progress === 100 ? "default" : "outline"}>
                      {progress === 100 ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}
                      {phase.timeline}
                    </Badge>
                    <span className="font-semibold">{phase.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="w-20 h-2" />
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div>
                    <Label>Objectives</Label>
                    <Textarea
                      value={phase.objectives}
                      onChange={(e) => updatePhase(phase.id, "objectives", e.target.value)}
                      placeholder="What are the objectives for this phase?"
                      className="mt-1"
                      data-testid={`input-objectives-${phase.id}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tools & Resources</Label>
                      <Textarea
                        value={phase.toolsResources}
                        onChange={(e) => updatePhase(phase.id, "toolsResources", e.target.value)}
                        placeholder="Required tools, templates, resources..."
                        className="mt-1"
                        data-testid={`input-tools-${phase.id}`}
                      />
                    </div>
                    <div>
                      <Label>Roadblocks & Mitigations</Label>
                      <Textarea
                        value={phase.roadblocksMitigations}
                        onChange={(e) => updatePhase(phase.id, "roadblocksMitigations", e.target.value)}
                        placeholder="Potential roadblocks and how to address them..."
                        className="mt-1"
                        data-testid={`input-roadblocks-${phase.id}`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Activities</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addActivity(phase.id)}
                        data-testid={`button-add-activity-${phase.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Activity
                      </Button>
                    </div>

                    {phase.activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center border rounded">
                        No activities defined. Add activities to track progress.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {phase.activities.map(activity => (
                          <div
                            key={activity.id}
                            className={`flex items-center gap-3 p-3 border rounded ${
                              activity.completed ? 'bg-muted' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activity.completed}
                              onChange={(e) => updateActivity(phase.id, activity.id, "completed", e.target.checked)}
                              className="w-4 h-4"
                              data-testid={`checkbox-activity-${activity.id}`}
                            />
                            <Input
                              value={activity.description}
                              onChange={(e) => updateActivity(phase.id, activity.id, "description", e.target.value)}
                              placeholder="Activity description"
                              className={`flex-1 ${activity.completed ? 'line-through text-muted-foreground' : ''}`}
                              data-testid={`input-activity-desc-${activity.id}`}
                            />
                            <Input
                              value={activity.owner}
                              onChange={(e) => updateActivity(phase.id, activity.id, "owner", e.target.value)}
                              placeholder="Owner"
                              className="w-32"
                              data-testid={`input-activity-owner-${activity.id}`}
                            />
                            <Input
                              type="date"
                              value={activity.targetDate}
                              onChange={(e) => updateActivity(phase.id, activity.id, "targetDate", e.target.value)}
                              className="w-36"
                              data-testid={`input-activity-date-${activity.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeActivity(phase.id, activity.id)}
                              data-testid={`button-remove-activity-${activity.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
