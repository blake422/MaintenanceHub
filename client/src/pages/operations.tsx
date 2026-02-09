import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  CheckCircle2, 
  Camera, 
  X, 
  Clock, 
  Wrench,
  Droplet,
  Eye,
  Hammer,
  Ruler,
  CheckSquare,
  Plus,
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertTriangle,
  Target,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Zap,
  TrendingUp,
  Shield,
  Settings,
} from "lucide-react";
import type { CilrTemplate, CilrTemplateTask, CilrRun, CilrTaskCompletion, CilrTaskMedia, Equipment } from "@shared/schema";

interface RunWithDetails extends CilrRun {
  template?: CilrTemplate;
  tasks?: CilrTemplateTask[];
  completions?: (CilrTaskCompletion & { media?: CilrTaskMedia[] })[];
}

interface TemplateWithTasks extends CilrTemplate {
  tasks?: CilrTemplateTask[];
}

interface AIGuidance {
  suggestion: string;
  safetyTips?: string[];
  commonIssues?: string[];
  bestPractices?: string[];
}

const taskTypeIcons: Record<string, typeof Wrench> = {
  clean: Droplet,
  inspect: Eye,
  lubricate: Droplet,
  repair: Hammer,
  measure: Ruler,
  verify: CheckSquare,
};

const taskTypeColors: Record<string, string> = {
  clean: "bg-blue-500",
  inspect: "bg-purple-500",
  lubricate: "bg-amber-500",
  repair: "bg-red-500",
  measure: "bg-green-500",
  verify: "bg-teal-500",
};

const taskTypeBgColors: Record<string, string> = {
  clean: "bg-blue-50 dark:bg-blue-950",
  inspect: "bg-purple-50 dark:bg-purple-950",
  lubricate: "bg-amber-50 dark:bg-amber-950",
  repair: "bg-red-50 dark:bg-red-950",
  measure: "bg-green-50 dark:bg-green-950",
  verify: "bg-teal-50 dark:bg-teal-950",
};

export default function Operations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("start");
  const [activeRun, setActiveRun] = useState<RunWithDetails | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [measuredValues, setMeasuredValues] = useState<Record<string, string>>({});
  const [showAIHelp, setShowAIHelp] = useState(false);
  const [aiGuidance, setAIGuidance] = useState<AIGuidance | null>(null);
  const [aiLoading, setAILoading] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateWithTasks[]>({
    queryKey: ["/api/cilr/templates"],
  });

  const { data: myRuns = [], isLoading: runsLoading } = useQuery<CilrRun[]>({
    queryKey: ["/api/cilr/runs/my"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/cilr/seed-defaults", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/templates"] });
      toast({ title: "Templates created", description: "Default CILR and Centerline templates are now available" });
    },
    onError: () => {
      toast({ title: "Failed to create templates", variant: "destructive" });
    },
  });

  const startRunMutation = useMutation({
    mutationFn: async (templateId: string): Promise<CilrRun> => {
      const res = await apiRequest("/api/cilr/runs", {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      return res.json();
    },
    onSuccess: async (run: CilrRun) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/runs/my"] });
      const res = await apiRequest(`/api/cilr/runs/${run.id}`);
      const runDetails = await res.json();
      setActiveRun(runDetails);
      setCurrentTaskIndex(0);
      setActiveTab("my-runs");
      toast({ title: "Checklist started", description: "Complete each task step by step" });
    },
    onError: () => {
      toast({ title: "Failed to start", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ runId, taskId, measuredValue, notes }: { runId: string; taskId: string; measuredValue?: string; notes?: string }): Promise<CilrTaskCompletion> => {
      const res = await apiRequest(`/api/cilr/runs/${runId}/completions`, {
        method: "POST",
        body: JSON.stringify({ taskId, isCompleted: true, measuredValue, notes }),
      });
      return res.json();
    },
    onSuccess: async () => {
      if (activeRun) {
        const res = await apiRequest(`/api/cilr/runs/${activeRun.id}`);
        const runDetails = await res.json();
        setActiveRun(runDetails);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/runs/my"] });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async ({ completionId, file }: { completionId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/cilr/completions/${completionId}/media`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: async () => {
      setCapturedImage(null);
      if (activeRun) {
        const res = await apiRequest(`/api/cilr/runs/${activeRun.id}`);
        const runDetails = await res.json();
        setActiveRun(runDetails);
      }
      toast({ title: "Photo uploaded", description: "Evidence captured successfully" });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const completeRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest(`/api/cilr/runs/${runId}/complete`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      setActiveRun(null);
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/runs/my"] });
      toast({ 
        title: "Checklist complete!", 
        description: "Great work! All tasks verified and recorded.",
      });
    },
    onError: () => {
      toast({ title: "Failed to complete", variant: "destructive" });
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch {
      toast({ title: "Camera access denied", variant: "destructive" });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `task-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
          setCapturedImage(file);
          stopCamera();
        }
      }, "image/jpeg", 0.9);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedImage(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!capturedImage || !activeRun || !activeRun.tasks) return;

    const currentTask = activeRun.tasks[currentTaskIndex];
    let completion = activeRun.completions?.find(c => c.taskId === currentTask.id);

    if (!completion) {
      completion = await completeTaskMutation.mutateAsync({
        runId: activeRun.id,
        taskId: currentTask.id,
        measuredValue: measuredValues[currentTask.id],
        notes: taskNotes[currentTask.id],
      });
    }

    await uploadMediaMutation.mutateAsync({ completionId: completion.id, file: capturedImage });
  };

  const handleCompleteTask = async () => {
    if (!activeRun || !activeRun.tasks) return;

    const currentTask = activeRun.tasks[currentTaskIndex];
    await completeTaskMutation.mutateAsync({
      runId: activeRun.id,
      taskId: currentTask.id,
      measuredValue: measuredValues[currentTask.id],
      notes: taskNotes[currentTask.id],
    });

    if (currentTaskIndex < activeRun.tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    }
  };

  const isTaskCompleted = (taskId: string) => {
    return activeRun?.completions?.some(c => c.taskId === taskId && c.isCompleted);
  };

  const getTaskMedia = (taskId: string) => {
    const completion = activeRun?.completions?.find(c => c.taskId === taskId);
    return completion?.media || [];
  };

  const allTasksCompleted = () => {
    if (!activeRun?.tasks || !activeRun.completions) return false;
    return activeRun.tasks.every(task => 
      activeRun.completions?.some(c => c.taskId === task.id && c.isCompleted)
    );
  };

  const getSpecStatus = (task: CilrTemplateTask, value: string): "pass" | "fail" | "neutral" => {
    if (!value || (!task.minValue && !task.maxValue)) return "neutral";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "neutral";
    const min = task.minValue ? parseFloat(task.minValue) : -Infinity;
    const max = task.maxValue ? parseFloat(task.maxValue) : Infinity;
    return numValue >= min && numValue <= max ? "pass" : "fail";
  };

  const getAIGuidance = async (task: CilrTemplateTask) => {
    setAILoading(true);
    setShowAIHelp(true);
    try {
      const res = await apiRequest("/api/cilr/ai-guidance", {
        method: "POST",
        body: JSON.stringify({
          taskType: task.taskType,
          taskName: task.name,
          description: task.description,
          instructions: task.instructions,
        }),
      });
      const data = await res.json();
      setAIGuidance(data);
    } catch {
      setAIGuidance({
        suggestion: `For ${task.taskType} tasks like "${task.name}", ensure you follow proper procedures and document any observations.`,
        safetyTips: ["Wear appropriate PPE", "Lock out/tag out if needed", "Check for hazards first"],
        bestPractices: ["Take clear photos", "Note any abnormalities", "Complete all required fields"],
      });
    }
    setAILoading(false);
  };

  const activeTemplates = templates.filter(t => t.isActive);
  const cilrTemplates = activeTemplates.filter(t => t.templateType === "cilr");
  const centerlineTemplates = activeTemplates.filter(t => t.templateType === "centerline");
  const inProgressRuns = myRuns.filter(r => r.status === "in_progress");
  const completedRuns = myRuns.filter(r => r.status === "completed");

  // Active Run View - World-class mobile-first experience
  if (activeRun && activeRun.tasks) {
    const currentTask = activeRun.tasks[currentTaskIndex];
    const Icon = taskTypeIcons[currentTask?.taskType || "inspect"] || Eye;
    const completedCount = activeRun.completions?.filter(c => c.isCompleted).length || 0;
    const taskMedia = getTaskMedia(currentTask?.id);
    const progressPercent = (completedCount / activeRun.tasks.length) * 100;
    const specStatus = currentTask && measuredValues[currentTask.id] 
      ? getSpecStatus(currentTask, measuredValues[currentTask.id])
      : "neutral";

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
        {/* Header with progress */}
        <div className="border-b bg-card">
          <div className="flex items-center gap-3 p-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveRun(null)} data-testid="button-back-to-list">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{activeRun.template?.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{completedCount}/{activeRun.tasks.length} complete</span>
                <span>·</span>
                <span>Task {currentTaskIndex + 1}</span>
              </div>
            </div>
            {allTasksCompleted() && (
              <Button 
                onClick={() => completeRunMutation.mutate(activeRun.id)}
                disabled={completeRunMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-finish-run"
              >
                {completeRunMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finish
                  </>
                )}
              </Button>
            )}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Task navigation dots */}
        <div className="flex gap-1.5 p-3 bg-muted/30 overflow-x-auto">
          {activeRun.tasks.map((task, idx) => {
            const isComplete = isTaskCompleted(task.id);
            const isCurrent = idx === currentTaskIndex;
            return (
              <button
                key={task.id}
                onClick={() => setCurrentTaskIndex(idx)}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isCurrent 
                    ? `${taskTypeColors[task.taskType || "inspect"]} text-white shadow-lg scale-110` 
                    : isComplete
                      ? "bg-green-500 text-white"
                      : "bg-card border-2 border-muted-foreground/20 text-muted-foreground"
                }`}
                data-testid={`button-task-nav-${idx}`}
              >
                {isComplete && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </button>
            );
          })}
        </div>

        {/* Main task content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 pb-32">
            {/* Task card */}
            <Card className={`${taskTypeBgColors[currentTask?.taskType || "inspect"]} border-2`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${taskTypeColors[currentTask?.taskType || "inspect"]} text-white shadow-lg`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="capitalize font-normal">
                        {currentTask?.taskType}
                      </Badge>
                      {currentTask?.photoRequired && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <Camera className="h-3 w-3 mr-1" />
                          Photo
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl leading-tight">{currentTask?.name}</CardTitle>
                  </div>
                  {isTaskCompleted(currentTask?.id) && (
                    <div className="bg-green-500 text-white p-2 rounded-full">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentTask?.description && (
                  <p className="text-muted-foreground">{currentTask.description}</p>
                )}
                
                {currentTask?.instructions && (
                  <div className="bg-background/80 backdrop-blur p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Instructions
                    </div>
                    <p className="text-sm">{currentTask.instructions}</p>
                  </div>
                )}

                {/* AI Assistant Button */}
                <Button
                  variant="outline"
                  onClick={() => getAIGuidance(currentTask)}
                  className="w-full justify-start gap-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-blue-100"
                  data-testid="button-ai-help"
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-purple-700 dark:text-purple-300">Get AI Guidance</span>
                </Button>
              </CardContent>
            </Card>

            {/* Measurement input for centerline tasks */}
            {(currentTask?.taskType === "measure" || currentTask?.taskType === "verify") && (
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Centerline Verification</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Spec display */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Target</p>
                      <p className="text-2xl font-mono font-bold">
                        {currentTask.targetValue || "—"}{currentTask.unit || ""}
                      </p>
                    </div>
                    {(currentTask.minValue || currentTask.maxValue) && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Acceptable Range</p>
                        <p className="text-lg font-mono">
                          {currentTask.minValue || "—"} to {currentTask.maxValue || "—"}{currentTask.unit || ""}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Measured value input */}
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Your Measurement</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="any"
                        placeholder={`Enter value${currentTask.unit ? ` (${currentTask.unit})` : ""}`}
                        value={measuredValues[currentTask.id] || ""}
                        onChange={(e) => setMeasuredValues({ ...measuredValues, [currentTask.id]: e.target.value })}
                        className={`text-2xl font-mono h-14 pr-20 ${
                          specStatus === "pass" 
                            ? "border-green-500 bg-green-50 dark:bg-green-950" 
                            : specStatus === "fail"
                              ? "border-red-500 bg-red-50 dark:bg-red-950"
                              : ""
                        }`}
                        data-testid="input-measured-value"
                      />
                      {currentTask.unit && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                          {currentTask.unit}
                        </span>
                      )}
                    </div>
                    {specStatus !== "neutral" && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg ${
                        specStatus === "pass" 
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" 
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                      }`}>
                        {specStatus === "pass" ? (
                          <>
                            <ThumbsUp className="h-5 w-5" />
                            <span className="font-medium">Within Spec - Good!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">Out of Spec - Action Required</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  placeholder="Add observations, issues found, or follow-up needed..."
                  value={taskNotes[currentTask?.id] || ""}
                  onChange={(e) => setTaskNotes({ ...taskNotes, [currentTask?.id]: e.target.value })}
                  rows={2}
                  className="mt-2"
                  data-testid="textarea-task-notes"
                />
              </CardContent>
            </Card>

            {/* Photo section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Photo Evidence
                  </CardTitle>
                  {currentTask?.photoRequired && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Required
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing photos */}
                {taskMedia.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {taskMedia.map((m) => (
                      <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={m.mediaUrl}
                          alt="Task photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Captured preview */}
                {capturedImage && (
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={URL.createObjectURL(capturedImage)}
                      alt="Captured"
                      className="w-full max-h-64 object-contain bg-muted"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setCapturedImage(null)}
                        data-testid="button-remove-captured"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      className="w-full mt-2"
                      onClick={handleUploadPhoto}
                      disabled={uploadMediaMutation.isPending}
                      data-testid="button-upload-photo"
                    >
                      {uploadMediaMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Save Photo
                    </Button>
                  </div>
                )}

                {/* Camera buttons */}
                {!capturedImage && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCamera(true);
                        startCamera();
                      }}
                      className="h-12"
                      data-testid="button-take-photo"
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Camera
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-12"
                      data-testid="button-upload-file"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Gallery
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg md:left-[var(--sidebar-width)]">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentTaskIndex(Math.max(0, currentTaskIndex - 1))}
              disabled={currentTaskIndex === 0}
              className="h-14 w-14"
              data-testid="button-prev-task"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            
            <Button
              onClick={handleCompleteTask}
              disabled={completeTaskMutation.isPending || isTaskCompleted(currentTask?.id)}
              className={`h-14 flex-1 text-lg ${
                isTaskCompleted(currentTask?.id) 
                  ? "bg-green-600 hover:bg-green-700" 
                  : ""
              }`}
              data-testid="button-complete-task"
            >
              {completeTaskMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isTaskCompleted(currentTask?.id) ? (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Done
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Complete
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentTaskIndex(Math.min(activeRun.tasks!.length - 1, currentTaskIndex + 1))}
              disabled={currentTaskIndex === activeRun.tasks.length - 1}
              className="h-14 w-14"
              data-testid="button-next-task"
            >
              <ArrowRight className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-upload"
        />

        {/* Camera dialog */}
        <Dialog open={showCamera} onOpenChange={(open) => { if (!open) stopCamera(); }}>
          <DialogContent className="max-w-lg p-0 overflow-hidden">
            <div className="relative">
              <video ref={videoRef} className="w-full aspect-[4/3] object-cover bg-black" playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button variant="secondary" onClick={stopCamera} data-testid="button-cancel-camera">
                  Cancel
                </Button>
                <Button onClick={capturePhoto} disabled={!streamActive} size="lg" className="rounded-full w-16 h-16" data-testid="button-capture">
                  <Camera className="h-8 w-8" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Guidance dialog */}
        <Dialog open={showAIHelp} onOpenChange={setShowAIHelp}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Assistant
              </DialogTitle>
              <DialogDescription>
                Smart guidance for {currentTask?.name}
              </DialogDescription>
            </DialogHeader>
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : aiGuidance && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p>{aiGuidance.suggestion}</p>
                </div>
                
                {aiGuidance.safetyTips && aiGuidance.safetyTips.length > 0 && (
                  <div>
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-amber-600" />
                      Safety Tips
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {aiGuidance.safetyTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-600">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {aiGuidance.bestPractices && aiGuidance.bestPractices.length > 0 && (
                  <div>
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-green-600" />
                      Best Practices
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {aiGuidance.bestPractices.map((practice, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-600">•</span>
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAIHelp(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main list view
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Operations</h1>
          <p className="text-muted-foreground">CILR & Centerlining task execution</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="start" className="gap-2" data-testid="tab-start">
            <Zap className="h-4 w-4" />
            Start
          </TabsTrigger>
          <TabsTrigger value="my-runs" className="gap-2" data-testid="tab-my-runs">
            <Clock className="h-4 w-4" />
            In Progress
            {inProgressRuns.length > 0 && (
              <Badge variant="secondary" className="ml-1">{inProgressRuns.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </TabsTrigger>
        </TabsList>

        {/* Start new checklist */}
        <TabsContent value="start" className="space-y-6 mt-6">
          {templatesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeTemplates.length === 0 ? (
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No checklists yet</h3>
                <p className="text-muted-foreground mb-6">Get started with our industry-standard CILR and Centerline templates</p>
                <Button 
                  onClick={() => seedTemplatesMutation.mutate()}
                  disabled={seedTemplatesMutation.isPending}
                  size="lg"
                  data-testid="button-seed-templates"
                >
                  {seedTemplatesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Default Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* CILR Section */}
              {cilrTemplates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                      <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">CILR Checklists</h2>
                      <p className="text-sm text-muted-foreground">Clean, Inspect, Lubricate, Repair</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cilrTemplates.map((template) => (
                      <TemplateCard 
                        key={template.id} 
                        template={template} 
                        equipment={equipment}
                        onStart={() => startRunMutation.mutate(template.id)}
                        isStarting={startRunMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Centerline Section */}
              {centerlineTemplates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Centerline Verification</h2>
                      <p className="text-sm text-muted-foreground">Measure and verify equipment settings</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {centerlineTemplates.map((template) => (
                      <TemplateCard 
                        key={template.id} 
                        template={template} 
                        equipment={equipment}
                        onStart={() => startRunMutation.mutate(template.id)}
                        isStarting={startRunMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* In Progress */}
        <TabsContent value="my-runs" className="space-y-4 mt-6">
          {runsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : inProgressRuns.length === 0 ? (
            <Card className="text-center">
              <CardContent className="p-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tasks in progress</h3>
                <p className="text-muted-foreground mb-4">Start a new checklist from the Start tab</p>
                <Button variant="outline" onClick={() => setActiveTab("start")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start Checklist
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {inProgressRuns.map((run) => {
                const template = templates.find(t => t.id === run.templateId);
                return (
                  <Card 
                    key={run.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={async () => {
                      const res = await apiRequest(`/api/cilr/runs/${run.id}`);
                      const runDetails = await res.json();
                      setActiveRun(runDetails);
                      setCurrentTaskIndex(0);
                    }}
                    data-testid={`card-run-${run.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${template?.templateType === "centerline" ? "bg-green-100 dark:bg-green-900" : "bg-blue-100 dark:bg-blue-900"}`}>
                          {template?.templateType === "centerline" ? (
                            <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                          ) : (
                            <Wrench className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{template?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            Started {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "recently"}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          In Progress
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Completed */}
        <TabsContent value="completed" className="space-y-4 mt-6">
          {runsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : completedRuns.length === 0 ? (
            <Card className="text-center">
              <CardContent className="p-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed checklists</h3>
                <p className="text-muted-foreground">Completed checklists will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedRuns.slice(0, 20).map((run) => {
                const template = templates.find(t => t.id === run.templateId);
                return (
                  <Card key={run.id} data-testid={`card-completed-${run.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{template?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            Completed {run.completedAt ? new Date(run.completedAt).toLocaleDateString() : "recently"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          Complete
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Template card component
function TemplateCard({ 
  template, 
  equipment, 
  onStart, 
  isStarting 
}: { 
  template: TemplateWithTasks; 
  equipment: Equipment[];
  onStart: () => void;
  isStarting: boolean;
}) {
  const equipmentItem = equipment.find(e => e.id === template.equipmentId);
  const taskCount = template.tasks?.length || 0;
  
  return (
    <Card className="hover-elevate" data-testid={`card-template-${template.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
            {equipmentItem && (
              <CardDescription className="truncate">{equipmentItem.name}</CardDescription>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {taskCount} tasks
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {template.frequency && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="capitalize">{template.frequency}</span>
            </div>
          )}
          {template.estimatedMinutes && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>{template.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onStart}
          disabled={isStarting}
          data-testid={`button-start-${template.id}`}
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Start Checklist
        </Button>
      </CardFooter>
    </Card>
  );
}
