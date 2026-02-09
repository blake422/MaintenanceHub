import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Plug, CheckCircle2, AlertCircle, Activity, Globe, Key, Settings, Trash2, TestTube2, FileJson } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { format } from "date-fns";

const integrationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["webhook", "rest_api", "custom"]),
  description: z.string().optional(),
  authType: z.enum(["none", "api_key", "bearer", "basic", "oauth2"]),
  apiKey: z.string().optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  syncInterval: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

type Integration = {
  id: string;
  companyId: string;
  name: string;
  type: "webhook" | "rest_api" | "custom";
  description?: string;
  authType: "none" | "api_key" | "bearer" | "basic" | "oauth2";
  webhookUrl?: string;
  syncInterval?: number;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
};

type IntegrationLog = {
  id: string;
  integrationId: string;
  eventType: string;
  status: "success" | "error";
  requestData?: any;
  responseData?: any;
  errorMessage?: string;
  createdAt: string;
};

export default function Integrations() {
  const { user, canManage } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [deleteIntegrationId, setDeleteIntegrationId] = useState<string | null>(null);

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    enabled: !!user,
  });

  const { data: integrationLogs = [], isLoading: logsLoading } = useQuery<IntegrationLog[]>({
    queryKey: [`/api/integrations/${selectedIntegration?.id}/logs`],
    enabled: !!selectedIntegration && showLogsDialog,
  });

  const createIntegration = useMutation({
    mutationFn: async (data: z.infer<typeof integrationFormSchema>) => {
      return await apiRequest("POST", "/api/integrations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: "Success", description: "Integration created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create integration",
        variant: "destructive",
      });
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setDeleteIntegrationId(null);
      toast({ title: "Success", description: "Integration deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete integration",
        variant: "destructive",
      });
    },
  });

  const testIntegration = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/integrations/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test Successful",
        description: data.message || "Connection test passed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Connection test failed",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof integrationFormSchema>>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      type: "rest_api",
      description: "",
      authType: "api_key",
      apiKey: "",
      webhookUrl: "",
      syncInterval: 3600,
      isActive: true,
    },
  });

  const onSubmit = (data: z.infer<typeof integrationFormSchema>) => {
    createIntegration.mutate(data);
  };

  // Calculate stats
  const activeIntegrations = integrations.filter(i => i.isActive).length;
  const webhookIntegrations = integrations.filter(i => i.type === "webhook").length;
  const apiIntegrations = integrations.filter(i => i.type === "rest_api").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external systems to MaintenanceHub
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-integration">
            <Plus className="w-4 h-4 mr-2" />
            Add Integration
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Active Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500" data-testid="stat-active-integrations">
              {isLoading ? <Skeleton className="h-8 w-16" /> : activeIntegrations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-webhook-integrations">
              {isLoading ? <Skeleton className="h-8 w-16" /> : webhookIntegrations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">REST APIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-api-integrations">
              {isLoading ? <Skeleton className="h-8 w-16" /> : apiIntegrations}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : integrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plug className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No integrations configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect external CMMS, ERP, or asset management systems
              </p>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id} className="hover-elevate" data-testid={`card-integration-${integration.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <Badge variant={integration.isActive ? "default" : "secondary"}>
                        {integration.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {integration.type.replace("_", " ")}
                      </Badge>
                    </div>
                    {integration.description && (
                      <CardDescription className="text-sm">{integration.description}</CardDescription>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Plug className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Authentication</p>
                    <p className="font-medium capitalize">{(integration.authType || "none").replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Last Sync</p>
                    <p className="font-medium">
                      {integration.lastSyncAt 
                        ? format(new Date(integration.lastSyncAt), "MMM d, yyyy HH:mm")
                        : "Never"}
                    </p>
                  </div>
                </div>

                {integration.webhookUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
                    <div className="flex items-center gap-2 p-2 bg-accent/30 rounded-lg">
                      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <code className="text-xs flex-1 overflow-x-auto">{integration.webhookUrl}</code>
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="flex gap-2 pt-3 border-t flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testIntegration.mutate(integration.id)}
                      disabled={testIntegration.isPending}
                      data-testid={`button-test-${integration.id}`}
                    >
                      <TestTube2 className="w-4 h-4 mr-2" />
                      {testIntegration.isPending ? "Testing..." : "Test"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setShowLogsDialog(true);
                      }}
                      data-testid={`button-logs-${integration.id}`}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Logs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteIntegrationId(integration.id)}
                      data-testid={`button-delete-${integration.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Integration Dialog */}
      {showCreateDialog && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Integration</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., SAP Integration" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="rest_api">REST API</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Textarea placeholder="Describe this integration..." {...field} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-auth-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="api_key">API Key</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                          <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("authType") !== "none" && (
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key / Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter API key or token" {...field} data-testid="input-api-key" />
                        </FormControl>
                        <FormDescription>
                          Keep this secure - it will be encrypted in storage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("type") === "webhook" && (
                  <FormField
                    control={form.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.example.com/webhook" {...field} data-testid="input-webhook-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="syncInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sync Interval (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          data-testid="input-sync-interval"
                        />
                      </FormControl>
                      <FormDescription>
                        How often to sync data (0 for manual sync only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createIntegration.isPending} data-testid="button-submit-integration">
                    {createIntegration.isPending ? "Creating..." : "Create Integration"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Logs Dialog */}
      {showLogsDialog && selectedIntegration && (
        <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Integration Logs - {selectedIntegration.name}
              </DialogTitle>
            </DialogHeader>
            {logsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : integrationLogs.length === 0 ? (
              <div className="py-12 text-center">
                <FileJson className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No logs available for this integration</p>
              </div>
            ) : (
              <div className="space-y-2">
                {integrationLogs.map((log) => (
                  <Card key={log.id} className={log.status === "error" ? "border-destructive" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{log.eventType}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                        </span>
                      </div>
                    </CardHeader>
                    {log.errorMessage && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-destructive">{log.errorMessage}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setShowLogsDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteIntegrationId && (
        <Dialog open={!!deleteIntegrationId} onOpenChange={() => setDeleteIntegrationId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Integration</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this integration? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteIntegrationId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteIntegration.mutate(deleteIntegrationId)}
                disabled={deleteIntegration.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteIntegration.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
