import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle2, X, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParsedEquipment {
  name: string;
  equipmentType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  status?: "operational" | "down" | "maintenance";
  installDate?: string;
  criticalityScore?: number;
  criticalityRanking?: string;
  assetLevel?: "site" | "area" | "line" | "equipment" | "component";
  errors?: string[];
}

interface ParsedPMSchedule {
  equipmentName: string;
  name: string;
  description?: string;
  frequencyDays?: number;
  estimatedDurationHours?: number;
  tasks?: Array<{
    taskNumber: number;
    description: string;
    estimatedMinutes?: number;
  }>;
  requiredParts?: Array<{
    partName: string;
    quantity: number;
  }>;
  errors?: string[];
}

interface ParsedPart {
  partNumber: string;
  name: string;
  description?: string;
  category?: string;
  location?: string;
  quantity?: number;
  reorderPoint?: number;
  unitCost?: number;
  supplier?: string;
  errors?: string[];
}

interface ImportResult {
  equipment: ParsedEquipment[];
  pmSchedules: ParsedPMSchedule[];
  parts: ParsedPart[];
  fileName: string;
  fileType: string;
  totalRows: number;
  validRows: number;
  errors: string[];
}

export default function EquipmentImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequest("POST", "/api/equipment/import/parse", formData);
      const data = await res.json();
      return data as ImportResult;
    },
    onSuccess: (data) => {
      setImportResult(data);
      toast({
        title: "File parsed successfully",
        description: `Found ${data.validRows} valid equipment records`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to parse file",
        description: error.message,
      });
    },
  });

  const confirmImport = useMutation({
    mutationFn: async (data: { equipment: ParsedEquipment[]; pmSchedules: ParsedPMSchedule[]; parts: ParsedPart[] }) => {
      await apiRequest("POST", "/api/equipment/import/confirm", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      const summary = [];
      if (importResult?.equipment.length) summary.push(`${importResult.equipment.length} equipment`);
      if (importResult?.pmSchedules.length) summary.push(`${importResult.pmSchedules.length} PM schedules`);
      if (importResult?.parts.length) summary.push(`${importResult.parts.length} parts`);
      toast({
        title: "Import successful",
        description: `Imported ${summary.join(', ')}`,
      });
      setFile(null);
      setImportResult(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error.message,
      });
    },
  });

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx?|csv|pdf|docx?)$/i)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel, CSV, PDF, or Word document",
      });
      return;
    }

    setFile(selectedFile);
    uploadFile.mutate(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setImportResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Equipment</h1>
        <p className="text-muted-foreground mt-2">
          Upload equipment data from Excel, CSV, PDF, or Word documents
        </p>
      </div>

      {!importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Supported formats: Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf), Word (.doc, .docx)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover-elevate"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              data-testid="dropzone-equipment-import"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                Drop your file here or click to browse
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Maximum file size: 50MB
              </p>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
                data-testid="input-file-upload"
              />
              <Button asChild>
                <label htmlFor="file-upload" className="cursor-pointer" data-testid="button-browse-file">
                  <FileText className="w-4 h-4 mr-2" />
                  Browse Files
                </label>
              </Button>
              {uploadFile.isPending && (
                <p className="text-sm text-muted-foreground mt-4">
                  Parsing file...
                </p>
              )}
            </div>

            <Alert className="mt-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>File Format Tips:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>
                    <strong>Excel/CSV:</strong> First row should contain headers like "Name", "Type", "Location", etc.
                  </li>
                  <li>
                    <strong>PDF/Word:</strong> Format as table or list with labels (e.g., "Equipment: Conveyor Belt")
                  </li>
                  <li>Minimum required: Equipment Name</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview Import</CardTitle>
                  <CardDescription>
                    Review the parsed equipment data before importing
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-import">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p className="font-medium truncate">{importResult.fileName}</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Equipment</p>
                  <p className="font-medium text-chart-3">{importResult.equipment.length}</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">PM Schedules</p>
                  <p className="font-medium text-chart-1">{importResult.pmSchedules.length}</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Parts</p>
                  <p className="font-medium text-chart-2">{importResult.parts.length}</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="font-medium text-destructive">{importResult.errors.length}</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Parsing Errors:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      {importResult.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="equipment" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="equipment" data-testid="tab-equipment">
                    Equipment ({importResult.equipment.length})
                  </TabsTrigger>
                  <TabsTrigger value="pm" data-testid="tab-pm">
                    <Calendar className="w-4 h-4 mr-2" />
                    PM Schedules ({importResult.pmSchedules.length})
                  </TabsTrigger>
                  <TabsTrigger value="parts" data-testid="tab-parts">
                    <Package className="w-4 h-4 mr-2" />
                    Parts ({importResult.parts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="equipment" className="space-y-4">
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Criticality</TableHead>
                          <TableHead>Manufacturer</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Validation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.equipment.map((eq, idx) => (
                          <TableRow key={idx} data-testid={`row-equipment-${idx}`}>
                            <TableCell className="font-medium">{eq.name}</TableCell>
                            <TableCell>{eq.equipmentType || "-"}</TableCell>
                            <TableCell>{eq.location || "-"}</TableCell>
                            <TableCell>
                              {eq.criticalityScore || eq.criticalityRanking ? (
                                <Badge variant={
                                  eq.criticalityScore === 1 ? "destructive" :
                                  eq.criticalityScore === 2 ? "default" :
                                  "secondary"
                                }>
                                  {eq.criticalityRanking || `Score: ${eq.criticalityScore}`}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>{eq.manufacturer || "-"}</TableCell>
                            <TableCell>{eq.model || "-"}</TableCell>
                            <TableCell>
                              {eq.status && (
                                <Badge
                                  variant={
                                    eq.status === "operational"
                                      ? "default"
                                      : eq.status === "down"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {eq.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {eq.errors && eq.errors.length > 0 ? (
                                <Badge variant="destructive" data-testid={`badge-error-${idx}`}>
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {eq.errors.length} error(s)
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-chart-3" data-testid={`badge-valid-${idx}`}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Valid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="pm" className="space-y-4">
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipment</TableHead>
                          <TableHead>PM Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Tasks</TableHead>
                          <TableHead>Parts</TableHead>
                          <TableHead>Validation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.pmSchedules.map((pm, idx) => (
                          <TableRow key={idx} data-testid={`row-pm-${idx}`}>
                            <TableCell className="font-medium">{pm.equipmentName}</TableCell>
                            <TableCell>{pm.name}</TableCell>
                            <TableCell className="max-w-xs truncate">{pm.description || "-"}</TableCell>
                            <TableCell>
                              {pm.frequencyDays ? `${pm.frequencyDays} days` : "-"}
                            </TableCell>
                            <TableCell>
                              {pm.tasks && pm.tasks.length > 0 ? (
                                <Badge variant="secondary">{pm.tasks.length} tasks</Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {pm.requiredParts && pm.requiredParts.length > 0 ? (
                                <Badge variant="secondary">{pm.requiredParts.length} parts</Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {pm.errors && pm.errors.length > 0 ? (
                                <Badge variant="destructive" data-testid={`badge-pm-error-${idx}`}>
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {pm.errors.length} error(s)
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-chart-1" data-testid={`badge-pm-valid-${idx}`}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Valid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="parts" className="space-y-4">
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Number</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Validation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.parts.map((part, idx) => (
                          <TableRow key={idx} data-testid={`row-part-${idx}`}>
                            <TableCell className="font-medium">{part.partNumber}</TableCell>
                            <TableCell>{part.name}</TableCell>
                            <TableCell className="max-w-xs truncate">{part.description || "-"}</TableCell>
                            <TableCell>{part.category || "-"}</TableCell>
                            <TableCell>{part.quantity ?? "-"}</TableCell>
                            <TableCell>{part.location || "-"}</TableCell>
                            <TableCell>
                              {part.errors && part.errors.length > 0 ? (
                                <Badge variant="destructive" data-testid={`badge-part-error-${idx}`}>
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {part.errors.length} error(s)
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-chart-2" data-testid={`badge-part-valid-${idx}`}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Valid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={confirmImport.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => confirmImport.mutate({
                    equipment: importResult.equipment.filter(eq => !eq.errors || eq.errors.length === 0),
                    pmSchedules: importResult.pmSchedules.filter(pm => !pm.errors || pm.errors.length === 0),
                    parts: importResult.parts.filter(part => !part.errors || part.errors.length === 0)
                  })}
                  disabled={confirmImport.isPending || (importResult.equipment.length === 0 && importResult.pmSchedules.length === 0 && importResult.parts.length === 0)}
                  data-testid="button-confirm-import"
                >
                  {confirmImport.isPending
                    ? "Importing..."
                    : `Import All Data`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
