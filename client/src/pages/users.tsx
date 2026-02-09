import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Plus, User, Shield, Wrench, Mail, X, Clock, Trash2, AlertCircle, Building2, ExternalLink, Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User as UserType, Invitation, Company } from "@shared/schema";
import { Link } from "wouter";

interface SeatBreakdown {
  purchased: { manager: number; tech: number };
  used: { manager: number; tech: number };
  pending: { manager: number; tech: number };
  available: { manager: number; tech: number };
  hasSubscription: boolean;
}

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [userToMove, setUserToMove] = useState<UserType | null>(null);
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  
  // License management state (platform admin only)
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [companyToManage, setCompanyToManage] = useState<Company | null>(null);
  const [managerSeats, setManagerSeats] = useState<number>(0);
  const [techSeats, setTechSeats] = useState<number>(0);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: !!user?.companyId,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/invitations"],
    enabled: !!user?.companyId && (user?.role === "admin" || user?.role === "manager"),
  });

  const isPlatformAdmin = user?.platformRole === "platform_admin";

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: isPlatformAdmin,
  });

  // Fetch seat breakdown for seat availability
  const { data: seatBreakdown } = useQuery<SeatBreakdown>({
    queryKey: ["/api/billing/seats"],
    enabled: !!user?.companyId && (user?.role === "admin" || user?.role === "manager"),
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiRequest("DELETE", `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  const inviteFormSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    role: z.enum(["admin", "manager", "tech"], {
      required_error: "Please select a role",
    }),
    companyId: z.string().optional(),
  }).refine((data) => {
    if (isPlatformAdmin && !data.companyId) {
      return false;
    }
    return true;
  }, {
    message: "Please select a company",
    path: ["companyId"],
  });

  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "tech",
      companyId: user?.companyId || undefined,
    },
  });

  useEffect(() => {
    if (isPlatformAdmin && companies.length > 0 && !form.getValues("companyId")) {
      form.setValue("companyId", companies[0].id);
    }
  }, [isPlatformAdmin, companies, form]);

  const inviteUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteFormSchema>) => {
      return await apiRequest("POST", "/api/invitations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Invitation sent",
        description: "The user has been invited successfully. They will join your company when they sign in.",
      });
      setShowInviteDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const onSubmitInvite = form.handleSubmit((data) => {
    inviteUserMutation.mutate(data);
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User removed",
        description: "The user has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  // Platform admin toggle mutation
  const togglePlatformAdminMutation = useMutation({
    mutationFn: async ({ userId, makePlatformAdmin }: { userId: string; makePlatformAdmin: boolean }) => {
      return await apiRequest("PUT", `/api/users/${userId}`, {
        platformRole: makePlatformAdmin ? "platform_admin" : "customer_user",
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: variables.makePlatformAdmin ? "Platform Admin Granted" : "Platform Admin Revoked",
        description: variables.makePlatformAdmin 
          ? "User now has platform admin access."
          : "User no longer has platform admin access.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update platform role",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return await apiRequest("POST", "/api/users/bulk-delete", { userIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/seat-summary"] });
      setSelectedUserIds(new Set());
      
      const hasErrors = data.skippedCount > 0;
      const deletedCount = data.deletedCount || 0;
      const skippedCount = data.skippedCount || 0;
      
      toast({
        title: hasErrors ? "Bulk delete completed with errors" : "Bulk delete completed",
        description: hasErrors 
          ? `Successfully deleted ${deletedCount} user(s). ${skippedCount} user(s) could not be deleted (they may have associated work orders or other data).`
          : `Successfully deleted ${deletedCount} user(s).`,
        variant: hasErrors ? "default" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk delete users",
        variant: "destructive",
      });
    },
  });

  const moveUserMutation = useMutation({
    mutationFn: async ({ userId, companyId }: { userId: string; companyId: string }) => {
      await apiRequest("PUT", `/api/users/${userId}`, { companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowMoveDialog(false);
      setUserToMove(null);
      setTargetCompanyId("");
      toast({
        title: "User moved",
        description: "The user has been moved to the new company successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move user",
        variant: "destructive",
      });
    },
  });

  const handleMoveUser = () => {
    if (!userToMove || !targetCompanyId) return;
    moveUserMutation.mutate({ userId: userToMove.id, companyId: targetCompanyId });
  };

  // License management mutation (platform admin only)
  const updateLicensesMutation = useMutation({
    mutationFn: async ({ companyId, purchasedManagerSeats, purchasedTechSeats }: { companyId: string; purchasedManagerSeats: number; purchasedTechSeats: number }) => {
      await apiRequest("PUT", `/api/companies/${companyId}/licenses`, { purchasedManagerSeats, purchasedTechSeats });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowLicenseDialog(false);
      setCompanyToManage(null);
      toast({
        title: "Licenses updated",
        description: "Company license seats have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update licenses",
        variant: "destructive",
      });
    },
  });

  const handleOpenLicenseDialog = (company: Company) => {
    setCompanyToManage(company);
    setManagerSeats(company.purchasedManagerSeats || 0);
    setTechSeats(company.purchasedTechSeats || 0);
    setShowLicenseDialog(true);
  };

  const handleUpdateLicenses = () => {
    if (!companyToManage) return;
    updateLicensesMutation.mutate({
      companyId: companyToManage.id,
      purchasedManagerSeats: managerSeats,
      purchasedTechSeats: techSeats,
    });
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSelectAll = () => {
    const selectableUsers = filteredUsers.filter(u => u.id !== user?.id);
    if (selectedUserIds.size === selectableUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedUserIds.size === 0) return;
    
    const count = selectedUserIds.size;
    if (confirm(`Are you sure you want to delete ${count} user(s)? This action cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedUserIds));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return Shield;
      case "manager":
        return User;
      case "tech":
        return Wrench;
      default:
        return User;
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      case "tech":
        return "secondary";
      default:
        return "outline";
    }
  };

  const canManageUsers = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";
  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(search) ||
      u.lastName?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.department?.toLowerCase().includes(search)
    );
  });

  const selectableUsers = filteredUsers.filter(u => u.id !== user?.id);
  const allSelected = selectableUsers.length > 0 && selectedUserIds.size === selectableUsers.length;

  if (usersLoading) {
    return <div className="p-8 text-center">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        {canManageUsers && (
          <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-user">
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        )}
      </div>

      {/* Stats by Role */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-destructive" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-admins">
              {users.filter((u) => u.role === "admin").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Managers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-managers">
              {users.filter((u) => u.role === "manager").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="w-4 h-4 text-chart-3" />
              Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-techs">
              {users.filter((u) => u.role === "tech").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Admin: All Companies with License Management */}
      {isPlatformAdmin && companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              All Companies ({companies.length})
            </CardTitle>
            <CardDescription>Manage company licenses and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{company.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {company.packageType || "demo"}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {company.purchasedManagerSeats || 0} manager seats
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {company.purchasedTechSeats || 0} tech seats
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenLicenseDialog(company)}
                  data-testid={`button-manage-licenses-${company.id}`}
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Manage Licenses
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {canManageUsers && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
            <CardDescription>Users who have been invited but haven't signed in yet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Badge variant={getRoleVariant(invitation.role)} className="capitalize">
                        {invitation.role}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                  disabled={deleteInvitationMutation.isPending}
                  data-testid={`button-cancel-invitation-${invitation.id}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search and Bulk Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
            
            {isAdmin && filteredUsers.length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-2 border-t">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={selectableUsers.length === 0}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedUserIds.size > 0
                      ? `${selectedUserIds.size} user(s) selected`
                      : `Select all ${selectableUsers.length} user(s)`}
                  </span>
                </div>
                
                {selectedUserIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedUserIds.size})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No users found matching your search.
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((u) => {
            const RoleIcon = getRoleIcon(u.role);
            const isCurrentUser = u.id === user?.id;
            const isSelected = selectedUserIds.has(u.id);

            return (
              <Card key={u.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    {isAdmin && !isCurrentUser && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleUser(u.id)}
                        className="mt-1"
                        data-testid={`checkbox-user-${u.id}`}
                      />
                    )}
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage src={u.profileImageUrl || undefined} alt={u.firstName || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {u.firstName?.[0] || "U"}
                        {u.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">
                          {u.firstName} {u.lastName}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-2">(You)</span>
                          )}
                        </CardTitle>
                        <Badge variant={getRoleVariant(u.role)} className="capitalize">
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {u.role}
                        </Badge>
                        {u.platformRole === "platform_admin" && (
                          <Badge variant="default" className="bg-purple-600">
                            Platform Admin
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">{u.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {u.department ? `Department: ${u.department}` : "No department assigned"}
                      {isPlatformAdmin && u.companyId && (
                        <span className="ml-2 text-xs">
                          Company: {companies.find(c => c.id === u.companyId)?.name || u.companyId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPlatformAdmin && !isCurrentUser && (
                        <>
                          <Button
                            size="sm"
                            variant={u.platformRole === "platform_admin" ? "default" : "outline"}
                            className={u.platformRole === "platform_admin" ? "bg-purple-600 hover:bg-purple-700" : ""}
                            onClick={() => {
                              const isCurrentlyPlatformAdmin = u.platformRole === "platform_admin";
                              if (confirm(isCurrentlyPlatformAdmin 
                                ? `Remove platform admin access from ${u.firstName} ${u.lastName}?`
                                : `Grant platform admin access to ${u.firstName} ${u.lastName}? This will give them full system access.`
                              )) {
                                togglePlatformAdminMutation.mutate({ 
                                  userId: u.id, 
                                  makePlatformAdmin: !isCurrentlyPlatformAdmin 
                                });
                              }
                            }}
                            disabled={togglePlatformAdminMutation.isPending}
                            data-testid={`button-toggle-platform-admin-${u.id}`}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            {u.platformRole === "platform_admin" ? "Revoke Admin" : "Make Admin"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUserToMove(u);
                              setTargetCompanyId("");
                              setShowMoveDialog(true);
                            }}
                            data-testid={`button-move-user-${u.id}`}
                          >
                            <Building2 className="w-4 h-4 mr-1" />
                            Move
                          </Button>
                        </>
                      )}
                      {canManageUsers && !isCurrentUser && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove ${u.firstName} ${u.lastName} from your company?`)) {
                              deleteUserMutation.mutate(u.id);
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          data-testid={`button-delete-user-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent data-testid="dialog-invite-user">
          <DialogHeader>
            <DialogTitle>Invite User to Company</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to invite. They'll be added to the selected company when they sign in.
            </DialogDescription>
          </DialogHeader>

          {/* Seat Availability Info */}
          {seatBreakdown && !isPlatformAdmin && (
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="font-medium">Available Seats</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-destructive" />
                  <span>Manager/Admin:</span>
                  <span className={`font-semibold ${seatBreakdown.available.manager > 0 ? "text-green-600" : "text-amber-600"}`}>
                    {seatBreakdown.available.manager}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-chart-3" />
                  <span>Technician:</span>
                  <span className={`font-semibold ${seatBreakdown.available.tech > 0 ? "text-green-600" : "text-amber-600"}`}>
                    {seatBreakdown.available.tech}
                  </span>
                </div>
              </div>
              {(seatBreakdown.available.manager === 0 && seatBreakdown.available.tech === 0) && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center gap-2">
                    No seats available.
                    <Link href="/billing" className="underline font-medium flex items-center gap-1">
                      Purchase more seats <ExternalLink className="h-3 w-3" />
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={onSubmitInvite} className="space-y-4">
              {isPlatformAdmin && (
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-invite-company">
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                {company.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="user@example.com"
                        type="email"
                        {...field}
                        data-testid="input-invite-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => {
                  const selectedRole = field.value;
                  const isManagerRole = selectedRole === "admin" || selectedRole === "manager";
                  const availableForRole = seatBreakdown
                    ? (isManagerRole ? seatBreakdown.available.manager : seatBreakdown.available.tech)
                    : 999; // Allow if no seat data (platform admin or data not loaded)
                  const noSeatsForRole = availableForRole === 0 && !isPlatformAdmin;

                  return (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-invite-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin" disabled={seatBreakdown?.available.manager === 0 && !isPlatformAdmin}>
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Admin
                              {seatBreakdown && !isPlatformAdmin && (
                                <span className="text-xs text-muted-foreground">
                                  ({seatBreakdown.available.manager} available)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                          <SelectItem value="manager" disabled={seatBreakdown?.available.manager === 0 && !isPlatformAdmin}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Manager
                              {seatBreakdown && !isPlatformAdmin && (
                                <span className="text-xs text-muted-foreground">
                                  ({seatBreakdown.available.manager} available)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                          <SelectItem value="tech" disabled={seatBreakdown?.available.tech === 0 && !isPlatformAdmin}>
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4" />
                              Technician
                              {seatBreakdown && !isPlatformAdmin && (
                                <span className="text-xs text-muted-foreground">
                                  ({seatBreakdown.available.tech} available)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {noSeatsForRole && (
                        <p className="text-sm text-amber-600">
                          No {isManagerRole ? "manager/admin" : "technician"} seats available.{" "}
                          <Link href="/billing" className="underline">Purchase more seats</Link>
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteDialog(false)}
                  data-testid="button-cancel-invite"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteUserMutation.isPending || (
                    !isPlatformAdmin && seatBreakdown && (
                      (form.watch("role") === "admin" || form.watch("role") === "manager")
                        ? seatBreakdown.available.manager === 0
                        : seatBreakdown.available.tech === 0
                    )
                  )}
                  data-testid="button-submit-invite"
                >
                  {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Move User Dialog - Platform Admin Only */}
      <Dialog open={showMoveDialog} onOpenChange={(open) => {
        setShowMoveDialog(open);
        if (!open) {
          setUserToMove(null);
          setTargetCompanyId("");
        }
      }}>
        <DialogContent data-testid="dialog-move-user">
          <DialogHeader>
            <DialogTitle>Move User to Different Company</DialogTitle>
            <DialogDescription>
              {userToMove && (
                <>Move <strong>{userToMove.firstName} {userToMove.lastName}</strong> ({userToMove.email}) to a different company.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Company</label>
              <div className="p-2 bg-muted rounded-md text-sm">
                {userToMove?.companyId ? (
                  companies.find(c => c.id === userToMove.companyId)?.name || "Unknown"
                ) : (
                  "No company assigned"
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Move to Company</label>
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
                <SelectTrigger data-testid="select-target-company">
                  <SelectValue placeholder="Select target company" />
                </SelectTrigger>
                <SelectContent>
                  {companies
                    .filter(c => c.id !== userToMove?.companyId)
                    .map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
              data-testid="button-cancel-move"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveUser}
              disabled={!targetCompanyId || moveUserMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveUserMutation.isPending ? "Moving..." : "Move User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Licenses Dialog - Platform Admin Only */}
      <Dialog open={showLicenseDialog} onOpenChange={(open) => {
        setShowLicenseDialog(open);
        if (!open) {
          setCompanyToManage(null);
        }
      }}>
        <DialogContent data-testid="dialog-manage-licenses">
          <DialogHeader>
            <DialogTitle>Manage Company Licenses</DialogTitle>
            <DialogDescription>
              {companyToManage && (
                <>Set license seats for <strong>{companyToManage.name}</strong>. These override any Stripe subscription limits.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" />
                Manager/Admin Seats
              </label>
              <Input
                type="number"
                min={0}
                value={managerSeats}
                onChange={(e) => setManagerSeats(parseInt(e.target.value) || 0)}
                data-testid="input-manager-seats"
              />
              <p className="text-xs text-muted-foreground">
                Includes both admin and manager roles
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4 text-chart-3" />
                Technician Seats
              </label>
              <Input
                type="number"
                min={0}
                value={techSeats}
                onChange={(e) => setTechSeats(parseInt(e.target.value) || 0)}
                data-testid="input-tech-seats"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Setting licenses manually will bypass normal billing. Use this for testing or special arrangements.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLicenseDialog(false)}
              data-testid="button-cancel-licenses"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLicenses}
              disabled={updateLicensesMutation.isPending}
              data-testid="button-save-licenses"
            >
              {updateLicensesMutation.isPending ? "Saving..." : "Save Licenses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
