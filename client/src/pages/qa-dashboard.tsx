import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Eye, 
  Calendar, 
  Filter, 
  CheckCircle2,
  Clock,
  Wrench,
  Camera,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CilrRun, CilrTemplate, Equipment } from "@shared/schema";

interface ExportData {
  runId: string;
  templateName?: string;
  templateType?: string;
  equipmentName?: string;
  equipmentCode?: string;
  completedBy?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  notes?: string | null;
  completions: {
    taskName?: string;
    taskType?: string;
    targetValue?: string;
    measuredValue?: string | null;
    minValue?: string;
    maxValue?: string;
    isCompleted?: boolean | null;
    isInSpec?: boolean | null;
    notes?: string | null;
    completedAt?: Date | null;
    photos: {
      fileName?: string | null;
      url?: string;
      uploadedAt?: Date | null;
    }[];
  }[];
}

export default function QADashboard() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<ExportData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: templates = [] } = useQuery<CilrTemplate[]>({
    queryKey: ["/api/cilr/templates"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: completedRuns = [], isLoading, refetch } = useQuery<CilrRun[]>({
    queryKey: ["/api/cilr/runs", { status: "completed" }],
    select: (data) => data.filter(r => r.status === "completed"),
  });

  const filteredRuns = completedRuns.filter(run => {
    if (selectedEquipment !== "all" && run.equipmentId !== selectedEquipment) return false;
    if (selectedTemplate !== "all" && run.templateId !== selectedTemplate) return false;
    if (startDate && run.completedAt && new Date(run.completedAt) < new Date(startDate)) return false;
    if (endDate && run.completedAt && new Date(run.completedAt) > new Date(endDate + "T23:59:59")) return false;
    return true;
  });

  const buildExportUrl = (format: "json" | "csv") => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (selectedEquipment !== "all") params.append("equipmentId", selectedEquipment);
    if (selectedTemplate !== "all") params.append("templateId", selectedTemplate);
    if (format === "csv") params.append("format", "csv");
    return `/api/cilr/export?${params.toString()}`;
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const response = await fetch(buildExportUrl(format), {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      if (format === "csv") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cilr-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cilr-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      toast({ title: "Export successful", description: `Downloaded ${format.toUpperCase()} file` });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const viewRunDetails = async (run: CilrRun) => {
    try {
      const response = await fetch(buildExportUrl("json"), { credentials: "include" });
      const data: ExportData[] = await response.json();
      const runData = data.find(d => d.runId === run.id);
      if (runData) {
        setSelectedRun(runData);
      }
    } catch (error) {
      toast({ title: "Failed to load details", variant: "destructive" });
    }
  };

  const getEquipmentName = (equipmentId: string | null) => {
    if (!equipmentId) return "N/A";
    return equipment.find(e => e.id === equipmentId)?.name || "Unknown";
  };

  const getTemplateName = (templateId: string) => {
    return templates.find(t => t.id === templateId)?.name || "Unknown";
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">QA Dashboard</h1>
          <p className="text-muted-foreground">View and export CILR/Centerlining completion records</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleExport("csv")}
            disabled={isExporting || filteredRuns.length === 0}
            data-testid="button-export-csv"
          >
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport("json")}
            disabled={isExporting || filteredRuns.length === 0}
            data-testid="button-export-json"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Equipment</Label>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger data-testid="select-equipment">
                  <SelectValue placeholder="All Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="All Templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredRuns.length} of {completedRuns.length} completed runs
            </p>
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setSelectedEquipment("all"); setSelectedTemplate("all"); }} data-testid="button-clear-filters">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Completed Records</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No completed runs found</h3>
              <p className="text-muted-foreground">Completed CILR runs will appear here for QA review</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.map((run) => {
                    const template = templates.find(t => t.id === run.templateId);
                    return (
                      <TableRow key={run.id} data-testid={`row-run-${run.id}`}>
                        <TableCell className="font-medium">
                          {getTemplateName(run.templateId)}
                        </TableCell>
                        <TableCell>{getEquipmentName(run.equipmentId)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {run.completedAt ? new Date(run.completedAt).toLocaleDateString() : "N/A"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={template?.templateType === "centerline" ? "secondary" : "outline"}>
                            {template?.templateType === "centerline" ? "Centerline" : "CILR"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewRunDetails(run)}
                            data-testid={`button-view-${run.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedRun?.templateName || "Run Details"}</DialogTitle>
          </DialogHeader>
          {selectedRun && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Equipment</p>
                    <p className="font-medium">{selectedRun.equipmentName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed By</p>
                    <p className="font-medium">{selectedRun.completedBy || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {selectedRun.startedAt ? new Date(selectedRun.startedAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-medium">
                      {selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>

                {selectedRun.notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedRun.notes}</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">Tasks ({selectedRun.completions.length})</h4>
                  {selectedRun.completions.map((completion, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{completion.taskName}</p>
                            <Badge variant="outline" className="mt-1 capitalize text-xs">
                              {completion.taskType}
                            </Badge>
                          </div>
                          {completion.isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600" />
                          )}
                        </div>

                        {(completion.targetValue || completion.measuredValue) && (
                          <div className="grid grid-cols-3 gap-2 text-sm mt-3 p-2 bg-muted/50 rounded">
                            {completion.targetValue && (
                              <div>
                                <p className="text-muted-foreground text-xs">Target</p>
                                <p className="font-mono">{completion.targetValue}</p>
                              </div>
                            )}
                            {completion.measuredValue && (
                              <div>
                                <p className="text-muted-foreground text-xs">Measured</p>
                                <p className="font-mono">{completion.measuredValue}</p>
                              </div>
                            )}
                            {(completion.minValue || completion.maxValue) && (
                              <div>
                                <p className="text-muted-foreground text-xs">Range</p>
                                <p className="font-mono">{completion.minValue} - {completion.maxValue}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {completion.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{completion.notes}</p>
                        )}

                        {completion.photos.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Camera className="h-3 w-3" />
                              Photos ({completion.photos.length})
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {completion.photos.map((photo, pIdx) => (
                                <a
                                  key={pIdx}
                                  href={photo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.fileName || `Photo ${pIdx + 1}`}
                                    className="h-20 w-20 object-cover rounded-lg border hover:border-primary transition-colors"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
