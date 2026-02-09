import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Plus, Package, AlertTriangle, Barcode, ListPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPartSchema, type Part, type WorkOrder } from "@shared/schema";
import { z } from "zod";

const partFormSchema = insertPartSchema.omit({ companyId: true });

export default function Inventory() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>("");
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const { data: parts = [], isLoading } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    enabled: !!user,
  });

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user && canManage,
  });

  const addPartToWorkOrder = useMutation({
    mutationFn: async ({ workOrderId, partId, quantity }: { workOrderId: string; partId: string; quantity: number }) => {
      const wo = workOrders.find(w => w.id === workOrderId);
      if (!wo) throw new Error("Work order not found");
      
      const existingParts = wo.partsUsed || [];
      const updatedParts = [...existingParts, { partId, quantity }];
      
      return await apiRequest("PATCH", `/api/work-orders/${workOrderId}`, {
        partsUsed: updatedParts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setSelectedPart(null);
      toast({ title: "Success", description: "Part added to work order" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add part",
        variant: "destructive",
      });
    },
  });

  const createPart = useMutation({
    mutationFn: async (data: z.infer<typeof partFormSchema>) => {
      return await apiRequest("POST", "/api/parts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      setShowAddDialog(false);
      form.reset();
      toast({ title: "Success", description: "Part created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create part",
        variant: "destructive",
      });
    },
  });

  const deletePart = useMutation({
    mutationFn: async (partId: string) => {
      return await apiRequest(`/api/parts/${partId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      setSelectedPart(null);
      toast({ title: "Success", description: "Part deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete part",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof partFormSchema>>({
    resolver: zodResolver(partFormSchema),
    defaultValues: {
      partNumber: "",
      name: "",
      machineType: "",
      stockLevel: 0,
      minStockLevel: 0,
      location: "",
      unitCost: 0,
    },
  });

  const onSubmit = (data: z.infer<typeof partFormSchema>) => {
    createPart.mutate(data);
  };

  // Barcode lookup handler
  const handleBarcodeSubmit = () => {
    if (!barcodeInput.trim()) return;
    
    const part = parts.find(p => p.partNumber === barcodeInput.trim());
    if (part) {
      setSearchTerm(barcodeInput.trim());
      setShowBarcodeDialog(false);
      setBarcodeInput("");
      toast({ title: "Part found", description: `Found: ${part.name}` });
    } else {
      toast({
        title: "Part not found",
        description: `No part with barcode ${barcodeInput}`,
        variant: "destructive",
      });
    }
  };

  // Get unique locations for filter dropdown
  const uniqueLocations = Array.from(new Set(parts.map(p => p.location).filter(Boolean))) as string[];

  // Apply all filters
  const filteredParts = parts.filter((part) => {
    // Search filter
    const matchesSearch = 
      part.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.machineType?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Location filter
    if (locationFilter !== "all" && part.location !== locationFilter) return false;

    // Stock status filter
    const minStock = part.minStockLevel || 0;
    if (statusFilter === "in-stock" && part.stockLevel <= minStock) return false;
    if (statusFilter === "low-stock" && part.stockLevel > minStock) return false;
    if (statusFilter === "out-of-stock" && part.stockLevel !== 0) return false;

    // Low stock only toggle
    if (showLowStockOnly && part.stockLevel > minStock) return false;

    return true;
  });

  const getStockStatus = (stockLevel: number, minStockLevel: number) => {
    if (stockLevel === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stockLevel <= minStockLevel) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const lowStockCount = parts.filter((p) => p.stockLevel <= (p.minStockLevel || 0)).length;
  const totalValue = parts.reduce((acc, p) => acc + p.stockLevel * (p.unitCost || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Parts Inventory</h1>
          <p className="text-muted-foreground">Track and manage spare parts inventory</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowBarcodeDialog(true)} data-testid="button-barcode">
            <Barcode className="w-4 h-4 mr-2" />
            Scan Barcode
          </Button>
          {canManage && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-part">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Part
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Part</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="partNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Part Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="machineType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Machine Type</FormLabel>
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
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-part-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="stockLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Level *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="minStockLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Stock *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value || 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="unitCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              value={field.value || 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPart.isPending} data-testid="button-submit-part">
                      {createPart.isPending ? "Creating..." : "Create Part"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Barcode Scanner Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Scan or enter barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeSubmit()}
              autoFocus
              data-testid="input-barcode"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBarcodeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBarcodeSubmit} data-testid="button-submit-barcode">
                Lookup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Work Order Dialog */}
      {selectedPart && (
        <Dialog open={!!selectedPart} onOpenChange={(open) => {
          if (!open && !addPartToWorkOrder.isPending) {
            setSelectedPart(null);
            setSelectedWorkOrderId("");
            setPartQuantity(1);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Part to Work Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Part: {selectedPart.name}</p>
                <p className="text-sm text-muted-foreground">Part Number: {selectedPart.partNumber}</p>
                <p className="text-sm text-muted-foreground">Available: {selectedPart.stockLevel} units</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Work Order</Label>
                  <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                    <SelectTrigger data-testid="select-work-order">
                      <SelectValue placeholder="Select work order" />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders.filter(wo => wo.status !== "completed").map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          #{wo.id.slice(0, 8)} - {wo.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedPart.stockLevel}
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                    data-testid="input-part-quantity"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPart(null);
                    setSelectedWorkOrderId("");
                    setPartQuantity(1);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedWorkOrderId) {
                      toast({ 
                        title: "Error", 
                        description: "Please select a work order",
                        variant: "destructive" 
                      });
                      return;
                    }
                    if (partQuantity < 1 || partQuantity > selectedPart.stockLevel) {
                      toast({ 
                        title: "Error", 
                        description: `Quantity must be between 1 and ${selectedPart.stockLevel}`,
                        variant: "destructive" 
                      });
                      return;
                    }
                    addPartToWorkOrder.mutate({ 
                      workOrderId: selectedWorkOrderId, 
                      partId: selectedPart.id, 
                      quantity: partQuantity 
                    });
                  }}
                  disabled={addPartToWorkOrder.isPending}
                  data-testid="button-add-part-to-wo"
                >
                  {addPartToWorkOrder.isPending ? "Adding..." : "Add Part"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-parts">{parts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-low-stock">
              {lowStockCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-value">
              ${totalValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search parts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-parts"
              />
            </div>
            
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger data-testid="select-location-filter">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
                <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                checked={showLowStockOnly}
                onCheckedChange={setShowLowStockOnly}
                data-testid="toggle-low-stock"
              />
              <Label className="text-sm">Low Stock Only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Parts Inventory</CardTitle>
          <CardDescription>Organized by machine type</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No parts found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try adjusting your search" : "Add parts to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredParts.map((part) => {
                const stockStatus = getStockStatus(part.stockLevel, part.minStockLevel || 0);
                const isLowStock = part.stockLevel <= (part.minStockLevel || 0);
                
                return (
                  <Card 
                    key={part.id} 
                    className={isLowStock ? "border-destructive/50" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <CardTitle className="text-base">{part.partNumber || part.name}</CardTitle>
                            <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                          </div>
                          <CardDescription className="font-medium text-foreground">
                            {part.name}
                          </CardDescription>
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Stock Level</p>
                          <p className="font-medium">
                            {part.stockLevel} / {part.minStockLevel || 0} min
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Location</p>
                          <p className="font-medium">{part.location || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Machine Type</p>
                          <p className="font-medium">{part.machineType || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Unit Cost</p>
                          <p className="font-medium">${part.unitCost || 0}</p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="mt-3 flex gap-2">
                          {workOrders.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPart(part)}
                              data-testid={`button-add-to-wo-${part.id}`}
                            >
                              <ListPlus className="w-4 h-4 mr-2" />
                              Add to Work Order
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${part.name}"?`)) {
                                deletePart.mutate(part.id);
                              }
                            }}
                            disabled={deletePart.isPending}
                            data-testid={`button-delete-part-${part.id}`}
                          >
                            {deletePart.isPending ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      )}
                      {isLowStock && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Reorder needed - stock below minimum level</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
