import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, QrCode, FileText, ChevronRight, Image, Upload, X, FileSpreadsheet, Building2, MapPin, Workflow, Wrench, Component, FolderOpen, Trash2, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertEquipmentSchema, type Equipment, type InsertEquipment } from "@shared/schema";
import { z } from "zod";

const equipmentFormSchema = insertEquipmentSchema.omit({ companyId: true });

// Collapsible Line Card component for By Line view
function LineCard({ 
  lineName, 
  equipment, 
  onSelectEquipment 
}: { 
  lineName: string; 
  equipment: Equipment[]; 
  onSelectEquipment: (eq: Equipment) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const criticalCount = equipment.filter(e => e.criticalityScore === 1).length;
  const highCount = equipment.filter(e => e.criticalityScore === 2).length;
  const mediumCount = equipment.filter(e => e.criticalityScore === 3).length;
  
  return (
    <Card>
      <CardHeader 
        className="pb-3 cursor-pointer hover-elevate"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChevronRight 
              className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Workflow className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <CardTitle className="text-lg">{lineName}</CardTitle>
              <CardDescription>{equipment.length} assets</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                {highCount} High
              </Badge>
            )}
            {mediumCount > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {mediumCount} Medium
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-2">
            {equipment.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => onSelectEquipment(eq)}
                data-testid={`equipment-row-${eq.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
                    {eq.equipmentType?.toLowerCase().includes('system') ? (
                      <Component className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{eq.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {eq.equipmentType && <span>{eq.equipmentType}</span>}
                      {eq.serialNumber && <span>• SN: {eq.serialNumber}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {eq.criticalityScore === 1 && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Critical</Badge>
                  )}
                  {eq.criticalityScore === 2 && (
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">High</Badge>
                  )}
                  {eq.criticalityScore === 3 && (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>
                  )}
                  {eq.criticalityScore === 4 && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Low</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// By Line View component
function ByLineView({ 
  equipment, 
  onSelectEquipment 
}: { 
  equipment: Equipment[]; 
  onSelectEquipment: (eq: Equipment) => void;
}) {
  // Group equipment by location (line)
  const groupedByLine = equipment.reduce((acc, eq) => {
    const line = eq.location || "Unassigned";
    if (!acc[line]) acc[line] = [];
    acc[line].push(eq);
    return acc;
  }, {} as Record<string, Equipment[]>);
  
  const lineNames = Object.keys(groupedByLine).sort();
  
  if (lineNames.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Workflow className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No equipment found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Import equipment to see them grouped by line
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-3">
      {lineNames.map((lineName) => (
        <LineCard 
          key={lineName}
          lineName={lineName}
          equipment={groupedByLine[lineName]}
          onSelectEquipment={onSelectEquipment}
        />
      ))}
    </div>
  );
}

export default function EquipmentPage() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "hierarchy" | "byLine">("byLine");

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    enabled: !!user,
  });

  // Fetch hierarchy tree structure
  const { data: hierarchyData = [], isLoading: isLoadingHierarchy } = useQuery<any[]>({
    queryKey: ["/api/equipment/hierarchy"],
    enabled: !!user && viewMode === "hierarchy",
  });

  const createEquipment = useMutation({
    mutationFn: async (data: z.infer<typeof equipmentFormSchema>) => {
      return await apiRequest("POST", "/api/equipment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/hierarchy"] });
      setShowAddDialog(false);
      form.reset();
      toast({ title: "Success", description: "Equipment created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create equipment",
        variant: "destructive",
      });
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: async ({ equipmentId, files }: { equipmentId: string; files: FileList }) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("photos", file);
      });
      return await apiRequest("POST", `/api/equipment/${equipmentId}/photos`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/hierarchy"] });
      toast({ title: "Success", description: "Photos uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  const uploadManual = useMutation({
    mutationFn: async ({ equipmentId, file }: { equipmentId: string; file: File }) => {
      const formData = new FormData();
      formData.append("manual", file);
      return await apiRequest(`/api/equipment/${equipmentId}/manual`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/hierarchy"] });
      toast({ title: "Success", description: "Manual uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload manual",
        variant: "destructive",
      });
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ equipmentId, file }: { equipmentId: string; file: File }) => {
      const formData = new FormData();
      formData.append("document", file);
      return await apiRequest(`/api/equipment/${equipmentId}/documents`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment/${variables.equipmentId}/documents`] });
      toast({ title: "Success", description: "Document uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ documentId, equipmentId }: { documentId: string; equipmentId: string }) => {
      return await apiRequest(`/api/equipment/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment/${variables.equipmentId}/documents`] });
      toast({ title: "Success", description: "Document deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const deleteEquipment = useMutation({
    mutationFn: async (equipmentId: string) => {
      return await apiRequest(`/api/equipment/${equipmentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setSelectedEquipment(null);
      toast({ title: "Success", description: "Equipment deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete equipment",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof equipmentFormSchema>>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: "",
      assetLevel: "equipment",
      equipmentType: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      location: "",
      parentEquipmentId: undefined,
      description: "",
    },
  });

  const onSubmit = (data: z.infer<typeof equipmentFormSchema>) => {
    createEquipment.mutate(data);
  };

  const filteredEquipment = equipment.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.equipmentType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Recursive tree node component
  const TreeNode = ({ node, level = 0 }: { node: any; level?: number }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const hasChildren = node.children && node.children.length > 0;
    
    const getAssetIcon = (assetLevel: string) => {
      const iconProps = { className: "w-4 h-4" };
      switch (assetLevel) {
        case "site": return <Building2 {...iconProps} />;
        case "area": return <MapPin {...iconProps} />;
        case "line": return <Workflow {...iconProps} />;
        case "equipment": return <Wrench {...iconProps} />;
        case "component": return <Component {...iconProps} />;
        default: return <Settings {...iconProps} />;
      }
    };

    const getAssetColor = (assetLevel: string) => {
      switch (assetLevel) {
        case "site": return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
        case "area": return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
        case "line": return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
        case "equipment": return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
        case "component": return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
        default: return "bg-gray-100 dark:bg-gray-800";
      }
    };

    return (
      <div className="w-full">
        <div 
          className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
          style={{ marginLeft: `${level * 1.5}rem` }}
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        >
          {hasChildren && (
            <ChevronRight 
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          )}
          {!hasChildren && <div className="w-4" />}
          
          <div className="flex items-center justify-center">{getAssetIcon(node.assetLevel)}</div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{node.name}</span>
              <Badge variant="outline" className={getAssetColor(node.assetLevel)}>
                {node.assetLevel}
              </Badge>
              {node.equipmentType && (
                <Badge variant="secondary">{node.equipmentType}</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {node.location && <span>{node.location}</span>}
              {node.manufacturer && <span className="ml-2">• {node.manufacturer}</span>}
              {node.model && <span className="ml-2">Model: {node.model}</span>}
            </div>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedEquipment(node);
            }}
            data-testid={`button-view-equipment-${node.id}`}
          >
            View Details
          </Button>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children.map((child: any) => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Equipment Assets</h1>
          <p className="text-muted-foreground">
            Manage your equipment registry and documentation
          </p>
        </div>
        {canManage && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation("/equipment/import")}
              data-testid="button-import-equipment"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Equipment
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-equipment">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Equipment</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Main Plant, Packaging Line 1, CNC Machine 3" data-testid="input-equipment-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assetLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Level *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "equipment"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-asset-level">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="site">Site (Facility/Plant)</SelectItem>
                              <SelectItem value="area">Area (Department)</SelectItem>
                              <SelectItem value="line">Line (Production Line)</SelectItem>
                              <SelectItem value="equipment">Equipment (Machine)</SelectItem>
                              <SelectItem value="component">Component (Part)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Where this asset sits in your hierarchy
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="parentEquipmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Asset</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-parent-equipment">
                                <SelectValue placeholder="None (top level)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None (top level)</SelectItem>
                              {equipment.map((eq) => (
                                <SelectItem key={eq.id} value={eq.id}>
                                  {eq.name} ({eq.assetLevel})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Optional: This asset belongs to...
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="equipmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createEquipment.isPending} data-testid="button-submit-equipment">
                      {createEquipment.isPending ? "Creating..." : "Create Equipment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {/* Search and View Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search equipment by name, type, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-equipment"
              />
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "hierarchy" | "byLine")} className="w-auto">
              <TabsList>
                <TabsTrigger value="byLine" data-testid="tab-byline-view">
                  By Line
                </TabsTrigger>
                <TabsTrigger value="hierarchy" data-testid="tab-hierarchy-view">
                  Hierarchy
                </TabsTrigger>
                <TabsTrigger value="list" data-testid="tab-list-view">
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* By Line View - Groups equipment by location (line) */}
      {viewMode === "byLine" && (
        <ByLineView 
          equipment={filteredEquipment} 
          onSelectEquipment={setSelectedEquipment}
        />
      )}

      {/* Hierarchy View */}
      {viewMode === "hierarchy" && (
        <>
          {isLoadingHierarchy ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : hierarchyData.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No equipment found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add equipment to build your asset hierarchy
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Asset Hierarchy</CardTitle>
                <CardDescription>
                  Equipment organized by site → area → line → equipment → component
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hierarchyData.map((node) => (
                    <TreeNode key={node.id} node={node} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {filteredEquipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No equipment found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm ? "Try adjusting your search" : "Add equipment to get started"}
            </p>
          </CardContent>
        </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipment.map((item) => (
            <Card 
              key={item.id} 
              className="hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => setSelectedEquipment(item)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Settings className="w-6 h-6 text-primary" />
                  </div>
                  {item.qrCode && (
                    <Badge variant="outline">
                      <QrCode className="w-3 h-3 mr-1" />
                      QR
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-3">{item.name}</CardTitle>
                <CardDescription className="text-sm">
                  {item.equipmentType || "Equipment"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{item.location || "No location"}</div>
                {item.manufacturer && (
                  <div className="text-xs text-muted-foreground">
                    {item.manufacturer} {item.model && `- ${item.model}`}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {item.qrCode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-qr-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEquipment(item);
                      }}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Code
                    </Button>
                  )}
                  {item.manualUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-manual-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(item.manualUrl!, "_blank");
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Manual
                    </Button>
                  )}
                  {item.photoUrls && item.photoUrls.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-photos-${item.id}`}
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Photos
                    </Button>
                  )}
                </div>
              </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Equipment Detail Dialog */}
      {selectedEquipment && (
        <Dialog open={!!selectedEquipment} onOpenChange={() => setSelectedEquipment(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedEquipment.name}</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="qr">QR Code</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="font-medium">{selectedEquipment.equipmentType || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    <span className="font-medium">{selectedEquipment.location || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Manufacturer:</span>{" "}
                    <span className="font-medium">{selectedEquipment.manufacturer || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>{" "}
                    <span className="font-medium">{selectedEquipment.model || "N/A"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Serial Number:</span>{" "}
                    <span className="font-medium">{selectedEquipment.serialNumber || "N/A"}</span>
                  </div>
                </div>
                {selectedEquipment.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedEquipment.description}</p>
                  </div>
                )}

                {canManage && (
                  <div className="pt-4 border-t mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete "${selectedEquipment.name}"? This will also delete all associated PM schedules, documents, and schematics.`)) {
                          deleteEquipment.mutate(selectedEquipment.id);
                        }
                      }}
                      disabled={deleteEquipment.isPending}
                      data-testid="button-delete-equipment"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteEquipment.isPending ? "Deleting..." : "Delete Equipment"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="photos" className="space-y-4">
                {canManage && (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          uploadPhotos.mutate({
                            equipmentId: selectedEquipment.id,
                            files: e.target.files,
                          });
                        }
                      }}
                      data-testid="input-upload-photos"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Select up to 5 images to upload
                    </p>
                  </div>
                )}
                {selectedEquipment.photoUrls && selectedEquipment.photoUrls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedEquipment.photoUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Equipment photo ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                        data-testid={`image-equipment-${index}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                    <Image className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                {canManage && (
                  <div>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          uploadManual.mutate({
                            equipmentId: selectedEquipment.id,
                            file: e.target.files[0],
                          });
                        }
                      }}
                      data-testid="input-upload-manual"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload PDF or Word document
                    </p>
                  </div>
                )}
                {selectedEquipment.manualUrl ? (
                  <div className="flex flex-col items-center justify-center py-12 border border-border rounded-lg">
                    <FileText className="w-12 h-12 text-primary mb-4" />
                    <p className="text-sm font-medium mb-4">Manual Available</p>
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedEquipment.manualUrl!, "_blank")}
                      data-testid="button-view-manual"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Manual
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                    <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No manual uploaded yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <EquipmentDocuments
                  equipmentId={selectedEquipment.id}
                  onUpload={(file) => uploadDocument.mutate({ equipmentId: selectedEquipment.id, file })}
                  onDelete={(docId) => deleteDocument.mutate({ documentId: docId, equipmentId: selectedEquipment.id })}
                  isUploading={uploadDocument.isPending}
                  isDeleting={deleteDocument.isPending}
                />
              </TabsContent>

              <TabsContent value="qr" className="space-y-4">
                {selectedEquipment.qrCode ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <img
                      src={selectedEquipment.qrCode}
                      alt="QR Code"
                      className="w-64 h-64"
                      data-testid="image-qr-code"
                    />
                    <p className="text-sm text-muted-foreground mt-4">
                      Scan this QR code to quickly access equipment details
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
                    <QrCode className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">QR code not generated</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EquipmentDocuments({ 
  equipmentId, 
  onUpload, 
  onDelete, 
  isUploading, 
  isDeleting 
}: { 
  equipmentId: string; 
  onUpload: (file: File) => void; 
  onDelete: (docId: string) => void; 
  isUploading: boolean; 
  isDeleting: boolean; 
}) {
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/equipment/${equipmentId}/documents`],
    enabled: !!equipmentId,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt"
        data-testid="input-upload-document"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full"
        data-testid="button-upload-document"
      >
        <Upload className="w-4 h-4 mr-2" />
        {isUploading ? "Uploading..." : "Upload Document"}
      </Button>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
          <FolderOpen className="w-12 h-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload manuals, specs, or other reference docs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover-elevate"
              data-testid={`document-item-${doc.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(doc.fileUrl, "_blank")}
                  data-testid={`button-download-${doc.id}`}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onDelete(doc.id)}
                  disabled={isDeleting}
                  data-testid={`button-delete-${doc.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
