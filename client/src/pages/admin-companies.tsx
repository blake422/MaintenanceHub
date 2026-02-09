import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2, Users, AlertCircle, Trash2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertCompanySchema, type Company } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { CompanySettingsDialog } from "@/components/CompanySettingsDialog";

export default function AdminCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!user && user.role === "admin",
  });

  const createCompany = useMutation({
    mutationFn: async (data: z.infer<typeof insertCompanySchema>) => {
      return await apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: "Success", description: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDeleteCompanyId(null);
      toast({
        title: "Company Deleted",
        description: "Company and all related data have been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof insertCompanySchema>>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: "",
      description: "",
      licenseCount: 10,
      usedLicenses: 0,
    },
  });

  const onSubmit = (data: z.infer<typeof insertCompanySchema>) => {
    createCompany.mutate(data);
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only administrators can access this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Companies</h1>
          <p className="text-muted-foreground">Manage companies in the system</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-company">
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : companies.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No companies found</p>
            </CardContent>
          </Card>
        ) : (
          companies.map((company) => {
            // Use purchasedManagerSeats + purchasedTechSeats for all companies (demo and paid)
            const isDemo = company.packageType === "demo";
            const hasActiveSubscription = company.subscriptionStatus === "active" || company.subscriptionStatus === "trialing";

            // Total seats = manager seats + tech seats (same for demo and paid)
            const totalSeats = (company.purchasedManagerSeats ?? 0) + (company.purchasedTechSeats ?? 0);

            const usedLicenses = company.usedLicenses ?? 0;
            const licenseUsagePercent = totalSeats > 0
              ? Math.round((usedLicenses / totalSeats) * 100)
              : 0;
            const isOverLimit = usedLicenses > totalSeats;

            // Calculate trial status
            const demoExpiresAt = company.demoExpiresAt ? new Date(company.demoExpiresAt) : null;
            const now = new Date();
            const isTrialExpired = isDemo && demoExpiresAt && now > demoExpiresAt;
            const trialDaysRemaining = demoExpiresAt
              ? Math.ceil((demoExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card key={company.id} className="hover-elevate" data-testid={`card-company-${company.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {company.name}
                    {isDemo && !hasActiveSubscription && (
                      <Badge
                        variant={isTrialExpired ? "destructive" : "secondary"}
                        className="ml-auto text-xs"
                      >
                        {isTrialExpired
                          ? "Trial Expired"
                          : `Trial: ${trialDaysRemaining}d left`}
                      </Badge>
                    )}
                    {hasActiveSubscription && (
                      <Badge variant="default" className="ml-auto text-xs">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{company.description || "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="w-4 h-4" />
                        License Usage
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" data-testid={`text-license-usage-${company.id}`}>
                          {usedLicenses} / {totalSeats}
                        </span>
                        {isOverLimit && (
                          <Badge variant="destructive" className="gap-1" data-testid={`badge-over-limit-${company.id}`}>
                            <AlertCircle className="w-3 h-3" />
                            Over Limit
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(licenseUsagePercent, 100)} 
                      className="h-2"
                      data-testid={`progress-license-${company.id}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      Created: {company.createdAt ? format(new Date(company.createdAt), "MMM d, yyyy") : "N/A"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCompany(company);
                          setShowSettingsDialog(true);
                        }}
                        data-testid={`button-configure-company-${company.id}`}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                      {user?.companyId === company.id ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled
                              data-testid={`button-delete-company-${company.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Cannot delete your own company</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteCompanyId(company.id)}
                          data-testid={`button-delete-company-${company.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Create Company Dialog */}
      {showCreateDialog && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Manufacturing" {...field} data-testid="input-company-name" />
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
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description..." {...field} value={field.value || ""} data-testid="textarea-company-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Count</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="10" 
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-license-count" 
                        />
                      </FormControl>
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
                  <Button type="submit" disabled={createCompany.isPending} data-testid="button-submit-company">
                    {createCompany.isPending ? "Creating..." : "Create Company"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCompanyId} onOpenChange={(open) => !open && setDeleteCompanyId(null)}>
        <AlertDialogContent data-testid="dialog-delete-company-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone and will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All company data</li>
                <li>All users in this company</li>
                <li>All equipment, work orders, and maintenance records</li>
                <li>All training data and certifications</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompanyId && deleteCompany.mutate(deleteCompanyId)}
              disabled={deleteCompany.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteCompany.isPending ? "Deleting..." : "Delete Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Company Settings Dialog */}
      <CompanySettingsDialog
        company={selectedCompany}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </div>
  );
}
