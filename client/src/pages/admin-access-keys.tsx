import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Key, Plus, Copy, Check, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { format } from "date-fns";

const createKeySchema = z.object({
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

type AccessKey = {
  id: string;
  key: string;
  createdById: string;
  usedById: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
};

export default function AdminAccessKeys() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: accessKeys = [], isLoading } = useQuery<AccessKey[]>({
    queryKey: ["/api/admin/access-keys"],
    enabled: !!user && user.platformRole === "platform_admin",
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createKeySchema>) => {
      const response = await apiRequest("POST", "/api/admin/access-keys", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-keys"] });
      setCreateDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Access key created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create access key",
        variant: "destructive",
      });
    },
  });

  const toggleKeyMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/access-keys/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-keys"] });
      toast({ title: "Success", description: "Access key updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update access key",
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/access-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-keys"] });
      toast({ title: "Success", description: "Access key deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete access key",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof createKeySchema>>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      notes: "",
      expiresAt: "",
    },
  });

  const onSubmit = (data: z.infer<typeof createKeySchema>) => {
    createKeyMutation.mutate(data);
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast({ title: "Copied!", description: "Access key copied to clipboard" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (key: AccessKey) => {
    if (!key.isActive) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.usedById) {
      return <Badge variant="secondary">Used</Badge>;
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  if (!user || user.platformRole !== "platform_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Key className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only platform administrators can access this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Access Keys</h1>
          <p className="text-muted-foreground">Manage signup access keys for new users</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-key">
          <Plus className="w-4 h-4 mr-2" />
          Generate New Key
        </Button>
      </div>

      {/* Access Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>All Access Keys</CardTitle>
          <CardDescription>
            Access keys are required for new users to sign up for the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : accessKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No access keys yet</h3>
              <p className="text-muted-foreground mb-4">Create your first access key to allow users to sign up</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate New Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accessKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`key-${key.id}`}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono bg-muted px-3 py-1 rounded">
                        {key.key}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.key)}
                        data-testid={`button-copy-${key.id}`}
                      >
                        {copiedKey === key.key ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      {getStatusBadge(key)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created {format(new Date(key.createdAt), "MMM d, yyyy")}</span>
                      {key.usedById && key.usedAt && (
                        <span>Used {format(new Date(key.usedAt), "MMM d, yyyy")}</span>
                      )}
                      {key.expiresAt && (
                        <span>Expires {format(new Date(key.expiresAt), "MMM d, yyyy")}</span>
                      )}
                    </div>
                    {key.notes && (
                      <p className="text-sm text-muted-foreground">{key.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {key.isActive && !key.usedById ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyMutation.mutate({ id: key.id, isActive: false })}
                        data-testid={`button-revoke-${key.id}`}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Revoke
                      </Button>
                    ) : !key.isActive && !key.usedById ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyMutation.mutate({ id: key.id, isActive: true })}
                        data-testid={`button-activate-${key.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Activate
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this access key? This action cannot be undone.")) {
                          deleteKeyMutation.mutate(key.id);
                        }
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deleteKeyMutation.isPending}
                      data-testid={`button-delete-${key.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Access Key</DialogTitle>
            <DialogDescription>
              Create a new access key that users can use to sign up for the platform
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="e.g., For Acme Corp demo"
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        data-testid="input-expires"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createKeyMutation.isPending}
                  data-testid="button-submit"
                >
                  {createKeyMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
