import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Settings,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { WorkOrder, Part } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: workOrders = [], isLoading: loadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user,
  });

  const { data: parts = [], isLoading: loadingParts } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    enabled: !!user,
  });

  const isLoading = loadingWorkOrders || loadingParts;

  // Calculate real stats
  const openWorkOrders = workOrders.filter(wo => wo.status === "open").length;
  const inProgressWorkOrders = workOrders.filter(wo => wo.status === "in_progress").length;
  const completedWorkOrders = workOrders.filter(wo => wo.status === "completed").length;
  const lowStockParts = parts.filter(p => (p.stockLevel || 0) <= (p.minStockLevel || 0)).length;
  const criticalParts = parts.filter(p => (p.stockLevel || 0) === 0).length;

  // Work orders by type
  const correctiveCount = workOrders.filter(wo => wo.type === "corrective").length;
  const preventiveCount = workOrders.filter(wo => wo.type === "preventive").length;
  const inspectionCount = workOrders.filter(wo => wo.type === "inspection").length;

  const workOrdersByType = [
    { name: "Corrective", value: correctiveCount || 1, color: "hsl(var(--chart-1))" },
    { name: "Preventive", value: preventiveCount || 1, color: "hsl(var(--chart-3))" },
    { name: "Inspection", value: inspectionCount || 1, color: "hsl(var(--chart-2))" },
  ];

  const totalOrders = correctiveCount + preventiveCount + inspectionCount;
  const complianceRate = totalOrders > 0
    ? Math.round((completedWorkOrders / totalOrders) * 100)
    : 0;

  // Mock downtime data for now - would come from downtime tracking table
  const downtimeData = [
    { name: "Mon", hours: 0 },
    { name: "Tue", hours: 0 },
    { name: "Wed", hours: 0 },
    { name: "Thu", hours: 0 },
    { name: "Fri", hours: 0 },
    { name: "Sat", hours: 0 },
    { name: "Sun", hours: 0 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName}! Here's your maintenance overview.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-open-wo">{openWorkOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {inProgressWorkOrders} in progress
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3" data-testid="stat-completed-wo">
              {completedWorkOrders}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-low-stock">
              {lowStockParts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalParts} out of stock
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            {totalOrders > 10 ? (
              <TrendingUp className="h-4 w-4 text-chart-3" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-orders">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All work orders
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Downtime Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Downtime</CardTitle>
            <CardDescription>Equipment downtime hours by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={downtimeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Work Orders by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Work Orders by Type</CardTitle>
            <CardDescription>Distribution of maintenance activities</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={workOrdersByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {workOrdersByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest work orders and maintenance events</CardDescription>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No work orders yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first work order to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.slice(0, 5).map((wo) => (
                <div key={wo.id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Work Order #{wo.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {wo.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {wo.status} • {wo.priority} priority
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
