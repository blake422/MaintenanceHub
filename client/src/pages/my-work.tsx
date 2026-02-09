import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, CheckCircle2, Clock, AlertCircle, Camera, Calendar, Wrench, Search, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder, TimeEntry } from "@shared/schema";

type ActiveTimer = TimeEntry & { workOrder?: WorkOrder };

export default function MyWork() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [pausingWorkOrderId, setPausingWorkOrderId] = useState<string | null>(null);
  const [breakReason, setBreakReason] = useState<string>("lunch");
  const [breakNotes, setBreakNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch work orders
  const { data: allWorkOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Fetch active timer from server (server-authoritative)
  const { data: activeTimer } = useQuery<ActiveTimer | null>({
    queryKey: ["/api/timer/active"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Filter to only show work orders assigned to current user
  const workOrders = allWorkOrders.filter(wo => wo.assignedToId === user?.id);

  // Client-side elapsed time calculation for display
  useEffect(() => {
    if (activeTimer && activeTimer.type === "work" && activeTimer.startTime) {
      const interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [activeTimer?.id, activeTimer?.type]);

  // Timer API mutations
  const startTimer = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest("POST", "/api/timer/start", { workOrderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Timer started" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start timer",
        variant: "destructive",
      });
    },
  });

  const pauseTimer = useMutation({
    mutationFn: async ({ workOrderId, breakReason, notes }: { workOrderId: string; breakReason: string; notes?: string }) => {
      return await apiRequest("POST", "/api/timer/pause", { workOrderId, breakReason, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setBreakDialogOpen(false);
      setBreakReason("lunch");
      setBreakNotes("");
      toast({ title: "Break started" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pause timer",
        variant: "destructive",
      });
    },
  });

  const resumeTimer = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest("POST", "/api/timer/resume", { workOrderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Back to work!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume timer",
        variant: "destructive",
      });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest("POST", "/api/timer/stop", { workOrderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Timer stopped" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to stop timer",
        variant: "destructive",
      });
    },
  });

  const completeWorkOrder = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest("PATCH", `/api/work-orders/${workOrderId}`, { status: "completed", completedAt: new Date() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Work order completed!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete work order",
        variant: "destructive",
      });
    },
  });

  const handleTimerAction = (woId: string) => {
    if (activeTimer) {
      if (activeTimer.workOrderId === woId) {
        // Same WO - toggle work/break
        if (activeTimer.type === "work") {
          // Pause work - show break reason dialog
          setPausingWorkOrderId(woId);
          setBreakDialogOpen(true);
        } else {
          // Resume from break
          resumeTimer.mutate(woId);
        }
      } else {
        // Different WO - stop current and start new
        stopTimer.mutate(activeTimer.workOrderId, {
          onSuccess: () => startTimer.mutate(woId),
        });
      }
    } else {
      // No active timer - start new
      startTimer.mutate(woId);
    }
  };

  const handleComplete = (woId: string) => {
    if (activeTimer?.workOrderId === woId) {
      stopTimer.mutate(woId, {
        onSuccess: () => completeWorkOrder.mutate(woId),
      });
    } else {
      completeWorkOrder.mutate(woId);
    }
  };

  const handlePauseConfirm = () => {
    if (pausingWorkOrderId) {
      pauseTimer.mutate({
        workOrderId: pausingWorkOrderId,
        breakReason,
        notes: breakNotes || undefined,
      });
      setPausingWorkOrderId(null);
    }
  };

  const getBreakReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      lunch: "Lunch Break",
      parts_wait: "Waiting for Parts",
      meeting: "Meeting",
      personal: "Personal Break",
      other: "Other",
    };
    return labels[reason] || reason;
  };

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

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "preventive":
        return { label: "PM", icon: Calendar, variant: "default" as const };
      case "corrective":
        return { label: "Repair", icon: Wrench, variant: "secondary" as const };
      case "inspection":
        return { label: "Inspection", icon: Search, variant: "outline" as const };
      default:
        return { label: type, icon: Wrench, variant: "outline" as const };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "text-chart-1";
      case "open":
        return "text-muted-foreground";
      case "completed":
        return "text-chart-3";
      default:
        return "text-muted-foreground";
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">My Work</h1>
        <p className="text-muted-foreground">Your assigned work orders and tasks</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-work">
              {workOrders.filter((wo) => wo.status !== "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-hours-today">
              {formatTime(workOrders.reduce((acc, wo) => acc + (wo.totalTimeMinutes || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Orders List */}
      {workOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No work orders assigned</p>
            <p className="text-sm text-muted-foreground mt-1">Check back later for new assignments</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workOrders.map((wo) => {
            const typeInfo = getTypeInfo(wo.type);
            const TypeIcon = typeInfo.icon;
            const isActive = activeTimer?.workOrderId === wo.id;
            const isBreak = isActive && activeTimer?.type === "break";
            
            return (
              <Card
                key={wo.id}
                className={cn(
                  "hover-elevate active-elevate-2",
                  wo.priority === "critical" && "border-destructive",
                  isActive && "border-primary"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="text-base">{wo.title}</CardTitle>
                        <Badge variant={typeInfo.variant} className="flex-shrink-0">
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">{wo.equipment || "No equipment assigned"}</CardDescription>
                    </div>
                    <Badge variant={getPriorityVariant(wo.priority)} className="capitalize flex-shrink-0">
                      {wo.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status and Time */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {wo.totalTimeMinutes && wo.totalTimeMinutes > 0 
                          ? formatTime(wo.totalTimeMinutes + (isActive && !isBreak ? Math.floor(elapsedSeconds / 60) : 0))
                          : isActive && !isBreak
                            ? formatTime(Math.floor(elapsedSeconds / 60))
                            : "Not started"}
                      </span>
                      {isBreak && (
                        <Badge variant="outline" className="ml-2">
                          <Coffee className="w-3 h-3 mr-1" />
                          On Break
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium capitalize", getStatusColor(wo.status))}>
                        {wo.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Timer Controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      variant={isActive ? "secondary" : "default"}
                      className="w-full h-12"
                      data-testid={`button-timer-${wo.id}`}
                      onClick={() => handleTimerAction(wo.id)}
                      disabled={startTimer.isPending || pauseTimer.isPending || resumeTimer.isPending || stopTimer.isPending}
                    >
                      {isActive ? (
                        isBreak ? (
                          <>
                            <Play className="w-5 h-5 mr-2" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="w-5 h-5 mr-2" />
                            Break
                          </>
                        )
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Start
                        </>
                      )}
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full h-12"
                      data-testid={`button-complete-${wo.id}`}
                      onClick={() => handleComplete(wo.id)}
                      disabled={completeWorkOrder.isPending || stopTimer.isPending || wo.status === "completed"}
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Complete
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-photo-${wo.id}`}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Add Photo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-details-${wo.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Timer Banner */}
      {activeTimer && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground p-4 shadow-lg z-50">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-primary-foreground rounded-full animate-pulse" />
              <div>
                <span className="font-medium">
                  {activeTimer.type === "work" ? "Working" : "On Break"}
                </span>
                {activeTimer.type === "break" && activeTimer.breakReason && (
                  <span className="text-xs ml-2 opacity-90">
                    ({getBreakReasonLabel(activeTimer.breakReason)})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeTimer.type === "work" && (
                <span className="text-sm font-mono">{formatTime(Math.floor(elapsedSeconds / 60))}</span>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => activeTimer && stopTimer.mutate(activeTimer.workOrderId)}
                data-testid="button-stop-timer-global"
                disabled={stopTimer.isPending}
              >
                {activeTimer.type === "work" ? "Take Break" : "End Break"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Break Reason Dialog */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent data-testid="dialog-break-reason">
          <DialogHeader>
            <DialogTitle>Take a Break</DialogTitle>
            <DialogDescription>
              Let us know why you're taking a break. This helps track productivity accurately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Break Reason</Label>
              <RadioGroup value={breakReason} onValueChange={setBreakReason}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lunch" id="lunch" data-testid="radio-lunch" />
                  <Label htmlFor="lunch" className="font-normal cursor-pointer">
                    Lunch Break
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parts_wait" id="parts_wait" data-testid="radio-parts" />
                  <Label htmlFor="parts_wait" className="font-normal cursor-pointer">
                    Waiting for Parts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="meeting" id="meeting" data-testid="radio-meeting" />
                  <Label htmlFor="meeting" className="font-normal cursor-pointer">
                    Meeting
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="personal" data-testid="radio-personal" />
                  <Label htmlFor="personal" className="font-normal cursor-pointer">
                    Personal Break
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" data-testid="radio-other" />
                  <Label htmlFor="other" className="font-normal cursor-pointer">
                    Other
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {breakReason === "other" && (
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional details..."
                  value={breakNotes}
                  onChange={(e) => setBreakNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-break-notes"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBreakDialogOpen(false);
                setBreakReason("lunch");
                setBreakNotes("");
                setPausingWorkOrderId(null);
              }}
              data-testid="button-cancel-break"
            >
              Cancel
            </Button>
            <Button onClick={handlePauseConfirm} disabled={pauseTimer.isPending} data-testid="button-confirm-break">
              Start Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
