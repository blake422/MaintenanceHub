import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Save, ListTodo, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExcellenceDeliverable } from "@shared/schema";

interface RAILItem {
  id: string;
  gap: string;
  dateIdentified: string;
  action: string;
  improvementType: "quick_win" | "short_term" | "long_term" | "strategic";
  priorityLevel: "critical" | "high" | "medium" | "low";
  internalOwner: string;
  consultantOwner: string;
  status: number; // 0-100
  targetDate: string;
  comments: string;
}

interface RAILFormProps {
  step: number;
  checklistItemId: string;
  onDismiss?: () => void;
}

const emptyItem: RAILItem = {
  id: "",
  gap: "",
  dateIdentified: new Date().toISOString().split("T")[0],
  action: "",
  improvementType: "quick_win",
  priorityLevel: "medium",
  internalOwner: "",
  consultantOwner: "",
  status: 0,
  targetDate: "",
  comments: ""
};

export function RAILForm({ step, checklistItemId, onDismiss }: RAILFormProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<RAILItem[]>([]);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: deliverables, isLoading } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables", step],
  });

  useEffect(() => {
    if (deliverables) {
      const existing = deliverables.find(
        d => d.step === step && d.checklistItemId === checklistItemId && d.deliverableType === "rail_tracker"
      );
      if (existing) {
        setDeliverableId(existing.id);
        const payload = existing.payload as { items: RAILItem[] };
        setItems(payload.items || []);
      }
    }
  }, [deliverables, step, checklistItemId]);

  const saveMutation = useMutation({
    mutationFn: async (itemsToSave: RAILItem[]): Promise<ExcellenceDeliverable> => {
      const payload = { items: itemsToSave };
      if (deliverableId) {
        return apiRequest("PUT", `/api/excellence-deliverables/${deliverableId}`, {
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      } else {
        return apiRequest("POST", "/api/excellence-deliverables", {
          step,
          checklistItemId,
          deliverableType: "rail_tracker",
          title: "RAIL - Rolling Issues and Actions List",
          payload,
          completedAt: new Date().toISOString(),
        }) as Promise<ExcellenceDeliverable>;
      }
    },
    onSuccess: (response) => {
      setDeliverableId(response.id);
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-deliverables", step] });
      queryClient.invalidateQueries({ queryKey: ["/api/excellence-progress"] });
      toast({
        title: "RAIL saved",
        description: `${items.length} action items saved successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save RAIL. Please try again.",
        variant: "destructive",
      });
    }
  });

  const addItem = () => {
    const newItem: RAILItem = {
      ...emptyItem,
      id: crypto.randomUUID(),
      dateIdentified: new Date().toISOString().split("T")[0]
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof RAILItem, value: any) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const filteredItems = items.filter(item => {
    if (filterPriority !== "all" && item.priorityLevel !== filterPriority) return false;
    if (filterStatus === "complete" && item.status < 100) return false;
    if (filterStatus === "in_progress" && (item.status === 0 || item.status >= 100)) return false;
    if (filterStatus === "not_started" && item.status > 0) return false;
    return true;
  });

  const stats = {
    total: items.length,
    complete: items.filter(i => i.status >= 100).length,
    inProgress: items.filter(i => i.status > 0 && i.status < 100).length,
    critical: items.filter(i => i.priorityLevel === "critical" && i.status < 100).length
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-red-600 bg-red-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "low": return "text-green-600 bg-green-100";
      default: return "text-muted-foreground bg-muted";
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" />
            RAIL - Rolling Issues and Actions List
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track gaps, actions, and improvement initiatives
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(items)}
          disabled={saveMutation.isPending}
          data-testid="button-save-rail"
        >
          <Save className="w-4 h-4 mr-2" />
          Save RAIL
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
            <p className="text-xs text-muted-foreground">Complete</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Critical Open</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Add */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={addItem} variant="outline" data-testid="button-add-rail-item">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32" data-testid="filter-priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Gap/Issue</TableHead>
                  <TableHead className="min-w-[100px]">Date</TableHead>
                  <TableHead className="min-w-[200px]">Action</TableHead>
                  <TableHead className="min-w-[120px]">Type</TableHead>
                  <TableHead className="min-w-[100px]">Priority</TableHead>
                  <TableHead className="min-w-[120px]">Owner</TableHead>
                  <TableHead className="min-w-[150px]">Status %</TableHead>
                  <TableHead className="min-w-[120px]">Target</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No items found. Click "Add Item" to start tracking issues and actions.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Textarea
                          value={item.gap}
                          onChange={(e) => updateItem(item.id, "gap", e.target.value)}
                          placeholder="Describe the gap or issue..."
                          className="min-h-16"
                          data-testid={`input-gap-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.dateIdentified}
                          onChange={(e) => updateItem(item.id, "dateIdentified", e.target.value)}
                          data-testid={`input-date-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={item.action}
                          onChange={(e) => updateItem(item.id, "action", e.target.value)}
                          placeholder="Action to address..."
                          className="min-h-16"
                          data-testid={`input-action-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.improvementType}
                          onValueChange={(v) => updateItem(item.id, "improvementType", v)}
                        >
                          <SelectTrigger data-testid={`select-type-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quick_win">Quick Win</SelectItem>
                            <SelectItem value="short_term">Short Term</SelectItem>
                            <SelectItem value="long_term">Long Term</SelectItem>
                            <SelectItem value="strategic">Strategic</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.priorityLevel}
                          onValueChange={(v) => updateItem(item.id, "priorityLevel", v)}
                        >
                          <SelectTrigger data-testid={`select-priority-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.internalOwner}
                          onChange={(e) => updateItem(item.id, "internalOwner", e.target.value)}
                          placeholder="Owner name"
                          data-testid={`input-owner-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.status}
                            onChange={(e) => updateItem(item.id, "status", parseInt(e.target.value) || 0)}
                            className="w-16"
                            data-testid={`input-status-${item.id}`}
                          />
                          <Progress value={item.status} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.targetDate}
                          onChange={(e) => updateItem(item.id, "targetDate", e.target.value)}
                          data-testid={`input-target-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
