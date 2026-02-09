import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, Sparkles, AlertCircle, CheckCircle2, FileText, TrendingDown, TrendingUp, Clock, AlertTriangle, Lightbulb, Shield, Archive, ArchiveRestore, Trash2, Download, Search, Target, Zap, ChevronRight, BarChart2, Activity, Loader2, GitBranch, Users, Wrench, Box, Leaf, Ruler, Check, ExternalLink, ClipboardCheck, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type DowntimeReport, type BreakdownAnalysis } from "@shared/schema";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// C4 Path to Excellence step mapping
const C4_STEPS = [
  { id: 0, name: 'Initial Process Assessment', icon: ClipboardCheck, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 1, name: 'Equipment Criticality Assessment', icon: Target, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 2, name: 'Root Cause Analysis System', icon: Users, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 3, name: 'Storeroom MRO Optimization', icon: Package, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 4, name: 'Preventive Maintenance Excellence', icon: Wrench, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 5, name: 'Data-Driven Performance Management', icon: BarChart2, color: 'text-red-500', bgColor: 'bg-red-500/10' },
];

// Professional text sanitizer - removes ALL markdown and formatting artifacts
const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    // Remove markdown headers
    .replace(/^#{1,6}\s*/gm, '')
    // Remove bold markers (handles nested cases)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Remove italic markers
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove bullet points and list markers
    .replace(/^\s*[-*+•]\s*/gm, '')
    .replace(/^\s*\d+[.)]\s*/gm, '')
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove backticks
    .replace(/`+([^`]*)`+/g, '$1')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove smart quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Clean up extra whitespace and newlines
    .replace(/\n{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export default function Downtime() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedReport, setSelectedReport] = useState<DowntimeReport | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [deepDiveDialog, setDeepDiveDialog] = useState<{ open: boolean; finding: any | null; type: string }>({ open: false, finding: null, type: "" });
  const [deepDiveResult, setDeepDiveResult] = useState<any | null>(null);
  const [activeSegmentTab, setActiveSegmentTab] = useState<string>("overview");
  const [breakdownDialog, setBreakdownDialog] = useState<{ open: boolean; finding: any | null; segment: string }>({ open: false, finding: null, segment: "" });
  const [breakdownResult, setBreakdownResult] = useState<BreakdownAnalysis | null>(null);
  const [breakdownActiveTab, setBreakdownActiveTab] = useState<string>("fivewhys");
  const [actionChecklist, setActionChecklist] = useState<Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    owner: string;
    timeline: string;
    successMetric: string;
    estimatedCost?: string;
    resources?: string;
    implementationSteps?: string[];
    raci?: { responsible: string; accountable: string; consulted: string; informed: string };
    status: 'pending' | 'in_progress' | 'completed';
    notes: string;
    dueDate?: string;
    completedDate?: string;
    segment: string;
    findingTitle: string;
  }>>([]);
  const [creatingWorkOrderForAction, setCreatingWorkOrderForAction] = useState<string | null>(null);
  const [showActionChecklist, setShowActionChecklist] = useState(false);

  const { data: reports = [], isLoading } = useQuery<DowntimeReport[]>({
    queryKey: ["/api/downtime/reports"],
    enabled: !!user,
  });

  const generateAnalysisReport = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/downtime/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate analysis report");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      setShowImportDialog(false);
      setSelectedFile(null);
      toast({
        title: "Analysis Complete!",
        description: `Analyzed ${data.recordCount} records (${data.totalDowntimeHours.toFixed(1)} hours). Report generated successfully.`,
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Failed to generate downtime analysis report";
      if (errorMessage.includes("413") || errorMessage.includes("Too Large") || errorMessage.includes("Request Entity")) {
        errorMessage = "File is too large for the server. Please try a smaller file (under 25MB) or split your data into smaller chunks.";
      }
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const archiveReport = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/downtime/reports/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Archived",
        description: "Report has been archived successfully",
      });
    },
  });

  const unarchiveReport = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/downtime/reports/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Restored",
        description: "Report has been restored from archive",
      });
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/downtime/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downtime/reports"] });
      toast({
        title: "Report Deleted",
        description: "Report has been permanently deleted",
      });
    },
  });

  const analyzeKeyFinding = useMutation({
    mutationFn: async ({ finding, context, findingId }: { finding: any; context?: string; findingId: string }) => {
      if (!selectedReport) throw new Error("No report selected");
      const response = await apiRequest("POST", `/api/downtime/reports/${selectedReport.id}/key-findings/${findingId}/analyze`, { finding, context });
      return await response.json();
    },
    onSuccess: (data) => {
      setDeepDiveResult(data);
      toast({
        title: "Analysis Complete",
        description: "Deep-dive breakdown has been generated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate deep-dive analysis",
        variant: "destructive",
      });
    },
  });

  const generateBreakdownAnalysis = useMutation({
    mutationFn: async ({ finding, segment }: { finding: any; segment: string }) => {
      if (!selectedReport) throw new Error("No report selected");
      const response = await apiRequest("POST", `/api/downtime/reports/${selectedReport.id}/breakdown-analysis`, { finding, segment });
      const data = await response.json();
      return data as BreakdownAnalysis;
    },
    onSuccess: (data: BreakdownAnalysis) => {
      setBreakdownResult(data);
      toast({
        title: "Breakdown Analysis Complete",
        description: "5 Whys and Fishbone diagram have been generated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate breakdown analysis",
        variant: "destructive",
      });
    },
  });

  const createWorkOrderFromAction = useMutation({
    mutationFn: async (action: {
      id: string;
      title: string;
      description: string;
      priority: string;
      timeline: string;
      segment: string;
      findingTitle: string;
    }) => {
      setCreatingWorkOrderForAction(action.id);
      const priorityMap: Record<string, string> = {
        'immediate': 'critical',
        'short-term': 'high',
        'medium-term': 'medium',
        'long-term': 'low'
      };
      const workOrderData = {
        title: `[RCA] ${action.title}`,
        description: `${action.description}\n\nGenerated from RCA Finding: ${action.findingTitle}\nSegment: ${action.segment}\nTimeline: ${action.timeline}`,
        priority: priorityMap[action.priority] || 'medium',
        type: 'corrective',
        status: 'open',
      };
      const response = await apiRequest("POST", "/api/work-orders", workOrderData);
      return await response.json();
    },
    onSuccess: () => {
      setCreatingWorkOrderForAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work Order Created",
        description: "A new work order has been created from this action",
      });
    },
    onError: (error: any) => {
      setCreatingWorkOrderForAction(null);
      toast({
        title: "Failed to Create Work Order",
        description: error.message || "Could not create work order",
        variant: "destructive",
      });
    },
  });

  const activeReports = reports.filter(report => !report.archived);
  const archivedReports = reports.filter(report => report.archived);
  const displayedReports = activeTab === "active" ? activeReports : archivedReports;

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to analyze",
        variant: "destructive",
      });
      return;
    }
    generateAnalysisReport.mutate(selectedFile);
  };

  const exportFindingToPDF = async (analysis: any, finding: any) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    const navy = [20, 40, 80] as [number, number, number];
    const green = [16, 185, 129] as [number, number, number];
    const gray = [100, 100, 100] as [number, number, number];
    
    // Header
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25);
    } catch {}
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Comprehensive Breakdown Report', 50, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('C4 Industrial | Deep-Dive Analysis', 50, 24);
    
    let y = 45;
    
    // Finding Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(analysis.findingDetails?.title || finding?.cause || finding?.title || 'Key Finding Analysis', margin, y);
    y += 10;
    
    // Executive Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', margin, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(sanitizeText(analysis.executiveSummary || ''), contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5 + 10;
    
    // Finding Details
    if (analysis.findingDetails) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Finding Details', margin, y);
      y += 6;
      
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Severity', sanitizeText(analysis.findingDetails.severity || 'N/A')],
          ['Impact Score', `${analysis.findingDetails.impactScore || 'N/A'}/10`],
          ['Downtime Contribution', sanitizeText(analysis.findingDetails.downtimeContribution || 'N/A')]
        ],
        theme: 'grid',
        headStyles: { fillColor: navy, fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Root Cause Breakdown
    if (analysis.rootCauseBreakdown) {
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Root Cause Breakdown', margin, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Primary Cause:', margin, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      const causeLines = doc.splitTextToSize(sanitizeText(analysis.rootCauseBreakdown.primaryCause || ''), contentWidth);
      doc.text(causeLines, margin, y);
      y += causeLines.length * 5 + 5;
      
      if (analysis.rootCauseBreakdown.contributingFactors?.length) {
        doc.setFont('helvetica', 'bold');
        doc.text('Contributing Factors:', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        analysis.rootCauseBreakdown.contributingFactors.forEach((f: string) => {
          doc.text(`• ${sanitizeText(f)}`, margin + 4, y);
          y += 5;
        });
        y += 5;
      }
    }
    
    // Recommended Actions
    if (analysis.recommendedActions?.length) {
      if (y > pageHeight - 80) { doc.addPage(); y = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Recommended Actions', margin, y);
      y += 6;
      
      autoTable(doc, {
        startY: y,
        head: [['Action', 'Priority', 'Owner', 'Timeline']],
        body: analysis.recommendedActions.map((a: any) => [
          sanitizeText(a.action || ''),
          sanitizeText(a.priority || 'N/A'),
          sanitizeText(a.owner || 'TBD'),
          sanitizeText(a.timeline || 'TBD')
        ]),
        theme: 'grid',
        headStyles: { fillColor: green, fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Risk Assessment
    if (analysis.riskAssessment) {
      if (y > pageHeight - 50) { doc.addPage(); y = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Risk Assessment', margin, y);
      y += 6;
      
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Recurrence Probability', sanitizeText(analysis.riskAssessment.recurrenceProbability || 'N/A')],
          ['Consequence Severity', sanitizeText(analysis.riskAssessment.consequenceSeverity || 'N/A')],
          ['Risk Score', `${analysis.riskAssessment.riskScore || 'N/A'}/25`],
          ['Mitigation Priority', sanitizeText(analysis.riskAssessment.mitigationPriority || 'N/A')]
        ],
        theme: 'grid',
        headStyles: { fillColor: navy, fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
      });
    }
    
    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text('C4 Industrial | Confidential', margin, pageHeight - 6);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
    
    doc.save(`Finding_Breakdown_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
    toast({
      title: "Report Exported",
      description: "Deep-dive analysis report has been downloaded",
    });
  };

  const exportBreakdownToPDF = async (breakdown: BreakdownAnalysis) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    const colors = {
      navy: [20, 40, 80] as [number, number, number],
      primary: [59, 130, 246] as [number, number, number],
      success: [22, 163, 74] as [number, number, number],
      warning: [234, 88, 12] as [number, number, number],
      danger: [220, 38, 38] as [number, number, number],
      gray: [100, 116, 139] as [number, number, number],
      bgLight: [248, 250, 252] as [number, number, number],
    };
    
    const checkPageBreak = (requiredSpace: number, currentY: number): number => {
      if (currentY + requiredSpace > pageHeight - 30) {
        doc.addPage();
        addPageHeader();
        return 50;
      }
      return currentY;
    };
    
    const addPageHeader = () => {
      doc.setFillColor(...colors.navy);
      doc.rect(0, 0, pageWidth, 35, 'F');
      try { doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25); } catch {}
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('C4 INDUSTRIAL', margin + 30, 14);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('BREAKDOWN ANALYSIS - 5 WHYS & FISHBONE', margin + 30, 26);
    };
    
    addPageHeader();
    let y = 45;
    
    // Title and Segment
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizeText(breakdown.findingTitle || 'Key Finding Analysis'), margin, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text(`Segment: ${breakdown.segment?.toUpperCase() || 'GENERAL'}`, margin, y);
    y += 10;
    
    // Executive Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary', margin, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(sanitizeText(breakdown.executiveSummary || ''), contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5 + 12;
    
    // Cost-Benefit Metrics Bar
    if (breakdown.costBenefitAnalysis) {
      y = checkPageBreak(30, y);
      doc.setFillColor(240, 253, 244);
      doc.rect(margin, y, contentWidth, 22, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.rect(margin, y, contentWidth, 22, 'S');
      
      const colWidth = contentWidth / 4;
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray);
      doc.text('Annual Savings', margin + 5, y + 6);
      doc.text('Implementation Cost', margin + colWidth + 5, y + 6);
      doc.text('Payback Period', margin + colWidth * 2 + 5, y + 6);
      doc.text('Risk Reduction', margin + colWidth * 3 + 5, y + 6);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text(sanitizeText(breakdown.costBenefitAnalysis.annualSavings || 'N/A'), margin + 5, y + 15);
      doc.setTextColor(0, 0, 0);
      doc.text(sanitizeText(breakdown.costBenefitAnalysis.implementationCost || 'N/A'), margin + colWidth + 5, y + 15);
      doc.setTextColor(59, 130, 246);
      doc.text(sanitizeText(breakdown.costBenefitAnalysis.paybackPeriod || 'N/A'), margin + colWidth * 2 + 5, y + 15);
      doc.setTextColor(0, 0, 0);
      doc.text(sanitizeText(breakdown.costBenefitAnalysis.riskReduction || 'N/A'), margin + colWidth * 3 + 5, y + 15);
      y += 30;
    }
    
    // Verification Evidence Section
    if (breakdown.verificationEvidence && breakdown.verificationEvidence.length > 0) {
      y = checkPageBreak(60, y);
      doc.setFillColor(251, 191, 36);
      doc.rect(margin, y, 4, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Verification Evidence (What Team Should Find)', margin + 8, y + 7);
      y += 16;
      
      const evidenceData = breakdown.verificationEvidence.map(ev => [
        sanitizeText(ev.observation || ''),
        sanitizeText(ev.measurementRecommendation || ev.measuredValue || ''),
        sanitizeText(ev.specificationSource || ev.specificationRange || ''),
        sanitizeText(ev.inspectionMethod || ev.deviation || ''),
        sanitizeText(ev.standardReference || '')
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Finding to Investigate', 'What to Measure', 'Where to Find Spec', 'Inspection Method', 'Standard Ref']],
        body: evidenceData,
        theme: 'grid',
        headStyles: { fillColor: [251, 146, 60], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 30 },
          4: { cellWidth: 26 }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Permanent Countermeasures Section
    if (breakdown.permanentCountermeasures && breakdown.permanentCountermeasures.length > 0) {
      y = checkPageBreak(60, y);
      doc.setFillColor(...colors.success);
      doc.rect(margin, y, 4, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Permanent Countermeasures', margin + 8, y + 7);
      y += 16;
      
      const cmData = breakdown.permanentCountermeasures.map((cm, idx) => [
        `${idx + 1}`,
        sanitizeText(cm.action || ''),
        sanitizeText(cm.specification || ''),
        sanitizeText(cm.torqueSpec || 'N/A'),
        sanitizeText(cm.partNumber || 'N/A'),
        sanitizeText(cm.standardReference || '')
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['#', 'Action', 'Specification', 'Torque', 'Part #', 'Std Ref']],
        body: cmData,
        theme: 'grid',
        headStyles: { fillColor: colors.success, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 40 },
          2: { cellWidth: 45 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Technician Validation Steps
    if (breakdown.technicianValidationSteps && breakdown.technicianValidationSteps.length > 0) {
      y = checkPageBreak(50, y);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Technician Validation Steps', margin, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      breakdown.technicianValidationSteps.forEach((step, idx) => {
        const stepLines = doc.splitTextToSize(`${idx + 1}. ${sanitizeText(step)}`, contentWidth - 5);
        y = checkPageBreak(stepLines.length * 4 + 4, y);
        doc.text(stepLines, margin + 5, y);
        y += stepLines.length * 4 + 3;
      });
      y += 8;
    }
    
    // 5 Whys Section
    y = checkPageBreak(60, y);
    doc.setFillColor(...colors.primary);
    doc.rect(margin, y, 4, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('5 Whys Analysis', margin + 8, y + 7);
    y += 16;
    
    if (breakdown.fiveWhys?.length > 0) {
      const whysData = breakdown.fiveWhys.map(why => [
        `Why ${why.step}`,
        sanitizeText(why.question),
        sanitizeText(why.answer),
        why.confidence || 'N/A'
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Step', 'Question', 'Answer', 'Confidence']],
        body: whysData,
        theme: 'grid',
        headStyles: { fillColor: colors.navy, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 50 },
          2: { cellWidth: 80 },
          3: { cellWidth: 22 }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Fishbone Section
    y = checkPageBreak(80, y);
    doc.setFillColor(...colors.warning);
    doc.rect(margin, y, 4, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Fishbone (Ishikawa) Diagram Analysis', margin + 8, y + 7);
    y += 16;
    
    const fishboneCategories = [
      { key: 'man', label: 'Man (People)', color: colors.primary },
      { key: 'machine', label: 'Machine (Equipment)', color: colors.warning },
      { key: 'method', label: 'Method (Process)', color: colors.success },
      { key: 'material', label: 'Material (Supplies)', color: [124, 58, 237] as [number, number, number] },
      { key: 'environment', label: 'Environment', color: [6, 182, 212] as [number, number, number] },
      { key: 'measurement', label: 'Measurement (Data)', color: [236, 72, 153] as [number, number, number] },
    ];
    
    const fishboneData: string[][] = [];
    fishboneCategories.forEach(cat => {
      const causes = breakdown.fishbone?.[cat.key as keyof typeof breakdown.fishbone] || [];
      if (causes.length > 0) {
        causes.forEach(cause => {
          fishboneData.push([
            cat.label,
            sanitizeText(cause.factor),
            sanitizeText(cause.description),
            cause.likelihood || 'N/A'
          ]);
        });
      }
    });
    
    if (fishboneData.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Category', 'Factor', 'Description', 'Likelihood']],
        body: fishboneData,
        theme: 'grid',
        headStyles: { fillColor: colors.navy, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { cellWidth: 80 },
          3: { cellWidth: 20 }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Root Cause
    if (breakdown.rootCause) {
      y = checkPageBreak(40, y);
      doc.setFillColor(...colors.danger);
      doc.rect(margin, y, 4, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Identified Root Cause', margin + 8, y + 7);
      y += 14;
      
      doc.setFillColor(...colors.bgLight);
      doc.rect(margin, y, contentWidth, 20, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const rcLines = doc.splitTextToSize(sanitizeText(breakdown.rootCause.statement), contentWidth - 10);
      doc.text(rcLines, margin + 5, y + 8);
      y += 25;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Category: ${breakdown.rootCause.category?.toUpperCase() || 'N/A'} | Confidence: ${breakdown.rootCause.confidence?.toUpperCase() || 'N/A'}`, margin, y);
      y += 12;
    }
    
    // Action Plan
    if (breakdown.actionPlan?.length > 0) {
      y = checkPageBreak(60, y);
      doc.setFillColor(...colors.success);
      doc.rect(margin, y, 4, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Recommended Action Plan', margin + 8, y + 7);
      y += 16;
      
      const actionData = breakdown.actionPlan.map(action => [
        sanitizeText(action.title),
        sanitizeText(action.description),
        action.priority || 'N/A',
        sanitizeText(action.ownerRole),
        sanitizeText(action.timeline)
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Action', 'Description', 'Priority', 'Owner', 'Timeline']],
        body: actionData,
        theme: 'grid',
        headStyles: { fillColor: colors.navy, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 55 },
          2: { cellWidth: 20 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Preventive Measures
    if (breakdown.preventiveMeasures?.length > 0) {
      y = checkPageBreak(40, y);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Preventive Measures', margin, y);
      y += 8;
      
      const pmData = breakdown.preventiveMeasures.map(pm => [
        sanitizeText(pm.measure),
        sanitizeText(pm.frequency),
        sanitizeText(pm.responsibility)
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Measure', 'Frequency', 'Responsibility']],
        body: pmData,
        theme: 'grid',
        headStyles: { fillColor: colors.navy, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Risks
    if (breakdown.risks?.length > 0) {
      y = checkPageBreak(30, y);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.warning);
      doc.text('Risks if Not Addressed', margin, y);
      y += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      breakdown.risks.forEach(risk => {
        const riskLines = doc.splitTextToSize(`• ${sanitizeText(risk)}`, contentWidth);
        y = checkPageBreak(riskLines.length * 4 + 2, y);
        doc.text(riskLines, margin, y);
        y += riskLines.length * 4 + 2;
      });
      y += 8;
    }
    
    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray);
      doc.text('C4 Industrial | Confidential', margin, pageHeight - 6);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
    
    doc.save(`Breakdown_Analysis_${breakdown.segment || 'general'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
    toast({
      title: "Report Exported",
      description: "Breakdown analysis report has been downloaded",
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please log in to view downtime analysis</p>
      </div>
    );
  }

  const exportToPDF = async (report: DowntimeReport) => {
    try {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const analysis = report.analysisData;
    const segments = constructSegmentsFromLegacyData(analysis);
    
    // Debug logging to understand data structure
    console.log('=== PDF EXPORT DEBUG ===');
    console.log('Analysis keys:', analysis ? Object.keys(analysis) : 'null');
    console.log('Analysis.recommendations:', analysis?.recommendations?.length || 0);
    console.log('Analysis.segments:', analysis?.segments ? Object.keys(analysis.segments) : 'none');
    if (analysis?.segments) {
      Object.entries(analysis.segments).forEach(([key, seg]: [string, any]) => {
        console.log(`Segment ${key} recommendations:`, seg?.recommendations?.length || 0);
      });
    }
    console.log('Constructed segments:', segments ? Object.keys(segments) : 'none');
    if (segments) {
      Object.entries(segments).forEach(([key, seg]: [string, any]) => {
        console.log(`Constructed segment ${key} recommendations:`, seg?.recommendations?.length || 0);
      });
    }
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Professional color palette
    const colors = {
      primary: [30, 58, 95] as [number, number, number],
      accent: [59, 130, 246] as [number, number, number],
      success: [22, 163, 74] as [number, number, number],
      warning: [234, 88, 12] as [number, number, number],
      danger: [220, 38, 38] as [number, number, number],
      purple: [124, 58, 237] as [number, number, number],
      cyan: [6, 182, 212] as [number, number, number],
      textDark: [30, 41, 59] as [number, number, number],
      textMuted: [100, 116, 139] as [number, number, number],
      bgLight: [248, 250, 252] as [number, number, number],
      border: [226, 232, 240] as [number, number, number],
      safety: [220, 38, 38] as [number, number, number],
      quality: [234, 88, 12] as [number, number, number],
      operations: [124, 58, 237] as [number, number, number],
      maintenance: [59, 130, 246] as [number, number, number]
    };
    
    // Segment icons and labels
    const segmentConfig: Record<string, { label: string; color: [number, number, number] }> = {
      safety: { label: 'Safety', color: colors.safety },
      quality: { label: 'Quality', color: colors.quality },
      operations: { label: 'Operations', color: colors.operations },
      maintenance: { label: 'Maintenance', color: colors.maintenance }
    };
    
    // Helper: Add section header with professional styling
    const addSectionHeader = (title: string, color: [number, number, number], y: number): number => {
      doc.setFillColor(...color);
      doc.rect(margin, y, 3, 12, 'F');
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 8, y + 9);
      return y + 18;
    };
    
    // Helper: Add page header with logo (for all pages)
    const addPageHeader = () => {
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // Add logo from embedded base64
      try {
        doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25);
      } catch (e) {
        console.log('Logo rendering skipped');
      }
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('C4 INDUSTRIAL', margin + 30, 14);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('DOWNTIME ANALYSIS REPORT', margin + 30, 26);
    };
    
    // Helper: Add page footer
    const addFooter = (pageNum: number, totalPages: number) => {
      doc.setDrawColor(...colors.border);
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.textMuted);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(format(new Date(), 'MMMM dd, yyyy'), margin, pageHeight - 10);
      doc.text('Confidential', pageWidth - margin, pageHeight - 10, { align: 'right' });
    };
    
    // Helper: Truncate text cleanly
    const truncate = (text: string, maxLen: number): string => {
      const clean = sanitizeText(text);
      return clean.length > maxLen ? clean.substring(0, maxLen - 3) + '...' : clean;
    };
    
    // ========== PAGE 1: EXECUTIVE SUMMARY ==========
    addPageHeader();
    
    // Report Info Box
    let yPos = 42;
    doc.setFillColor(...colors.bgLight);
    doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'F');
    doc.setDrawColor(...colors.border);
    doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'S');
    
    doc.setTextColor(...colors.textMuted);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Source:', margin + 5, yPos + 9);
    doc.text('Generated:', margin + 5, yPos + 17);
    doc.setTextColor(...colors.textDark);
    doc.setFont('helvetica', 'bold');
    doc.text(report.fileName || 'Uploaded Data', margin + 28, yPos + 9);
    doc.text(format(new Date(report.createdAt), 'MMMM dd, yyyy'), margin + 35, yPos + 17);
    
    // Key metrics on right side
    doc.setTextColor(...colors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('Records:', pageWidth - margin - 70, yPos + 9);
    doc.text('Total Downtime:', pageWidth - margin - 70, yPos + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text(`${report.recordCount || 0}`, pageWidth - margin - 35, yPos + 9);
    doc.setTextColor(...colors.danger);
    doc.text(`${report.totalDowntimeHours?.toFixed(1) || 0} hrs`, pageWidth - margin - 35, yPos + 17);
    
    yPos = 72;
    
    // ========== COMPREHENSIVE EXECUTIVE OVERVIEW ==========
    // Aggregate all data from segments for overview
    const allFindings: any[] = [];
    const allRecommendations: any[] = [];
    let totalSegmentDowntime = 0;
    
    if (segments) {
      Object.entries(segments).forEach(([key, seg]: [string, any]) => {
        const config = segmentConfig[key];
        totalSegmentDowntime += seg.downtimeHours || 0;
        
        // Collect findings
        (seg.findings || []).forEach((f: any) => allFindings.push({ ...f, segment: config?.label || key }));
        (seg.rootCauses || []).forEach((r: any) => allFindings.push({ ...r, segment: config?.label || key }));
        
        // Collect recommendations
        (seg.recommendations || []).forEach((r: any) => allRecommendations.push({ ...r, segment: config?.label || key }));
      });
    }
    
    console.log('Total allRecommendations collected:', allRecommendations.length);
    console.log('Sample recommendation:', allRecommendations[0]);
    
    // Executive Summary Section
    yPos = addSectionHeader('EXECUTIVE OVERVIEW', colors.accent, yPos);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textDark);
    const summaryText = sanitizeText(analysis?.summary?.criticalFindings || 'Analysis complete. Review the detailed sections below for key insights and recommendations.');
    const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 10);
    doc.text(splitSummary, margin + 5, yPos);
    yPos += splitSummary.length * 5 + 8;
    
    // Key Metrics Overview Box
    doc.setFillColor(...colors.bgLight);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'F');
    doc.setDrawColor(...colors.border);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'S');
    
    const metricBoxWidth = contentWidth / 4;
    const overviewMetrics = [
      { label: 'Total Downtime', value: `${report.totalDowntimeHours?.toFixed(1) || 0} hrs`, color: colors.danger },
      { label: 'Records Analyzed', value: `${report.recordCount || 0}`, color: colors.textDark },
      { label: 'Total Findings', value: `${allFindings.length}`, color: colors.warning },
      { label: 'Actions Required', value: `${allRecommendations.length}`, color: colors.success }
    ];
    
    overviewMetrics.forEach((metric, idx) => {
      const xPos = margin + (metricBoxWidth * idx) + 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.textMuted);
      doc.text(metric.label, xPos, yPos + 10);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...metric.color);
      doc.text(metric.value, xPos, yPos + 22);
    });
    yPos += 35;
    
    // Critical Focus Area highlight
    if (analysis?.summary) {
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'S');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14);
      doc.text('CRITICAL FOCUS:', margin + 5, yPos + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(truncate(analysis.summary.mostAffectedEquipment || 'See detailed analysis', 60), margin + 50, yPos + 8);
      
      if (analysis.summary.primaryCauses?.length > 0) {
        const causes = analysis.summary.primaryCauses.slice(0, 3).map((c: string) => sanitizeText(c)).join(' | ');
        doc.text('Top Causes: ' + truncate(causes, 80), margin + 5, yPos + 14);
      }
      yPos += 25;
    }
    
    // Segment Breakdown Summary Table (compact on first page)
    if (segments) {
      yPos = addSectionHeader('SEGMENT BREAKDOWN', colors.primary, yPos);
      
      const segmentData = Object.entries(segments).map(([key, seg]: [string, any]) => {
        const config = segmentConfig[key];
        const findingsCount = (seg.findings?.length || 0) + (seg.rootCauses?.length || 0);
        const recsCount = seg.recommendations?.length || 0;
        return [
          config?.label || key,
          `${seg.downtimeHours?.toFixed(1) || 0} hrs`,
          seg.severity?.toUpperCase() || 'LOW',
          findingsCount.toString(),
          recsCount.toString()
        ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [['Segment', 'Downtime', 'Severity', 'Findings', 'Actions']],
        body: segmentData,
        theme: 'plain',
        headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
        bodyStyles: { fontSize: 9, cellPadding: 4, textColor: colors.textDark },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: contentWidth * 0.25 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // ========== C4 PATH TO EXCELLENCE SUMMARY ==========
    if (allRecommendations.length > 0) {
      // Group recommendations by C4 step
      const stepGroups: Record<number, any[]> = {};
      allRecommendations.forEach(rec => {
        const step = typeof rec.c4Step === 'number' ? rec.c4Step : parseInt(rec.c4Step) || 4;
        if (!stepGroups[step]) stepGroups[step] = [];
        stepGroups[step].push(rec);
      });
      
      const stepsUsed = Object.keys(stepGroups).map(Number).sort((a, b) => a - b);
      const c4StepNames: Record<number, string> = {
        0: 'Initial Process Assessment',
        1: 'Equipment Criticality Assessment',
        2: 'Root Cause Analysis System',
        3: 'Storeroom MRO Optimization',
        4: 'Preventive Maintenance Excellence',
        5: 'Data-Driven Performance Management'
      };
      
      if (stepsUsed.length > 0) {
        // Check if we need a new page
        if (yPos > pageHeight - 80) {
          doc.addPage();
          addPageHeader();
          yPos = 45;
        }
        
        yPos = addSectionHeader('C4 PATH TO EXCELLENCE - RECOMMENDED STEPS', colors.primary, yPos);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...colors.textMuted);
        doc.text('Based on your downtime analysis, the following steps from C4\'s Maintenance Excellence Program are recommended:', margin, yPos);
        yPos += 8;
        
        // Create summary table of recommended steps
        const stepTableData = stepsUsed.map(stepId => {
          const stepName = c4StepNames[stepId] || `Step ${stepId}`;
          const recs = stepGroups[stepId];
          const priorities = recs.map(r => r.priority).filter(Boolean);
          const hasImmediate = priorities.includes('immediate');
          const hasShortTerm = priorities.includes('short-term');
          return [
            `Step ${stepId}`,
            stepName,
            recs.length.toString(),
            hasImmediate ? 'IMMEDIATE' : hasShortTerm ? 'Short-term' : 'Medium-term'
          ];
        });
        
        autoTable(doc, {
          startY: yPos,
          head: [['Step', 'Name', 'Recommendations', 'Priority']],
          body: stepTableData,
          theme: 'plain',
          headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
          bodyStyles: { fontSize: 9, cellPadding: 4, textColor: colors.textDark },
          alternateRowStyles: { fillColor: colors.bgLight },
          columnStyles: {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: contentWidth * 0.45 },
            2: { cellWidth: 35, halign: 'center' },
            3: { halign: 'center' }
          },
          margin: { left: margin, right: margin }
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
        
        // Add step details with rationale
        stepsUsed.forEach(stepId => {
          const stepName = c4StepNames[stepId] || `Step ${stepId}`;
          const recs = stepGroups[stepId];
          
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            doc.addPage();
            addPageHeader();
            yPos = 45;
          }
          
          // Step header
          doc.setFillColor(...colors.bgLight);
          doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.primary);
          doc.text(`Step ${stepId}: ${stepName}`, margin + 5, yPos + 8);
          yPos += 16;
          
          // List recommendations for this step
          recs.slice(0, 3).forEach((rec, idx) => {
            if (yPos > pageHeight - 40) {
              doc.addPage();
              addPageHeader();
              yPos = 45;
            }
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.textDark);
            const recTitle = truncate(sanitizeText(rec.title || 'Recommendation'), 80);
            doc.text(`${idx + 1}. ${recTitle}`, margin + 5, yPos);
            yPos += 5;
            
            // Rationale
            if (rec.c4StepRationale) {
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(...colors.textMuted);
              const rationaleText = truncate(sanitizeText(rec.c4StepRationale), 120);
              const splitRationale = doc.splitTextToSize(`Why: ${rationaleText}`, contentWidth - 15);
              doc.text(splitRationale, margin + 10, yPos);
              yPos += splitRationale.length * 4 + 3;
            }
          });
          
          if (recs.length > 3) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...colors.textMuted);
            doc.text(`+ ${recs.length - 3} more recommendations in this step`, margin + 10, yPos);
            yPos += 5;
          }
          
          yPos += 5;
        });
        
        yPos += 5;
      }
    }
    
    // ========== ALL FINDINGS CONSOLIDATED ==========
    // Only add new page if we're running low on space
    if (yPos > pageHeight - 80) {
      doc.addPage();
      addPageHeader();
      yPos = 45;
    }
    
    if (allFindings.length > 0) {
      yPos = addSectionHeader('ALL FINDINGS ACROSS SEGMENTS', colors.danger, yPos);
      const findingsTableData = allFindings.slice(0, 15).map((f: any, idx: number) => [
        (idx + 1).toString(),
        f.segment || '',
        sanitizeText(f.title || f.cause || f.description || ''),
        f.severity || f.priority || 'Medium'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Segment', 'Finding', 'Severity']],
        body: findingsTableData,
        theme: 'plain',
        headStyles: { fillColor: colors.danger, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
        bodyStyles: { fontSize: 8, cellPadding: 4, textColor: colors.textDark, minCellHeight: 12, overflow: 'linebreak' },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: contentWidth - 85 },
          3: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // ========== ALL ACTIONS CONSOLIDATED ==========
    // Only add new page if we're running low on space
    if (yPos > pageHeight - 60) {
      doc.addPage();
      addPageHeader();
      yPos = 45;
    }
    
    if (allRecommendations.length > 0) {
      yPos = addSectionHeader('AI-DRIVEN RECOMMENDATIONS', colors.success, yPos);
    
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...colors.textMuted);
      doc.text('AI-generated recommendations prioritized by expected impact. Implement systematically to reduce downtime.', margin + 5, yPos);
      yPos += 10;
      // First table: Summary of recommendations
      const actionsTableData = allRecommendations.map((r: any, idx: number) => [
        (idx + 1).toString(),
        r.segment || '',
        sanitizeText(r.title || r.action || r.description || ''),
        r.priority || r.timeline || 'Medium',
        sanitizeText(r.expectedOutcome || r.expectedImpact || r.impact || 'Reduce downtime')
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Segment', 'Action', 'Priority', 'Expected Outcome']],
        body: actionsTableData,
        theme: 'plain',
        headStyles: { fillColor: colors.success, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
        bodyStyles: { fontSize: 8, cellPadding: 4, textColor: colors.textDark, minCellHeight: 12, overflow: 'linebreak' },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 28 },
          2: { cellWidth: contentWidth - 108 },
          3: { cellWidth: 28, halign: 'center' },
          4: { cellWidth: 40 }
        },
        margin: { left: margin, right: margin }
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
      
      // Detailed recommendations with CBM, measurements, audits
      // Only add new page if needed
      if (yPos > pageHeight - 60) {
        doc.addPage();
        addPageHeader();
        yPos = 45;
      }
      
      yPos = addSectionHeader('IMPLEMENTATION DETAILS', colors.accent, yPos);
      
      allRecommendations.forEach((rec: any, idx: number) => {
        if (yPos > 220) { doc.addPage(); addPageHeader(); yPos = 45; }
        
        // Recommendation header
        doc.setFillColor(...colors.bgLight);
        doc.roundedRect(margin, yPos, contentWidth, 10, 1, 1, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textDark);
        doc.text(`${idx + 1}. ${sanitizeText(rec.title || rec.action || '')}`, margin + 3, yPos + 7);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.accent);
        doc.text(`[${rec.segment || 'General'}] ${rec.priority || ''}`, pageWidth - margin - 40, yPos + 7);
        yPos += 14;
        
        // Description
        if (rec.description) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.textDark);
          const descLines = doc.splitTextToSize(sanitizeText(rec.description), contentWidth - 10);
          doc.text(descLines, margin + 3, yPos);
          yPos += descLines.length * 4 + 4;
        }
        
        // C4 Path to Excellence alignment
        if (rec.c4StepName || rec.c4Step !== undefined) {
          doc.setFillColor(59, 130, 246); // blue
          doc.roundedRect(margin + 3, yPos, contentWidth - 10, 8, 1, 1, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          const stepLabel = rec.c4StepName ? `PATH TO EXCELLENCE: Step ${rec.c4Step} - ${rec.c4StepName}` : `PATH TO EXCELLENCE: Step ${rec.c4Step}`;
          doc.text(stepLabel, margin + 6, yPos + 5.5);
          yPos += 11;
          
          if (rec.c4StepRationale) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...colors.textDark);
            const rationaleLines = doc.splitTextToSize(sanitizeText(rec.c4StepRationale), contentWidth - 15);
            doc.text(rationaleLines, margin + 5, yPos);
            yPos += rationaleLines.length * 3.5 + 3;
          }
        }
        
        // Key details in compact format
        const details: string[] = [];
        if (rec.conditionBasedPM) details.push(`CBM/PdM: ${sanitizeText(rec.conditionBasedPM)}`);
        if (rec.measurementsRequired) details.push(`Measurements: ${sanitizeText(rec.measurementsRequired)}`);
        if (rec.auditRequirements) details.push(`Audit: ${sanitizeText(rec.auditRequirements)}`);
        if (rec.owner) details.push(`Owner: ${sanitizeText(rec.owner)}`);
        if (rec.timeline) details.push(`Timeline: ${sanitizeText(rec.timeline)}`);
        
        if (details.length > 0) {
          doc.setFontSize(7);
          doc.setTextColor(...colors.textMuted);
          details.forEach(detail => {
            if (yPos > 270) { doc.addPage(); addPageHeader(); yPos = 45; }
            const detailLines = doc.splitTextToSize(detail, contentWidth - 10);
            doc.text(detailLines, margin + 5, yPos);
            yPos += detailLines.length * 3.5 + 2;
          });
        }
        
        // Implementation steps
        if (rec.implementationSteps && Array.isArray(rec.implementationSteps) && rec.implementationSteps.length > 0) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.textDark);
          doc.text('Implementation Steps:', margin + 5, yPos);
          yPos += 4;
          doc.setFont('helvetica', 'normal');
          rec.implementationSteps.forEach((step: string, stepIdx: number) => {
            if (yPos > 270) { doc.addPage(); addPageHeader(); yPos = 45; }
            const stepLines = doc.splitTextToSize(`${stepIdx + 1}. ${sanitizeText(step)}`, contentWidth - 15);
            doc.text(stepLines, margin + 8, yPos);
            yPos += stepLines.length * 3.5 + 1;
          });
        }
        
        yPos += 8;
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(...colors.textMuted);
      doc.text('No actions recorded in this analysis.', margin + 5, yPos);
      yPos += 15;
    }
    
    // Legacy recommendations section removed - recommendations now consolidated above
    
    // ========== DETAILED ANALYSIS ==========
    // Check if we have patterns or root causes before adding section
    const hasPatterns = analysis?.patterns && analysis.patterns.length > 0;
    const hasRootCauses = analysis?.rootCauseAnalysis && analysis.rootCauseAnalysis.length > 0;
    const hasPreventiveMeasures = analysis?.preventiveMeasures && analysis.preventiveMeasures.length > 0;
    
    if (hasPatterns || hasRootCauses || hasPreventiveMeasures) {
      // Only add new page if we're running low on space
      if (yPos > pageHeight - 80) {
        doc.addPage();
        addPageHeader();
        yPos = 45;
      }
    }
    
    // Patterns Section
    if (hasPatterns) {
      yPos = addSectionHeader('IDENTIFIED PATTERNS', colors.purple, yPos);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Pattern', 'Severity', 'Frequency', 'Description']],
        body: analysis.patterns.map((p: any) => [
          sanitizeText(p.title || ''),
          sanitizeText(p.severity || ''),
          sanitizeText(p.frequency || ''),
          sanitizeText(p.description || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: colors.purple, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: colors.textDark,
          minCellHeight: 12,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.20 },
          1: { cellWidth: contentWidth * 0.10 },
          2: { cellWidth: contentWidth * 0.12 },
          3: { cellWidth: contentWidth * 0.58 }
        },
        margin: { left: margin, right: margin }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Root Cause Analysis Table
    if (hasRootCauses) {
      if (yPos > pageHeight - 60) { doc.addPage(); addPageHeader(); yPos = 45; }
      
      yPos = addSectionHeader('ROOT CAUSE ANALYSIS', colors.danger, yPos);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Root Cause', 'Category', 'Impact', 'Evidence']],
        body: analysis.rootCauseAnalysis.map((rca: any) => [
          sanitizeText(rca.cause || ''),
          sanitizeText(rca.category || rca.priority || ''),
          sanitizeText(rca.estimatedImpact || ''),
          sanitizeText(rca.evidence || rca.impact || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: colors.danger, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: colors.textDark,
          minCellHeight: 12,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.25 },
          1: { cellWidth: contentWidth * 0.12 },
          2: { cellWidth: contentWidth * 0.18 },
          3: { cellWidth: contentWidth * 0.45 }
        },
        margin: { left: margin, right: margin }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Preventive Measures
    if (hasPreventiveMeasures) {
      if (yPos > pageHeight - 60) { doc.addPage(); addPageHeader(); yPos = 45; }
      
      yPos = addSectionHeader('PREVENTIVE MEASURES', colors.cyan, yPos);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Measure', 'Target Cause', 'Implementation', 'Frequency']],
        body: analysis.preventiveMeasures.map((pm: any) => [
          sanitizeText(pm.measure || ''),
          sanitizeText(pm.targetedCause || ''),
          sanitizeText(pm.implementation || 'Standard procedures'),
          sanitizeText(pm.frequency || pm.expectedReduction || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: colors.cyan, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: colors.textDark,
          minCellHeight: 12,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.26 },
          1: { cellWidth: contentWidth * 0.24 },
          2: { cellWidth: contentWidth * 0.30 },
          3: { cellWidth: contentWidth * 0.20 }
        },
        margin: { left: margin, right: margin }
      });
    }
    
    // Add footers to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i, pageCount);
    }
    
    // Save - open in new tab for embedded webview compatibility
    const pdfFileName = (report.fileName || 'Downtime_Report').replace(/\.[^/.]+$/, '') + '_Analysis.pdf';
    
    // Open PDF in new tab - more reliable in embedded webviews
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');
    
    // Also try the download approach as backup
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = pdfFileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 500);
    
    toast({
      title: "Report Opened",
      description: `PDF opened in new tab. Use your browser's save function if needed.`,
    });
    
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Export segment-specific PDF
  const exportSegmentToPDF = async (segmentKey: string, segment: any, report: any) => {
    console.log('=== PDF SEGMENT EXPORT START ===');
    console.log('PDF Export - segmentKey:', segmentKey);
    console.log('PDF Export - segment object:', JSON.stringify(segment, null, 2));
    console.log('PDF Export - segment findings count:', segment?.findings?.length || 0);
    console.log('PDF Export - segment rootCauses count:', segment?.rootCauses?.length || 0);
    console.log('PDF Export - segment recommendations count:', segment?.recommendations?.length || 0);
    console.log('PDF Export - segment executiveSummary:', segment?.executiveSummary);
    console.log('PDF Export - report fileName:', report?.fileName);
    
    if (!segment) {
      console.error('PDF Export - segment is null or undefined!');
      toast({
        title: "Export Failed",
        description: "No segment data available to export",
        variant: "destructive"
      });
      return;
    }
    
    // Check what data is available - allow export even with partial data
    const hasFindings = (segment.findings?.length > 0) || (segment.rootCauses?.length > 0);
    const hasRecommendations = segment.recommendations?.length > 0;
    const hasExecutiveSummary = !!segment.executiveSummary;
    const hasDowntimeData = segment.downtimeHours > 0;
    const hasAnyData = hasFindings || hasRecommendations || hasExecutiveSummary || hasDowntimeData;
    console.log('PDF Export - hasFindings:', hasFindings, 'hasRecommendations:', hasRecommendations, 'hasExecutiveSummary:', hasExecutiveSummary, 'hasDowntimeData:', hasDowntimeData);
    
    if (!hasAnyData) {
      toast({
        title: "No Data to Export",
        description: `The ${segmentKey} segment has no analysis data to export. Try running the AI analysis first.`,
        variant: "destructive"
      });
      return;
    }
    
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    const segmentLabels: Record<string, string> = {
      safety: 'Safety',
      quality: 'Quality',
      operations: 'Operations',
      maintenance: 'Maintenance'
    };
    const segmentColors: Record<string, [number, number, number]> = {
      safety: [220, 38, 38],
      quality: [37, 99, 235],
      operations: [217, 119, 6],
      maintenance: [22, 163, 74]
    };
    
    const segmentLabel = segmentLabels[segmentKey] || segmentKey;
    const headerColor = segmentColors[segmentKey] || [59, 130, 246];
    
    const colors = {
      primary: headerColor,
      textDark: [31, 41, 55] as [number, number, number],
      textMuted: [107, 114, 128] as [number, number, number],
      bgLight: [249, 250, 251] as [number, number, number],
      success: [22, 163, 74] as [number, number, number],
      warning: [217, 119, 6] as [number, number, number],
      danger: [220, 38, 38] as [number, number, number]
    };
    
    const cleanText = (text: string): string => {
      if (!text) return '';
      return sanitizeText(text);
    };
    
    const truncate = (text: string, maxLen: number): string => {
      const cleaned = cleanText(text);
      return cleaned.length > maxLen ? cleaned.substring(0, maxLen - 3) + '...' : cleaned;
    };
    
    // Header
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, 6, 24, 24);
    } catch (e) {
      console.log('Logo rendering skipped');
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${segmentLabel} Analysis Report`, margin + 30, 16);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(report.fileName || 'Downtime Analysis', margin + 30, 24);
    doc.text(format(new Date(report.createdAt), "MMMM dd, yyyy"), pageWidth - margin - 40, 24);
    
    let yPos = 45;
    
    // Executive Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text('Executive Summary', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textMuted);
    const summaryLines = doc.splitTextToSize(cleanText(segment.executiveSummary || ''), contentWidth);
    doc.text(summaryLines, margin, yPos);
    yPos += summaryLines.length * 5 + 10;
    
    // Key Metrics
    if (segment.keyMetrics) {
      doc.setFillColor(...colors.bgLight);
      doc.rect(margin, yPos - 2, contentWidth, 20, 'F');
      
      const metrics = Object.entries(segment.keyMetrics);
      const metricWidth = contentWidth / metrics.length;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.textDark);
      
      metrics.forEach(([key, value], i) => {
        const x = margin + (i * metricWidth) + (metricWidth / 2);
        doc.text(String(value), x, yPos + 6, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.textMuted);
        doc.text(key.replace(/([A-Z])/g, ' $1').trim(), x, yPos + 12, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textDark);
      });
      yPos += 28;
    }
    
    // Findings Table
    if (segment.findings?.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.textDark);
      doc.text('Key Findings', margin, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Finding', 'Severity', 'Impact']],
        body: segment.findings.map((f: any) => [
          cleanText(f.title || ''),
          cleanText(f.severity || ''),
          cleanText(f.impact || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: headerColor, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: colors.textDark,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto'
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Root Causes
    if (segment.rootCauses?.length > 0) {
      if (yPos > 200) { doc.addPage(); yPos = 25; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.textDark);
      doc.text('Root Causes', margin, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Cause', 'Risk Level', 'Evidence']],
        body: segment.rootCauses.map((c: any) => [
          cleanText(c.cause || ''),
          cleanText(c.riskLevel || ''),
          cleanText(c.evidence || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: colors.danger, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: colors.textDark,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto'
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Recommendations - New Page
    if (segment.recommendations?.length > 0) {
      doc.addPage();
      yPos = 25;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.textDark);
      doc.text(`${segmentLabel} Recommendations`, margin, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Action', 'Priority', 'Owner', 'Timeline']],
        body: segment.recommendations.map((r: any, i: number) => [
          (i + 1).toString(),
          cleanText(r.title || ''),
          cleanText(r.priority || ''),
          cleanText(r.owner || ''),
          cleanText(r.timeline || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: colors.success, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: colors.textDark,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto'
      });
    }
    
    // KPIs
    if (segment.kpis?.length > 0) {
      yPos = (doc as any).lastAutoTable?.finalY + 15 || 150;
      if (yPos > 220) { doc.addPage(); yPos = 25; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.textDark);
      doc.text('Key Performance Indicators', margin, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Current', 'Target', 'Gap']],
        body: segment.kpis.map((k: any) => [
          cleanText(k.metric || ''),
          cleanText(k.current || ''),
          cleanText(k.target || ''),
          cleanText(k.gap || '')
        ]),
        theme: 'plain',
        headStyles: { 
          fillColor: headerColor, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: colors.textDark,
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 'auto', halign: 'center' }
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto'
      });
    }
    
    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...colors.textMuted);
      doc.text(`${segmentLabel} Analysis Report | Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 10);
      doc.text('MaintenanceHub', pageWidth - margin - 25, doc.internal.pageSize.getHeight() - 10);
    }
    
    const pdfFileName = `${segmentLabel}_Analysis_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(pdfFileName);
    
    toast({
      title: `${segmentLabel} Report Exported`,
      description: `Professional ${segmentLabel.toLowerCase()} analysis saved as ${pdfFileName}`,
    });
  };

  // Segment configuration
  const segmentConfig = {
    safety: { 
      label: 'Safety', 
      icon: Shield, 
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: 'border-red-200 dark:border-red-800',
      badgeVariant: 'destructive' as const
    },
    quality: { 
      label: 'Quality', 
      icon: CheckCircle2, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
      badgeVariant: 'default' as const
    },
    operations: { 
      label: 'Operations', 
      icon: Activity, 
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
      borderColor: 'border-amber-200 dark:border-amber-800',
      badgeVariant: 'secondary' as const
    },
    maintenance: { 
      label: 'Maintenance', 
      icon: Target, 
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: 'border-green-200 dark:border-green-800',
      badgeVariant: 'outline' as const
    }
  };

  // Render segment card for overview
  const renderSegmentOverviewCard = (segmentKey: string, segment: any) => {
    const config = segmentConfig[segmentKey as keyof typeof segmentConfig];
    if (!config || !segment) return null;
    const Icon = config.icon;
    
    return (
      <Card 
        key={segmentKey} 
        className={`cursor-pointer hover-elevate ${config.borderColor} border-2`}
        onClick={() => setActiveSegmentTab(segmentKey)}
        data-testid={`card-segment-${segmentKey}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 text-base ${config.color}`}>
              <Icon className="w-5 h-5" />
              {config.label}
            </CardTitle>
            <Badge variant={segment.severity === 'critical' ? 'destructive' : segment.severity === 'high' ? 'destructive' : 'secondary'}>
              {segment.severity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold">{segment.downtimeHours?.toFixed(1) || 0} hrs</div>
          <p className="text-xs text-muted-foreground line-clamp-2">{segment.executiveSummary}</p>
          <div className="flex items-center gap-1 text-xs text-primary">
            <span>{segment.findings?.length || 0} findings</span>
            <span>•</span>
            <span>{segment.recommendations?.length || 0} actions</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render full segment detail view
  const renderSegmentDetail = (segmentKey: string, segment: any) => {
    const config = segmentConfig[segmentKey as keyof typeof segmentConfig];
    if (!config || !segment) return null;
    const Icon = config.icon;
    
    return (
      <div className="space-y-6">
        {/* Segment Header */}
        <div className={`p-6 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className={`text-2xl font-bold flex items-center gap-2 ${config.color}`}>
                <Icon className="w-6 h-6" />
                {config.label} Analysis
              </h2>
              <p className="mt-2 text-muted-foreground">{segment.executiveSummary}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{segment.downtimeHours?.toFixed(1) || 0}</div>
              <div className="text-sm text-muted-foreground">hours downtime</div>
            </div>
          </div>
          
          {/* Key Metrics */}
          {segment.keyMetrics && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {Object.entries(segment.keyMetrics).map(([key, value]) => (
                <div key={key} className="text-center p-3 bg-background rounded-lg">
                  <div className="text-lg font-bold">{String(value)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Findings */}
        {segment.findings?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Key Findings ({segment.findings.length})
              </CardTitle>
              <CardDescription>Click "Generate Breakdown Analysis" to get AI-powered 5 Whys and Fishbone analysis for each finding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {segment.findings.map((finding: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg hover-elevate">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{finding.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'secondary'}>
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{segmentKey}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{finding.description}</p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">Impact: {finding.impact}</span>
                      {finding.affectedEquipment?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {finding.affectedEquipment.slice(0, 3).map((eq: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{eq}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      data-testid={`button-breakdown-analysis-${segmentKey}-${idx}`}
                      onClick={() => {
                        setBreakdownDialog({ open: true, finding, segment: segmentKey });
                        setBreakdownResult(null);
                        generateBreakdownAnalysis.mutate({ finding, segment: segmentKey });
                      }}
                      disabled={generateBreakdownAnalysis.isPending}
                    >
                      {generateBreakdownAnalysis.isPending && breakdownDialog.finding === finding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <GitBranch className="w-4 h-4 mr-2" />
                          Generate Breakdown Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Root Causes */}
        {segment.rootCauses?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5" />
                Root Causes ({segment.rootCauses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {segment.rootCauses.map((cause: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{cause.cause}</h4>
                    <Badge variant={cause.riskLevel === 'critical' || cause.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                      {cause.riskLevel} risk
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{cause.evidence}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Recommendations */}
        {segment.recommendations?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Recommended Actions ({segment.recommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {segment.recommendations.map((rec: any, idx: number) => {
                const c4StepNum = typeof rec.c4Step === 'number' ? rec.c4Step : parseInt(rec.c4Step);
                const c4StepInfo = C4_STEPS.find(s => s.id === c4StepNum);
                const StepIcon = c4StepInfo?.icon || Target;
                
                return (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant={rec.priority === 'immediate' ? 'destructive' : rec.priority === 'short-term' ? 'default' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                    
                    {/* C4 Path to Excellence Link */}
                    {(rec.c4Step !== undefined || rec.c4StepName) && (
                      <div className="mb-3 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <StepIcon className={`w-5 h-5 ${c4StepInfo?.color || 'text-blue-500'}`} />
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              Path to Excellence: Step {rec.c4Step} - {rec.c4StepName || c4StepInfo?.name}
                            </span>
                          </div>
                          <Link href="/excellence-path">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-go-to-step-${rec.c4Step}`}>
                              Go to Step
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                        {rec.c4StepRationale && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 italic">{rec.c4StepRationale}</p>
                        )}
                      </div>
                    )}
                    
                    {/* CBM/PdM Details */}
                    {(rec.conditionBasedPM || rec.measurementsRequired || rec.auditRequirements) && (
                      <div className="mb-3 space-y-2 text-xs">
                        {rec.conditionBasedPM && (
                          <div className="p-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded">
                            <span className="font-semibold text-orange-700 dark:text-orange-300">CBM/PdM:</span>
                            <span className="ml-1 text-orange-600 dark:text-orange-400">{rec.conditionBasedPM}</span>
                          </div>
                        )}
                        {rec.measurementsRequired && (
                          <div className="p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                            <span className="font-semibold text-green-700 dark:text-green-300">Measurements:</span>
                            <span className="ml-1 text-green-600 dark:text-green-400">{rec.measurementsRequired}</span>
                          </div>
                        )}
                        {rec.auditRequirements && (
                          <div className="p-2 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded">
                            <span className="font-semibold text-purple-700 dark:text-purple-300">Audit:</span>
                            <span className="ml-1 text-purple-600 dark:text-purple-400">{rec.auditRequirements}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Implementation Steps */}
                    {rec.implementationSteps && Array.isArray(rec.implementationSteps) && rec.implementationSteps.length > 0 && (
                      <div className="mb-3 p-2 bg-muted rounded text-xs">
                        <span className="font-semibold">Implementation Steps:</span>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          {rec.implementationSteps.map((step: string, stepIdx: number) => (
                            <li key={stepIdx} className="text-muted-foreground">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Owner:</span>
                        <p className="font-medium">{rec.owner}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Timeline:</span>
                        <p className="font-medium">{rec.timeline}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Expected Outcome:</span>
                        <p className="font-medium">{rec.expectedOutcome}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        
        {/* KPIs */}
        {segment.kpis?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Key Performance Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {segment.kpis.map((kpi: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg text-center">
                    <div className="text-sm font-medium text-muted-foreground">{kpi.metric}</div>
                    <div className="text-xl font-bold mt-1">{kpi.current}</div>
                    <div className="text-xs text-muted-foreground">Target: {kpi.target}</div>
                    <div className="text-xs text-amber-600 mt-1">{kpi.gap}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Export Button */}
        <div className="flex justify-end">
          <Button onClick={() => exportSegmentToPDF(segmentKey, segment, selectedReport)} data-testid={`button-export-${segmentKey}-pdf`}>
            <Download className="w-4 h-4 mr-2" />
            Export {config.label} Report
          </Button>
        </div>
      </div>
    );
  };

  // Helper function to construct segments from legacy data if segments don't exist
  const constructSegmentsFromLegacyData = (analysis: any) => {
    if (!analysis) return null;
    
    // If segments exist, return them
    if (analysis.segments) return analysis.segments;
    
    const totalHours = analysis.summary?.totalDowntimeHours || analysis.totalDowntimeHours || 0;
    
    // Create base segments with initial zero hours
    const segments: Record<string, any> = {
      safety: {
        downtimeHours: 0,
        severity: 'low',
        executiveSummary: 'Safety-related downtime analysis focusing on incidents that could impact worker safety or create hazardous conditions.',
        keyMetrics: { incidentCount: 0, nearMissCount: 0, riskScore: 'N/A' },
        findings: [],
        rootCauses: [],
        recommendations: [],
        kpis: [],
      },
      quality: {
        downtimeHours: 0,
        severity: 'low',
        executiveSummary: 'Quality-related downtime analysis focusing on defects, rework, and product specification issues.',
        keyMetrics: { defectRate: '0%', scrapCost: '$0', firstPassYield: 'N/A' },
        findings: [],
        rootCauses: [],
        recommendations: [],
        kpis: [],
      },
      operations: {
        downtimeHours: 0,
        severity: 'low',
        executiveSummary: 'Operations-related downtime focusing on throughput, changeovers, and process inefficiencies.',
        keyMetrics: { oeeScore: 'N/A', throughputLoss: '0%', changeoverTime: 'N/A' },
        findings: [],
        rootCauses: [],
        recommendations: [],
        kpis: [],
      },
      maintenance: {
        downtimeHours: 0,
        severity: 'low',
        executiveSummary: 'Maintenance-related downtime focusing on equipment failures, breakdowns, and preventive maintenance gaps.',
        keyMetrics: { mtbf: 'N/A', mttr: 'N/A', pmCompliance: 'N/A' },
        findings: [],
        rootCauses: [],
        recommendations: [],
        kpis: [],
      },
    };

    // Categorize based on category field first, then keywords
    const categorizeItem = (item: any): string => {
      const category = (item.category || '').toLowerCase();
      const text = ((item.cause || '') + ' ' + (item.title || '') + ' ' + (item.description || '') + ' ' + (item.evidence || '')).toLowerCase();
      const equipList = (item.affectedEquipment || []).map((e: string) => (e || '').toLowerCase()).join(' ');
      const combined = category + ' ' + text + ' ' + equipList;
      
      // Use category field if available
      if (category === 'mechanical' || category === 'electrical') {
        // Check for specific sub-categories
        if (/sensor|alignment|calibration|inspection/i.test(text)) return 'quality';
        if (/safety|guard|lockout|emergency/i.test(text)) return 'safety';
        return 'maintenance';
      }
      if (category === 'process' || category === 'planned maintenance') {
        // Process = operations, Planned Maintenance (like sanitation) = operations
        if (/sanitation|cleaning|changeover|setup/i.test(text)) return 'operations';
        if (/quality|defect|contamination/i.test(text)) return 'quality';
        return 'operations';
      }
      
      // Fallback to keyword-based categorization
      // Safety keywords
      if (/safety|hazard|injury|incident|guard|lockout|loto|ppe|emergency|fire|spill|leak|exposure|light.?curtain/i.test(combined)) {
        return 'safety';
      }
      // Quality keywords
      if (/quality|defect|reject|scrap|rework|spec|tolerance|inspection|calibration|contamination|out.?of.?spec|label|misprint/i.test(combined)) {
        return 'quality';
      }
      // Operations keywords
      if (/changeover|change.?over|setup|operator|training|material|supply|scheduling|throughput|speed|rate|staffing|shift|sanitation|cleaning|process/i.test(combined)) {
        return 'operations';
      }
      // Maintenance keywords
      if (/belt|motor|bearing|wear|alignment|breakdown|failure|repair|replace|mechanical|hydraulic|pneumatic|sleeve|machine|dough|mixer/i.test(combined)) {
        return 'maintenance';
      }
      // Default
      return 'maintenance';
    };

    // Extract hours from estimatedImpact text (e.g., "300 hours (~35% of total downtime)")
    const extractHours = (text: string): number => {
      if (!text) return 0;
      const match = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
      return match ? parseFloat(match[1]) : 0;
    };

    // Track hours per segment from root causes
    const segmentHours: Record<string, number> = { safety: 0, quality: 0, operations: 0, maintenance: 0 };

    // Distribute rootCauseAnalysis as rootCauses and track hours
    (analysis.rootCauseAnalysis || []).forEach((rca: any) => {
      const segmentKey = categorizeItem(rca);
      const hours = extractHours(rca.estimatedImpact);
      segmentHours[segmentKey] += hours;
      
      segments[segmentKey].rootCauses.push({
        cause: rca.cause,
        evidence: rca.evidence || rca.estimatedImpact,
        riskLevel: rca.priority || 'medium',
      });
    });

    // Distribute patterns as findings
    (analysis.patterns || []).forEach((pattern: any) => {
      const segmentKey = categorizeItem(pattern);
      
      segments[segmentKey].findings.push({
        title: pattern.title,
        description: pattern.description,
        severity: pattern.severity,
        affectedEquipment: pattern.affectedEquipment,
        impact: `Frequency: ${pattern.frequency}`,
      });
    });

    // Distribute recommendations
    (analysis.recommendations || []).forEach((rec: any) => {
      const segmentKey = categorizeItem(rec);
      
      segments[segmentKey].recommendations.push({
        title: rec.title || rec.action,
        description: rec.description || rec.action,
        priority: rec.priority,
        expectedImpact: rec.expectedOutcome || rec.expectedImpact,
        timeframe: rec.timeframe || rec.implementation,
        owner: 'Maintenance Team',
        timeline: '30 days',
      });
    });

    // Calculate downtime hours per segment
    const totalTrackedHours = Object.values(segmentHours).reduce((a, b) => a + b, 0);
    const untrackedHours = totalHours - totalTrackedHours;
    
    console.log('Segment hours tracked:', segmentHours);
    console.log('Total tracked:', totalTrackedHours, 'Untracked:', untrackedHours, 'Total:', totalHours);
    
    // Calculate counts for proportional distribution
    const counts = {
      safety: segments.safety.findings.length + segments.safety.rootCauses.length,
      quality: segments.quality.findings.length + segments.quality.rootCauses.length,
      operations: segments.operations.findings.length + segments.operations.rootCauses.length,
      maintenance: segments.maintenance.findings.length + segments.maintenance.rootCauses.length,
    };
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    
    // Distribute tracked hours directly, then distribute untracked proportionally
    Object.keys(segments).forEach((key) => {
      const trackedForSegment = segmentHours[key] || 0;
      const proportionalUntracked = (counts[key as keyof typeof counts] / totalCount) * untrackedHours;
      segments[key].downtimeHours = Math.round((trackedForSegment + proportionalUntracked) * 10) / 10;
    });
    
    console.log('Final segment hours:', {
      safety: segments.safety.downtimeHours,
      quality: segments.quality.downtimeHours,
      operations: segments.operations.downtimeHours,
      maintenance: segments.maintenance.downtimeHours,
    });

    // Update severity based on findings and hours
    Object.keys(segments).forEach((key) => {
      const seg = segments[key];
      const findingsCount = seg.findings.length + seg.rootCauses.length;
      const hoursPercent = totalHours > 0 ? (seg.downtimeHours / totalHours) * 100 : 0;
      
      if (findingsCount >= 3 || hoursPercent > 30) seg.severity = 'high';
      else if (findingsCount >= 2 || hoursPercent > 15) seg.severity = 'medium';
      else seg.severity = 'low';
      
      // Update executive summary with actual data
      if (seg.findings.length > 0 || seg.rootCauses.length > 0) {
        const topIssues = [...seg.findings, ...seg.rootCauses].slice(0, 2).map((f: any) => f.title || f.cause).join(', ');
        seg.executiveSummary = `${seg.downtimeHours} hours of downtime attributed to ${key}-related issues. Primary concerns: ${topIssues}.`;
      }
    });

    return segments;
  };

  if (selectedReport) {
    const analysis = selectedReport.analysisData;
    const segments = constructSegmentsFromLegacyData(analysis);
    
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <Button variant="ghost" onClick={() => setSelectedReport(null)} data-testid="button-back">
              ← Back to Reports
            </Button>
            <h1 className="text-2xl font-bold mt-2" data-testid="text-report-title">{selectedReport.fileName}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-report-generated-at">
              Generated {format(new Date(selectedReport.createdAt), "MMM dd, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {actionChecklist.length > 0 && (
              <Button 
                variant="default" 
                onClick={() => setShowActionChecklist(true)}
                data-testid="button-view-action-checklist"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Action Checklist ({actionChecklist.filter(a => a.status !== 'completed').length} pending)
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => exportToPDF(selectedReport)}
              data-testid="button-export-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Full Report
            </Button>
            <div className="text-right">
              <div className="text-2xl font-bold" data-testid="text-total-downtime-hours">{selectedReport.totalDowntimeHours?.toFixed(1)} hrs</div>
              <div className="text-sm text-muted-foreground" data-testid="text-records-analyzed">{selectedReport.recordCount} records analyzed</div>
            </div>
          </div>
        </div>

        {/* Segment Tabs */}
        <div className="border-b px-6">
          <Tabs value={activeSegmentTab} onValueChange={setActiveSegmentTab}>
            <TabsList className="h-12">
              <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
                <FileText className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="safety" className="gap-2" data-testid="tab-safety">
                <Shield className="w-4 h-4" />
                Safety
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-2" data-testid="tab-quality">
                <CheckCircle2 className="w-4 h-4" />
                Quality
              </TabsTrigger>
              <TabsTrigger value="operations" className="gap-2" data-testid="tab-operations">
                <Activity className="w-4 h-4" />
                Operations
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-2" data-testid="tab-maintenance">
                <Target className="w-4 h-4" />
                Maintenance
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            {activeSegmentTab === "overview" ? (
              <div className="space-y-6">
                {/* Executive Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Critical Findings</h4>
                      <p className="text-muted-foreground" data-testid="text-critical-findings">{analysis?.summary?.criticalFindings}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Most Affected Equipment</h4>
                        <Badge variant="destructive" data-testid="badge-most-affected-equipment">{analysis?.summary?.mostAffectedEquipment}</Badge>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Primary Causes</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis?.summary?.primaryCauses?.map((cause: string, idx: number) => (
                            <Badge key={idx} variant="outline" data-testid={`badge-primary-cause-${idx}`}>{cause}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* C4 Path to Excellence Summary */}
                {segments && (() => {
                  // Collect all recommendations from all segments
                  const allRecs: any[] = [];
                  Object.entries(segments).forEach(([segKey, seg]: [string, any]) => {
                    if (seg?.recommendations) {
                      seg.recommendations.forEach((rec: any) => {
                        allRecs.push({ ...rec, segment: segKey });
                      });
                    }
                  });
                  
                  // Group by C4 step
                  const stepGroups: Record<number, any[]> = {};
                  allRecs.forEach(rec => {
                    const step = typeof rec.c4Step === 'number' ? rec.c4Step : parseInt(rec.c4Step) || 4;
                    if (!stepGroups[step]) stepGroups[step] = [];
                    stepGroups[step].push(rec);
                  });
                  
                  const stepsUsed = Object.keys(stepGroups).map(Number).sort((a, b) => a - b);
                  
                  if (stepsUsed.length === 0) return null;
                  
                  return (
                    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          C4 Path to Excellence - Recommended Steps
                        </CardTitle>
                        <CardDescription>
                          Based on your downtime analysis, here are the recommended steps from C4's 6-step Maintenance Excellence Program
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Step Progress Visualization */}
                        <div className="flex items-center justify-between gap-2 mb-6">
                          {C4_STEPS.map((step, idx) => {
                            const isRecommended = stepsUsed.includes(step.id);
                            const recCount = stepGroups[step.id]?.length || 0;
                            const StepIcon = step.icon;
                            return (
                              <div key={step.id} className="flex flex-col items-center flex-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecommended ? step.bgColor : 'bg-muted'} ${isRecommended ? 'ring-2 ring-offset-2' : ''}`} style={{ ringColor: isRecommended ? 'hsl(var(--primary))' : undefined }}>
                                  <StepIcon className={`w-5 h-5 ${isRecommended ? step.color : 'text-muted-foreground'}`} />
                                </div>
                                <span className={`text-xs mt-1 text-center ${isRecommended ? 'font-semibold' : 'text-muted-foreground'}`}>
                                  Step {step.id}
                                </span>
                                {isRecommended && (
                                  <Badge variant="secondary" className="text-xs mt-1">{recCount} rec{recCount !== 1 ? 's' : ''}</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Recommended Steps Details */}
                        <Accordion type="multiple" className="space-y-2">
                          {stepsUsed.map(stepId => {
                            const stepInfo = C4_STEPS.find(s => s.id === stepId);
                            const recs = stepGroups[stepId];
                            const StepIcon = stepInfo?.icon || Target;
                            
                            return (
                              <AccordionItem key={stepId} value={`step-${stepId}`} className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stepInfo?.bgColor}`}>
                                      <StepIcon className={`w-4 h-4 ${stepInfo?.color}`} />
                                    </div>
                                    <div className="text-left">
                                      <div className="font-semibold">Step {stepId}: {stepInfo?.name}</div>
                                      <div className="text-xs text-muted-foreground">{recs.length} recommendation{recs.length !== 1 ? 's' : ''} aligned with this step</div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                  <div className="space-y-3 mt-2">
                                    {recs.map((rec, idx) => (
                                      <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{rec.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{rec.description}</div>
                                            {rec.c4StepRationale && (
                                              <div className="text-xs text-primary mt-2 italic">
                                                <strong>Why this step:</strong> {rec.c4StepRationale}
                                              </div>
                                            )}
                                          </div>
                                          <Badge variant="outline" className="text-xs capitalize shrink-0">{rec.segment}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <Badge variant={rec.priority === 'immediate' ? 'destructive' : rec.priority === 'short-term' ? 'default' : 'secondary'} className="text-xs">
                                            {rec.priority}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">Owner: {rec.owner}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-4">
                                    <Link href="/excellence-path">
                                      <Button variant="outline" size="sm" className="gap-2" data-testid={`button-go-to-excellence-step-${stepId}`}>
                                        <ExternalLink className="w-4 h-4" />
                                        Go to Step {stepId} in Path to Excellence
                                      </Button>
                                    </Link>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Segment Overview Cards */}
                {segments && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Analysis by Segment</h3>
                    <p className="text-sm text-muted-foreground mb-4">Click any segment for detailed findings and recommendations</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(segments).map(([key, segment]) => 
                        renderSegmentOverviewCard(key, segment)
                      )}
                    </div>
                  </div>
                )}

                {/* Legacy Key Findings for backward compatibility */}
                {!segments && analysis?.rootCauseAnalysis?.length > 0 && (
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Key Findings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {analysis?.rootCauseAnalysis?.map((rca: any, idx: number) => (
                          <div key={`rca-${idx}`} className="flex items-start justify-between p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-4 h-4 ${rca.priority === 'high' ? 'text-destructive' : rca.priority === 'medium' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                <span className="font-medium">{rca.cause}</span>
                                <Badge variant={rca.priority === 'high' ? 'destructive' : rca.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                  {rca.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{rca.evidence}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>Impact: {rca.estimatedImpact}</span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-4 shrink-0"
                              onClick={() => {
                                setDeepDiveResult(null);
                                setDeepDiveDialog({ open: true, finding: rca, type: 'rootcause' });
                                analyzeKeyFinding.mutate({ finding: rca, context: 'Root cause finding from downtime analysis', findingId: `rca-${idx}` });
                              }}
                              disabled={analyzeKeyFinding.isPending}
                              data-testid={`button-deep-dive-rca-${idx}`}
                            >
                              {analyzeKeyFinding.isPending && deepDiveDialog.finding === rca ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4 mr-1" />
                        )}
                        Comprehensive Breakdown
                      </Button>
                    </div>
                  ))}

                  {/* Patterns as Key Findings */}
                  {analysis?.patterns?.filter((p: any) => p.severity === 'high' || p.severity === 'medium').map((pattern: any, idx: number) => (
                    <div key={`pattern-${idx}`} className="flex items-start justify-between p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Activity className={`w-4 h-4 ${pattern.severity === 'high' ? 'text-destructive' : 'text-amber-500'}`} />
                          <span className="font-medium">{pattern.title}</span>
                          <Badge variant={pattern.severity === 'high' ? 'destructive' : 'default'} className="text-xs">
                            {pattern.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{pattern.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BarChart2 className="w-3 h-3" />
                          <span>{pattern.frequency}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-4 shrink-0"
                        onClick={() => {
                          setDeepDiveResult(null);
                          setDeepDiveDialog({ open: true, finding: pattern, type: 'pattern' });
                          analyzeKeyFinding.mutate({ finding: pattern, context: 'Downtime pattern identified in analysis', findingId: `pattern-${idx}` });
                        }}
                        disabled={analyzeKeyFinding.isPending}
                        data-testid={`button-deep-dive-pattern-${idx}`}
                      >
                        {analyzeKeyFinding.isPending && deepDiveDialog.finding === pattern ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4 mr-1" />
                        )}
                        Comprehensive Breakdown
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
                )}

                {/* Legacy Tabs for backward compatibility with non-segmented reports */}
                {!segments && (
            <Tabs defaultValue="patterns" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
                <TabsTrigger value="rootcause" data-testid="tab-rootcause">Root Causes</TabsTrigger>
                <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="preventive" data-testid="tab-preventive">Preventive Measures</TabsTrigger>
              </TabsList>

              <TabsContent value="patterns" className="space-y-4 mt-4">
                {analysis?.patterns?.map((pattern: any, idx: number) => (
                  <Card key={idx} data-testid={`card-pattern-${idx}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-pattern-title-${idx}`}>{pattern.title}</CardTitle>
                          <CardDescription data-testid={`text-pattern-frequency-${idx}`}>{pattern.frequency}</CardDescription>
                        </div>
                        <Badge variant={
                          pattern.severity === "high" ? "destructive" :
                          pattern.severity === "medium" ? "default" : "secondary"
                        } data-testid={`badge-pattern-severity-${idx}`}>
                          {pattern.severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm" data-testid={`text-pattern-description-${idx}`}>{pattern.description}</p>
                      <div>
                        <p className="text-sm font-semibold mb-1">Affected Equipment:</p>
                        <div className="flex flex-wrap gap-2">
                          {pattern.affectedEquipment?.map((eq: string, i: number) => (
                            <Badge key={i} variant="outline" data-testid={`badge-pattern-equipment-${idx}-${i}`}>{eq}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="rootcause" className="space-y-4 mt-4">
                {analysis?.rootCauseAnalysis?.map((rca: any, idx: number) => (
                  <Card key={idx} data-testid={`card-rootcause-${idx}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-rootcause-title-${idx}`}>
                          <AlertTriangle className="w-5 h-5" />
                          {rca.cause}
                        </CardTitle>
                        <Badge variant={
                          rca.priority === "high" ? "destructive" :
                          rca.priority === "medium" ? "default" : "secondary"
                        } data-testid={`badge-rootcause-priority-${idx}`}>
                          {rca.priority} priority
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Evidence:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-rootcause-evidence-${idx}`}>{rca.evidence}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Estimated Impact:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-rootcause-impact-${idx}`}>{rca.estimatedImpact}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Affected Equipment:</p>
                        <div className="flex flex-wrap gap-2">
                          {rca.affectedEquipment?.map((eq: string, i: number) => (
                            <Badge key={i} variant="outline" data-testid={`badge-rootcause-equipment-${idx}-${i}`}>{eq}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4 mt-4">
                {analysis?.recommendations?.map((rec: any, idx: number) => (
                  <Card key={idx} data-testid={`card-recommendation-${idx}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-recommendation-title-${idx}`}>
                          <Lightbulb className="w-5 h-5" />
                          {rec.title}
                        </CardTitle>
                        <Badge variant={
                          rec.priority === "high" ? "destructive" :
                          rec.priority === "medium" ? "default" : "secondary"
                        } data-testid={`badge-recommendation-priority-${idx}`}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Description:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-recommendation-description-${idx}`}>{rec.description}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Expected Impact:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-recommendation-impact-${idx}`}>{rec.expectedOutcome || rec.expectedImpact}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Implementation:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-recommendation-implementation-${idx}`}>{rec.implementation}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Estimated Cost Savings:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-recommendation-savings-${idx}`}>{rec.estimatedCostSavings}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="preventive" className="space-y-4 mt-4">
                {analysis?.preventiveMeasures?.map((measure: any, idx: number) => (
                  <Card key={idx} data-testid={`card-preventive-${idx}`}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-preventive-title-${idx}`}>
                        <Shield className="w-5 h-5" />
                        {measure.measure}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Targeted Cause:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-preventive-cause-${idx}`}>{measure.targetedCause}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Implementation:</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-preventive-implementation-${idx}`}>{measure.implementation}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">Expected Reduction:</p>
                        <Badge variant="outline" data-testid={`badge-preventive-reduction-${idx}`}>{measure.expectedReduction}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
                )}
              </div>
            ) : (
              /* Render segment detail views */
              segments && renderSegmentDetail(activeSegmentTab, segments[activeSegmentTab as keyof typeof segments])
            )}
          </div>
        </ScrollArea>

        {/* Deep-Dive Analysis Dialog */}
        <Dialog 
          open={deepDiveDialog.open} 
          onOpenChange={(open) => { 
            if (!open) { 
              setDeepDiveDialog({ open: false, finding: null, type: "" }); 
              setDeepDiveResult(null); 
            } 
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Comprehensive Breakdown Analysis
              </DialogTitle>
              <DialogDescription>
                {deepDiveDialog.finding?.cause || deepDiveDialog.finding?.title || "Deep-dive analysis"}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 pr-4">
              {analyzeKeyFinding.isPending ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Generating comprehensive breakdown analysis...</p>
                  <p className="text-xs text-muted-foreground">This may take 15-30 seconds</p>
                </div>
              ) : deepDiveResult ? (
                <div className="space-y-6 pb-4">
                  {/* Executive Summary */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <h3 className="font-semibold text-lg mb-2">Executive Summary</h3>
                    <p className="text-sm">{deepDiveResult.executiveSummary}</p>
                  </div>

                  {/* Finding Details */}
                  {deepDiveResult.findingDetails && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Severity</p>
                        <Badge variant={deepDiveResult.findingDetails.severity === 'critical' || deepDiveResult.findingDetails.severity === 'high' ? 'destructive' : 'default'} className="mt-1">
                          {deepDiveResult.findingDetails.severity}
                        </Badge>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Impact Score</p>
                        <p className="font-bold text-lg">{deepDiveResult.findingDetails.impactScore}/10</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center col-span-2">
                        <p className="text-xs text-muted-foreground">Downtime Contribution</p>
                        <p className="font-medium text-sm">{deepDiveResult.findingDetails.downtimeContribution}</p>
                      </div>
                    </div>
                  )}

                  {/* Root Cause Breakdown */}
                  {deepDiveResult.rootCauseBreakdown && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Root Cause Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">PRIMARY CAUSE</p>
                          <p className="font-medium">{deepDiveResult.rootCauseBreakdown.primaryCause}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">CAUSE CHAIN</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {deepDiveResult.rootCauseBreakdown.causeChain?.map((cause: string, i: number) => (
                              <div key={i} className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">{cause}</Badge>
                                {i < (deepDiveResult.rootCauseBreakdown.causeChain?.length || 0) - 1 && <ChevronRight className="w-3 h-3" />}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">CONTRIBUTING FACTORS</p>
                          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                            {deepDiveResult.rootCauseBreakdown.contributingFactors?.map((f: string, i: number) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Impact Assessment */}
                  {deepDiveResult.impactAssessment && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-blue-500" />
                          Impact Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">PRODUCTION</p>
                            <p>{deepDiveResult.impactAssessment.productionImpact}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">FINANCIAL</p>
                            <p>{deepDiveResult.impactAssessment.financialImpact}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">SAFETY</p>
                            <p>{deepDiveResult.impactAssessment.safetyImplications}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">QUALITY</p>
                            <p>{deepDiveResult.impactAssessment.qualityImplications}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommended Actions */}
                  {deepDiveResult.recommendedActions && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Recommended Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {deepDiveResult.recommendedActions.map((action: any, i: number) => (
                            <div key={i} className="p-3 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-sm">{action.action}</p>
                                <Badge variant={action.priority === 'immediate' ? 'destructive' : action.priority === 'short-term' ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">
                                  {action.priority}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                <div><strong>Owner:</strong> {action.owner}</div>
                                <div><strong>Timeline:</strong> {action.timeline}</div>
                                <div><strong>Cost:</strong> {action.estimatedCost}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Risk Assessment */}
                  {deepDiveResult.riskAssessment && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-500" />
                          Risk Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div className="p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Recurrence</p>
                            <Badge variant={deepDiveResult.riskAssessment.recurrenceProbability === 'high' ? 'destructive' : 'secondary'} className="mt-1">
                              {deepDiveResult.riskAssessment.recurrenceProbability}
                            </Badge>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Consequence</p>
                            <Badge variant={deepDiveResult.riskAssessment.consequenceSeverity === 'high' ? 'destructive' : 'secondary'} className="mt-1">
                              {deepDiveResult.riskAssessment.consequenceSeverity}
                            </Badge>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Risk Score</p>
                            <p className="font-bold text-lg">{deepDiveResult.riskAssessment.riskScore}</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-xs text-muted-foreground">Priority</p>
                            <p className="font-bold text-lg">{deepDiveResult.riskAssessment.mitigationPriority}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* KPI Metrics */}
                  {deepDiveResult.kpiMetrics && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-500" />
                          KPI Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">MTBF</p>
                            <p className="font-medium text-sm">{deepDiveResult.kpiMetrics.mtbf}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">MTTR</p>
                            <p className="font-medium text-sm">{deepDiveResult.kpiMetrics.mttr}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Availability Impact</p>
                            <p className="font-medium text-sm">{deepDiveResult.kpiMetrics.availabilityImpact}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Reliability Target</p>
                            <p className="font-medium text-sm">{deepDiveResult.kpiMetrics.reliabilityTarget}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Analysis will appear here</p>
                </div>
              )}
            </ScrollArea>

            {deepDiveResult && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => { 
                    setDeepDiveDialog({ open: false, finding: null, type: "" }); 
                    setDeepDiveResult(null); 
                  }}
                  data-testid="button-close-deep-dive"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => exportFindingToPDF(deepDiveResult, deepDiveDialog.finding)} 
                  data-testid="button-export-finding-pdf"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Breakdown Analysis Dialog with 5 Whys and Fishbone */}
        <Dialog
          open={breakdownDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setBreakdownDialog({ open: false, finding: null, segment: "" });
              setBreakdownResult(null);
              setBreakdownActiveTab("fivewhys");
            }
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                Breakdown Analysis - 5 Whys & Fishbone
              </DialogTitle>
              <DialogDescription>
                {breakdownDialog.finding?.title || "AI-powered root cause analysis"}
                {breakdownDialog.segment && (
                  <Badge variant="outline" className="ml-2 capitalize">{breakdownDialog.segment}</Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              {generateBreakdownAnalysis.isPending ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analyzing root cause...</p>
                </div>
              ) : breakdownResult ? (
                <div className="space-y-4 pb-4">
                  {/* CONSULTANT-GRADE EXECUTIVE SUMMARY */}
                  
                  {/* Problem & Root Cause - The headline */}
                  <div className="p-4 bg-destructive/10 rounded-lg border-l-4 border-destructive">
                    <h3 className="font-bold text-base">{sanitizeText(breakdownResult.findingTitle)}</h3>
                    {breakdownResult.executiveSummary && (
                      <p className="text-sm mt-2 text-muted-foreground">{sanitizeText(breakdownResult.executiveSummary)}</p>
                    )}
                    {breakdownResult.rootCause && (
                      <p className="text-sm mt-2">
                        <span className="font-semibold">Root Cause:</span> {sanitizeText(breakdownResult.rootCause.statement)}
                      </p>
                    )}
                  </div>

                  {/* Key Metrics Bar */}
                  {breakdownResult.costBenefitAnalysis && (
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs text-muted-foreground">Annual Savings</p>
                        <p className="font-bold text-green-600">{sanitizeText(breakdownResult.costBenefitAnalysis.annualSavings)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Implementation Cost</p>
                        <p className="font-bold">{sanitizeText(breakdownResult.costBenefitAnalysis.implementationCost)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-muted-foreground">Payback Period</p>
                        <p className="font-bold text-blue-600">{sanitizeText(breakdownResult.costBenefitAnalysis.paybackPeriod)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Risk Reduction</p>
                        <p className="font-bold">{sanitizeText(breakdownResult.costBenefitAnalysis.riskReduction)}</p>
                      </div>
                    </div>
                  )}

                  {/* VERIFICATION EVIDENCE - What the team should find */}
                  {breakdownResult.verificationEvidence && breakdownResult.verificationEvidence.length > 0 && (
                    <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Search className="w-4 h-4 text-amber-600" />
                        Verification Evidence (What Team Should Find)
                      </h4>
                      <div className="space-y-3">
                        {breakdownResult.verificationEvidence.map((evidence, idx) => (
                          <div key={idx} className="p-3 bg-background rounded border text-sm">
                            <p className="font-medium">{sanitizeText(evidence.observation)}</p>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Measured:</span>{' '}
                                <span className="font-mono text-destructive">{evidence.measuredValue}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Spec:</span>{' '}
                                <span className="font-mono text-green-600">{evidence.specificationRange}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Deviation:</span>{' '}
                                <span className="font-mono font-semibold">{evidence.deviation}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Method:</span> {evidence.inspectionMethod}
                              </div>
                            </div>
                            <p className="text-xs mt-1 text-muted-foreground">
                              <span className="font-medium">Ref:</span> {evidence.standardReference}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PERMANENT COUNTERMEASURES - With exact specs */}
                  {breakdownResult.permanentCountermeasures && breakdownResult.permanentCountermeasures.length > 0 && (
                    <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        Permanent Countermeasures
                      </h4>
                      <div className="space-y-3">
                        {breakdownResult.permanentCountermeasures.map((cm, idx) => (
                          <div key={idx} className="p-3 bg-background rounded border">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{sanitizeText(cm.action)}</p>
                                <p className="text-xs mt-1"><span className="text-muted-foreground">Spec:</span> <span className="font-mono">{cm.specification}</span></p>
                                {cm.torqueSpec && cm.torqueSpec !== 'N/A' && (
                                  <p className="text-xs"><span className="text-muted-foreground">Torque:</span> <span className="font-mono font-semibold text-primary">{cm.torqueSpec}</span></p>
                                )}
                                {cm.partNumber && cm.partNumber !== 'N/A' && (
                                  <p className="text-xs"><span className="text-muted-foreground">Parts:</span> <span className="font-mono">{cm.partNumber}</span></p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Verify:</span> {cm.verificationMethod} | <span className="font-medium">Ref:</span> {cm.standardReference}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TECHNICIAN VALIDATION STEPS */}
                  {breakdownResult.technicianValidationSteps && breakdownResult.technicianValidationSteps.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Technician Validation Steps
                      </h4>
                      <div className="space-y-2">
                        {breakdownResult.technicianValidationSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <p>{sanitizeText(step)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Priority Actions - Concise list */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Action Plan ({breakdownResult.actionPlan?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {breakdownResult.actionPlan?.slice(0, 5).map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 bg-muted/50 rounded">
                          <Badge 
                            variant={action.priority === 'immediate' ? 'destructive' : action.priority === 'short-term' ? 'default' : 'secondary'}
                            className="text-xs shrink-0 mt-0.5"
                          >
                            {idx + 1}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{sanitizeText(action.title)}</p>
                            <p className="text-xs text-muted-foreground">{action.ownerRole} • {action.timeline}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Details Section */}
                  <Accordion type="single" collapsible className="w-full">
                    {/* 5 Whys Detail */}
                    <AccordionItem value="fivewhys">
                      <AccordionTrigger className="text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4" />
                          5 Whys Analysis
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {breakdownResult.fiveWhys?.map((why, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                                {why.step}
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">{sanitizeText(why.question)}</p>
                                <p className="text-sm">{sanitizeText(why.answer)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Fishbone Detail */}
                    <AccordionItem value="fishbone">
                      <AccordionTrigger className="text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Fishbone Categories
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {breakdownResult.fishbone?.man?.length ? (
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                              <p className="text-xs font-semibold text-blue-600 mb-1">Man</p>
                              {breakdownResult.fishbone.man.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                          {breakdownResult.fishbone?.machine?.length ? (
                            <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                              <p className="text-xs font-semibold text-orange-600 mb-1">Machine</p>
                              {breakdownResult.fishbone.machine.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                          {breakdownResult.fishbone?.method?.length ? (
                            <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                              <p className="text-xs font-semibold text-green-600 mb-1">Method</p>
                              {breakdownResult.fishbone.method.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                          {breakdownResult.fishbone?.material?.length ? (
                            <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                              <p className="text-xs font-semibold text-purple-600 mb-1">Material</p>
                              {breakdownResult.fishbone.material.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                          {breakdownResult.fishbone?.measurement?.length ? (
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded">
                              <p className="text-xs font-semibold text-cyan-600 mb-1">Measurement</p>
                              {breakdownResult.fishbone.measurement.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                          {breakdownResult.fishbone?.environment?.length ? (
                            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                              <p className="text-xs font-semibold text-amber-600 mb-1">Environment</p>
                              {breakdownResult.fishbone.environment.map((c, i) => (
                                <p key={i} className="text-xs">{sanitizeText(c.factor)}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Full Action Details */}
                    <AccordionItem value="actions">
                      <AccordionTrigger className="text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Full Action Details & RACI
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {breakdownResult.actionPlan?.map((action, idx) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <p className="font-medium text-sm">{sanitizeText(action.title)}</p>
                                <Badge variant={action.priority === 'immediate' ? 'destructive' : 'secondary'} className="text-xs">
                                  {action.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{sanitizeText(action.description)}</p>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div><span className="text-muted-foreground">Owner:</span> {action.ownerRole}</div>
                                <div><span className="text-muted-foreground">Timeline:</span> {action.timeline}</div>
                                <div><span className="text-muted-foreground">Metric:</span> {sanitizeText(action.successMetric)}</div>
                                <div><span className="text-muted-foreground">Cost:</span> {action.estimatedCost || 'TBD'}</div>
                              </div>
                              {(action as any).raci && (
                                <div className="mt-2 pt-2 border-t flex gap-2 text-xs">
                                  <Badge variant="outline">R: {(action as any).raci.responsible}</Badge>
                                  <Badge variant="outline">A: {(action as any).raci.accountable}</Badge>
                                  <Badge variant="outline">C: {(action as any).raci.consulted}</Badge>
                                  <Badge variant="outline">I: {(action as any).raci.informed}</Badge>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Risks & Preventive Measures */}
                    {(breakdownResult.risks?.length || breakdownResult.preventiveMeasures?.length) ? (
                      <AccordionItem value="risks">
                        <AccordionTrigger className="text-sm font-medium">
                          <span className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Risks & Prevention
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {breakdownResult.risks?.length ? (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-amber-600 mb-1">Risks if Not Addressed</p>
                              <ul className="space-y-1">
                                {breakdownResult.risks.map((risk, idx) => (
                                  <li key={idx} className="text-xs flex items-start gap-1">
                                    <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                                    {sanitizeText(risk)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {breakdownResult.preventiveMeasures?.length ? (
                            <div>
                              <p className="text-xs font-semibold text-green-600 mb-1">Preventive Measures</p>
                              <ul className="space-y-1">
                                {breakdownResult.preventiveMeasures.map((pm, idx) => (
                                  <li key={idx} className="text-xs">
                                    {sanitizeText(pm.measure)} ({pm.frequency}, {pm.responsibility})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}
                  </Accordion>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Analysis will appear here</p>
                </div>
              )}
            </ScrollArea>

            {breakdownResult && (
              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const newActions = (breakdownResult.actionPlan || []).map((action, idx) => ({
                      id: `${Date.now()}-${idx}`,
                      title: sanitizeText(action.title),
                      description: sanitizeText(action.description),
                      priority: action.priority,
                      owner: action.ownerRole,
                      timeline: action.timeline,
                      successMetric: sanitizeText(action.successMetric),
                      estimatedCost: action.estimatedCost,
                      resources: action.resources,
                      implementationSteps: action.implementationSteps?.map(s => sanitizeText(s)),
                      raci: action.raci,
                      status: 'pending' as const,
                      notes: '',
                      segment: breakdownDialog.segment,
                      findingTitle: breakdownResult.findingTitle,
                    }));
                    setActionChecklist(prev => [...prev, ...newActions]);
                    setShowActionChecklist(true);
                    toast({
                      title: "Actions Added",
                      description: `${newActions.length} actions added to checklist`,
                    });
                  }}
                  data-testid="button-add-to-checklist"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Add to Checklist
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBreakdownDialog({ open: false, finding: null, segment: "" });
                      setBreakdownResult(null);
                    }}
                    data-testid="button-close-breakdown"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={async () => {
                      // Export RCA to PDF - Comprehensive Consultant-Grade Report
                      const { jsPDF } = await import('jspdf');
                      const doc = new jsPDF();
                      const pageWidth = doc.internal.pageSize.getWidth();
                      const margin = 15;
                      let y = 20;
                      
                      const checkPage = (needed: number = 20) => {
                        if (y > 280 - needed) { doc.addPage(); y = 20; }
                      };
                      
                      // Title
                      doc.setFontSize(16);
                      doc.setTextColor(40);
                      doc.text('Comprehensive Breakdown Analysis', pageWidth / 2, y, { align: 'center' });
                      y += 8;
                      
                      doc.setFontSize(10);
                      doc.setTextColor(100);
                      doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy")} | Segment: ${breakdownDialog.segment.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
                      y += 12;
                      
                      // Problem Statement
                      doc.setFontSize(11);
                      doc.setTextColor(40);
                      doc.text('PROBLEM STATEMENT:', margin, y);
                      y += 5;
                      doc.setFontSize(10);
                      const problemLines = doc.splitTextToSize(sanitizeText(breakdownResult.findingTitle), pageWidth - 2 * margin);
                      doc.text(problemLines, margin, y);
                      y += problemLines.length * 5 + 5;
                      
                      // Executive Summary
                      if (breakdownResult.executiveSummary) {
                        checkPage(30);
                        doc.setFontSize(11);
                        doc.setTextColor(0, 80, 150);
                        doc.text('EXECUTIVE SUMMARY:', margin, y);
                        y += 5;
                        doc.setFontSize(9);
                        doc.setTextColor(40);
                        const summaryLines = doc.splitTextToSize(sanitizeText(breakdownResult.executiveSummary), pageWidth - 2 * margin);
                        doc.text(summaryLines, margin, y);
                        y += summaryLines.length * 4 + 8;
                      }
                      
                      // Root Cause
                      if (breakdownResult.rootCause) {
                        checkPage(30);
                        doc.setFontSize(11);
                        doc.setTextColor(180, 0, 0);
                        doc.text('ROOT CAUSE:', margin, y);
                        y += 5;
                        doc.setFontSize(10);
                        doc.setTextColor(40);
                        const rcLines = doc.splitTextToSize(sanitizeText(breakdownResult.rootCause.statement), pageWidth - 2 * margin);
                        doc.text(rcLines, margin, y);
                        y += rcLines.length * 5 + 3;
                        
                        if (breakdownResult.rootCause.category) {
                          doc.setFontSize(9);
                          doc.setTextColor(100);
                          doc.text(`Category: ${breakdownResult.rootCause.category} | Confidence: ${breakdownResult.rootCause.confidence}%`, margin, y);
                          y += 8;
                        }
                      }
                      
                      // Cost-Benefit Summary
                      const cba = (breakdownResult as any).costBenefitAnalysis;
                      if (cba) {
                        checkPage(25);
                        doc.setFontSize(11);
                        doc.setTextColor(0, 100, 0);
                        doc.text('FINANCIAL IMPACT:', margin, y);
                        y += 5;
                        doc.setFontSize(9);
                        doc.setTextColor(40);
                        doc.text(`Annual Savings: ${cba.annualSavings}`, margin, y);
                        y += 4;
                        doc.text(`Implementation Cost: ${cba.implementationCost}`, margin, y);
                        y += 4;
                        doc.text(`Payback Period: ${cba.paybackPeriod}`, margin, y);
                        y += 4;
                        if (cba.roi) {
                          doc.text(`ROI: ${cba.roi}`, margin, y);
                          y += 4;
                        }
                        y += 4;
                      }
                      
                      // 5 Whys Analysis
                      if (breakdownResult.fiveWhys?.length) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('5 WHYS ANALYSIS:', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        breakdownResult.fiveWhys.forEach((why) => {
                          checkPage(15);
                          doc.setTextColor(100);
                          doc.text(`Why ${why.step}: ${sanitizeText(why.question)}`, margin + 2, y);
                          y += 4;
                          doc.setTextColor(40);
                          const ansLines = doc.splitTextToSize(sanitizeText(why.answer), pageWidth - 2 * margin - 6);
                          doc.text(ansLines, margin + 4, y);
                          y += ansLines.length * 4 + 3;
                        });
                        y += 4;
                      }
                      
                      // Fishbone Analysis
                      if (breakdownResult.fishbone) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('FISHBONE ANALYSIS (6M):', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        
                        const categories = ['man', 'machine', 'method', 'material', 'environment', 'measurement'];
                        const labels: Record<string, string> = { 
                          man: 'Man/People', machine: 'Machine/Equipment', method: 'Method/Process',
                          material: 'Material', environment: 'Environment', measurement: 'Measurement'
                        };
                        
                        categories.forEach(cat => {
                          const causes = breakdownResult.fishbone?.[cat as keyof typeof breakdownResult.fishbone];
                          if (causes && causes.length > 0) {
                            checkPage(15);
                            doc.setTextColor(80);
                            doc.text(`${labels[cat]}:`, margin + 2, y);
                            y += 4;
                            doc.setTextColor(40);
                            causes.forEach((cause: any) => {
                              checkPage(8);
                              // Handle both string causes and object causes
                              const causeText = typeof cause === 'string' ? cause : (cause.factor || '');
                              const causeLines = doc.splitTextToSize(`- ${sanitizeText(causeText)}`, pageWidth - 2 * margin - 10);
                              doc.text(causeLines, margin + 6, y);
                              y += causeLines.length * 4;
                            });
                            y += 2;
                          }
                        });
                        y += 4;
                      }
                      
                      // Verification Evidence
                      const evidence = (breakdownResult as any).verificationEvidence;
                      if (evidence?.length) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('VERIFICATION EVIDENCE:', margin, y);
                        y += 6;
                        doc.setFontSize(8);
                        doc.setTextColor(80);
                        doc.text('Finding', margin, y);
                        doc.text('What to Check', margin + 45, y);
                        doc.text('Where to Find Spec', margin + 90, y);
                        doc.text('Method', margin + 140, y);
                        y += 4;
                        doc.setDrawColor(200);
                        doc.line(margin, y, pageWidth - margin, y);
                        y += 3;
                        doc.setTextColor(40);
                        
                        evidence.forEach((ev: any) => {
                          checkPage(8);
                          doc.text(sanitizeText(ev.observation || '').substring(0, 22), margin, y);
                          doc.text(sanitizeText(ev.measurementRecommendation || ev.measuredValue || '').substring(0, 22), margin + 45, y);
                          doc.text(sanitizeText(ev.specificationSource || ev.specification || '').substring(0, 25), margin + 90, y);
                          doc.text(sanitizeText(ev.inspectionMethod || ev.deviation || '').substring(0, 18), margin + 140, y);
                          y += 5;
                        });
                        y += 4;
                      }
                      
                      // Permanent Countermeasures
                      const countermeasures = (breakdownResult as any).permanentCountermeasures;
                      if (countermeasures?.length) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('PERMANENT COUNTERMEASURES:', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        
                        countermeasures.forEach((cm: any, idx: number) => {
                          checkPage(20);
                          doc.setTextColor(40);
                          doc.text(`${idx + 1}. ${sanitizeText(cm.action || '')}`, margin + 2, y);
                          y += 4;
                          doc.setFontSize(8);
                          doc.setTextColor(80);
                          if (cm.specification) {
                            const specLines = doc.splitTextToSize(`Spec: ${sanitizeText(cm.specification)}`, pageWidth - 2 * margin - 10);
                            doc.text(specLines, margin + 6, y);
                            y += specLines.length * 3.5;
                          }
                          if (cm.partNumber) doc.text(`Part: ${cm.partNumber}`, margin + 6, y), y += 3.5;
                          if (cm.standard) doc.text(`Standard: ${cm.standard}`, margin + 6, y), y += 3.5;
                          doc.setFontSize(9);
                          y += 2;
                        });
                        y += 4;
                      }
                      
                      // Technician Validation Steps
                      const validation = (breakdownResult as any).technicianValidationSteps;
                      if (validation?.length) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('TECHNICIAN VALIDATION STEPS:', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        
                        validation.forEach((step: any, idx: number) => {
                          checkPage(15);
                          doc.setTextColor(40);
                          // Handle both string steps and object steps
                          const stepText = typeof step === 'string' ? step : (step.step || '');
                          const stepLines = doc.splitTextToSize(`${idx + 1}. ${sanitizeText(stepText)}`, pageWidth - 2 * margin - 4);
                          doc.text(stepLines, margin + 2, y);
                          y += stepLines.length * 4;
                          doc.setFontSize(8);
                          doc.setTextColor(80);
                          if (typeof step === 'object' && step.expectedResult) {
                            doc.text(`Expected: ${sanitizeText(step.expectedResult)}`, margin + 8, y);
                            y += 3.5;
                          }
                          if (typeof step === 'object' && step.tool) {
                            doc.text(`Tool: ${sanitizeText(step.tool)}`, margin + 8, y);
                            y += 3.5;
                          }
                          doc.setFontSize(9);
                          y += 2;
                        });
                        y += 4;
                      }
                      
                      // Action Plan
                      if (breakdownResult.actionPlan?.length) {
                        checkPage(40);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('ACTION PLAN:', margin, y);
                        y += 6;
                        
                        breakdownResult.actionPlan.forEach((action, idx) => {
                          checkPage(25);
                          doc.setFontSize(10);
                          doc.setTextColor(40);
                          doc.text(`${idx + 1}. ${sanitizeText(action.title)}`, margin + 2, y);
                          y += 4;
                          doc.setFontSize(8);
                          doc.setTextColor(80);
                          doc.text(`Owner: ${action.ownerRole} | Timeline: ${action.timeline} | Priority: ${action.priority}`, margin + 6, y);
                          y += 4;
                          if (action.description) {
                            const descLines = doc.splitTextToSize(sanitizeText(action.description), pageWidth - 2 * margin - 10);
                            doc.text(descLines, margin + 6, y);
                            y += descLines.length * 3.5;
                          }
                          if (action.successMetric) {
                            doc.text(`Success Metric: ${sanitizeText(action.successMetric)}`, margin + 6, y);
                            y += 4;
                          }
                          y += 3;
                        });
                        y += 4;
                      }
                      
                      // Preventive Measures
                      if (breakdownResult.preventiveMeasures?.length) {
                        checkPage(30);
                        doc.setFontSize(11);
                        doc.setTextColor(40);
                        doc.text('PREVENTIVE MEASURES:', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        
                        breakdownResult.preventiveMeasures.forEach((pm, idx) => {
                          checkPage(10);
                          doc.setTextColor(40);
                          const pmLines = doc.splitTextToSize(`${idx + 1}. ${sanitizeText(pm.measure)} (${pm.frequency}, ${pm.responsibility})`, pageWidth - 2 * margin - 4);
                          doc.text(pmLines, margin + 2, y);
                          y += pmLines.length * 4 + 2;
                        });
                        y += 4;
                      }
                      
                      // Risks
                      if (breakdownResult.risks?.length) {
                        checkPage(30);
                        doc.setFontSize(11);
                        doc.setTextColor(150, 80, 0);
                        doc.text('RISKS:', margin, y);
                        y += 6;
                        doc.setFontSize(9);
                        doc.setTextColor(40);
                        
                        breakdownResult.risks.forEach((risk) => {
                          checkPage(10);
                          const riskLines = doc.splitTextToSize(`- ${sanitizeText(risk.description)} [${risk.likelihood}/${risk.impact}] Mitigation: ${sanitizeText(risk.mitigation)}`, pageWidth - 2 * margin - 4);
                          doc.text(riskLines, margin + 2, y);
                          y += riskLines.length * 4 + 2;
                        });
                      }
                      
                      doc.save(`RCA-${breakdownDialog.segment}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
                      toast({ title: "Report Exported", description: "Comprehensive RCA report saved as PDF" });
                    }}
                    data-testid="button-export-rca"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Action Checklist Dialog */}
        <Dialog open={showActionChecklist} onOpenChange={setShowActionChecklist}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Action Checklist
              </DialogTitle>
              <DialogDescription>
                Track and manage action items from your breakdown analysis. {actionChecklist.filter(a => a.status === 'completed').length} of {actionChecklist.length} completed.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              {actionChecklist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No actions in checklist yet</p>
                  <p className="text-xs text-muted-foreground mt-2">Run Breakdown Analysis on findings and add actions to your checklist</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {actionChecklist.filter(a => a.status === 'completed').length} / {actionChecklist.length} completed
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(actionChecklist.filter(a => a.status === 'completed').length / actionChecklist.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Group by segment */}
                  {['safety', 'quality', 'operations', 'maintenance'].map(seg => {
                    const segmentActions = actionChecklist.filter(a => a.segment === seg);
                    if (segmentActions.length === 0) return null;
                    
                    const config = segmentConfig[seg as keyof typeof segmentConfig];
                    const Icon = config.icon;
                    
                    return (
                      <Card key={seg} className={`${config.borderColor} border`}>
                        <CardHeader className="pb-2">
                          <CardTitle className={`text-base flex items-center gap-2 ${config.color}`}>
                            <Icon className="w-5 h-5" />
                            {config.label} Actions ({segmentActions.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {segmentActions.map((action) => (
                            <div 
                              key={action.id} 
                              className={`p-4 border rounded-lg ${action.status === 'completed' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => {
                                    setActionChecklist(prev => prev.map(a => 
                                      a.id === action.id 
                                        ? { 
                                            ...a, 
                                            status: a.status === 'completed' ? 'pending' : a.status === 'in_progress' ? 'completed' : 'in_progress',
                                            completedDate: a.status === 'in_progress' ? new Date().toISOString() : undefined
                                          }
                                        : a
                                    ));
                                  }}
                                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    action.status === 'completed' 
                                      ? 'bg-green-500 border-green-500 text-white' 
                                      : action.status === 'in_progress'
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'border-muted-foreground'
                                  }`}
                                  data-testid={`checkbox-action-${action.id}`}
                                >
                                  {action.status === 'completed' && <Check className="w-3 h-3" />}
                                  {action.status === 'in_progress' && <Clock className="w-3 h-3" />}
                                </button>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <h4 className={`font-medium ${action.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                      {action.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={action.priority === 'immediate' ? 'destructive' : action.priority === 'short-term' ? 'default' : 'secondary'}>
                                        {action.priority}
                                      </Badge>
                                      <Badge variant="outline" className="capitalize">{action.status.replace('_', ' ')}</Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Owner:</span>
                                      <span className="ml-1 font-medium">{action.owner}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Timeline:</span>
                                      <span className="ml-1 font-medium">{action.timeline}</span>
                                    </div>
                                    {action.estimatedCost && (
                                      <div>
                                        <span className="text-muted-foreground">Est. Cost:</span>
                                        <span className="ml-1 font-medium">{action.estimatedCost}</span>
                                      </div>
                                    )}
                                    <div className="col-span-2 md:col-span-1">
                                      <span className="text-muted-foreground">Success Metric:</span>
                                      <span className="ml-1 font-medium">{action.successMetric}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Implementation Steps */}
                                  {action.implementationSteps && action.implementationSteps.length > 0 && (
                                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                      <p className="text-xs font-semibold text-muted-foreground mb-2">Implementation Steps:</p>
                                      <ol className="space-y-1 text-xs list-decimal list-inside">
                                        {action.implementationSteps.map((step, stepIdx) => (
                                          <li key={stepIdx} className={action.status === 'completed' ? 'text-muted-foreground line-through' : ''}>
                                            {step}
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}
                                  
                                  {/* RACI Matrix */}
                                  {action.raci && (
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      <Badge variant="outline" className="text-xs">R: {action.raci.responsible}</Badge>
                                      <Badge variant="outline" className="text-xs">A: {action.raci.accountable}</Badge>
                                      <Badge variant="outline" className="text-xs">C: {action.raci.consulted}</Badge>
                                      <Badge variant="outline" className="text-xs">I: {action.raci.informed}</Badge>
                                    </div>
                                  )}
                                  {action.status === 'completed' && action.completedDate && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                      Completed {format(new Date(action.completedDate), "MMM dd, yyyy")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      createWorkOrderFromAction.mutate({
                                        id: action.id,
                                        title: action.title,
                                        description: action.description,
                                        priority: action.priority,
                                        timeline: action.timeline,
                                        segment: action.segment,
                                        findingTitle: action.findingTitle,
                                      });
                                    }}
                                    disabled={creatingWorkOrderForAction === action.id}
                                    data-testid={`button-create-wo-${action.id}`}
                                  >
                                    {creatingWorkOrderForAction === action.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Wrench className="w-4 h-4 mr-1" />
                                        Create WO
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setActionChecklist(prev => prev.filter(a => a.id !== action.id));
                                    }}
                                    data-testid={`button-remove-action-${action.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => {
                  setActionChecklist([]);
                  toast({
                    title: "Checklist Cleared",
                    description: "All actions have been removed from the checklist",
                  });
                }}
                disabled={actionChecklist.length === 0}
                data-testid="button-clear-checklist"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowActionChecklist(false)}
                  data-testid="button-close-checklist"
                >
                  Close
                </Button>
                <Button
                  onClick={async () => {
                    const { jsPDF } = await import('jspdf');
                    const { default: autoTable } = await import('jspdf-autotable');
                    
                    const doc = new jsPDF();
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 14;
                    
                    doc.setFontSize(18);
                    doc.setTextColor(40);
                    doc.text('Action Checklist Report', pageWidth / 2, 20, { align: 'center' });
                    
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy")}`, pageWidth / 2, 28, { align: 'center' });
                    doc.text(`${actionChecklist.filter(a => a.status === 'completed').length} of ${actionChecklist.length} actions completed`, pageWidth / 2, 34, { align: 'center' });
                    
                    let yPos = 45;
                    
                    // Group by segment
                    ['safety', 'quality', 'operations', 'maintenance'].forEach(seg => {
                      const segmentActions = actionChecklist.filter(a => a.segment === seg);
                      if (segmentActions.length === 0) return;
                      
                      // Check if we need a new page
                      if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                      }
                      
                      // Segment header
                      doc.setFontSize(12);
                      doc.setTextColor(40);
                      doc.text(`${seg.charAt(0).toUpperCase() + seg.slice(1)} Actions (${segmentActions.length})`, margin, yPos);
                      yPos += 8;
                      
                      segmentActions.forEach((action, idx) => {
                        // Check for new page
                        if (yPos > 250) {
                          doc.addPage();
                          yPos = 20;
                        }
                        
                        // Action title with status
                        doc.setFontSize(10);
                        doc.setTextColor(40);
                        const statusIcon = action.status === 'completed' ? '[X]' : action.status === 'in_progress' ? '[~]' : '[ ]';
                        doc.text(`${statusIcon} ${action.title}`, margin, yPos);
                        yPos += 5;
                        
                        // Action details
                        doc.setFontSize(8);
                        doc.setTextColor(100);
                        doc.text(`Priority: ${action.priority} | Owner: ${action.owner} | Timeline: ${action.timeline}`, margin + 4, yPos);
                        yPos += 4;
                        
                        if (action.estimatedCost) {
                          doc.text(`Est. Cost: ${action.estimatedCost}`, margin + 4, yPos);
                          yPos += 4;
                        }
                        
                        doc.text(`Success Metric: ${action.successMetric}`, margin + 4, yPos);
                        yPos += 4;
                        
                        // RACI
                        if (action.raci) {
                          doc.text(`RACI: R-${action.raci.responsible} | A-${action.raci.accountable} | C-${action.raci.consulted} | I-${action.raci.informed}`, margin + 4, yPos);
                          yPos += 4;
                        }
                        
                        // Implementation Steps
                        if (action.implementationSteps && action.implementationSteps.length > 0) {
                          doc.text('Implementation Steps:', margin + 4, yPos);
                          yPos += 4;
                          action.implementationSteps.forEach((step, stepIdx) => {
                            if (yPos > 280) {
                              doc.addPage();
                              yPos = 20;
                            }
                            doc.text(`  ${stepIdx + 1}. ${step}`, margin + 6, yPos);
                            yPos += 3.5;
                          });
                        }
                        
                        if (action.status === 'completed' && action.completedDate) {
                          doc.setTextColor(34, 139, 34);
                          doc.text(`Completed: ${format(new Date(action.completedDate), "MMM dd, yyyy")}`, margin + 4, yPos);
                          yPos += 4;
                        }
                        
                        yPos += 4;
                      });
                      
                      yPos += 6;
                    });
                    
                    doc.save('action-checklist.pdf');
                    toast({
                      title: "Checklist Exported",
                      description: "Action checklist has been exported to PDF",
                    });
                  }}
                  disabled={actionChecklist.length === 0}
                  data-testid="button-export-checklist"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold">Downtime Analysis Reports</h1>
          <p className="text-sm text-muted-foreground">
            C4 Powered downtime analysis from imported data
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowImportDialog(true)} data-testid="button-import">
            <Upload className="w-4 h-4 mr-2" />
            Generate New Report
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archive")} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-12">
            <TabsTrigger value="active" className="gap-2" data-testid="tab-active-reports">
              <FileText className="w-4 h-4" />
              Active Reports ({activeReports.length})
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2" data-testid="tab-archived-reports">
              <Archive className="w-4 h-4" />
              Archive ({archivedReports.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 overflow-auto p-6 mt-0">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : displayedReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {activeTab === "archive" ? (
                  <>
                    <Archive className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Archived Reports</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Archived reports will appear here
                    </p>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Analysis Reports</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Import downtime data (CSV, Excel, PDF, Word) to generate C4 Powered analysis reports
                    </p>
                    {canManage && (
                      <Button onClick={() => setShowImportDialog(true)} data-testid="button-generate-first">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Your First Report
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedReports.map((report) => (
              <Card
                key={report.id}
                data-testid={`card-report-${report.id}`}
              >
                <CardHeader className="cursor-pointer hover-elevate" onClick={() => setSelectedReport(report)}>
                  <div className="flex items-start justify-between mb-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <Badge variant="outline">{report.fileType}</Badge>
                  </div>
                  <CardTitle className="text-lg truncate">{report.fileName}</CardTitle>
                  <CardDescription>
                    {format(new Date(report.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Records Analyzed:</span>
                        <span className="font-semibold">{report.recordCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Downtime:</span>
                        <span className="font-semibold">{report.totalDowntimeHours?.toFixed(1)} hrs</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Most Affected:</span>
                        <span className="font-semibold truncate ml-2">
                          {report.analysisData?.summary?.mostAffectedEquipment || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      {activeTab === "archive" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchiveReport.mutate(report.id);
                          }}
                          data-testid={`button-unarchive-${report.id}`}
                        >
                          <ArchiveRestore className="w-3 h-3 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveReport.mutate(report.id);
                          }}
                          data-testid={`button-archive-${report.id}`}
                        >
                          <Archive className="w-3 h-3 mr-1" />
                          Move to Archive
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
                            deleteReport.mutate(report.id);
                          }
                        }}
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Downtime Analysis Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Sparkles className="w-4 h-4" />
              <AlertTitle>C4 Powered Analysis</AlertTitle>
              <AlertDescription>
                Upload any format (CSV, Excel, PDF, Word) with downtime data. Our advanced analysis engine will automatically generate a comprehensive professional report with insights, patterns, root causes, and recommendations.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 25 * 1024 * 1024) {
                    toast({
                      title: "File Too Large",
                      description: "Please select a file smaller than 25MB. For larger files, try splitting the data into smaller chunks.",
                      variant: "destructive"
                    });
                    e.target.value = '';
                    setSelectedFile(null);
                    return;
                  }
                  setSelectedFile(file);
                }}
                data-testid="input-import-file"
              />
              <p className="text-xs text-muted-foreground">Maximum file size: 25MB</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setSelectedFile(null);
                }}
                data-testid="button-cancel-import"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedFile || generateAnalysisReport.isPending}
                data-testid="button-start-analysis"
              >
                {generateAnalysisReport.isPending ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
