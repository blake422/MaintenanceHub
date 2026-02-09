import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download, TrendingUp, TrendingDown } from "lucide-react";

export default function Reports() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  const monthlyWorkOrders = [
    { month: "Jan", corrective: 45, preventive: 32, inspection: 18 },
    { month: "Feb", corrective: 52, preventive: 28, inspection: 22 },
    { month: "Mar", corrective: 38, preventive: 35, inspection: 20 },
    { month: "Apr", corrective: 41, preventive: 30, inspection: 19 },
    { month: "May", corrective: 35, preventive: 38, inspection: 21 },
    { month: "Jun", corrective: 29, preventive: 42, inspection: 23 },
  ];

  const downtimeTrend = [
    { month: "Jan", hours: 45.2 },
    { month: "Feb", hours: 38.5 },
    { month: "Mar", hours: 42.1 },
    { month: "Apr", hours: 35.8 },
    { month: "May", hours: 31.2 },
    { month: "Jun", hours: 28.5 },
  ];

  const complianceByType = [
    { name: "PM Completed", value: 94, color: "hsl(var(--chart-3))" },
    { name: "PM Missed", value: 6, color: "hsl(var(--destructive))" },
  ];

  const equipmentStatus = [
    { name: "Operational", value: 85, color: "hsl(var(--chart-3))" },
    { name: "Maintenance", value: 12, color: "hsl(var(--chart-2))" },
    { name: "Down", value: 3, color: "hsl(var(--destructive))" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into maintenance operations
            </p>
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into maintenance operations
          </p>
        </div>
        <Button data-testid="button-export-report">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1" data-testid="metric-compliance">
              94%
            </div>
            <p className="text-xs text-chart-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Downtime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1" data-testid="metric-downtime">
              28.5h
            </div>
            <p className="text-xs text-chart-3 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              -8.6% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">MTBF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1" data-testid="metric-mtbf">
              156h
            </div>
            <p className="text-xs text-chart-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12.3% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">MTTR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1" data-testid="metric-mttr">
              2.3h
            </div>
            <p className="text-xs text-chart-3 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              -15.2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="work-orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="work-orders" data-testid="tab-work-orders">
            Work Orders
          </TabsTrigger>
          <TabsTrigger value="downtime" data-testid="tab-downtime">
            Downtime
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            Compliance
          </TabsTrigger>
          <TabsTrigger value="equipment" data-testid="tab-equipment">
            Equipment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work-orders">
          <Card>
            <CardHeader>
              <CardTitle>Work Orders by Type (6 Months)</CardTitle>
              <CardDescription>Breakdown of maintenance activities over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyWorkOrders}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="corrective" fill="hsl(var(--chart-1))" name="Corrective" />
                  <Bar dataKey="preventive" fill="hsl(var(--chart-3))" name="Preventive" />
                  <Bar dataKey="inspection" fill="hsl(var(--chart-2))" name="Inspection" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="downtime">
          <Card>
            <CardHeader>
              <CardTitle>Downtime Trend (6 Months)</CardTitle>
              <CardDescription>Total equipment downtime hours per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={downtimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    name="Downtime Hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>PM Compliance Rate</CardTitle>
              <CardDescription>Preventive maintenance completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={complianceByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {complianceByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Status Distribution</CardTitle>
              <CardDescription>Current operational status of all equipment</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={equipmentStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {equipmentStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
