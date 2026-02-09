import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ExcellenceDeliverable, ClientCompany } from "@shared/schema";
import { 
  ClipboardCheck, 
  Save, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Target,
  Building,
  User,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  History
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { InterviewRecorder } from "./interview-recorder";
import { Users, MessageSquare } from "lucide-react";

interface AssessmentItem {
  id: string;
  activityCode: string;
  activityName: string;
  elementNumber: number;
  description: string;
  possibleScore: number;
  actualScore: number;
  comments: string;
  category: string;
  scoringGuide: string;
}

interface ImprovementAction {
  id: string;
  step: number;
  priority: "critical" | "high" | "medium";
  action: string;
  rationale: string;
  sourceItemId: string;
  category: string;
}

interface AssessmentData {
  clientCompanyId?: string;
  clientCompanyName?: string;
  plantName: string;
  assessorName: string;
  assessmentDate: string;
  items: AssessmentItem[];
  improvementActions?: ImprovementAction[];
  totalScore?: number;
  maxScore?: number;
  percentageScore?: number;
}

// Map assessment items to improvement actions for Steps 1-6
const generateImprovementActions = (items: AssessmentItem[]): ImprovementAction[] => {
  const actions: ImprovementAction[] = [];
  
  // Activity code to Step mapping
  const activityToStep: Record<string, number> = {
    "1.1": 1, // Equipment Info → Step 1 Equipment Criticality
    "1.2": 1, // Evaluate & Prioritize → Step 1 Equipment Criticality
    "1.3": 2, // Define & Classify Failures → Step 2 RCA System
    "1.4": 4, // Determine PM Requirements → Step 4 PM Excellence
    "1.5": 3, // Storeroom Supplies → Step 3 Storeroom MRO
    "1.6": 5, // Schedule & Control Work → Step 5 Data-Driven Performance
  };

  // Priority based on possible score
  const getPriority = (possible: number): "critical" | "high" | "medium" => {
    if (possible >= 8) return "critical";
    if (possible >= 4) return "high";
    return "medium";
  };

  // Action templates based on item categories and gaps
  const actionTemplates: Record<string, (item: AssessmentItem, gap: number) => string> = {
    "Equipment Records": (item, gap) => 
      `Establish complete equipment registry with hierarchical structure (current gap: ${gap} points)`,
    "Failure Tracking": (item, gap) => 
      `Implement breakdown tracking system with trend visualization and prioritization (current gap: ${gap} points)`,
    "Work Order Management": (item, gap) => 
      `Define and implement work order type classification (emergency, corrective, preventive) (current gap: ${gap} points)`,
    "Documentation": (item, gap) => 
      `Create technical document management system with version control (current gap: ${gap} points)`,
    "Criticality Assessment": (item, gap) => 
      `Establish ABC criticality ranking methodology for all equipment (current gap: ${gap} points)`,
    "Visual Management": (item, gap) => 
      `Implement visual asset tagging with criticality indicators visible to operators (current gap: ${gap} points)`,
    "Safety": (item, gap) => 
      `Complete NFPA 70E arc flash assessment and establish prevention program (current gap: ${gap} points)`,
    "RCA Process": (item, gap) => 
      `Establish formal RCA process with 5-Why methodology and corrective action tracking (current gap: ${gap} points)`,
    "Continuous Improvement": (item, gap) => 
      `Implement daily failure review meetings with action item follow-up (current gap: ${gap} points)`,
    "PM Strategy": (item, gap) => 
      `Develop PM strategy using RCM/FMEA methodology for critical equipment (current gap: ${gap} points)`,
    "PM Optimization": (item, gap) => 
      `Optimize PM frequencies based on failure data analysis (current gap: ${gap} points)`,
    "Inventory Management": (item, gap) => 
      `Implement ABC parts classification with min/max levels for critical spares (current gap: ${gap} points)`,
    "Storeroom Operations": (item, gap) => 
      `Establish controlled storeroom with proper access controls and location system (current gap: ${gap} points)`,
    "Work Scheduling": (item, gap) => 
      `Implement weekly/daily maintenance scheduling with resource planning (current gap: ${gap} points)`,
    "Backlog Management": (item, gap) => 
      `Establish backlog management process with aging and prioritization (current gap: ${gap} points)`,
    "5S Standards": (item, gap) => 
      `Achieve 5S standards in maintenance shop with monthly audits (current gap: ${gap} points)`,
  };

  items.forEach(item => {
    const gap = item.possibleScore - item.actualScore;
    if (gap > 0) {
      const step = activityToStep[item.activityCode] || 1;
      const priority = getPriority(item.possibleScore);
      
      const actionFn = actionTemplates[item.category];
      const action = actionFn 
        ? actionFn(item, gap)
        : `Address gap in ${item.category}: ${item.description.substring(0, 100)}... (gap: ${gap} points)`;
      
      actions.push({
        id: `action-${item.id}`,
        step,
        priority,
        action,
        rationale: item.description,
        sourceItemId: item.id,
        category: item.category,
      });
    }
  });

  // Sort by priority (critical first) then by step
  return actions.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.step - b.step;
  });
}

interface ProcessAssessmentFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const defaultItems: AssessmentItem[] = [
  // 1.1 Prepare Equipment Information
  {
    id: "1.1.1",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 1,
    description: "A complete equipment record exists for every piece of equipment, the equipment is organized in a logical hierarchy, and equipment is easy to locate.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Equipment Records",
    scoringGuide: "Equipment records complete and organized in logical hierarchy"
  },
  {
    id: "1.1.2",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 2,
    description: "Breakdowns and trouble calls are tracked, graphed, and priorities understood.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Failure Tracking",
    scoringGuide: "Active tracking and visualization of breakdown data with clear prioritization"
  },
  {
    id: "1.1.3",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 3,
    description: "Appropriate work order types are used to track emergency, corrective, and preventive maintenance work.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Work Order Management",
    scoringGuide: "Work order types properly defined and consistently used"
  },
  {
    id: "1.1.4",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 4,
    description: "BOMs (Bills of Materials) are in place for A-Critical equipment.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "Equipment Records",
    scoringGuide: "Complete BOMs for all critical A-class equipment"
  },
  {
    id: "1.1.5",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 5,
    description: "A technical document management system is in place.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Documentation",
    scoringGuide: "Organized system for managing technical documents with version control"
  },
  {
    id: "1.1.6",
    activityCode: "1.1",
    activityName: "Prepare Equipment Information",
    elementNumber: 6,
    description: "Model line technical documentation is available and up to date.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Documentation",
    scoringGuide: "Current technical documentation for model/reference lines"
  },
  // 1.2 Evaluate & Prioritize Equipment
  {
    id: "1.2.1",
    activityCode: "1.2",
    activityName: "Evaluate & Prioritize Equipment",
    elementNumber: 1,
    description: "Equipment is ranked by criticality A, B & C.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Criticality Assessment",
    scoringGuide: "All equipment classified using ABC criticality methodology"
  },
  {
    id: "1.2.2",
    activityCode: "1.2",
    activityName: "Evaluate & Prioritize Equipment",
    elementNumber: 2,
    description: "Equipment # and priority rank are clearly marked on equipment and known by factory floor associates.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Visual Management",
    scoringGuide: "Visible asset tags with criticality markings; operators can identify rankings"
  },
  {
    id: "1.2.3",
    activityCode: "1.2",
    activityName: "Evaluate & Prioritize Equipment",
    elementNumber: 3,
    description: "An NFPA 70E arc flash assessment has been completed and a prevention program is in place.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "Safety",
    scoringGuide: "Complete arc flash study with labels, PPE requirements, and training program"
  },
  // 1.3 Define & Classify Failures
  {
    id: "1.3.1",
    activityCode: "1.3",
    activityName: "Define & Classify Failures",
    elementNumber: 1,
    description: "Failure definitions are established: \"equipment breakdown\" (part required), \"process failure\" (stop >10 min, no part), \"minor stop\" (<10 min), \"trouble call\" (non-breakdown emergency). Codes with time constraints defined and known.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Failure Classification",
    scoringGuide: "Clear failure type definitions known by all maintenance and operations personnel"
  },
  // 1.4 Understand Conditions & Level of Maintenance
  {
    id: "1.4.1",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 1,
    description: "Existing PMs have been cleaned up, and PM strategies have been developed based on equipment criticality. Robust 5S lubrication program exists.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "PM Strategy",
    scoringGuide: "PM optimization complete with criticality-based strategies and lubrication program"
  },
  {
    id: "1.4.2",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 2,
    description: "PM completion rate >= 95% (Focus on criticality \"A\" first).",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "PM Execution",
    scoringGuide: "Sustained PM completion rate at or above 95% with A-critical priority"
  },
  {
    id: "1.4.3",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 3,
    description: "Current maintenance workflow is understood and documented.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Process Documentation",
    scoringGuide: "Documented workflow with clear roles, responsibilities, and handoffs"
  },
  {
    id: "1.4.4",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 4,
    description: "70% Maintenance time is captured on a work order.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Work Order Management",
    scoringGuide: "At least 70% of maintenance labor hours documented on work orders"
  },
  {
    id: "1.4.5",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 5,
    description: "Basic storeroom management has been established.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "Storeroom Management",
    scoringGuide: "Organized storeroom with min/max levels, reorder points, and proper controls"
  },
  {
    id: "1.4.6",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 6,
    description: "Parts are ranked by ABC & critical spares identified.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Storeroom Management",
    scoringGuide: "Parts classified ABC with critical spares on BOM regardless of equipment rank"
  },
  {
    id: "1.4.7",
    activityCode: "1.4",
    activityName: "Understand Conditions & Level of Maintenance",
    elementNumber: 7,
    description: "Training program evaluated, skills needs assessment completed, training policy and priorities established, aligned with business goals.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "Maintenance Skills",
    scoringGuide: "Complete skills gap analysis with training policy aligned to business objectives"
  },
  // 1.5 Establish Baselines & Improvement Targets
  {
    id: "1.5.1",
    activityCode: "1.5",
    activityName: "Establish Baselines & Improvement Targets",
    elementNumber: 1,
    description: "A Maintenance scorecard is in place with baselines and improvement targets established.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "Performance Management",
    scoringGuide: "Scorecard includes: costs, breakdowns, OEE loss, MRO value, planned vs unplanned, PM completion"
  },
  // 1.6 PM Management
  {
    id: "1.6.1",
    activityCode: "1.6",
    activityName: "PM Management",
    elementNumber: 1,
    description: "Maintenance has staffed and developed a Planned Maintenance structure. Lead Maintenance Planner has developed a kitting program.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Planning & Scheduling",
    scoringGuide: "Dedicated planner role with cross-functional PM improvement team (Ops, Finance, Eng, CI)"
  },
  {
    id: "1.6.2",
    activityCode: "1.6",
    activityName: "PM Management",
    elementNumber: 2,
    description: "Cross-functional team meets at least weekly to review planned maintenance schedule and PM trends. Agenda used and minutes tracked.",
    possibleScore: 4,
    actualScore: 0,
    comments: "",
    category: "Planning & Scheduling",
    scoringGuide: "Weekly cross-functional meetings with documented agenda and minutes"
  },
  {
    id: "1.6.3",
    activityCode: "1.6",
    activityName: "PM Management",
    elementNumber: 3,
    description: "Planned maintenance communication board is in place and up to date displaying upcoming planned maintenance work and PM trends.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Visual Management",
    scoringGuide: "Visible communication board with current PM schedule and trends"
  },
  {
    id: "1.6.4",
    activityCode: "1.6",
    activityName: "PM Management",
    elementNumber: 4,
    description: "Maintenance uses failure data in daily meetings to prevent breakdowns and eliminate defects.",
    possibleScore: 2,
    actualScore: 0,
    comments: "",
    category: "Continuous Improvement",
    scoringGuide: "Daily review of breakdown and trouble call data in shift/daily meetings"
  },
  {
    id: "1.6.5",
    activityCode: "1.6",
    activityName: "PM Management",
    elementNumber: 5,
    description: "Maintenance shop at 5S level.",
    possibleScore: 8,
    actualScore: 0,
    comments: "",
    category: "5S Standards",
    scoringGuide: "Shop meets 5S standards with monthly audits sustained for 3+ consecutive months"
  }
];

export function ProcessAssessmentForm({ step, checklistItemId, onDismiss }: ProcessAssessmentFormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<AssessmentData>({
    plantName: "",
    assessorName: "",
    assessmentDate: new Date().toISOString().split('T')[0],
    items: defaultItems
  });
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({
    "1.1": true, "1.2": true, "1.3": true, "1.4": true, "1.5": true, "1.6": true
  });
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    industry: "",
    location: "",
    contactName: "",
    contactEmail: "",
    notes: ""
  });

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  const { data: clientCompanies = [] } = useQuery<ClientCompany[]>({
    queryKey: ["/api/client-companies"],
  });

  const createClientCompanyMutation = useMutation({
    mutationFn: async (companyData: typeof newCompanyForm) => {
      return apiRequest("POST", "/api/client-companies", companyData) as unknown as Promise<ClientCompany>;
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      setData(prev => ({
        ...prev,
        clientCompanyId: newCompany.id,
        clientCompanyName: newCompany.name,
        plantName: newCompany.name
      }));
      setNewCompanyForm({ name: "", industry: "", location: "", contactName: "", contactEmail: "", notes: "" });
      setShowNewCompanyDialog(false);
      toast({
        title: "Client Company Created",
        description: `${newCompany.name} has been added to your assessment history.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client company. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "process_assessment"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as AssessmentData;
        if (payload?.items) {
          setData(payload);
        }
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: AssessmentData): Promise<ExcellenceDeliverable> => {
      // Generate improvement actions based on gaps
      const improvementActions = generateImprovementActions(dataToSave.items);
      const totalPossible = dataToSave.items.reduce((sum, item) => sum + item.possibleScore, 0);
      const totalActual = dataToSave.items.reduce((sum, item) => sum + item.actualScore, 0);
      
      const enrichedData: AssessmentData = {
        ...dataToSave,
        improvementActions,
        totalScore: totalActual,
        maxScore: totalPossible,
        percentageScore: totalPossible > 0 ? Math.round((totalActual / totalPossible) * 100) : 0,
      };
      
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload: enrichedData,
          isComplete: true,
          completedAt: new Date().toISOString(),
        }) as unknown as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "process_assessment",
          title: "Maintenance Process Assessment",
          payload: enrichedData,
          isComplete: true,
          completedAt: new Date().toISOString(),
        }) as unknown as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (response) => {
      setDeliverableId(response.id);
      // Invalidate all step deliverables since actions affect steps 1-6
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "Assessment Saved",
        description: `Assessment saved with ${data.improvementActions?.length || 0} improvement actions generated for Steps 1-6.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateScore = (itemId: string, score: number) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId 
          ? { ...item, actualScore: Math.min(Math.max(0, score), item.possibleScore) }
          : item
      )
    }));
  };

  const updateComments = (itemId: string, comments: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, comments } : item
      )
    }));
  };

  const toggleActivity = (activityCode: string) => {
    setExpandedActivities(prev => ({
      ...prev,
      [activityCode]: !prev[activityCode]
    }));
  };

  // Group items by activity
  const groupedItems = data.items.reduce((acc, item) => {
    if (!acc[item.activityCode]) {
      acc[item.activityCode] = {
        name: item.activityName,
        items: []
      };
    }
    acc[item.activityCode].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: AssessmentItem[] }>);

  // Calculate scores
  const totalPossible = data.items.reduce((sum, item) => sum + item.possibleScore, 0);
  const totalActual = data.items.reduce((sum, item) => sum + item.actualScore, 0);
  const percentageScore = totalPossible > 0 ? Math.round((totalActual / totalPossible) * 100) : 0;

  // Get gaps (items with scores less than possible)
  const gaps = data.items.filter(item => item.actualScore < item.possibleScore);
  const criticalGaps = gaps.filter(item => item.possibleScore >= 8);
  const significantGaps = gaps.filter(item => item.possibleScore >= 4 && item.possibleScore < 8);

  const getScoreColor = (actual: number, possible: number) => {
    const percent = possible > 0 ? (actual / possible) * 100 : 0;
    if (percent >= 100) return "text-green-600 dark:text-green-400";
    if (percent >= 75) return "text-yellow-600 dark:text-yellow-400";
    if (percent >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const generateReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Maintenance Process Assessment Report', margin, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.plantName || 'Facility'} | ${data.assessorName || 'Assessor'} | ${data.assessmentDate}`, margin, 28);

    // Overall Score Box
    let yPos = 45;
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
    doc.setDrawColor(59, 130, 246);
    doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'S');

    doc.setTextColor(30, 64, 175);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OVERALL ASSESSMENT SCORE', margin + 10, yPos + 12);
    doc.setFontSize(28);
    doc.text(`${percentageScore}%`, margin + 10, yPos + 26);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${totalActual} / ${totalPossible} points`, margin + 50, yPos + 26);
    doc.text(`${gaps.length} improvement areas identified`, pageWidth - margin - 60, yPos + 20);

    yPos = 85;

    // Activity Summary Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Assessment by Activity Area', margin, yPos);
    yPos += 8;

    const activitySummary = Object.entries(groupedItems).map(([code, group]) => {
      const possible = group.items.reduce((s, i) => s + i.possibleScore, 0);
      const actual = group.items.reduce((s, i) => s + i.actualScore, 0);
      const percent = possible > 0 ? Math.round((actual / possible) * 100) : 0;
      return [code, group.name, `${actual}/${possible}`, `${percent}%`];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Code', 'Activity', 'Score', '%']],
      body: activitySummary,
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: contentWidth - 60 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Gaps/Improvement Areas
    if (gaps.length > 0) {
      doc.addPage();
      yPos = 20;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Custom Improvement Checklist (Based on Assessment Gaps)', margin, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('These items should be addressed in Step 1 of your Path to Excellence implementation.', margin, yPos + 5);
      yPos += 15;

      const gapData = gaps.map((gap, idx) => [
        (idx + 1).toString(),
        gap.activityCode,
        gap.description.substring(0, 80) + (gap.description.length > 80 ? '...' : ''),
        `${gap.actualScore}/${gap.possibleScore}`,
        gap.comments || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Area', 'Gap Description', 'Score', 'Notes']],
        body: gapData,
        theme: 'plain',
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 3 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 15 },
          2: { cellWidth: contentWidth - 85 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 40 }
        },
        margin: { left: margin, right: margin }
      });
    }

    // Detailed Assessment
    doc.addPage();
    yPos = 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Detailed Assessment Results', margin, yPos);
    yPos += 10;

    Object.entries(groupedItems).forEach(([code, group]) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const possible = group.items.reduce((s, i) => s + i.possibleScore, 0);
      const actual = group.items.reduce((s, i) => s + i.actualScore, 0);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(`${code} ${group.name} (${actual}/${possible})`, margin, yPos);
      yPos += 6;

      group.items.forEach(item => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const desc = doc.splitTextToSize(`${item.elementNumber}. ${item.description}`, contentWidth - 30);
        doc.text(desc, margin + 5, yPos);
        
        const scoreColor: [number, number, number] = item.actualScore >= item.possibleScore ? [22, 163, 74] : [220, 38, 38];
        doc.setTextColor(...scoreColor);
        doc.text(`${item.actualScore}/${item.possibleScore}`, pageWidth - margin - 15, yPos);
        
        yPos += desc.length * 4 + 3;
      });
      yPos += 5;
    });

    doc.save(`maintenance-process-assessment-${data.plantName || 'report'}.pdf`);
    toast({
      title: "Report Generated",
      description: "Your assessment report has been downloaded.",
    });
  };

  if (isLoading) {
    return <div className="p-6">Loading assessment...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Maintenance Process Assessment
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate current maintenance processes to generate your custom improvement checklist
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={generateReport}
            data-testid="button-generate-assessment-report"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button
            onClick={() => saveMutation.mutate(data)}
            disabled={saveMutation.isPending}
            data-testid="button-save-assessment"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="interviews" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="interviews" data-testid="tab-stakeholder-interviews">
            <Users className="w-4 h-4 mr-2" />
            1. Stakeholder Interviews
          </TabsTrigger>
          <TabsTrigger value="assessment" data-testid="tab-assessment">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            2. Process Assessment
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="assessment" className="space-y-6 mt-4">
          {/* Client Company Selection */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Client Company (Assessment History)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Select or create a client company to track this assessment</Label>
                  <Select
                    value={data.clientCompanyId || ""}
                    onValueChange={(value) => {
                      const selectedCompany = clientCompanies.find(c => c.id === value);
                      setData(prev => ({
                        ...prev,
                        clientCompanyId: value,
                        clientCompanyName: selectedCompany?.name || "",
                        plantName: selectedCompany?.name || prev.plantName
                      }));
                    }}
                  >
                    <SelectTrigger data-testid="select-client-company">
                      <SelectValue placeholder="Select a client company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} {company.industry && `(${company.industry})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-new-client-company">
                      <Plus className="w-4 h-4 mr-2" />
                      New Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Client Company</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Company Name *</Label>
                        <Input
                          value={newCompanyForm.name}
                          onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter company name"
                          data-testid="input-new-company-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Industry</Label>
                          <Input
                            value={newCompanyForm.industry}
                            onChange={(e) => setNewCompanyForm(prev => ({ ...prev, industry: e.target.value }))}
                            placeholder="e.g., Manufacturing"
                            data-testid="input-new-company-industry"
                          />
                        </div>
                        <div>
                          <Label>Location</Label>
                          <Input
                            value={newCompanyForm.location}
                            onChange={(e) => setNewCompanyForm(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g., Chicago, IL"
                            data-testid="input-new-company-location"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Contact Name</Label>
                          <Input
                            value={newCompanyForm.contactName}
                            onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                            placeholder="Primary contact"
                            data-testid="input-new-company-contact"
                          />
                        </div>
                        <div>
                          <Label>Contact Email</Label>
                          <Input
                            type="email"
                            value={newCompanyForm.contactEmail}
                            onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                            placeholder="contact@company.com"
                            data-testid="input-new-company-email"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={newCompanyForm.notes}
                          onChange={(e) => setNewCompanyForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any additional notes about this client..."
                          rows={2}
                          data-testid="input-new-company-notes"
                        />
                      </div>
                      <Button
                        onClick={() => createClientCompanyMutation.mutate(newCompanyForm)}
                        disabled={!newCompanyForm.name || createClientCompanyMutation.isPending}
                        className="w-full"
                        data-testid="button-create-client-company"
                      >
                        {createClientCompanyMutation.isPending ? "Creating..." : "Create Client Company"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {clientCompanies.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {clientCompanies.length} client {clientCompanies.length === 1 ? 'company' : 'companies'} in your assessment history
                </p>
              )}
            </CardContent>
          </Card>

          {/* Header Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="flex items-center gap-1">
                    <Building className="w-3 h-3" /> Plant/Facility Name
                  </Label>
                  <Input
                    value={data.plantName}
                    onChange={(e) => setData(prev => ({ ...prev, plantName: e.target.value }))}
                    placeholder="Enter plant name"
                    data-testid="input-plant-name"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Assessor Name
                  </Label>
                  <Input
                    value={data.assessorName}
                    onChange={(e) => setData(prev => ({ ...prev, assessorName: e.target.value }))}
                    placeholder="Enter assessor name"
                    data-testid="input-assessor-name"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Assessment Date
                  </Label>
                  <Input
                    type="date"
                    value={data.assessmentDate}
                    onChange={(e) => setData(prev => ({ ...prev, assessmentDate: e.target.value }))}
                    data-testid="input-assessment-date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

      {/* Overall Score */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(totalActual, totalPossible)}`}>
                  {percentageScore}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-2xl font-semibold">{totalActual}</div>
                <div className="text-sm text-muted-foreground">of {totalPossible} points</div>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>{criticalGaps.length} Critical Gaps</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-orange-500" />
                <span>{significantGaps.length} Significant Gaps</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4 text-blue-500" />
                <span>{gaps.length} Total Improvements</span>
              </div>
            </div>
          </div>
          <Progress value={percentageScore} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Assessment Items by Activity */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([activityCode, group]) => {
          const activityPossible = group.items.reduce((s, i) => s + i.possibleScore, 0);
          const activityActual = group.items.reduce((s, i) => s + i.actualScore, 0);
          const activityPercent = activityPossible > 0 ? Math.round((activityActual / activityPossible) * 100) : 0;

          return (
            <Card key={activityCode}>
              <Collapsible open={expandedActivities[activityCode]} onOpenChange={() => toggleActivity(activityCode)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover-elevate">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline">{activityCode}</Badge>
                        {group.name}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className={`font-semibold ${getScoreColor(activityActual, activityPossible)}`}>
                          {activityActual}/{activityPossible} ({activityPercent}%)
                        </div>
                        {expandedActivities[activityCode] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                    <Progress value={activityPercent} className="h-2 mt-2" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {group.items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                Element {item.elementNumber}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                              <Badge 
                                variant={item.actualScore >= item.possibleScore ? "default" : "destructive"}
                                className="text-xs"
                              >
                                Max {item.possibleScore} pts
                              </Badge>
                            </div>
                            <p className="text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Scoring: {item.scoringGuide}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1 min-w-[80px]">
                            <Label className="text-xs">Score</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={item.possibleScore}
                                step={0.1}
                                value={item.actualScore}
                                onChange={(e) => updateScore(item.id, parseFloat(e.target.value) || 0)}
                                className="w-16 text-center"
                                data-testid={`input-score-${item.id}`}
                              />
                              <span className="text-sm text-muted-foreground">/ {item.possibleScore}</span>
                            </div>
                            {item.actualScore >= item.possibleScore && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Comments / Observations</Label>
                          <Textarea
                            value={item.comments}
                            onChange={(e) => updateComments(item.id, e.target.value)}
                            placeholder="Document observations, evidence, or notes..."
                            className="mt-1 text-sm"
                            rows={2}
                            data-testid={`input-comments-${item.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

          {/* Generated Checklist Preview */}
          {gaps.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  Your Custom Step 1 Checklist ({gaps.length} items)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Based on your assessment, these are the improvement areas for your Path to Excellence implementation
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {gaps.map((gap, idx) => (
                    <div 
                      key={gap.id} 
                      className="flex items-start gap-3 p-2 bg-background rounded border"
                    >
                      <Badge variant={gap.possibleScore >= 8 ? "destructive" : gap.possibleScore >= 4 ? "default" : "secondary"} className="mt-0.5">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{gap.activityCode} - {gap.category}</p>
                        <p className="text-xs text-muted-foreground">{gap.description}</p>
                        <p className="text-xs mt-1">
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            Gap: {gap.possibleScore - gap.actualScore} pts
                          </span>
                          {gap.comments && <span className="ml-2 text-muted-foreground">| {gap.comments}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="interviews" className="mt-4 space-y-4">
          {/* Interview Guidance */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Why Interview First?</h4>
                  <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mt-1">
                    Stakeholder interviews provide critical context before scoring. Technicians reveal frontline challenges, 
                    while leadership shares strategic perspectives. These insights help you score the assessment accurately 
                    and identify gaps that numbers alone might miss.
                  </p>
                  <div className="flex gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">Leadership</Badge>
                      <span className="text-blue-700 dark:text-blue-300">Cultural + Strategic view</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">Technician</Badge>
                      <span className="text-blue-700 dark:text-blue-300">Day-to-day realities</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {deliverableId ? (
            <InterviewRecorder assessmentDeliverableId={deliverableId} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-2">
                  Save the assessment header first to enable stakeholder interviews
                </p>
                <p className="text-sm text-muted-foreground">
                  Enter plant name, assessor name, and date above, then click "Save Assessment"
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
