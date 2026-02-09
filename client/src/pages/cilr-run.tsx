import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle2, 
  Circle, 
  ArrowLeft, 
  ArrowRight, 
  Loader2,
  SprayCan,
  Search,
  Droplets,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCheck,
  SkipForward
} from "lucide-react";
import type { CilrTemplate, CilrRun, CilrTemplateTask, CilrTaskCompletion, Equipment } from "@shared/schema";

interface CilrRunResponse extends CilrRun {
  template: CilrTemplate;
  equipment?: Equipment;
  tasks: CilrTemplateTask[];
  completions: CilrTaskCompletion[];
}

interface RunTask extends CilrTemplateTask {
  status: 'pending' | 'completed' | 'skipped';
  completion?: CilrTaskCompletion;
}

const taskTypeConfig = {
  clean: { icon: SprayCan, label: "Clean", color: "bg-blue-500" },
  inspect: { icon: Search, label: "Inspect", color: "bg-amber-500" },
  lubricate: { icon: Droplets, label: "Lubricate", color: "bg-green-500" },
  repair: { icon: Wrench, label: "Repair", color: "bg-red-500" },
};

export default function CilrRunPage() {
  const params = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [manualTaskIndex, setManualTaskIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const { data: run, isLoading: runLoading } = useQuery<CilrRunResponse>({
    queryKey: ["/api/cilr/runs", params.runId],
  });

  const tasks: RunTask[] = (run?.tasks || []).map((task: CilrTemplateTask) => {
    const completion = run?.completions?.find(c => c.taskId === task.id);
    const isSkipped = completion && !completion.isCompleted && completion.notes?.startsWith('[SKIPPED]');
    return {
      ...task,
      status: completion?.isCompleted ? 'completed' : (isSkipped ? 'skipped' : 'pending'),
      completion,
    };
  });

  const firstIncompleteIndex = tasks.findIndex(t => t.status === 'pending');
  const currentTaskIndex = manualTaskIndex ?? (firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(0, tasks.length - 1));
  const currentTask = tasks[currentTaskIndex];
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const skippedCount = tasks.filter(t => t.status === 'skipped').length;
  const progress = tasks.length > 0 ? ((completedCount + skippedCount) / tasks.length) * 100 : 0;

  const submitTaskMutation = useMutation({
    mutationFn: async (data: { taskId: string; isCompleted: boolean; notes?: string }) => {
      return apiRequest("POST", `/api/cilr/runs/${params.runId}/completions`, {
        taskId: data.taskId,
        isCompleted: data.isCompleted,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/runs", params.runId] });
      toast({ title: "Task recorded", description: "Moving to next task..." });
      setNotes("");
      // Advance to the next task immediately (optimistically)
      if (currentTaskIndex < tasks.length - 1) {
        setManualTaskIndex(currentTaskIndex + 1);
      } else {
        // If this was the last task, let auto-selection take over
        setManualTaskIndex(null);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit task", variant: "destructive" });
    },
  });

  const completeRunMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cilr/runs/${params.runId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cilr/runs"] });
      toast({ title: "Run completed!", description: "CILR routine finished successfully" });
      setLocation("/operations");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete run", variant: "destructive" });
    },
  });

  const handleCompleteTask = () => {
    if (!currentTask) return;
    submitTaskMutation.mutate({
      taskId: currentTask.id,
      isCompleted: true,
      notes: notes || undefined,
    });
  };

  const handleSkipTask = () => {
    if (!currentTask) return;
    submitTaskMutation.mutate({
      taskId: currentTask.id,
      isCompleted: false,
      notes: notes ? `[SKIPPED] ${notes}` : '[SKIPPED]',
    });
  };

  const handleCompleteRun = () => {
    completeRunMutation.mutate();
  };

  if (runLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Run not found</p>
            <Button className="mt-4" onClick={() => setLocation("/operations")}>
              Back to Operations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allTasksCompleted = (completedCount + skippedCount) === tasks.length && tasks.length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/operations")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-template-name">{run.template?.name}</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-equipment-name">
            {run.equipment?.name} - {run.equipment?.location}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          In Progress
        </Badge>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground" data-testid="text-progress">
              {completedCount + skippedCount} of {tasks.length} tasks
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tasks.map((task, index) => {
          const config = taskTypeConfig[task.taskType as keyof typeof taskTypeConfig];
          const Icon = config?.icon || Circle;
          return (
            <button
              key={task.id}
              onClick={() => setManualTaskIndex(index)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                index === currentTaskIndex
                  ? "border-primary bg-primary/10"
                  : task.status === 'completed'
                  ? "border-green-500/50 bg-green-500/10"
                  : task.status === 'skipped'
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-muted hover-elevate"
              }`}
              data-testid={`button-task-nav-${task.id}`}
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : task.status === 'skipped' ? (
                <SkipForward className="h-4 w-4 text-amber-500" />
              ) : (
                <Icon className={`h-4 w-4 ${index === currentTaskIndex ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <span className="text-sm whitespace-nowrap">
                {index + 1}. {task.name.slice(0, 15)}{task.name.length > 15 ? "..." : ""}
              </span>
            </button>
          );
        })}
      </div>

      {currentTask && (
        <Card className="overflow-hidden">
          <CardHeader className={`${taskTypeConfig[currentTask.taskType as keyof typeof taskTypeConfig]?.color || "bg-gray-500"} text-white`}>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = taskTypeConfig[currentTask.taskType as keyof typeof taskTypeConfig]?.icon || Circle;
                return <Icon className="h-6 w-6" />;
              })()}
              <div>
                <CardTitle className="text-white" data-testid="text-current-task-name">
                  {currentTask.name}
                </CardTitle>
                <CardDescription className="text-white/80">
                  Task {currentTaskIndex + 1} of {tasks.length} - {taskTypeConfig[currentTask.taskType as keyof typeof taskTypeConfig]?.label || currentTask.taskType}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="font-medium mb-2">Instructions</h3>
              <p className="text-muted-foreground" data-testid="text-task-instructions">
                {currentTask.instructions || "Complete this task according to standard procedures."}
              </p>
            </div>

            {currentTask.status === 'completed' || currentTask.status === 'skipped' ? (
              <div className={`p-4 rounded-lg border ${
                currentTask.status === 'completed' 
                  ? "bg-green-500/10 border-green-500/50" 
                  : "bg-amber-500/10 border-amber-500/50"
              }`}>
                <div className="flex items-center gap-2">
                  {currentTask.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <SkipForward className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="font-medium">
                    {currentTask.status === 'completed' ? 'Task Completed' : 'Task Skipped'}
                  </span>
                </div>
                {currentTask.completion?.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {currentTask.completion.notes.replace('[SKIPPED] ', '')}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-medium mb-2">Notes (Optional)</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any observations or notes about this task..."
                    className="min-h-24"
                    data-testid="input-task-notes"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {currentTaskIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setManualTaskIndex(currentTaskIndex - 1)}
                  data-testid="button-previous-task"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
              <div className="flex-1" />
              {currentTask.status === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSkipTask}
                    disabled={submitTaskMutation.isPending}
                    data-testid="button-skip-task"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleCompleteTask}
                    disabled={submitTaskMutation.isPending}
                    data-testid="button-complete-task"
                  >
                    {submitTaskMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Complete Task
                  </Button>
                </>
              )}
              {(currentTask.status === 'completed' || currentTask.status === 'skipped') && currentTaskIndex < tasks.length - 1 && (
                <Button onClick={() => setManualTaskIndex(currentTaskIndex + 1)} data-testid="button-next-task">
                  Next Task
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {allTasksCompleted && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-6 text-center">
            <CheckCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Tasks Processed!</h3>
            <p className="text-muted-foreground mb-4">
              {completedCount} completed, {skippedCount} skipped
            </p>
            <Button
              size="lg"
              onClick={handleCompleteRun}
              disabled={completeRunMutation.isPending}
              data-testid="button-finish-run"
            >
              {completeRunMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Finish Run
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
