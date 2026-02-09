import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ClientCompany, ExcellenceDeliverable } from "@shared/schema";
import {
  Building,
  Plus,
  History,
  MapPin,
  Mail,
  User,
  Calendar,
  FileText,
  BarChart3,
  Pencil,
  Trash2,
  ClipboardCheck,
  Factory
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface AssessmentData {
  clientCompanyId?: string;
  clientCompanyName?: string;
  plantName: string;
  assessorName: string;
  assessmentDate: string;
  totalScore?: number;
  maxScore?: number;
  percentageScore?: number;
}

export default function AssessmentHistory() {
  const { toast } = useToast();
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ClientCompany | null>(null);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    industry: "",
    location: "",
    contactName: "",
    contactEmail: "",
    notes: ""
  });

  const { data: clientCompanies = [], isLoading } = useQuery<ClientCompany[]>({
    queryKey: ["/api/client-companies"],
  });

  const { data: deliverables = [] } = useQuery<ExcellenceDeliverable[]>({
    queryKey: ["/api/excellence-deliverables"],
  });

  const createMutation = useMutation({
    mutationFn: async (companyData: typeof newCompanyForm) => {
      return apiRequest("POST", "/api/client-companies", companyData) as unknown as Promise<ClientCompany>;
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      setNewCompanyForm({ name: "", industry: "", location: "", contactName: "", contactEmail: "", notes: "" });
      setShowNewCompanyDialog(false);
      toast({
        title: "Client Company Created",
        description: `${newCompany.name} has been added to your assessment history.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client company. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof newCompanyForm }) => {
      return apiRequest("PUT", `/api/client-companies/${id}`, data) as unknown as Promise<ClientCompany>;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      setEditingCompany(null);
      toast({
        title: "Client Company Updated",
        description: `${updated.name} has been updated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client company. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/client-companies/${id}`) as unknown as Promise<void>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      toast({
        title: "Client Company Deleted",
        description: "The client company has been removed from your history.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client company. Please try again.",
        variant: "destructive",
      });
    }
  });

  const getAssessmentsForCompany = (companyId: string) => {
    return deliverables.filter(d => {
      const payload = d.payload as AssessmentData | null;
      return payload?.clientCompanyId === companyId && d.deliverableType === "process_assessment";
    });
  };

  const resetForm = () => {
    setNewCompanyForm({ name: "", industry: "", location: "", contactName: "", contactEmail: "", notes: "" });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading assessment history...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Assessment History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage client companies and their maintenance process assessments
          </p>
        </div>
        <Dialog open={showNewCompanyDialog} onOpenChange={(open) => {
          setShowNewCompanyDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-client-company">
              <Plus className="w-4 h-4 mr-2" />
              Add Client Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Company Name *</Label>
                <Input
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter company name"
                  data-testid="input-history-company-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Industry</Label>
                  <Input
                    value={newCompanyForm.industry}
                    onChange={(e) => setNewCompanyForm(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Manufacturing"
                    data-testid="input-history-company-industry"
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={newCompanyForm.location}
                    onChange={(e) => setNewCompanyForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Chicago, IL"
                    data-testid="input-history-company-location"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contact Name</Label>
                  <Input
                    value={newCompanyForm.contactName}
                    onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Primary contact"
                    data-testid="input-history-company-contact"
                  />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={newCompanyForm.contactEmail}
                    onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="contact@company.com"
                    data-testid="input-history-company-email"
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newCompanyForm.notes}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes about this client..."
                  rows={2}
                  data-testid="input-history-company-notes"
                />
              </div>
              <Button
                onClick={() => createMutation.mutate(newCompanyForm)}
                disabled={!newCompanyForm.name || createMutation.isPending}
                className="w-full"
                data-testid="button-submit-new-company"
              >
                {createMutation.isPending ? "Creating..." : "Create Client Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {clientCompanies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Client Companies Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Start tracking your maintenance assessments by adding client companies. 
              Each company will have its own assessment history.
            </p>
            <Button onClick={() => setShowNewCompanyDialog(true)} data-testid="button-empty-add-company">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientCompanies.map((company) => {
            const assessments = getAssessmentsForCompany(company.id);
            const latestAssessment = assessments[0];
            const latestPayload = latestAssessment?.payload as AssessmentData | null;

            return (
              <Card key={company.id} className="hover-elevate" data-testid={`card-client-company-${company.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="w-4 h-4 text-primary" />
                        {company.name}
                      </CardTitle>
                      {company.industry && (
                        <CardDescription className="mt-1">{company.industry}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Dialog open={editingCompany?.id === company.id} onOpenChange={(open) => {
                        if (open) {
                          setEditingCompany(company);
                          setNewCompanyForm({
                            name: company.name,
                            industry: company.industry || "",
                            location: company.location || "",
                            contactName: company.contactName || "",
                            contactEmail: company.contactEmail || "",
                            notes: company.notes || ""
                          });
                        } else {
                          setEditingCompany(null);
                          resetForm();
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-edit-company-${company.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Client Company</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>Company Name *</Label>
                              <Input
                                value={newCompanyForm.name}
                                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter company name"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Industry</Label>
                                <Input
                                  value={newCompanyForm.industry}
                                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, industry: e.target.value }))}
                                  placeholder="e.g., Manufacturing"
                                />
                              </div>
                              <div>
                                <Label>Location</Label>
                                <Input
                                  value={newCompanyForm.location}
                                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, location: e.target.value }))}
                                  placeholder="e.g., Chicago, IL"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Contact Name</Label>
                                <Input
                                  value={newCompanyForm.contactName}
                                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                                  placeholder="Primary contact"
                                />
                              </div>
                              <div>
                                <Label>Contact Email</Label>
                                <Input
                                  type="email"
                                  value={newCompanyForm.contactEmail}
                                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                                  placeholder="contact@company.com"
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Notes</Label>
                              <Textarea
                                value={newCompanyForm.notes}
                                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Any additional notes..."
                                rows={2}
                              />
                            </div>
                            <Button
                              onClick={() => updateMutation.mutate({ id: company.id, data: newCompanyForm })}
                              disabled={!newCompanyForm.name || updateMutation.isPending}
                              className="w-full"
                            >
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-company-${company.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Client Company?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {company.name} from your assessment history. 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(company.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    {company.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {company.location}
                      </div>
                    )}
                    {company.contactName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3 h-3" />
                        {company.contactName}
                      </div>
                    )}
                    {company.contactEmail && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {company.contactEmail}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" />
                        Assessments
                      </span>
                      <Badge variant="secondary">{assessments.length}</Badge>
                    </div>
                    
                    {latestAssessment && latestPayload ? (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Latest Assessment</span>
                          <span className="font-medium">
                            {latestPayload.assessmentDate ? format(new Date(latestPayload.assessmentDate), "MMM d, yyyy") : "—"}
                          </span>
                        </div>
                        {latestPayload.percentageScore !== undefined && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              Score
                            </span>
                            <Badge 
                              variant={latestPayload.percentageScore >= 75 ? "default" : latestPayload.percentageScore >= 50 ? "secondary" : "destructive"}
                            >
                              {latestPayload.percentageScore}%
                            </Badge>
                          </div>
                        )}
                        {latestPayload.assessorName && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Assessor</span>
                            <span>{latestPayload.assessorName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        No assessments yet
                      </div>
                    )}
                  </div>

                  {company.createdAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2">
                      <Calendar className="w-3 h-3" />
                      Added {format(new Date(company.createdAt), "MMM d, yyyy")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
