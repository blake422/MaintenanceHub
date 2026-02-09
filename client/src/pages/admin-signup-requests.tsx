import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, Clock } from "lucide-react";

interface SignupRequest {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
}

export default function AdminSignupRequests() {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery<SignupRequest[]>({
    queryKey: ["/api/admin/signup-requests"],
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/admin/signup-requests/${requestId}/approve`, {});
    },
    onSuccess: () => {
      setApprovingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/signup-requests"] });
      toast({
        title: "Request Approved",
        description: "Access code has been sent to the user.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Signup Requests</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Signup Requests</h1>
        <p className="text-muted-foreground">
          Review and approve free trial access requests
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Requests ({pending.length})
          </CardTitle>
          <CardDescription>
            {pending.length === 0
              ? "No pending requests"
              : "Click approve to send access code to user"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All caught up! No pending requests.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                  data-testid={`request-pending-${request.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{request.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-approve-${request.id}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Requests */}
      {approved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Approved ({approved.length})
            </CardTitle>
            <CardDescription>Previously approved requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approved.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/20"
                  data-testid={`request-approved-${request.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{request.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Approved {new Date(request.approvedAt || "").toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="default">Approved</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
