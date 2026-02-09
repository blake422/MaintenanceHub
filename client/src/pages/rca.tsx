import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Lightbulb, Sparkles, Wand2, FileDown, Eye, Search, TrendingUp, X, Calendar, User, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { RCA, Equipment, WorkOrder } from "@shared/schema";
import { format } from "date-fns";
import { WorkOrderCreationDialog } from "@/components/WorkOrderCreationDialog";
import { LOGO_BASE64 } from "@/lib/logo-base64";

export default function RCAPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [problemStatement, setProblemStatement] = useState("");
  const [whyAnswers, setWhyAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [loadingWhy, setLoadingWhy] = useState<number | null>(null);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [selectedRCA, setSelectedRCA] = useState<RCA | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"new" | "history">("new");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Work Order Creation Dialog state
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);
  const [createdRCA, setCreatedRCA] = useState<RCA | null>(null);
  
  // New comprehensive fields
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>("");
  const [rootCauses, setRootCauses] = useState<string[]>([""]);
  const [correctiveActions, setCorrectiveActions] = useState<{
    action: string;
    responsible: string;
    dueDate: string;
    completed: boolean;
  }[]>([{ action: "", responsible: "", dueDate: "", completed: false }]);
  const [fishboneCategories, setFishboneCategories] = useState<Record<string, string[]>>({
    People: [""],
    Process: [""],
    Equipment: [""],
    Materials: [""],
    Environment: [""],
    Management: [""],
  });

  // Fetch RCA records with pagination and search
  const { data: rcaData, isLoading } = useQuery({
    queryKey: ["/api/rca", page, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
      });
      const response = await fetch(`/api/rca?${params}`);
      if (!response.ok) throw new Error("Failed to fetch RCAs");
      return response.json();
    },
    enabled: !!user,
  });

  const rcaRecords = rcaData?.records || [];
  const pagination = rcaData?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 };
  const stats = rcaData?.stats || { total: 0, thisMonth: 0, withCorrectiveActions: 0 };

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    enabled: !!user,
  });

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user,
  });

  // Auto-populate Why #1 when problem statement is entered
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (problemStatement.trim() === "") {
      setAutoPopulated(false);
    }
    
    if (problemStatement.trim() && !autoPopulated && !whyAnswers[0]) {
      timeoutId = setTimeout(() => {
        handleGetWhySuggestion(0);
      }, 1000);
    }
    
    return () => clearTimeout(timeoutId);
  }, [problemStatement, autoPopulated, whyAnswers]);

  const getWhySuggestion = useMutation({
    mutationFn: async ({ whyIndex }: { whyIndex: number }) => {
      const previousWhys = whyAnswers.slice(0, whyIndex).filter(a => a.trim());
      
      const response = await fetch('/api/rca/suggest-why', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemStatement,
          previousWhys,
          whyLevel: whyIndex + 1,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      const newWhyAnswers = [...whyAnswers];
      newWhyAnswers[variables.whyIndex] = data.suggestion;
      setWhyAnswers(newWhyAnswers);

      if (variables.whyIndex === 0) {
        setAutoPopulated(true);
      }

      toast({
        title: "C4 Suggestion Generated",
        description: `Why #${variables.whyIndex + 1} suggestion has been added.`,
      });
    },
    onError: (error, variables) => {
      if (variables.whyIndex === 0) {
        setAutoPopulated(false);
      }
      
      toast({
        title: "Failed to get suggestion",
        description: "There was an error getting the C4 suggestion. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetWhySuggestion = async (whyIndex: number) => {
    if (!problemStatement.trim()) {
      toast({
        title: "Problem statement required",
        description: "Please enter a problem statement first.",
        variant: "destructive",
      });
      return;
    }

    setLoadingWhy(whyIndex);
    try {
      await getWhySuggestion.mutateAsync({ whyIndex });
    } finally {
      setLoadingWhy(null);
    }
  };

  const createRCA = useMutation({
    mutationFn: async () => {
      const fiveWhys = whyAnswers
        .filter(a => a.trim())
        .map((answer, idx) => ({
          question: `Why #${idx + 1}?`,
          answer,
        }));

      // Clean up fishbone categories
      const cleanedFishbone = Object.entries(fishboneCategories).reduce((acc, [key, values]) => {
        const filtered = values.filter(v => v.trim());
        if (filtered.length > 0) {
          acc[key] = filtered;
        }
        return acc;
      }, {} as Record<string, string[]>);

      const response = await fetch('/api/rca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemStatement,
          equipmentId: selectedEquipment && selectedEquipment !== "none" ? selectedEquipment : undefined,
          workOrderId: selectedWorkOrder && selectedWorkOrder !== "none" ? selectedWorkOrder : undefined,
          fiveWhys,
          fishboneDiagram: Object.keys(cleanedFishbone).length > 0 ? cleanedFishbone : undefined,
          rootCauses: rootCauses.filter(r => r.trim()),
          correctiveActions: correctiveActions.filter(ca => ca.action.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create RCA');
      }

      const newRCA = await response.json();

      // Get AI insights
      const analysisResponse = await fetch(`/api/rca/${newRCA.id}/analyze`, {
        method: 'POST',
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze RCA');
      }

      return newRCA;
    },
    onSuccess: (rca) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rca"] });
      
      // Check if there are corrective actions to create work orders from
      const validCorrectiveActions = correctiveActions.filter(ca => ca.action.trim());
      
      if (validCorrectiveActions.length > 0) {
        // Show work order creation dialog
        setCreatedRCA(rca);
        setShowWorkOrderDialog(true);
      } else {
        // No corrective actions, just show success and switch to history
        resetForm();
        setViewMode("history");
        toast({
          title: "Success",
          description: "RCA created and analyzed successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create RCA",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setShowNewForm(false);
    setProblemStatement("");
    setWhyAnswers(["", "", "", "", ""]);
    setAutoPopulated(false);
    setSelectedEquipment("");
    setSelectedWorkOrder("");
    setRootCauses([""]);
    setCorrectiveActions([{ action: "", responsible: "", dueDate: "", completed: false }]);
    setFishboneCategories({
      People: [""],
      Process: [""],
      Equipment: [""],
      Materials: [""],
      Environment: [""],
      Management: [""],
    });
  };

  const handleSubmit = () => {
    if (!problemStatement.trim()) {
      toast({
        title: "Problem statement required",
        description: "Please enter a problem statement.",
        variant: "destructive",
      });
      return;
    }

    const filledWhys = whyAnswers.filter(a => a.trim()).length;
    if (filledWhys === 0) {
      toast({
        title: "At least one why required",
        description: "Please complete at least Why #1.",
        variant: "destructive",
      });
      return;
    }

    createRCA.mutate();
  };

  const exportToPDF = async (rca: RCA) => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Clean color palette
      const navy = [20, 40, 80] as [number, number, number];
      const green = [16, 185, 129] as [number, number, number];
      const gray = [100, 100, 100] as [number, number, number];
      const lightGray = [245, 245, 245] as [number, number, number];
      
      // Text sanitizer
      const sanitize = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/^#{1,6}\s*/gm, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/^[\-\*\+]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\n{2,}/g, ' ')
          .trim();
      };
      
      // Get data
      const eq = equipment.find(e => e.id === rca.equipmentId);
      const wo = workOrders.find(w => w.id === rca.workOrderId);
      const whys = rca.fiveWhys || [];
      const completedActions = rca.correctiveActions?.filter((ca: any) => ca.completed || ca.status === 'completed').length || 0;
      const totalActions = rca.correctiveActions?.length || 0;
      
      // ============ HEADER ============
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      try {
        doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25);
      } catch {}
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Root Cause Analysis Report', 50, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('C4 Industrial', 50, 26);
      
      let y = 45;
      
      // ============ REPORT INFO ============
      doc.setFontSize(10);
      doc.setTextColor(...gray);
      doc.text(`Report #${rca.id.substring(0, 8).toUpperCase()}`, margin, y);
      doc.text(`Date: ${rca.createdAt ? format(new Date(rca.createdAt), "MMMM d, yyyy") : 'N/A'}`, pageWidth - margin, y, { align: 'right' });
      y += 15;
      
      // ============ PROBLEM STATEMENT ============
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Problem Statement', margin, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const problemLines = doc.splitTextToSize(rca.problemStatement, contentWidth);
      doc.text(problemLines, margin, y);
      y += problemLines.length * 5 + 10;
      
      // ============ 5 WHYS TABLE ============
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('5 Whys Analysis', margin, y);
      y += 6;
      
      const whysData = Array.from({ length: 5 }, (_, i) => {
        const answer = whys[i]?.answer?.trim() ? sanitize(whys[i].answer) : '—';
        return [`Why ${i + 1}`, answer];
      });
      
      autoTable(doc, {
        startY: y,
        head: [['Level', 'Finding']],
        body: whysData,
        theme: 'grid',
        headStyles: { fillColor: navy, fontSize: 10, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: 'bold' },
          1: { cellWidth: contentWidth - 25 }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 15;
      
      // ============ ROOT CAUSES ============
      if (rca.rootCauses && rca.rootCauses.length > 0) {
        if (y > pageHeight - 50) { doc.addPage(); y = 20; }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Root Causes Identified', margin, y);
        y += 6;
        
        autoTable(doc, {
          startY: y,
          head: [['#', 'Root Cause']],
          body: rca.rootCauses.map((cause: string, i: number) => [`${i + 1}`, sanitize(cause)]),
          theme: 'grid',
          headStyles: { fillColor: navy, fontSize: 10, fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: contentWidth - 15 }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 15;
      }
      
      // ============ CORRECTIVE ACTIONS ============
      if (rca.correctiveActions && rca.correctiveActions.length > 0) {
        if (y > pageHeight - 50) { doc.addPage(); y = 20; }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Corrective Actions (${completedActions}/${totalActions} Complete)`, margin, y);
        y += 6;
        
        autoTable(doc, {
          startY: y,
          head: [['Action', 'Owner', 'Due', 'Status']],
          body: rca.correctiveActions.map((ca: any) => [
            sanitize(ca.action || ''),
            ca.owner || ca.responsible || '—',
            ca.dueDate ? format(new Date(ca.dueDate), "MMM d") : '—',
            ca.completed || ca.status === 'completed' ? 'Done' : 'Open'
          ]),
          theme: 'grid',
          headStyles: { fillColor: green, fontSize: 10, fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: contentWidth - 65 },
            1: { cellWidth: 25 },
            2: { cellWidth: 20 },
            3: { cellWidth: 20, halign: 'center' }
          },
          didParseCell: (data: any) => {
            if (data.column.index === 3 && data.section === 'body') {
              data.cell.styles.textColor = data.cell.raw === 'Done' ? green : [200, 100, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });
        y = (doc as any).lastAutoTable.finalY + 15;
      }
      
      // ============ AI INSIGHTS ============
      if (rca.aiInsights) {
        if (y > pageHeight - 60) { doc.addPage(); y = 20; }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('AI Analysis', margin, y);
        y += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const insights = sanitize(rca.aiInsights);
        const insightLines = doc.splitTextToSize(insights, contentWidth);
        
        for (const line of insightLines) {
          if (y > pageHeight - 20) { doc.addPage(); y = 20; }
          doc.text(line, margin, y);
          y += 5;
        }
      }
      
      // ============ FOOTER ON ALL PAGES ============
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

      doc.save(`RCA_Report_${rca.id.substring(0, 8)}_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "PDF Exported",
        description: "Professional RCA report has been downloaded.",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      });
    }
  };

  const shouldShowC4Suggest = (idx: number) => {
    if (idx === 0) {
      return !autoPopulated && problemStatement.trim() !== "";
    }
    return whyAnswers[0].trim() !== "";
  };

  // Reset to page 1 when search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">RCA Oracle</h1>
          <p className="text-muted-foreground">
            Comprehensive Root Cause Analysis with C4 AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "new" ? "default" : "outline"}
            onClick={() => setViewMode("new")}
            data-testid="button-view-new"
          >
            <Plus className="w-4 h-4 mr-2" />
            New RCA
          </Button>
          <Button
            variant={viewMode === "history" ? "default" : "outline"}
            onClick={() => setViewMode("history")}
            data-testid="button-view-history"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total RCAs</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-3xl">{stats.thisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>With Actions</CardDescription>
            <CardTitle className="text-3xl">{stats.withCorrectiveActions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {viewMode === "new" && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Create Comprehensive RCA</CardTitle>
            <CardDescription>
              Complete root cause analysis with fishbone diagram, corrective actions, and C4 AI insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="problem" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="problem">Problem & 5 Whys</TabsTrigger>
                <TabsTrigger value="fishbone">Fishbone</TabsTrigger>
                <TabsTrigger value="root-causes">Root Causes</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="problem" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Equipment (Optional)</label>
                    <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                      <SelectTrigger data-testid="select-equipment">
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {equipment.map((eq) => (
                          <SelectItem key={eq.id} value={eq.id}>
                            {eq.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Work Order (Optional)</label>
                    <Select value={selectedWorkOrder} onValueChange={setSelectedWorkOrder}>
                      <SelectTrigger data-testid="select-work-order">
                        <SelectValue placeholder="Select work order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {workOrders.map((wo) => (
                          <SelectItem key={wo.id} value={wo.id}>
                            {wo.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Problem Statement *</label>
                  <Textarea
                    placeholder="Describe the problem in detail..."
                    className="min-h-[100px]"
                    value={problemStatement}
                    onChange={(e) => {
                      setProblemStatement(e.target.value);
                      if (e.target.value.trim() === "") {
                        setAutoPopulated(false);
                      }
                    }}
                    data-testid="input-problem-statement"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    C4 will auto-generate Why #1 once you enter the problem statement
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    5 Whys Analysis
                    <span className="text-xs text-muted-foreground ml-2">(C4 Powered)</span>
                  </label>
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Why #{idx + 1}
                            {idx === 0 && autoPopulated && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Auto-generated
                              </Badge>
                            )}
                          </p>
                          {shouldShowC4Suggest(idx) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleGetWhySuggestion(idx)}
                              disabled={loadingWhy === idx}
                              data-testid={`button-c4-suggest-${idx + 1}`}
                            >
                              <Wand2 className="w-3 h-3 mr-1" />
                              {loadingWhy === idx ? "Generating..." : "C4 Suggest"}
                            </Button>
                          )}
                        </div>
                        <Textarea
                          placeholder={idx === 0 
                            ? "C4 will auto-populate this (or click C4 Suggest)..." 
                            : `Why did this happen? (Level ${idx + 1})`
                          }
                          className="min-h-[60px]"
                          value={whyAnswers[idx]}
                          onChange={(e) => {
                            const newWhyAnswers = [...whyAnswers];
                            newWhyAnswers[idx] = e.target.value;
                            setWhyAnswers(newWhyAnswers);
                            if (idx === 0 && !autoPopulated) {
                              setAutoPopulated(true);
                            }
                          }}
                          data-testid={`input-why-${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fishbone" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Categorize contributing factors using the fishbone diagram method
                </p>
                {Object.keys(fishboneCategories).map((category) => (
                  <div key={category}>
                    <label className="text-sm font-medium mb-2 block">{category}</label>
                    <div className="space-y-2">
                      {fishboneCategories[category].map((value, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            placeholder={`Enter ${category.toLowerCase()} factor...`}
                            value={value}
                            onChange={(e) => {
                              const newCategories = { ...fishboneCategories };
                              newCategories[category][idx] = e.target.value;
                              setFishboneCategories(newCategories);
                            }}
                            data-testid={`input-fishbone-${category}-${idx}`}
                          />
                          {fishboneCategories[category].length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const newCategories = { ...fishboneCategories };
                                newCategories[category].splice(idx, 1);
                                setFishboneCategories(newCategories);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newCategories = { ...fishboneCategories };
                          newCategories[category].push("");
                          setFishboneCategories(newCategories);
                        }}
                        data-testid={`button-add-fishbone-${category}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add {category} Factor
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="root-causes" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Identify the fundamental root causes based on your 5 Whys analysis
                </p>
                <div className="space-y-2">
                  {rootCauses.map((cause, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder="Enter root cause..."
                        value={cause}
                        onChange={(e) => {
                          const newCauses = [...rootCauses];
                          newCauses[idx] = e.target.value;
                          setRootCauses(newCauses);
                        }}
                        data-testid={`input-root-cause-${idx}`}
                      />
                      {rootCauses.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const newCauses = [...rootCauses];
                            newCauses.splice(idx, 1);
                            setRootCauses(newCauses);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRootCauses([...rootCauses, ""])}
                    data-testid="button-add-root-cause"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Root Cause
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Define corrective actions with assignments and due dates
                </p>
                <div className="space-y-4">
                  {correctiveActions.map((action, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium">Action #{idx + 1}</h4>
                          {correctiveActions.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const newActions = [...correctiveActions];
                                newActions.splice(idx, 1);
                                setCorrectiveActions(newActions);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="Corrective action description..."
                          value={action.action}
                          onChange={(e) => {
                            const newActions = [...correctiveActions];
                            newActions[idx].action = e.target.value;
                            setCorrectiveActions(newActions);
                          }}
                          data-testid={`input-action-${idx}`}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Responsible person..."
                            value={action.responsible}
                            onChange={(e) => {
                              const newActions = [...correctiveActions];
                              newActions[idx].responsible = e.target.value;
                              setCorrectiveActions(newActions);
                            }}
                            data-testid={`input-responsible-${idx}`}
                          />
                          <Input
                            type="date"
                            value={action.dueDate}
                            onChange={(e) => {
                              const newActions = [...correctiveActions];
                              newActions[idx].dueDate = e.target.value;
                              setCorrectiveActions(newActions);
                            }}
                            data-testid={`input-due-date-${idx}`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCorrectiveActions([...correctiveActions, { action: "", responsible: "", dueDate: "", completed: false }])}
                    data-testid="button-add-action"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Corrective Action
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleSubmit}
              disabled={createRCA.isPending}
              data-testid="button-submit-rca"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {createRCA.isPending ? "Creating RCA..." : "Generate C4 Insights & Save RCA"}
            </Button>
          </CardContent>
        </Card>
      )}

      {viewMode === "history" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search RCAs by problem or root cause..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-rca"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading RCA records...
                </div>
              ) : rcaRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No RCA records found. {searchTerm && "Try a different search term or "}Click "New RCA" to create one.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Problem Statement</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Root Causes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rcaRecords.map((rca) => {
                        const eq = equipment.find(e => e.id === rca.equipmentId);
                        return (
                          <TableRow key={rca.id} className="hover-elevate">
                            <TableCell className="font-medium max-w-md">
                              <div className="line-clamp-2">{rca.problemStatement}</div>
                            </TableCell>
                            <TableCell>
                              {eq ? eq.name : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {(rca.rootCauses || []).length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {(rca.rootCauses || []).slice(0, 2).map((rc: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {rc}
                                    </Badge>
                                  ))}
                                  {(rca.rootCauses || []).length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{(rca.rootCauses || []).length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {rca.createdAt ? format(new Date(rca.createdAt), "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRCA(rca);
                                    setShowFullAnalysis(true);
                                  }}
                                  data-testid={`button-view-${rca.id}`}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => exportToPDF(rca)}
                                  data-testid={`button-export-${rca.id}`}
                                >
                                  <FileDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <Button
                                key={pageNum}
                                size="sm"
                                variant={page === pageNum ? "default" : "outline"}
                                onClick={() => setPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          {pagination.totalPages > 5 && <span className="text-sm text-muted-foreground">...</span>}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                          disabled={page === pagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Analysis Dialog */}
      <Dialog open={showFullAnalysis} onOpenChange={setShowFullAnalysis}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Full RCA Analysis</DialogTitle>
          </DialogHeader>
          
          {selectedRCA && (
            <div className="space-y-6">
              {/* Problem Statement */}
              <div>
                <h3 className="font-semibold mb-2">Problem Statement</h3>
                <p className="text-sm text-muted-foreground">{selectedRCA.problemStatement}</p>
              </div>

              {/* Equipment/Work Order */}
              {(selectedRCA.equipmentId || selectedRCA.workOrderId) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedRCA.equipmentId && (
                    <div>
                      <h3 className="font-semibold mb-2 text-sm">Equipment</h3>
                      <p className="text-sm text-muted-foreground">
                        {equipment.find(e => e.id === selectedRCA.equipmentId)?.name || "Unknown"}
                      </p>
                    </div>
                  )}
                  {selectedRCA.workOrderId && (
                    <div>
                      <h3 className="font-semibold mb-2 text-sm">Work Order</h3>
                      <p className="text-sm text-muted-foreground">
                        {workOrders.find(w => w.id === selectedRCA.workOrderId)?.title || "Unknown"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 5 Whys */}
              <div>
                <h3 className="font-semibold mb-3">5 Whys Analysis</h3>
                <div className="space-y-3">
                  {(selectedRCA.fiveWhys || []).map((why: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Why #{idx + 1}</p>
                      <p className="text-sm">{why.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Root Causes */}
              {selectedRCA.rootCauses && selectedRCA.rootCauses.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Root Causes</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRCA.rootCauses.map((cause: string, idx: number) => (
                      <Badge key={idx} variant="destructive">
                        {cause}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Fishbone Diagram */}
              {selectedRCA.fishboneDiagram && Object.keys(selectedRCA.fishboneDiagram).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Fishbone Analysis</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedRCA.fishboneDiagram).map(([category, factors]: [string, any]) => (
                      <Card key={category}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{category}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-1">
                            {factors.map((factor: string, idx: number) => (
                              <li key={idx} className="text-muted-foreground">• {factor}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Corrective Actions */}
              {selectedRCA.correctiveActions && selectedRCA.correctiveActions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Corrective Actions</h3>
                  <div className="space-y-2">
                    {selectedRCA.correctiveActions.map((action: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1">{action.action}</p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                {action.responsible && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {action.responsible}
                                  </span>
                                )}
                                {action.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(action.dueDate), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={action.completed ? "default" : "secondary"}>
                                {action.completed ? "Completed" : "Pending"}
                              </Badge>
                              {!action.completed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 text-xs"
                                  onClick={() => {
                                    const description = `RCA Corrective Action:\n${action.action}\n\nProblem: ${selectedRCA.problemStatement}\n\nResponsible: ${action.responsible || 'TBD'}\nDue Date: ${action.dueDate ? format(new Date(action.dueDate), "MMM d, yyyy") : 'TBD'}`;
                                    window.location.href = `/work-orders?create=true&title=${encodeURIComponent(`RCA: ${action.action.substring(0, 50)}${action.action.length > 50 ? '...' : ''}`)}&description=${encodeURIComponent(description)}&priority=high`;
                                  }}
                                  data-testid={`button-create-wo-rca-action-${idx}`}
                                >
                                  <Wrench className="w-3 h-3" />
                                  Create WO
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {selectedRCA.aiInsights && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    C4 AI Insights
                  </h3>
                  <Card className="bg-accent/50 border-accent">
                    <CardContent className="pt-4">
                      <p className="text-sm whitespace-pre-wrap">{selectedRCA.aiInsights}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => exportToPDF(selectedRCA)}
                  className="flex-1"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowFullAnalysis(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Work Order Creation Dialog */}
      {createdRCA && (
        <WorkOrderCreationDialog
          open={showWorkOrderDialog}
          onOpenChange={setShowWorkOrderDialog}
          rcaId={createdRCA.id}
          equipmentId={selectedEquipment || undefined}
          correctiveActions={correctiveActions.filter(ca => ca.action.trim())}
          onComplete={() => {
            resetForm();
            setViewMode("history");
            toast({
              title: "Success",
              description: "RCA created and work orders assigned successfully!",
            });
          }}
        />
      )}
    </div>
  );
}
