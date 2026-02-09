import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Users, Eye, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface InterviewResponse {
  id: string;
  leaderName: string;
  role: string;
  date: string;
  competencyArea: string;
  question: string;
  response: string;
  strengthsObserved: string;
  developmentAreas: string;
  actionPlan: string;
}

interface Observation {
  id: string;
  date: string;
  time: string;
  leaderObserved: string;
  location: string;
  category: string;
  focusArea: string;
  observationNotes: string;
  positiveExamples: string;
  improvementOpportunities: string;
  followUp: string;
}

interface LeadershipData {
  interviews: InterviewResponse[];
  observations: Observation[];
}

interface LeadershipFormProps {
  step: number;
  checklistItemId: string;
  formType: "interview" | "observation";
  onDismiss?: () => void;
}

const competencyAreas = [
  "Strategic Thinking",
  "Team Leadership",
  "Communication",
  "Problem Solving",
  "Change Management",
  "Technical Knowledge",
  "Coaching & Development",
  "Safety Leadership",
  "Continuous Improvement",
  "Stakeholder Management"
];

const observationCategories = [
  "Daily Huddle & Communication",
  "Floor Interactions and Supervision",
  "Performance and Accountability",
  "Problem Solving Response",
  "Safety Practices",
  "Team Engagement"
];

export function LeadershipForm({ step, checklistItemId, formType, onDismiss }: LeadershipFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<LeadershipData>({ interviews: [], observations: [] });
  const [deliverableId, setDeliverableId] = useState<string | null>(null);

  const deliverableType = formType === "interview" ? "leadership_interview" : "leadership_observation";

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === deliverableType
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as LeadershipData;
        setData(payload || { interviews: [], observations: [] });
      }
    }
  }, [deliverables, step, checklistItemId, deliverableType]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: LeadershipData): Promise<ExcellenceDeliverable> => {
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: dataToSave,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType,
          title: formType === "interview" ? "Leadership Development Interview" : "Leadership Observations",
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
        title: "Saved successfully",
        description: formType === "interview" ? "Interview records saved." : "Observations saved.",
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

  // Interview functions
  const addInterview = () => {
    const newInterview: InterviewResponse = {
      id: crypto.randomUUID(),
      leaderName: "",
      role: "",
      date: new Date().toISOString().split("T")[0],
      competencyArea: "",
      question: "",
      response: "",
      strengthsObserved: "",
      developmentAreas: "",
      actionPlan: ""
    };
    setData(prev => ({ ...prev, interviews: [...prev.interviews, newInterview] }));
  };

  const updateInterview = (id: string, field: keyof InterviewResponse, value: string) => {
    setData(prev => ({
      ...prev,
      interviews: prev.interviews.map(i => i.id === id ? { ...i, [field]: value } : i)
    }));
  };

  const removeInterview = (id: string) => {
    setData(prev => ({
      ...prev,
      interviews: prev.interviews.filter(i => i.id !== id)
    }));
  };

  // Observation functions
  const addObservation = () => {
    const newObs: Observation = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      time: "",
      leaderObserved: "",
      location: "",
      category: "",
      focusArea: "",
      observationNotes: "",
      positiveExamples: "",
      improvementOpportunities: "",
      followUp: ""
    };
    setData(prev => ({ ...prev, observations: [...prev.observations, newObs] }));
  };

  const updateObservation = (id: string, field: keyof Observation, value: string) => {
    setData(prev => ({
      ...prev,
      observations: prev.observations.map(o => o.id === id ? { ...o, [field]: value } : o)
    }));
  };

  const removeObservation = (id: string) => {
    setData(prev => ({
      ...prev,
      observations: prev.observations.filter(o => o.id !== id)
    }));
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {formType === "interview" ? (
              <>
                <ClipboardList className="w-5 h-5 text-primary" />
                Leadership Development Interview
              </>
            ) : (
              <>
                <Eye className="w-5 h-5 text-primary" />
                Leadership Observations (Gemba)
              </>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formType === "interview" 
              ? "Document structured interviews for assessing and developing leadership" 
              : "Record leadership behaviors and development opportunities from floor observations"}
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(data)}
          disabled={saveMutation.isPending}
          data-testid="button-save-leadership"
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>

      {formType === "interview" ? (
        <div className="space-y-4">
          <Button onClick={addInterview} variant="outline" data-testid="button-add-interview">
            <Plus className="w-4 h-4 mr-2" />
            Add Interview Record
          </Button>

          {data.interviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No interview records yet. Click "Add Interview Record" to start documenting leadership assessments.
              </CardContent>
            </Card>
          ) : (
            data.interviews.map((interview, idx) => (
              <Card key={interview.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Interview #{idx + 1}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInterview(interview.id)}
                      data-testid={`button-remove-interview-${interview.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Leader Name</Label>
                      <Input
                        value={interview.leaderName}
                        onChange={(e) => updateInterview(interview.id, "leaderName", e.target.value)}
                        placeholder="Name"
                        data-testid={`input-leader-name-${interview.id}`}
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Input
                        value={interview.role}
                        onChange={(e) => updateInterview(interview.id, "role", e.target.value)}
                        placeholder="Job title"
                        data-testid={`input-role-${interview.id}`}
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={interview.date}
                        onChange={(e) => updateInterview(interview.id, "date", e.target.value)}
                        data-testid={`input-date-${interview.id}`}
                      />
                    </div>
                    <div>
                      <Label>Competency Area</Label>
                      <Select
                        value={interview.competencyArea}
                        onValueChange={(v) => updateInterview(interview.id, "competencyArea", v)}
                      >
                        <SelectTrigger data-testid={`select-competency-${interview.id}`}>
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent>
                          {competencyAreas.map(area => (
                            <SelectItem key={area} value={area}>{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Interview Question</Label>
                    <Textarea
                      value={interview.question}
                      onChange={(e) => updateInterview(interview.id, "question", e.target.value)}
                      placeholder="What question was asked?"
                      className="min-h-16"
                      data-testid={`input-question-${interview.id}`}
                    />
                  </div>

                  <div>
                    <Label>Response Summary</Label>
                    <Textarea
                      value={interview.response}
                      onChange={(e) => updateInterview(interview.id, "response", e.target.value)}
                      placeholder="Key points from their response..."
                      className="min-h-24"
                      data-testid={`input-response-${interview.id}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-green-600">Strengths Observed</Label>
                      <Textarea
                        value={interview.strengthsObserved}
                        onChange={(e) => updateInterview(interview.id, "strengthsObserved", e.target.value)}
                        placeholder="What strengths were demonstrated?"
                        className="min-h-20"
                        data-testid={`input-strengths-${interview.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-orange-600">Development Areas</Label>
                      <Textarea
                        value={interview.developmentAreas}
                        onChange={(e) => updateInterview(interview.id, "developmentAreas", e.target.value)}
                        placeholder="Areas for improvement..."
                        className="min-h-20"
                        data-testid={`input-development-${interview.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-primary">Action Plan</Label>
                      <Textarea
                        value={interview.actionPlan}
                        onChange={(e) => updateInterview(interview.id, "actionPlan", e.target.value)}
                        placeholder="Next steps and development actions..."
                        className="min-h-20"
                        data-testid={`input-action-plan-${interview.id}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Button onClick={addObservation} variant="outline" data-testid="button-add-observation">
            <Plus className="w-4 h-4 mr-2" />
            Add Observation
          </Button>

          {data.observations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No observations yet. Click "Add Observation" to start documenting leadership behaviors.
              </CardContent>
            </Card>
          ) : (
            data.observations.map((obs, idx) => (
              <Card key={obs.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Observation #{idx + 1}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeObservation(obs.id)}
                      data-testid={`button-remove-obs-${obs.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={obs.date}
                        onChange={(e) => updateObservation(obs.id, "date", e.target.value)}
                        data-testid={`input-obs-date-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={obs.time}
                        onChange={(e) => updateObservation(obs.id, "time", e.target.value)}
                        data-testid={`input-obs-time-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label>Leader Observed</Label>
                      <Input
                        value={obs.leaderObserved}
                        onChange={(e) => updateObservation(obs.id, "leaderObserved", e.target.value)}
                        placeholder="Name"
                        data-testid={`input-obs-leader-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={obs.location}
                        onChange={(e) => updateObservation(obs.id, "location", e.target.value)}
                        placeholder="Where observed"
                        data-testid={`input-obs-location-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={obs.category}
                        onValueChange={(v) => updateObservation(obs.id, "category", v)}
                      >
                        <SelectTrigger data-testid={`select-obs-category-${obs.id}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {observationCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Focus Area</Label>
                    <Input
                      value={obs.focusArea}
                      onChange={(e) => updateObservation(obs.id, "focusArea", e.target.value)}
                      placeholder="What specific behavior or skill was the focus?"
                      data-testid={`input-obs-focus-${obs.id}`}
                    />
                  </div>

                  <div>
                    <Label>Observation Notes</Label>
                    <Textarea
                      value={obs.observationNotes}
                      onChange={(e) => updateObservation(obs.id, "observationNotes", e.target.value)}
                      placeholder="Detailed notes about what was observed..."
                      className="min-h-24"
                      data-testid={`input-obs-notes-${obs.id}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-green-600">Positive Examples</Label>
                      <Textarea
                        value={obs.positiveExamples}
                        onChange={(e) => updateObservation(obs.id, "positiveExamples", e.target.value)}
                        placeholder="What went well?"
                        className="min-h-20"
                        data-testid={`input-obs-positive-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-orange-600">Improvement Opportunities</Label>
                      <Textarea
                        value={obs.improvementOpportunities}
                        onChange={(e) => updateObservation(obs.id, "improvementOpportunities", e.target.value)}
                        placeholder="What could be improved?"
                        className="min-h-20"
                        data-testid={`input-obs-improve-${obs.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-primary">Follow-Up Actions</Label>
                      <Textarea
                        value={obs.followUp}
                        onChange={(e) => updateObservation(obs.id, "followUp", e.target.value)}
                        placeholder="Next steps or coaching points..."
                        className="min-h-20"
                        data-testid={`input-obs-followup-${obs.id}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
