import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Send, ChevronRight, ChevronLeft, CheckCircle2, Plus, Download, Hand } from "lucide-react";
import jsPDF from "jspdf";

interface TroubleshootingSession {
  id: string;
  currentStep: number;
  step1Data?: { problem: string };
  aiConversation: { role: string; content: string }[];
  completed: boolean;
  createdAt: string;
}

export default function Troubleshooting() {
  const { toast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");

  const steps = [
    { number: 1, title: "Identify", description: "Define the problem clearly" },
    { number: 2, title: "Gather", description: "Collect data and observations" },
    { number: 3, title: "Analyze", description: "Examine patterns and causes" },
    { number: 4, title: "Plan", description: "Develop solution strategy" },
    { number: 5, title: "Implement", description: "Execute the repair plan" },
    { number: 6, title: "Observe", description: "Verify fix and document learnings" },
  ];

  const { data: sessions = [], error: sessionsError, isLoading: sessionsLoading } = useQuery<TroubleshootingSession[]>({
    queryKey: ["/api/troubleshooting"],
  });

  const { data: currentSession, isLoading: isSessionLoading } = useQuery<TroubleshootingSession>({
    queryKey: ["/api/troubleshooting", selectedSessionId],
    enabled: !!selectedSessionId,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const res = await fetch(`/api/troubleshooting/${selectedSessionId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      return data;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/troubleshooting", {
        currentStep: 1,
      });
      return response.json();
    },
    onSuccess: (newSession) => {
      // Manually set the query data for the new session
      queryClient.setQueryData(["/api/troubleshooting", newSession.id], newSession);
      queryClient.invalidateQueries({ queryKey: ["/api/troubleshooting"] });
      setSelectedSessionId(newSession.id);
      toast({
        title: "Session Started",
        description: "New troubleshooting session created",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedSessionId) throw new Error("No session selected");
      const response = await apiRequest("POST", `/api/troubleshooting/${selectedSessionId}/chat`, {
        message,
      });
      return response.json();
    },
    onSuccess: () => {
      if (selectedSessionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/troubleshooting", selectedSessionId] });
      }
      setChatMessage("");
    },
  });

  const advanceStepMutation = useMutation({
    mutationFn: async ({ currentStep, complete }: { currentStep: number; complete?: boolean }) => {
      if (!selectedSessionId) throw new Error("No session selected");
      
      const response = await apiRequest("PUT", `/api/troubleshooting/${selectedSessionId}`, {
        ...(complete ? { completed: true } : { currentStep: currentStep + 1 }),
      });
      return response.json();
    },
    onSuccess: () => {
      if (selectedSessionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/troubleshooting", selectedSessionId] });
      }
      toast({
        title: "Step Advanced",
        description: "Moving to next step",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to advance step",
        variant: "destructive",
      });
    },
  });

  // Navigation to specific step
  const goToStepMutation = useMutation({
    mutationFn: async (targetStep: number) => {
      if (!selectedSessionId) throw new Error("No session selected");
      const response = await apiRequest("PUT", `/api/troubleshooting/${selectedSessionId}`, {
        currentStep: targetStep,
      });
      return response.json();
    },
    onSuccess: () => {
      if (selectedSessionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/troubleshooting", selectedSessionId] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to navigate to step",
        variant: "destructive",
      });
    },
  });

  const handleGoToStep = (stepNumber: number) => {
    if (!currentSession) return;
    const sessionStep = currentSession.currentStep || 1;
    // Only allow going to completed steps or the current step
    if (stepNumber <= sessionStep) {
      goToStepMutation.mutate(stepNumber);
    }
  };

  const handlePreviousStep = () => {
    const sessionStep = currentSession?.currentStep || 1;
    if (!currentSession || sessionStep <= 1) return;
    goToStepMutation.mutate(sessionStep - 1);
  };

  // Export troubleshooting session to PDF
  const handleExportPDF = () => {
    if (!currentSession) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 25;

    // Header
    doc.setFillColor(33, 150, 243);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TROUBLESHOOTING SESSION', margin, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);

    yPos = 50;

    // Session Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SESSION OVERVIEW', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Current Step: ${currentStep} of 6 - ${steps[currentStep - 1]?.title || ''}`, margin, yPos);
    yPos += 6;
    doc.text(`Status: ${currentSession.completed ? 'Completed' : 'In Progress'}`, margin, yPos);
    yPos += 6;
    doc.text(`Created: ${new Date(currentSession.createdAt).toLocaleString()}`, margin, yPos);
    yPos += 12;

    // Problem Statement
    if (currentSession.step1Data?.problem) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PROBLEM STATEMENT', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const problemLines = doc.splitTextToSize(currentSession.step1Data.problem, contentWidth);
      doc.text(problemLines, margin, yPos);
      yPos += problemLines.length * 5 + 10;
    }

    // Steps Progress
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('6-STEP PROCESS STATUS', margin, yPos);
    yPos += 10;

    steps.forEach((step, idx) => {
      const stepNum = idx + 1;
      const status = stepNum < currentStep ? '✓ Completed' : stepNum === currentStep ? '→ Current' : '○ Pending';
      const statusColor = stepNum < currentStep ? [34, 139, 34] : stepNum === currentStep ? [33, 150, 243] : [150, 150, 150];
      
      doc.setTextColor(...statusColor as [number, number, number]);
      doc.setFontSize(10);
      doc.text(`Step ${stepNum}: ${step.title} - ${step.description}`, margin + 5, yPos);
      doc.setTextColor(100, 100, 100);
      doc.text(status, pageWidth - margin - 30, yPos);
      yPos += 7;
    });
    yPos += 10;

    // AI Conversation History
    if (currentSession.aiConversation.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 25;
      }

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TROUBLESHOOTING CONVERSATION', margin, yPos);
      yPos += 10;

      doc.setFontSize(9);
      currentSession.aiConversation.forEach((msg, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 25;
        }

        const role = msg.role === 'assistant' ? 'C4 Coach' : 'Technician';
        const roleColor = msg.role === 'assistant' ? [33, 150, 243] : [100, 100, 100];
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...roleColor as [number, number, number]);
        doc.text(`${role}:`, margin, yPos);
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const msgLines = doc.splitTextToSize(msg.content, contentWidth - 5);
        
        // Check if message will fit
        const linesNeeded = msgLines.length * 4;
        if (yPos + linesNeeded > 270) {
          doc.addPage();
          yPos = 25;
        }

        doc.text(msgLines, margin + 5, yPos);
        yPos += msgLines.length * 4 + 8;
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
      doc.text('MaintenanceHub - C4 Troubleshooting', margin, 290);
    }

    // Open in new tab
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');

    toast({
      title: "Export Generated",
      description: "Troubleshooting session exported to PDF",
    });
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !selectedSessionId) return;
    sendMessageMutation.mutate(chatMessage);
  };

  const handleNextStep = () => {
    if (!currentSession) {
      toast({
        title: "Error",
        description: "No session loaded",
        variant: "destructive",
      });
      return;
    }
    
    // If on step 6, mark as completed instead of advancing
    if (currentSession.currentStep === 6) {
      advanceStepMutation.mutate({ currentStep: 6, complete: true });
    } else {
      advanceStepMutation.mutate({ currentStep: currentSession.currentStep });
    }
  };

  const currentStep = currentSession?.currentStep || 1;
  
  // Show error if sessions failed to load
  if (sessionsError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">Error loading troubleshooting</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <p className="text-destructive font-medium">Failed to load troubleshooting sessions</p>
              <p className="text-sm text-muted-foreground">{(sessionsError as Error)?.message || "Unknown error occurred"}</p>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                data-testid="button-retry"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If session is completed, show completion message
  if (currentSession?.completed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">Session Completed</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-chart-3">
              <CheckCircle2 className="w-6 h-6" />
              Troubleshooting Session Complete!
            </CardTitle>
            <CardDescription>
              This troubleshooting session has been successfully completed through all 6 steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-chart-3/10 rounded-lg">
              <p className="text-sm font-medium mb-2">Session Summary:</p>
              <p className="text-sm text-muted-foreground">
                You've worked through: Identify → Gather → Analyze → Plan → Implement → Observe
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setSelectedSessionId(null)}
                className="flex-1"
                data-testid="button-back-to-sessions"
              >
                Back to Sessions
              </Button>
              <Button 
                onClick={handleExportPDF}
                variant="outline"
                className="flex-1"
                data-testid="button-export-completed"
              >
                <Download className="w-4 h-4 mr-2" />
                Export for Tech
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show session selection if no session is selected
  if (!selectedSessionId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">
            Guided 6-step troubleshooting process with C4 assistance
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start Troubleshooting</CardTitle>
            <CardDescription>Create a new session or continue an existing one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => createSessionMutation.mutate()}
              disabled={createSessionMutation.isPending}
              className="w-full"
              data-testid="button-new-session"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start New Session
            </Button>

            {sessions.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue existing
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {sessions.map((session) => (
                    <Card
                      key={session.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedSessionId(session.id)}
                      data-testid={`card-session-${session.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={session.completed ? "default" : "secondary"}>
                            {session.completed ? "Completed" : `Step ${session.currentStep}/6`}
                          </Badge>
                          {session.completed && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        </div>
                        <p className="text-sm font-medium line-clamp-2">
                          {session.step1Data?.problem || "New session"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while session is being fetched
  if (selectedSessionId && isSessionLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-muted-foreground">Loading troubleshooting session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If session is selected but data isn't available, show error
  if (selectedSessionId && !currentSession) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">Session not found</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Unable to load this session.</p>
              <Button onClick={() => setSelectedSessionId(null)} variant="outline">
                Back to Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show the selected session
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            C4 Troubleshooting Assistant
          </h1>
          <p className="text-muted-foreground">
            Guided 6-step troubleshooting process with C4 assistance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setSelectedSessionId(null)}
            variant="outline"
            data-testid="button-back-to-sessions"
          >
            All Sessions
          </Button>
          <Button 
            onClick={() => createSessionMutation.mutate()} 
            disabled={createSessionMutation.isPending}
            variant="outline"
            data-testid="button-new-session"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
          <Button 
            onClick={handleExportPDF}
            variant="outline"
            data-testid="button-export-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            Export for Tech
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step {currentStep} of 6: {steps[currentStep - 1]?.title || "Unknown"}
          </CardTitle>
          <CardDescription>{steps[currentStep - 1]?.description || ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={(currentStep / 6) * 100} className="h-2" />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {steps.map((step) => {
              const isCompleted = step.number < currentStep;
              const isCurrent = step.number === currentStep;
              const isClickable = step.number <= currentStep;
              
              return (
                <button
                  key={step.number}
                  onClick={() => isClickable && handleGoToStep(step.number)}
                  disabled={!isClickable || goToStepMutation.isPending}
                  className={`text-center p-2 rounded-lg transition-all ${
                    isCompleted
                      ? "bg-chart-3/10 text-chart-3 cursor-pointer hover-elevate"
                      : isCurrent
                      ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  }`}
                  data-testid={`button-step-${step.number}`}
                >
                  <div className="text-xs font-medium">{step.title}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">Step {step.number}</div>
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 mx-auto mt-1" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Step Navigation Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousStep}
              disabled={currentStep <= 1 || goToStepMutation.isPending}
              data-testid="button-previous-step"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous Step
            </Button>
            <span className="text-sm text-muted-foreground">
              Click completed steps above to review
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextStep}
              disabled={currentStep >= 6 || advanceStepMutation.isPending || currentSession?.aiConversation.length === 0}
              data-testid="button-quick-next"
            >
              Next Step
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="flex flex-col h-[500px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              C4 Troubleshooting Coach
            </CardTitle>
            <CardDescription>
              Chat with the AI coach - all your work happens here. Answer questions to build troubleshooting skills.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-4 min-h-0">
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {!currentSession || currentSession.aiConversation.length === 0 ? (
                <div className="p-3 rounded-lg bg-accent/50 text-accent-foreground">
                  <p className="text-sm flex items-start gap-2">
                    <Hand className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Welcome to C4 Troubleshooting Coach! Start by typing your problem in the chat box below. I'll ask questions to guide you through the 6-step process: Identify, Gather, Analyze, Plan, Implement, Observe.</span>
                  </p>
                  <p className="text-sm mt-2 ml-6">
                    Type what's happening and I'll coach you through it!
                  </p>
                </div>
              ) : (
                currentSession.aiConversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === "assistant"
                        ? "bg-accent/50 text-accent-foreground"
                        : "bg-primary/10 text-foreground ml-8"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <Input
                placeholder="Type your response to the coach..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sendMessageMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button 
                size="icon"
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {currentStep < 6 && (
          <Card>
            <CardContent className="pt-6">
              <Button 
                className="w-full"
                onClick={handleNextStep}
                disabled={advanceStepMutation.isPending || currentSession?.aiConversation.length === 0}
                data-testid="button-next-step"
              >
                {currentStep === 1 && "Continue to Gather"}
                {currentStep === 2 && "Continue to Analyze"}
                {currentStep === 3 && "Continue to Plan"}
                {currentStep === 4 && "Continue to Implement"}
                {currentStep === 5 && "Continue to Observe"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Chat with the coach above until you have all the information needed, then click to advance
              </p>
            </CardContent>
          </Card>
        )}
        
        {currentStep === 6 && (
          <Card>
            <CardContent className="pt-6">
              <Button 
                className="w-full"
                onClick={handleNextStep}
                disabled={advanceStepMutation.isPending}
                data-testid="button-complete-session"
              >
                Complete Session
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
