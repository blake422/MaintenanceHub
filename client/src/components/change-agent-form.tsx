import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Save, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface WeekStrategy {
  week: string;
  objectives: string;
  keyActivities: string;
  toolsResources: string;
  milestones: string;
  roadblocks: string;
}

interface AssessmentArea {
  id: string;
  area: string;
  subtopic: string;
  weight: number;
  criteria: string;
  score: number;
  rationale: string;
  weeklyActions: string;
}

interface ChangeAgentData {
  strategy: WeekStrategy[];
  assessments: AssessmentArea[];
}

interface ChangeAgentFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const defaultStrategy: WeekStrategy[] = [
  {
    week: "Week 1: Assessment & Team Reset",
    objectives: "Stabilize consulting team; gain union/leadership alignment; identify top 3-5 immediate roadblocks",
    keyActivities: "",
    toolsResources: "",
    milestones: "",
    roadblocks: ""
  },
  {
    week: "Week 2: Deep Dive & Prioritization",
    objectives: "Pinpoint 5-7 core roadblocks; co-prioritize actions; start coaching",
    keyActivities: "",
    toolsResources: "",
    milestones: "",
    roadblocks: ""
  },
  {
    week: "Week 3: Quick Wins Implementation",
    objectives: "Roll out 3-4 quick wins to boost OEE; coach leadership; build momentum",
    keyActivities: "",
    toolsResources: "",
    milestones: "",
    roadblocks: ""
  },
  {
    week: "Week 4: Full Rollout & Support",
    objectives: "Expand to full site; embed leadership training; tackle deeper issues",
    keyActivities: "",
    toolsResources: "",
    milestones: "",
    roadblocks: ""
  },
  {
    week: "Week 5: Evaluation & Handover",
    objectives: "Quantify OEE uplift; report to plant manager; empower teams for sustainability",
    keyActivities: "",
    toolsResources: "",
    milestones: "",
    roadblocks: ""
  }
];

const defaultAssessments: AssessmentArea[] = [
  { id: "1", area: "Operations", subtopic: "Process Efficiency & Bottlenecks", weight: 15, criteria: "Alignment with strategy, quick win opportunities ID'd", score: 0, rationale: "", weeklyActions: "" },
  { id: "2", area: "Operations", subtopic: "Safety & Compliance", weight: 10, criteria: "Adherence to protocols, union-aligned checks", score: 0, rationale: "", weeklyActions: "" },
  { id: "3", area: "Operations", subtopic: "Team Engagement & Morale", weight: 10, criteria: "Ops team input on issues, cross-functional synergy", score: 0, rationale: "", weeklyActions: "" },
  { id: "4", area: "Leadership", subtopic: "Strategy Alignment & Vision", weight: 12, criteria: "Leaders' ability to align teams with OEE goals", score: 0, rationale: "", weeklyActions: "" },
  { id: "5", area: "Leadership", subtopic: "Communication & Transparency", weight: 10, criteria: "Clear, consistent messaging; information flow", score: 0, rationale: "", weeklyActions: "" },
  { id: "6", area: "Leadership", subtopic: "Decision-Making & Accountability", weight: 8, criteria: "Timely decisions with clear ownership", score: 0, rationale: "", weeklyActions: "" },
  { id: "7", area: "Maintenance", subtopic: "PM Execution & Reliability", weight: 12, criteria: "PM compliance, equipment uptime, MTBF trends", score: 0, rationale: "", weeklyActions: "" },
  { id: "8", area: "Maintenance", subtopic: "Work Order Management", weight: 8, criteria: "Backlog management, scheduling effectiveness", score: 0, rationale: "", weeklyActions: "" },
  { id: "9", area: "Union/Culture", subtopic: "Union Relations", weight: 8, criteria: "Collaborative discussions, grievance resolution", score: 0, rationale: "", weeklyActions: "" },
  { id: "10", area: "Union/Culture", subtopic: "Change Readiness", weight: 7, criteria: "Openness to new methods, training participation", score: 0, rationale: "", weeklyActions: "" }
];

export function ChangeAgentForm({ step, checklistItemId, onDismiss }: ChangeAgentFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<ChangeAgentData>({
    strategy: defaultStrategy,
    assessments: defaultAssessments
  });
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "change_agent_strategy"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as ChangeAgentData;
        setData(payload || { strategy: defaultStrategy, assessments: defaultAssessments });
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: ChangeAgentData): Promise<ExcellenceDeliverable> => {
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "change_agent_strategy",
          title: "Change-Agent Strategy and Scoring",
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
        title: "Change Agent Strategy saved",
        description: "Strategy and assessments saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateStrategy = (index: number, field: keyof WeekStrategy, value: string) => {
    setData(prev => ({
      ...prev,
      strategy: prev.strategy.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    }));
  };

  const updateAssessment = (id: string, field: keyof AssessmentArea, value: any) => {
    setData(prev => ({
      ...prev,
      assessments: prev.assessments.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      )
    }));
  };

  const calculateWeightedScore = () => {
    const totalWeight = data.assessments.reduce((sum, a) => sum + a.weight, 0);
    const weightedSum = data.assessments.reduce((sum, a) => sum + (a.score * a.weight), 0);
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Change-Agent Strategy and Scoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Plan your change management strategy and assess organizational readiness
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(data)}
          disabled={saveMutation.isPending}
          data-testid="button-save-change-agent"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Strategy
        </Button>
      </div>

      <Tabs defaultValue="strategy" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="strategy">Weekly Strategy</TabsTrigger>
          <TabsTrigger value="assessment">Assessment Scoring</TabsTrigger>
        </TabsList>

        <TabsContent value="strategy" className="space-y-4">
          {data.strategy.map((week, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{week.week}</CardTitle>
                <CardDescription>{week.objectives}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Key Activities</Label>
                    <Textarea
                      value={week.keyActivities}
                      onChange={(e) => updateStrategy(index, "keyActivities", e.target.value)}
                      placeholder="List key activities for this week..."
                      className="min-h-20 mt-1"
                      data-testid={`input-activities-${index}`}
                    />
                  </div>
                  <div>
                    <Label>Tools & Resources</Label>
                    <Textarea
                      value={week.toolsResources}
                      onChange={(e) => updateStrategy(index, "toolsResources", e.target.value)}
                      placeholder="Required tools, templates, support..."
                      className="min-h-20 mt-1"
                      data-testid={`input-tools-${index}`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Milestones & KPIs</Label>
                    <Textarea
                      value={week.milestones}
                      onChange={(e) => updateStrategy(index, "milestones", e.target.value)}
                      placeholder="Key milestones and metrics..."
                      className="min-h-20 mt-1"
                      data-testid={`input-milestones-${index}`}
                    />
                  </div>
                  <div>
                    <Label>Roadblocks & Mitigations</Label>
                    <Textarea
                      value={week.roadblocks}
                      onChange={(e) => updateStrategy(index, "roadblocks", e.target.value)}
                      placeholder="Potential issues and how to address..."
                      className="min-h-20 mt-1"
                      data-testid={`input-roadblocks-${index}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="assessment" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Overall Readiness Score
                  </CardTitle>
                  <CardDescription>Weighted average across all assessment areas</CardDescription>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getScoreColor(calculateWeightedScore())}`}>
                    {calculateWeightedScore()}%
                  </div>
                  <Progress value={calculateWeightedScore()} className="w-32 h-2 mt-1" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Area</TableHead>
                      <TableHead className="w-[150px]">Subtopic</TableHead>
                      <TableHead className="w-[60px]">Weight</TableHead>
                      <TableHead className="w-[200px]">Criteria</TableHead>
                      <TableHead className="w-[80px]">Score (0-100)</TableHead>
                      <TableHead className="w-[200px]">Rationale</TableHead>
                      <TableHead className="w-[200px]">Weekly Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assessments.map(assessment => (
                      <TableRow key={assessment.id}>
                        <TableCell>
                          <Badge variant="outline">{assessment.area}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {assessment.subtopic}
                        </TableCell>
                        <TableCell className="text-center">
                          {assessment.weight}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {assessment.criteria}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={assessment.score}
                            onChange={(e) => updateAssessment(assessment.id, "score", parseInt(e.target.value) || 0)}
                            className="w-16"
                            data-testid={`input-score-${assessment.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={assessment.rationale}
                            onChange={(e) => updateAssessment(assessment.id, "rationale", e.target.value)}
                            placeholder="Why this score?"
                            className="min-h-16 text-xs"
                            data-testid={`input-rationale-${assessment.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={assessment.weeklyActions}
                            onChange={(e) => updateAssessment(assessment.id, "weeklyActions", e.target.value)}
                            placeholder="Actions to improve"
                            className="min-h-16 text-xs"
                            data-testid={`input-actions-${assessment.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
