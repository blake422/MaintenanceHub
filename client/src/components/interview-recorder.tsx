import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mic, MicOff, Square, Play, Pause, Upload, FileText, AlertTriangle, CheckCircle, Loader2, Users, MessageSquare, Target, ListChecks, ClipboardList, Briefcase, Sparkles, Download, Volume2, Wrench, Building2, Plus, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { InterviewSession, ClientCompany } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logo-base64";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface InterviewRecorderProps {
  assessmentDeliverableId?: string;
}

const ROLE_OPTIONS = [
  { value: "technician", label: "Maintenance Technician", level: "technician" },
  { value: "storeroom", label: "Storeroom Personnel", level: "technician" },
  { value: "operations", label: "Operations Staff", level: "technician" },
  { value: "supervisor", label: "Maintenance Supervisor", level: "leadership" },
  { value: "manager", label: "Maintenance Manager", level: "leadership" },
  { value: "planner", label: "Maintenance Planner", level: "leadership" },
  { value: "other", label: "Other", level: "technician" },
];

// AudioPlayer component that fetches signed URLs for secure audio playback
function AudioPlayer({ 
  sessionId, 
  hasTranscript, 
  onRetryTranscription, 
  isRetrying 
}: { 
  sessionId: string; 
  hasTranscript: boolean; 
  onRetryTranscription: () => void; 
  isRetrying: boolean;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudioUrl = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/interview-sessions/${sessionId}/audio-url`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to get audio URL');
        }
        const data = await response.json();
        setAudioUrl(data.audioUrl);
        setError(null);
      } catch (err) {
        setError('Could not load audio');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAudioUrl();
  }, [sessionId]);

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Audio Recording</span>
        {!hasTranscript && (
          <Badge variant="secondary">Transcription pending</Badge>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audio...
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : audioUrl ? (
        <audio 
          controls 
          className="w-full h-10"
          src={audioUrl}
          data-testid={`audio-player-${sessionId}`}
        >
          Your browser does not support the audio element.
        </audio>
      ) : null}
      {!hasTranscript && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onRetryTranscription}
            disabled={isRetrying}
            data-testid={`button-retry-transcription-${sessionId}`}
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isRetrying ? "Transcribing..." : "Retry Transcription"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Categorized questions by level (Leadership vs Technician) and category (Cultural vs Day-to-Day)
interface QuestionCategory {
  category: string;
  icon: string;
  questions: string[];
}

const INTERVIEW_QUESTIONS: Record<string, QuestionCategory[]> = {
  leadership: [
    {
      category: "Cultural & Team Dynamics",
      icon: "users",
      questions: [
        "How would you describe the maintenance culture here? Is it reactive or proactive?",
        "How well do maintenance and operations teams work together?",
        "Is there a blame culture when things go wrong, or is it focused on learning?",
        "How is knowledge shared between experienced and newer team members?",
        "What's the general morale of the maintenance team?",
        "How do you recognize and reward good performance?",
        "Are there conflicts between shifts or crews that affect work quality?",
        "How open is the team to change and new ways of working?",
        "Do technicians feel empowered to make decisions or stop work if unsafe?",
        "How well does upper management understand and support maintenance needs?",
      ],
    },
    {
      category: "Day-to-Day Operations & Processes",
      icon: "clipboard",
      questions: [
        "What percentage of your work is planned vs. reactive/emergency?",
        "How do you prioritize and schedule maintenance work?",
        "What's your biggest bottleneck in getting work completed?",
        "How effective is your preventive maintenance program?",
        "What metrics do you use to measure maintenance performance?",
        "How do you handle parts availability and procurement?",
        "What's your process for root cause analysis after failures?",
        "How do you coordinate with production for equipment access?",
        "What information or data do you wish you had better access to?",
        "What technology investments would most benefit the team?",
        "How do you plan for and track contractor work?",
        "What training gaps exist in your team?",
        "How do you ensure compliance with safety and regulatory requirements?",
      ],
    },
  ],
  technician: [
    {
      category: "Cultural & Team Dynamics",
      icon: "users",
      questions: [
        "Do you feel your input and ideas are valued by management?",
        "How well does communication work between shifts?",
        "Do you get blamed when things go wrong, or is it seen as a learning opportunity?",
        "How well do maintenance and operations work together day-to-day?",
        "Are there personality conflicts or team issues that affect work?",
        "Do you feel you have the authority to stop work if something is unsafe?",
        "How supportive are supervisors when you encounter problems?",
        "Is knowledge shared openly or do people hoard information?",
        "Do you feel management understands the challenges you face?",
        "Would you recommend this as a good place to work?",
      ],
    },
    {
      category: "Day-to-Day Operations & Processes",
      icon: "clipboard",
      questions: [
        "What equipment gives you the most trouble?",
        "Do you have the tools and parts you need to do your job?",
        "How clear are the work orders you receive?",
        "What frustrates you most about the current maintenance process?",
        "How do you know what work to do each day?",
        "Are safety concerns taken seriously when you raise them?",
        "What training would help you do your job better?",
        "How much time do you spend looking for parts or waiting?",
        "Are PM tasks actually useful or just checking boxes?",
        "What would you change about how maintenance is done here?",
        "How do you report problems or suggest improvements?",
        "Do you have time to do quality work or are you always rushing?",
      ],
    },
  ],
};

// Helper to get the level for a role
const getRoleLevel = (role: string): "leadership" | "technician" => {
  const roleOption = ROLE_OPTIONS.find(r => r.value === role);
  return (roleOption?.level as "leadership" | "technician") || "technician";
};

export function InterviewRecorder({ assessmentDeliverableId }: InterviewRecorderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("record");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [intervieweeName, setIntervieweeName] = useState("");
  const [intervieweeDepartment, setIntervieweeDepartment] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  
  // Client company state
  const [selectedClientCompanyId, setSelectedClientCompanyId] = useState<string>("");
  const [newClientCompanyName, setNewClientCompanyName] = useState("");
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [filterClientCompanyId, setFilterClientCompanyId] = useState<string>("");
  
  // Reassign interview state
  const [reassignInterviewId, setReassignInterviewId] = useState<string | null>(null);
  const [reassignTargetCompanyId, setReassignTargetCompanyId] = useState<string>("");
  
  // Speech-to-text state
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isSpeechToTextActive, setIsSpeechToTextActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const isSpeechActiveRef = useRef(false); // Use ref to avoid stale closure in onend callback
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Build query key - only include assessmentId when it exists
  const queryKey = assessmentDeliverableId 
    ? ["/api/interview-sessions", { assessmentId: assessmentDeliverableId }]
    : ["/api/interview-sessions"];
    
  const { data: interviews, isLoading: isLoadingInterviews } = useQuery<InterviewSession[]>({
    queryKey,
  });

  // Client companies query
  const { data: clientCompanies } = useQuery<ClientCompany[]>({
    queryKey: ["/api/client-companies"],
  });

  const createClientCompanyMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return apiRequest("POST", "/api/client-companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      setIsCreateCompanyOpen(false);
      setNewClientCompanyName("");
      toast({
        title: "Client Company Created",
        description: "New client company has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client company.",
        variant: "destructive",
      });
    },
  });

  const reassignInterviewMutation = useMutation({
    mutationFn: async ({ interviewId, clientCompanyId }: { interviewId: string; clientCompanyId: string | null }) => {
      return apiRequest("PUT", `/api/interview-sessions/${interviewId}`, { 
        clientCompanyId: clientCompanyId || null 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/interview-sessions"] });
      setReassignInterviewId(null);
      setReassignTargetCompanyId("");
      toast({
        title: "Interview Reassigned",
        description: "The interview has been moved to the new company.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reassign interview.",
        variant: "destructive",
      });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/interview-sessions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const uploadAudioMutation = useMutation({
    mutationFn: async ({ sessionId, audio }: { sessionId: string; audio: Blob }) => {
      const formData = new FormData();
      formData.append("audio", audio, "interview.webm");
      
      const response = await fetch(`/api/interview-sessions/${sessionId}/audio`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload audio");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey });
      
      // Check if transcription failed but audio was saved (server returns 200 with transcriptionFailed flag)
      if (data?.transcriptionFailed) {
        toast({
          title: "Recording Saved",
          description: data?.message || "Audio was saved but transcription failed. You can enter the transcript manually or retry later.",
          variant: "default",
        });
      } else {
        toast({
          title: "Interview Processed",
          description: "Audio has been transcribed and summarized.",
        });
      }
      resetRecording();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload interview audio. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveManualTranscriptMutation = useMutation({
    mutationFn: async ({ sessionId, transcript }: { sessionId: string; transcript: string }) => {
      return apiRequest("PUT", `/api/interview-sessions/${sessionId}`, { transcript });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Transcript Saved",
        description: "Manual transcript has been saved.",
      });
    },
  });

  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const summarizeInterviewMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setSummarizingId(sessionId);
      return apiRequest("POST", `/api/interview-sessions/${sessionId}/summarize`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Interview Summarized",
        description: "AI has analyzed the transcript and extracted key insights.",
      });
      setSummarizingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to summarize interview.",
        variant: "destructive",
      });
      setSummarizingId(null);
    },
  });

  // Retry transcription for sessions with saved audio but failed transcription
  const [retryingTranscriptionId, setRetryingTranscriptionId] = useState<string | null>(null);

  const retryTranscriptionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setRetryingTranscriptionId(sessionId);
      return apiRequest("POST", `/api/interview-sessions/${sessionId}/retry-transcription`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Transcription Complete",
        description: "Audio has been transcribed and summarized successfully.",
      });
      setRetryingTranscriptionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Transcription Failed",
        description: error?.message || "Failed to transcribe audio. You can enter the transcript manually.",
        variant: "destructive",
      });
      setRetryingTranscriptionId(null);
    },
  });

  // State for rollup client filter
  const [rollupClientCompanyId, setRollupClientCompanyId] = useState<string>("");

  const rollupMutation = useMutation({
    mutationFn: async (clientCompanyId?: string) => {
      const payload: any = {};
      if (assessmentDeliverableId) {
        payload.assessmentId = assessmentDeliverableId;
      }
      if (clientCompanyId) {
        payload.clientCompanyId = clientCompanyId;
      }
      const response = await apiRequest("POST", "/api/interview-sessions/rollup", payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Analysis Complete",
        description: `Executive summary and ${data.actionPriorities?.length || 0} recommended actions generated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate interview analysis.",
        variant: "destructive",
      });
    },
  });

  // Helper function to add C4 logo header to PDF
  const addPdfHeader = (doc: jsPDF, title: string, subtitle?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    // Header with blue background
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Add C4 logo on the right side of header
    try {
      doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, 5, 40, 30);
    } catch (e) {
      // Logo loading failed, continue without it
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 20);
    
    if (subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(subtitle, margin, 32);
    }
  };

  // Helper function to add C4 logo footer to PDF pages
  const addPdfFooter = (doc: jsPDF) => {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`C4 Consulting | Page ${i} of ${pageCount}`, margin, 290);
      doc.text(new Date().toLocaleDateString(), pageWidth - margin - 30, 290);
    }
  };

  // Export individual interview summary as PDF
  const exportInterviewSummary = (interview: InterviewSession) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    const roleLabel = ROLE_OPTIONS.find(r => r.value === interview.intervieweeRole)?.label || interview.intervieweeRole;
    addPdfHeader(doc, 'Stakeholder Interview Report', `${roleLabel} Interview`);

    // Interview Details Box
    let yPos = 50;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'S');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text('Interviewee Details', margin + 5, yPos + 10);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    const detailsY = yPos + 20;
    doc.text(`Name: ${interview.intervieweeName || 'Not provided'}`, margin + 5, detailsY);
    doc.text(`Department: ${interview.intervieweeDepartment || 'Not provided'}`, margin + 80, detailsY);
    doc.text(`Date: ${interview.createdAt ? new Date(interview.createdAt).toLocaleDateString() : 'N/A'}`, margin + 5, detailsY + 10);

    yPos = 95;

    // Summary Section
    if (interview.summary) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Interview Summary', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const summaryLines = doc.splitTextToSize(interview.summary, contentWidth);
      
      summaryLines.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 10;
    }

    // Pain Points Section
    if (interview.painPoints && (interview.painPoints as any[]).length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Key Pain Points Identified', margin, yPos);
      yPos += 8;

      const painPointsData = (interview.painPoints as any[]).map((point: any) => [
        point.severity?.toUpperCase() || 'N/A',
        point.theme || '',
        `"${point.quote || ''}"`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Severity', 'Theme', 'Quote']],
        body: painPointsData,
        headStyles: { 
          fillColor: [30, 64, 175],
          fontSize: 10,
        },
        styles: { 
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 40 },
          2: { cellWidth: 'auto', fontStyle: 'italic' },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Transcript Section
    if (interview.transcript) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Full Transcript', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const transcriptLines = doc.splitTextToSize(interview.transcript, contentWidth);
      
      transcriptLines.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
    }

    // Footer with C4 branding
    addPdfFooter(doc);

    doc.save(`Interview-${roleLabel.replace(/\s+/g, '-')}-${interview.id.slice(0, 8)}.pdf`);
    
    toast({
      title: "Report Exported",
      description: "Interview report has been downloaded as PDF.",
    });
  };

  // Export all interviews as consolidated PDF
  const exportAllInterviews = () => {
    if (!interviews || interviews.length === 0) {
      toast({
        title: "No Interviews",
        description: "There are no interviews to export.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Cover Page with C4 Logo
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 80, 'F');
    
    // Add C4 logo on cover
    try {
      doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 60, 10, 50, 38);
    } catch (e) {
      // Logo loading failed, continue without it
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Stakeholder Interview', margin, 35);
    doc.text('Consolidated Report', margin, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 70);

    // Summary Statistics
    let yPos = 100;
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Interview Summary', margin, yPos);
    yPos += 10;

    const completedCount = interviews.filter(i => i.summary).length;
    const roleBreakdown = ROLE_OPTIONS.map(role => ({
      role: role.label,
      count: interviews.filter(i => i.intervieweeRole === role.value).length,
    })).filter(r => r.count > 0);

    const summaryData = [
      ['Total Interviews', interviews.length.toString()],
      ['Completed (with summary)', completedCount.toString()],
      ['Pending Analysis', (interviews.length - completedCount).toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      body: summaryData,
      styles: { fontSize: 11, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'center', cellWidth: 40 },
      },
      theme: 'plain',
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Role Breakdown
    if (roleBreakdown.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Interviews by Role', margin, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Role', 'Count']],
        body: roleBreakdown.map(r => [r.role, r.count.toString()]),
        headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 30, halign: 'center' },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Consolidated Pain Points
    const allPainPoints: any[] = [];
    interviews.forEach(interview => {
      if (interview.painPoints && (interview.painPoints as any[]).length > 0) {
        (interview.painPoints as any[]).forEach((point: any) => {
          allPainPoints.push({
            ...point,
            role: ROLE_OPTIONS.find(r => r.value === interview.intervieweeRole)?.label || interview.intervieweeRole,
          });
        });
      }
    });

    if (allPainPoints.length > 0) {
      doc.addPage();
      yPos = 20;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Consolidated Pain Points', margin, yPos);
      yPos += 10;

      // Group by severity
      const criticalPoints = allPainPoints.filter(p => p.severity === 'critical');
      const majorPoints = allPainPoints.filter(p => p.severity === 'major');
      const minorPoints = allPainPoints.filter(p => p.severity === 'minor');

      const painPointsTable = [
        ...criticalPoints.map(p => ['CRITICAL', p.role, p.theme, `"${p.quote}"`]),
        ...majorPoints.map(p => ['MAJOR', p.role, p.theme, `"${p.quote}"`]),
        ...minorPoints.map(p => ['MINOR', p.role, p.theme, `"${p.quote}"`]),
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Severity', 'Source Role', 'Theme', 'Quote']],
        body: painPointsTable,
        headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 40 },
          3: { cellWidth: 'auto', fontStyle: 'italic' },
        },
      });
    }

    // Individual Interview Details
    interviews.forEach((interview, idx) => {
      doc.addPage();
      let y = 20;

      const roleLabel = ROLE_OPTIONS.find(r => r.value === interview.intervieweeRole)?.label || interview.intervieweeRole;
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'S');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(`Interview ${idx + 1}: ${roleLabel}`, margin + 5, y + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${interview.intervieweeName || 'Anonymous'} | ${interview.intervieweeDepartment || 'N/A'}`, margin + 5, y + 20);

      y += 35;

      if (interview.summary) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Summary:', margin, y);
        y += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        const summaryLines = doc.splitTextToSize(interview.summary, contentWidth);
        
        summaryLines.forEach((line: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += 5;
        });
        y += 10;
      }

      if (interview.painPoints && (interview.painPoints as any[]).length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Pain Points:', margin, y);
        y += 6;

        (interview.painPoints as any[]).forEach((point: any) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          if (point.severity === 'critical') {
            doc.setTextColor(220, 38, 38);
          } else if (point.severity === 'major') {
            doc.setTextColor(217, 119, 6);
          } else {
            doc.setTextColor(100, 116, 139);
          }
          doc.text(`[${point.severity?.toUpperCase()}]`, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(` ${point.theme}`, margin + 20, y);
          y += 5;
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          const quoteLines = doc.splitTextToSize(`"${point.quote}"`, contentWidth - 10);
          doc.text(quoteLines, margin + 5, y);
          y += quoteLines.length * 4 + 4;
        });
      }
    });

    // Footer with C4 branding
    addPdfFooter(doc);

    doc.save(`Stakeholder-Interviews-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    
    toast({
      title: "Report Exported",
      description: `Consolidated report with ${interviews.length} interviews has been downloaded.`,
    });
  };

  // Export rollup analysis report as PDF
  const exportRollupReport = (data: any, companyName?: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Cover Page with C4 Logo
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 80, 'F');
    
    try {
      doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 60, 10, 50, 38);
    } catch (e) {
      // Logo loading failed
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Interview Analysis Report', margin, 30);
    
    if (companyName) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName, margin, 45);
    }
    
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 65);

    let yPos = 95;

    // Executive Summary
    if (data.executiveSummary) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Executive Summary', margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const summaryLines = doc.splitTextToSize(data.executiveSummary, contentWidth);
      
      summaryLines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 15;
    }

    // Top Pain Points
    if (data.topPainPoints && data.topPainPoints.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Key Pain Points Identified', margin, yPos);
      yPos += 10;

      const painPointsData = data.topPainPoints.map((point: any) => [
        point.severity?.toUpperCase() || 'N/A',
        `${point.frequency || 1}x`,
        point.theme || '',
        (point.examples || []).slice(0, 1).join('; ') || '',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Severity', 'Freq', 'Theme', 'Example']],
        body: painPointsData,
        headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 50 },
          3: { cellWidth: 'auto', fontStyle: 'italic' },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Recommended Actions
    if (data.actionPriorities && data.actionPriorities.length > 0) {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Recommended Actions', margin, yPos);
      yPos += 10;

      // Highlight box for actions
      const actionsHeight = Math.min(data.actionPriorities.length * 15 + 10, 100);
      doc.setFillColor(240, 253, 244); // Light green background
      doc.roundedRect(margin, yPos - 5, contentWidth, actionsHeight, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94); // Green border
      doc.roundedRect(margin, yPos - 5, contentWidth, actionsHeight, 3, 3, 'S');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      data.actionPriorities.forEach((action: string, idx: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}.`, margin + 5, yPos + 3);
        doc.setFont('helvetica', 'normal');
        
        const actionLines = doc.splitTextToSize(action, contentWidth - 20);
        doc.text(actionLines, margin + 15, yPos + 3);
        yPos += actionLines.length * 5 + 5;
      });

      yPos += 15;
    }

    // Stakeholder Insights
    if (data.stakeholderInsights && data.stakeholderInsights.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Stakeholder Insights', margin, yPos);
      yPos += 10;

      const insightsData = data.stakeholderInsights.map((insight: any) => [
        insight.role || '',
        insight.keyTakeaway || '',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Role', 'Key Takeaway']],
        body: insightsData,
        headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
        },
      });
    }

    // Footer with C4 branding
    addPdfFooter(doc);

    const fileName = companyName 
      ? `Interview-Analysis-${companyName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
      : `Interview-Analysis-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    
    doc.save(fileName);
    
    toast({
      title: "Analysis Report Exported",
      description: "The interview analysis report has been downloaded as PDF.",
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use lower bitrate (64kbps) to reduce file size for long recordings
      // This allows ~45 minutes of recording within Whisper's 25MB limit
      const options: MediaRecorderOptions = { 
        mimeType: "audio/webm",
        audioBitsPerSecond: 64000 
      };
      
      // Fallback if browser doesn't support bitrate option
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch {
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Show warning at 20 minutes (file size may be getting large)
          if (newTime === 20 * 60) {
            toast({
              title: "Long Recording",
              description: "Recording is 20 minutes long. Consider stopping soon to ensure reliable processing.",
            });
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record interviews.",
        variant: "destructive",
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    // Also stop speech recognition
    stopSpeechToText();
  };
  
  // Speech-to-text functions
  const startSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech-to-text is not supported in your browser. Please use Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        setLiveTranscript(prev => prev + finalTranscript);
        setManualTranscript(prev => prev + finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access for speech-to-text.",
          variant: "destructive",
        });
      }
    };
    
    recognition.onend = () => {
      // Auto-restart if still active - use ref to avoid stale closure
      if (isSpeechActiveRef.current && speechRecognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already started or other error - ignore
        }
      }
    };
    
    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
      isSpeechActiveRef.current = true;
      setIsSpeechToTextActive(true);
      toast({
        title: "Speech-to-Text Active",
        description: "Recording continuously - speak naturally. Click Stop when done.",
      });
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  };
  
  const stopSpeechToText = () => {
    isSpeechActiveRef.current = false; // Set ref first to prevent auto-restart
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    setIsSpeechToTextActive(false);
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setSelectedRole("");
    setIntervieweeName("");
    setIntervieweeDepartment("");
    setConsentGiven(false);
    setManualTranscript("");
    setLiveTranscript("");
    stopSpeechToText();
  };

  const handleSubmitRecording = async () => {
    if (!selectedRole || !consentGiven) {
      toast({
        title: "Missing Information",
        description: "Please select a role and confirm consent before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Only include assessmentDeliverableId and clientCompanyId if they exist
      const sessionData: any = {
        intervieweeRole: selectedRole,
        intervieweeName: intervieweeName || undefined,
        intervieweeDepartment: intervieweeDepartment || undefined,
        consentGiven: true,
      };
      if (assessmentDeliverableId) {
        sessionData.assessmentDeliverableId = assessmentDeliverableId;
      }
      if (selectedClientCompanyId) {
        sessionData.clientCompanyId = selectedClientCompanyId;
      }
      const session = await createSessionMutation.mutateAsync(sessionData);

      if (audioBlob) {
        await uploadAudioMutation.mutateAsync({
          sessionId: (session as any).id,
          audio: audioBlob,
        });
      } else if (manualTranscript) {
        await saveManualTranscriptMutation.mutateAsync({
          sessionId: (session as any).id,
          transcript: manualTranscript,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save interview session.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const completedInterviews = interviews?.filter(i => i.summary) || [];
  const pendingInterviews = interviews?.filter(i => !i.summary) || [];
  
  // Calculate completed interviews for the selected rollup company
  const rollupCompletedCount = rollupClientCompanyId
    ? completedInterviews.filter(i => i.clientCompanyId === rollupClientCompanyId).length
    : completedInterviews.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Stakeholder Interviews
        </CardTitle>
        <CardDescription>
          Record interviews with maintenance personnel to understand pain points and improvement opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record" data-testid="tab-record">
              <Mic className="h-4 w-4 mr-2" />
              Record
            </TabsTrigger>
            <TabsTrigger value="interviews" data-testid="tab-interviews">
              <FileText className="h-4 w-4 mr-2" />
              Interviews ({interviews?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">
              <Target className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="space-y-6 mt-4">
            {/* Client Company Selection */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-primary" />
                <Label className="text-base font-semibold">Client Company (Optional)</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Organize interviews by client company for easy filtering and export
              </p>
              <div className="flex gap-2">
                <Select value={selectedClientCompanyId || "__none__"} onValueChange={(val) => setSelectedClientCompanyId(val === "__none__" ? "" : val)}>
                  <SelectTrigger className="flex-1" data-testid="select-client-company">
                    <SelectValue placeholder="Select or create a client company..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No company selected</SelectItem>
                    {clientCompanies?.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isCreateCompanyOpen} onOpenChange={setIsCreateCompanyOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" data-testid="button-create-company">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Client Company</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Company Name *</Label>
                        <Input
                          value={newClientCompanyName}
                          onChange={(e) => setNewClientCompanyName(e.target.value)}
                          placeholder="Enter client company name"
                          data-testid="input-new-company-name"
                        />
                      </div>
                      <Button
                        onClick={() => createClientCompanyMutation.mutate({ name: newClientCompanyName })}
                        disabled={!newClientCompanyName.trim() || createClientCompanyMutation.isPending}
                        data-testid="button-save-company"
                      >
                        {createClientCompanyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Create Company
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label>Interviewee Role *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Name (Optional)</Label>
                  <Input 
                    value={intervieweeName}
                    onChange={(e) => setIntervieweeName(e.target.value)}
                    placeholder="Interviewee name"
                    data-testid="input-name"
                  />
                </div>

                <div>
                  <Label>Department (Optional)</Label>
                  <Input 
                    value={intervieweeDepartment}
                    onChange={(e) => setIntervieweeDepartment(e.target.value)}
                    placeholder="Department or area"
                    data-testid="input-department"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="consent" 
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                    data-testid="checkbox-consent"
                  />
                  <Label htmlFor="consent" className="text-sm">
                    I confirm the interviewee has given verbal consent to be recorded
                  </Label>
                </div>
              </div>

            </div>

            {/* Always-visible Interview Question Guides */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              {/* Leadership Questions */}
              <div className={`border-2 rounded-lg p-4 ${selectedRole && getRoleLevel(selectedRole) === "leadership" ? "border-primary bg-primary/5" : "border-muted"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Leadership Interview Guide</h4>
                  <Badge variant={selectedRole && getRoleLevel(selectedRole) === "leadership" ? "default" : "secondary"} className="ml-auto">
                    {INTERVIEW_QUESTIONS.leadership.reduce((sum, cat) => sum + cat.questions.length, 0)} questions
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">For Managers, Planners, Storeroom, and Operations staff</p>
                <ScrollArea className="h-64">
                  <div className="space-y-4 pr-4">
                    {INTERVIEW_QUESTIONS.leadership.map((category, catIdx) => (
                      <div key={catIdx} className="space-y-2">
                        <h5 className="font-medium text-sm flex items-center gap-2 sticky top-0 bg-background py-1">
                          {category.icon === "users" ? <Users className="h-4 w-4 text-primary" /> : <ClipboardList className="h-4 w-4 text-primary" />}
                          {category.category}
                        </h5>
                        <ul className="space-y-1.5 text-sm">
                          {category.questions.map((question, idx) => (
                            <li key={idx} className="flex gap-2 p-1.5 rounded hover-elevate">
                              <span className="text-primary font-medium text-xs mt-0.5 min-w-[18px]">{idx + 1}.</span>
                              <span className="text-muted-foreground">{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Technician/Supervisor Questions */}
              <div className={`border-2 rounded-lg p-4 ${selectedRole && getRoleLevel(selectedRole) === "technician" ? "border-primary bg-primary/5" : "border-muted"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Technician & Supervisor Guide</h4>
                  <Badge variant={selectedRole && getRoleLevel(selectedRole) === "technician" ? "default" : "secondary"} className="ml-auto">
                    {INTERVIEW_QUESTIONS.technician.reduce((sum, cat) => sum + cat.questions.length, 0)} questions
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">For Technicians and Supervisors</p>
                <ScrollArea className="h-64">
                  <div className="space-y-4 pr-4">
                    {INTERVIEW_QUESTIONS.technician.map((category, catIdx) => (
                      <div key={catIdx} className="space-y-2">
                        <h5 className="font-medium text-sm flex items-center gap-2 sticky top-0 bg-background py-1">
                          {category.icon === "users" ? <Users className="h-4 w-4 text-primary" /> : <ClipboardList className="h-4 w-4 text-primary" />}
                          {category.category}
                        </h5>
                        <ul className="space-y-1.5 text-sm">
                          {category.questions.map((question, idx) => (
                            <li key={idx} className="flex gap-2 p-1.5 rounded hover-elevate">
                              <span className="text-primary font-medium text-xs mt-0.5 min-w-[18px]">{idx + 1}.</span>
                              <span className="text-muted-foreground">{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <div className="text-4xl font-mono mb-4 text-center">{formatTime(recordingTime)}</div>
              
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="flex justify-center gap-4 flex-wrap">
                  {!isRecording && !audioBlob && (
                    <Button 
                      size="lg" 
                      onClick={startRecording}
                      disabled={!selectedRole || !consentGiven}
                      data-testid="button-start-recording"
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      Start Recording
                    </Button>
                  )}

                  {isRecording && !isPaused && (
                    <>
                      <Button size="lg" variant="outline" onClick={pauseRecording}>
                        <Pause className="h-5 w-5 mr-2" />
                        Pause
                      </Button>
                      <Button size="lg" variant="destructive" onClick={stopRecording}>
                        <Square className="h-5 w-5 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}

                  {isRecording && isPaused && (
                    <>
                      <Button size="lg" variant="outline" onClick={resumeRecording}>
                        <Play className="h-5 w-5 mr-2" />
                        Resume
                      </Button>
                      <Button size="lg" variant="destructive" onClick={stopRecording}>
                        <Square className="h-5 w-5 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}

                  {audioBlob && !isRecording && (
                    <>
                      {/* File size warning for large recordings */}
                      {audioBlob.size > 20 * 1024 * 1024 && (
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            Large recording ({(audioBlob.size / (1024 * 1024)).toFixed(1)}MB) - 
                            {audioBlob.size > 25 * 1024 * 1024 
                              ? " too large for auto-transcription. Audio will be saved for manual transcription."
                              : " may take longer to process."}
                          </span>
                        </div>
                      )}
                      <Button 
                        size="lg" 
                        onClick={handleSubmitRecording}
                        disabled={uploadAudioMutation.isPending}
                        data-testid="button-submit-recording"
                      >
                        {uploadAudioMutation.isPending ? (
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-5 w-5 mr-2" />
                        )}
                        {uploadAudioMutation.isPending ? "Processing..." : "Submit & Transcribe"}
                      </Button>
                      <Button size="lg" variant="outline" onClick={resetRecording}>
                        Discard
                      </Button>
                    </>
                  )}
                </div>

                {/* Speech-to-Text Button */}
                {speechSupported && (
                  <Button 
                    variant={isSpeechToTextActive ? "destructive" : "secondary"}
                    onClick={isSpeechToTextActive ? stopSpeechToText : startSpeechToText}
                    disabled={!selectedRole || !consentGiven}
                    data-testid="button-speech-to-text"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    {isSpeechToTextActive ? "Stop Speech-to-Text" : "Start Speech-to-Text"}
                  </Button>
                )}
                
                {!speechSupported && (
                  <p className="text-sm text-muted-foreground">
                    Speech-to-text requires Chrome or Edge browser
                  </p>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center justify-center gap-2 text-destructive mb-4">
                  <span className="animate-pulse">
                    <MicOff className="h-4 w-4" />
                  </span>
                  Recording in progress...
                </div>
              )}
              
              {isSpeechToTextActive && (
                <div className="flex items-center justify-center gap-2 text-primary mb-4">
                  <span className="animate-pulse">
                    <Volume2 className="h-4 w-4" />
                  </span>
                  Listening... speak now
                </div>
              )}

              {/* Live Transcript Display */}
              {(liveTranscript || manualTranscript) && (
                <div className="mt-4">
                  <Label className="mb-2 block font-medium">Live Transcript</Label>
                  <Textarea
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    placeholder="Transcript will appear here as you speak, or you can type manually..."
                    className="min-h-[150px]"
                    data-testid="textarea-transcript"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    You can edit the transcript manually if needed
                  </p>
                </div>
              )}
              
              {/* Manual Transcript Input when not using speech-to-text */}
              {!liveTranscript && !manualTranscript && !isRecording && !audioBlob && (
                <div className="mt-4 border-t pt-4">
                  <Label className="mb-2 block font-medium">Or Enter Transcript Manually</Label>
                  <Textarea
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    placeholder="Type or paste the interview transcript here..."
                    className="min-h-[100px]"
                    data-testid="textarea-manual-transcript"
                  />
                </div>
              )}
            </div>

            {/* Submit manual transcript button */}
            {manualTranscript && !audioBlob && !isRecording && (
              <div className="flex justify-center mt-4">
                <Button 
                  size="lg"
                  onClick={handleSubmitRecording}
                  disabled={!selectedRole || !consentGiven || createSessionMutation.isPending}
                  data-testid="button-submit-transcript"
                >
                  {createSessionMutation.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5 mr-2" />
                  )}
                  Save Interview
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="interviews" className="mt-4">
            {/* Client Company Filter */}
            {clientCompanies && clientCompanies.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Filter by Company:</Label>
                <Select value={filterClientCompanyId || "__all__"} onValueChange={(val) => setFilterClientCompanyId(val === "__all__" ? "" : val)}>
                  <SelectTrigger className="w-[200px]" data-testid="select-filter-company">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All companies</SelectItem>
                    {clientCompanies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterClientCompanyId && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterClientCompanyId("")}>
                    Clear
                  </Button>
                )}
              </div>
            )}

            {isLoadingInterviews ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : interviews?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No interviews recorded yet</p>
                <p className="text-sm">Start by recording an interview with maintenance personnel</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group interviews by client company */}
                {(() => {
                  const filteredInterviews = interviews?.filter(interview => !filterClientCompanyId || interview.clientCompanyId === filterClientCompanyId) || [];
                  
                  // Group by client company
                  const groupedByCompany = filteredInterviews.reduce((acc, interview) => {
                    const companyId = interview.clientCompanyId || "__none__";
                    if (!acc[companyId]) {
                      acc[companyId] = [];
                    }
                    acc[companyId].push(interview);
                    return acc;
                  }, {} as Record<string, typeof filteredInterviews>);

                  // Sort company IDs: companies first, then no-company
                  const companyIds = Object.keys(groupedByCompany).sort((a, b) => {
                    if (a === "__none__") return 1;
                    if (b === "__none__") return -1;
                    return 0;
                  });

                  return companyIds.map(companyId => {
                    const companyInterviews = groupedByCompany[companyId];
                    const clientCompany = clientCompanies?.find(c => c.id === companyId);
                    const summarizedCount = companyInterviews.filter(i => i.summary).length;

                    return (
                      <div key={companyId} className="border rounded-lg overflow-hidden">
                        {/* Company Header */}
                        <div className="bg-muted/50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold">
                              {clientCompany?.name || "Unassigned Interviews"}
                            </h4>
                            <Badge variant="secondary" className="ml-2">
                              {companyInterviews.length} interview{companyInterviews.length !== 1 ? "s" : ""}
                            </Badge>
                            {summarizedCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                {summarizedCount} summarized
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Interviews List */}
                        <Accordion type="single" collapsible className="px-2 pb-2">
                          {companyInterviews.map((interview) => (
                            <AccordionItem key={interview.id} value={interview.id} className="border rounded-lg px-4 mt-2">
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3 w-full flex-wrap">
                                  <Badge variant={interview.summary ? "default" : "secondary"}>
                                    {ROLE_OPTIONS.find(r => r.value === interview.intervieweeRole)?.label || interview.intervieweeRole}
                                  </Badge>
                                  {interview.intervieweeName && (
                                    <span className="text-sm">{interview.intervieweeName}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-auto mr-2">
                                    {interview.createdAt ? new Date(interview.createdAt).toLocaleDateString() : ""}
                                  </span>
                                  {interview.summary ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4 pt-2">
                                {/* Action Buttons */}
                                <div className="flex gap-2 flex-wrap">
                                  {interview.transcript && !interview.summary && (
                                    <Button
                                      size="sm"
                                      onClick={() => summarizeInterviewMutation.mutate(interview.id)}
                                      disabled={summarizingId === interview.id}
                                      data-testid={`button-summarize-${interview.id}`}
                                    >
                                      {summarizingId === interview.id ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                      )}
                                      {summarizingId === interview.id ? "Summarizing..." : "Summarize with AI"}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => exportInterviewSummary(interview)}
                                    data-testid={`button-export-${interview.id}`}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                  </Button>
                                  
                                  {/* Reassign Company Dialog */}
                                  <Dialog 
                                    open={reassignInterviewId === interview.id} 
                                    onOpenChange={(open) => {
                                      if (!open) {
                                        setReassignInterviewId(null);
                                        setReassignTargetCompanyId("");
                                      }
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setReassignInterviewId(interview.id);
                                          setReassignTargetCompanyId(interview.clientCompanyId || "__none__");
                                        }}
                                        data-testid={`button-reassign-${interview.id}`}
                                      >
                                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                                        Reassign
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Reassign Interview to Different Company</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        <div>
                                          <Label className="text-sm font-medium">Current Company</Label>
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {clientCompanies?.find(c => c.id === interview.clientCompanyId)?.name || "Unassigned"}
                                          </p>
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium">Move to Company</Label>
                                          <Select 
                                            value={reassignTargetCompanyId || "__none__"} 
                                            onValueChange={setReassignTargetCompanyId}
                                          >
                                            <SelectTrigger data-testid="select-reassign-company">
                                              <SelectValue placeholder="Select company..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">Unassigned</SelectItem>
                                              {clientCompanies?.map(company => (
                                                <SelectItem key={company.id} value={company.id}>
                                                  {company.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="flex gap-2 justify-end pt-2">
                                          <Button
                                            variant="outline"
                                            onClick={() => {
                                              setReassignInterviewId(null);
                                              setReassignTargetCompanyId("");
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              const newCompanyId = reassignTargetCompanyId === "__none__" ? null : reassignTargetCompanyId;
                                              reassignInterviewMutation.mutate({
                                                interviewId: interview.id,
                                                clientCompanyId: newCompanyId,
                                              });
                                            }}
                                            disabled={reassignInterviewMutation.isPending}
                                            data-testid="button-confirm-reassign"
                                          >
                                            {reassignInterviewMutation.isPending ? (
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                                            )}
                                            {reassignInterviewMutation.isPending ? "Moving..." : "Move Interview"}
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>

                                {/* Audio Playback Section */}
                                {interview.audioObjectKey && (
                                  <AudioPlayer 
                                    sessionId={interview.id} 
                                    hasTranscript={!!interview.transcript}
                                    onRetryTranscription={() => retryTranscriptionMutation.mutate(interview.id)}
                                    isRetrying={retryingTranscriptionId === interview.id}
                                  />
                                )}

                                {interview.summary && (
                                  <div>
                                    <h5 className="font-medium mb-1">Summary</h5>
                                    <p className="text-sm text-muted-foreground">{interview.summary}</p>
                                  </div>
                                )}
                                
                                {interview.painPoints && (interview.painPoints as any[]).length > 0 && (
                                  <div>
                                    <h5 className="font-medium mb-2">Pain Points</h5>
                                    <div className="space-y-2">
                                      {(interview.painPoints as any[]).map((point: any, pidx: number) => (
                                        <div key={pidx} className="border rounded p-3 bg-muted/50">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={
                                              point.severity === "critical" ? "destructive" :
                                              point.severity === "major" ? "default" : "secondary"
                                            }>
                                              {point.severity}
                                            </Badge>
                                            <span className="font-medium text-sm">{point.theme}</span>
                                          </div>
                                          <p className="text-sm italic text-muted-foreground">"{point.quote}"</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {interview.transcript && (
                                  <div>
                                    <h5 className="font-medium mb-1">Full Transcript</h5>
                                    <ScrollArea className="h-40 border rounded p-2">
                                      <p className="text-sm whitespace-pre-wrap">{interview.transcript}</p>
                                    </ScrollArea>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-medium">Interview Rollup Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    Extract common themes and pain points across interviews
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={exportAllInterviews}
                    disabled={!interviews || interviews.length === 0}
                    data-testid="button-export-all-interviews"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export All (PDF)
                  </Button>
                </div>
              </div>

              {/* Client Company Selection for Rollup */}
              {clientCompanies && clientCompanies.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Select Client Company for Rollup</Label>
                      <p className="text-xs text-muted-foreground">Generate common themes from all interviews for a specific client</p>
                    </div>
                    <Select value={rollupClientCompanyId || "__all__"} onValueChange={(val) => setRollupClientCompanyId(val === "__all__" ? "" : val)}>
                      <SelectTrigger className="w-[220px]" data-testid="select-rollup-company">
                        <SelectValue placeholder="Select company..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Companies</SelectItem>
                        {clientCompanies.map(company => {
                          const companyInterviews = interviews?.filter(i => i.clientCompanyId === company.id && i.summary) || [];
                          return (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} ({companyInterviews.length} summarized)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => rollupMutation.mutate(rollupClientCompanyId || undefined)}
                      disabled={rollupCompletedCount < 2 || rollupMutation.isPending}
                      data-testid="button-generate-rollup"
                    >
                      {rollupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Summarize & Get Actions ({rollupCompletedCount} interviews)
                    </Button>
                  </div>
                </div>
              )}

              {/* Fallback for no client companies */}
              {(!clientCompanies || clientCompanies.length === 0) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    onClick={() => rollupMutation.mutate(undefined)}
                    disabled={rollupCompletedCount < 2 || rollupMutation.isPending}
                    data-testid="button-generate-rollup"
                  >
                    {rollupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Summarize & Get Actions ({rollupCompletedCount} interviews)
                  </Button>
                  {rollupCompletedCount < 2 && (
                    <span className="text-sm text-muted-foreground">
                      Need at least 2 summarized interviews
                    </span>
                  )}
                </div>
              )}

              {rollupMutation.data && (
                <div className="space-y-6 border rounded-lg p-4">
                  {/* Header with company context and export button */}
                  <div className="flex items-center justify-between gap-2 border-b pb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">
                        Interview Analysis Report
                        {rollupClientCompanyId && clientCompanies?.find(c => c.id === rollupClientCompanyId) && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            - {clientCompanies.find(c => c.id === rollupClientCompanyId)?.name}
                          </span>
                        )}
                      </h4>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportRollupReport(
                        rollupMutation.data,
                        rollupClientCompanyId ? clientCompanies?.find(c => c.id === rollupClientCompanyId)?.name : undefined
                      )}
                      data-testid="button-export-rollup-pdf"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>

                  {/* Executive Summary */}
                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Executive Summary
                    </h5>
                    <p className="text-sm bg-muted/50 rounded p-3">{(rollupMutation.data as any).executiveSummary}</p>
                  </div>

                  {/* Top Pain Points */}
                  {(rollupMutation.data as any).topPainPoints?.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Top Pain Points
                      </h5>
                      <div className="space-y-2">
                        {(rollupMutation.data as any).topPainPoints.map((point: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 border rounded p-3 bg-muted/30">
                            <Badge variant={point.severity === "critical" ? "destructive" : point.severity === "major" ? "default" : "secondary"}>
                              {point.frequency}x {point.severity}
                            </Badge>
                            <div className="flex-1">
                              <span className="font-medium">{point.theme}</span>
                              {point.examples?.length > 0 && (
                                <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                                  {point.examples.slice(0, 2).map((ex: string, exIdx: number) => (
                                    <li key={exIdx}>{ex}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Priority Actions - More prominent */}
                  {(rollupMutation.data as any).actionPriorities?.length > 0 && (
                    <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                        <CheckCircle className="h-5 w-5" />
                        Recommended Actions
                      </h5>
                      <div className="space-y-3">
                        {(rollupMutation.data as any).actionPriorities.map((action: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 bg-background rounded p-3 border">
                            <Badge variant="outline" className="shrink-0 font-bold">
                              {idx + 1}
                            </Badge>
                            <span className="text-sm">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stakeholder Insights */}
                  {(rollupMutation.data as any).stakeholderInsights?.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Stakeholder Insights
                      </h5>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(rollupMutation.data as any).stakeholderInsights.map((insight: any, idx: number) => (
                          <div key={idx} className="border rounded p-3">
                            <Badge variant="secondary" className="mb-2">{insight.role}</Badge>
                            <p className="text-sm text-muted-foreground">{insight.keyTakeaway}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {completedInterviews.length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Complete at least 2 interviews to generate a rollup summary
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
