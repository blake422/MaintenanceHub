import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Company } from "@shared/schema";
import {
  Building2,
  CheckCircle2,
  Settings,
  Users,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Plus,
  Minus,
} from "lucide-react";
import logoUrl from "@assets/C4 Logo-Clean (1)_1762187643543.png";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0); // Start at 0 for trial/purchase choice
  const [planChoice, setPlanChoice] = useState<"trial" | "purchase" | null>(null);
  const [companyData, setCompanyData] = useState({
    name: "",
    description: "",
  });

  // Seat selection for purchase flow (minimum 1 manager seat = $100/month)
  const [managerSeats, setManagerSeats] = useState(1);
  const [techSeats, setTechSeats] = useState(0);

  // Pricing constants
  const MANAGER_PRICE = 100;
  const TECH_PRICE = 20;
  const monthlyTotal = (managerSeats * MANAGER_PRICE) + (techSeats * TECH_PRICE);

  // Fetch company to check onboarding state
  const { data: company } = useQuery<Company>({
    queryKey: user?.companyId ? ["/api/companies", user.companyId] : undefined,
    enabled: !!user?.companyId,
  });

  // Handle payment success/canceled from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      // Payment successful - show success and go to completion step
      setPlanChoice("purchase");
      setCurrentStep(2);
      toast({
        title: "Payment Successful!",
        description: "Your subscription is now active.",
      });
      // Clear the query params from URL
      window.history.replaceState({}, "", "/onboarding");
    } else if (paymentStatus === "canceled") {
      // Payment canceled - go back to plan selection
      setPlanChoice(null);
      setCurrentStep(0);
      toast({
        title: "Payment Canceled",
        description: "You can try again when you're ready.",
        variant: "destructive",
      });
      // Clear the query params from URL
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [toast]);

  // Restore step based on company state (prevents reset on re-render)
  useEffect(() => {
    if (company && user?.companyId) {
      // User already has a company - skip to completion step
      if (company.packageType === "demo") {
        setPlanChoice("trial");
        setCurrentStep(2); // Go to "You're All Set" step
      } else {
        setPlanChoice("purchase");
        // For paid plans, if onboarding not complete, they're at step 2
        if (!company.onboardingCompleted) {
          setCurrentStep(2);
        }
      }
    }
  }, [company, user?.companyId]);
  const [equipmentData, setEquipmentData] = useState({
    name: "",
    equipmentType: "",
    location: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = planChoice === "trial" ? 3 : 2; // Trial: choose, company, complete. Purchase: choose, checkout
  const progress = (currentStep / totalSteps) * 100;

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/complete");
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Welcome to MaintenanceHub!",
        description: "Your account is all set up. Let's get started!",
      });
      
      // Manually update the company cache to mark onboarding as complete
      if (user?.companyId) {
        queryClient.setQueryData(["/api/companies", user.companyId], (old: any) => {
          if (old) {
            return { ...old, onboardingCompleted: true };
          }
          return old;
        });
      }
      
      // Navigate to dashboard - cache is now updated
      setLocation("/");
    },
  });

  const createCompany = useMutation({
    mutationFn: async (data: typeof companyData) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return await res.json();
    },
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      if (planChoice === "trial") {
        toast({
          title: "Trial Started!",
          description: "Your 30-day free trial is active. You can invite 1 manager + 1 technician.",
        });
        setCurrentStep(2); // Go to complete step
      } else {
        // Redirect to Stripe checkout for purchase
        try {
          const checkoutRes = await apiRequest("POST", "/api/billing/create-checkout", {
            companyId: company.id,
            managerSeats,
            techSeats,
            successUrl: "/onboarding?payment=success",
            cancelUrl: "/onboarding?payment=canceled",
          });
          const session = await checkoutRes.json();
          window.location.href = session.url;
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to start checkout",
            variant: "destructive",
          });
        }
      }
    },
  });

  const createEquipment = useMutation({
    mutationFn: async (data: typeof equipmentData) => {
      const res = await apiRequest("POST", "/api/equipment", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Equipment added!",
        description: "Your first piece of equipment has been added.",
      });
      setCurrentStep(2); // Go to complete
    },
  });

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't show validation error if mutation is already in progress or succeeded
    if (createCompany.isPending || createCompany.isSuccess) {
      return;
    }
    
    if (!companyData.name.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter your company name to continue.",
        variant: "destructive",
      });
      return;
    }
    createCompany.mutate(companyData);
  };

  const handleEquipmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't show validation error if mutation is already in progress or succeeded
    if (createEquipment.isPending || createEquipment.isSuccess) {
      return;
    }
    
    if (!equipmentData.name.trim()) {
      toast({
        title: "Equipment name required",
        description: "Please enter equipment name to continue.",
        variant: "destructive",
      });
      return;
    }
    createEquipment.mutate(equipmentData);
  };

  const handleSkipEquipment = () => {
    setCurrentStep(2); // Go to complete step
  };

  const handleComplete = () => {
    completeOnboarding.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|pdf|doc|docx)$/i)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV, Excel, PDF, or Word document.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/equipment/import-onboarding', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Equipment imported!",
        description: `Successfully imported ${result.count} equipment items.`,
      });
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setCurrentStep(4);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error importing your equipment. Please check the file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="C4 Industrial" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Welcome to MaintenanceHub
          </h1>
          <p className="text-muted-foreground">
            Let's get you set up in just a few easy steps
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Step {currentStep} of {totalSteps}</span>
                <span className="font-medium">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Step 0: Choose Trial or Purchase */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Welcome to MaintenanceHub!</CardTitle>
              <CardDescription>
                Choose how you'd like to get started with your maintenance management platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card 
                  className="hover-elevate cursor-pointer border-2 transition-colors"
                  onClick={() => { setPlanChoice("trial"); setCurrentStep(1); }}
                  data-testid="card-trial-option"
                >
                  <CardContent className="pt-6">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl font-bold text-chart-3">30</span>
                      </div>
                      <h3 className="font-semibold text-lg">Free Trial</h3>
                      <p className="text-sm text-muted-foreground">
                        Try all features free for 30 days. Invite 1 manager + 1 technician
                      </p>
                      <ul className="text-sm text-left space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-chart-3" />
                          <span>No credit card required</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-chart-3" />
                          <span>Full access to all features</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-chart-3" />
                          <span>Invite 1 manager + 1 technician</span>
                        </li>
                      </ul>
                      <Button className="w-full" variant="outline" data-testid="button-select-trial">
                        Start Free Trial
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="hover-elevate cursor-pointer border-2 transition-colors"
                  onClick={() => { setPlanChoice("purchase"); setCurrentStep(1); }}
                  data-testid="card-purchase-option"
                >
                  <CardContent className="pt-6">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl">💳</span>
                      </div>
                      <h3 className="font-semibold text-lg">Purchase Licenses</h3>
                      <p className="text-sm text-muted-foreground">
                        Buy user licenses and start using MaintenanceHub today
                      </p>
                      <ul className="text-sm text-left space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>Managers/Admins: $100/month</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>Technicians: $50/month</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>Cancel anytime</span>
                        </li>
                      </ul>
                      <Button className="w-full" data-testid="button-select-purchase">
                        Purchase Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Company Setup (simplified) */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>{planChoice === "trial" ? "Start Your Free Trial" : "Purchase Licenses"}</CardTitle>
              <CardDescription>
                {planChoice === "trial" 
                  ? "Enter your company name to activate your 30-day free trial"
                  : "Set up your company and choose your license count"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Manufacturing Inc."
                    value={companyData.name}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, name: e.target.value })
                    }
                    data-testid="input-company-name"
                  />
                </div>
                {planChoice === "purchase" && (
                  <div className="space-y-4">
                    {/* Manager Seats Selector */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Manager/Admin Seats</p>
                          <p className="text-sm text-muted-foreground">${MANAGER_PRICE}/month each</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setManagerSeats(Math.max(1, managerSeats - 1))}
                            disabled={managerSeats <= 1}
                            data-testid="button-decrease-manager"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-lg">{managerSeats}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setManagerSeats(managerSeats + 1)}
                            data-testid="button-increase-manager"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Minimum 1 required. For admins and managers who oversee operations.
                      </p>
                    </div>

                    {/* Technician Seats Selector */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Technician Seats</p>
                          <p className="text-sm text-muted-foreground">${TECH_PRICE}/month each</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setTechSeats(Math.max(0, techSeats - 1))}
                            disabled={techSeats <= 0}
                            data-testid="button-decrease-tech"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-lg">{techSeats}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setTechSeats(techSeats + 1)}
                            data-testid="button-increase-tech"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Optional. For technicians who perform maintenance work.
                      </p>
                    </div>

                    {/* Monthly Total */}
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Monthly Total</span>
                        <span className="text-2xl font-bold text-primary">${monthlyTotal}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {managerSeats} manager × ${MANAGER_PRICE} + {techSeats} tech × ${TECH_PRICE}
                      </p>
                    </div>
                  </div>
                )}
                {planChoice === "trial" && (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm font-medium mb-2">Your trial includes:</p>
                    <ul className="text-sm space-y-1">
                      <li>✓ 30 days free access</li>
                      <li>✓ Invite 1 manager + 1 technician</li>
                      <li>✓ All features unlocked</li>
                    </ul>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createCompany.isPending}
                    data-testid="button-create-company"
                  >
                    {createCompany.isPending ? "Processing..." : (planChoice === "trial" ? "Start Free Trial" : "Continue to Payment")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Complete (for trial only) */}
        {currentStep === 2 && planChoice === "trial" && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-chart-3" />
              </div>
              <CardTitle>You're All Set!</CardTitle>
              <CardDescription>
                Your 30-day free trial is active. Start managing your maintenance operations!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invite Your Team</p>
                      <p className="text-sm text-muted-foreground">
                        Invite 1 manager + 1 technician from Admin → Users
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Add Equipment</p>
                      <p className="text-sm text-muted-foreground">
                        Build your asset registry with QR codes and photos
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Try C4 Features</p>
                      <p className="text-sm text-muted-foreground">
                        Explore AI troubleshooting and maintenance planning
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleComplete}
                disabled={completeOnboarding.isPending}
                data-testid="button-complete-onboarding"
              >
                {completeOnboarding.isPending ? "Setting up..." : "Start Using MaintenanceHub"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Complete (for purchase) */}
        {currentStep === 2 && planChoice === "purchase" && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-chart-3" />
              </div>
              <CardTitle>Payment Successful!</CardTitle>
              <CardDescription>
                Your subscription is active. Start managing your maintenance operations!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invite Your Team</p>
                      <p className="text-sm text-muted-foreground">
                        Add team members from Admin → Users based on your purchased seats
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Add Equipment</p>
                      <p className="text-sm text-muted-foreground">
                        Build your asset registry with QR codes and photos
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Explore C4 Features</p>
                      <p className="text-sm text-muted-foreground">
                        Use AI troubleshooting and maintenance planning
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleComplete}
                disabled={completeOnboarding.isPending}
                data-testid="button-complete-onboarding-purchase"
              >
                {completeOnboarding.isPending ? "Setting up..." : "Go to Dashboard"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: First Equipment (Optional) - REMOVED for simplicity */}
        {currentStep === 999 && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Add Your Equipment</CardTitle>
              <CardDescription>
                Add equipment manually or import from a file (Excel, PDF, or Word). You can always add more later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="manual" data-testid="tab-manual-entry">Manual Entry</TabsTrigger>
                  <TabsTrigger value="import" data-testid="tab-import-file">Import from File</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <form onSubmit={handleEquipmentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="equipment-name">Equipment Name *</Label>
                      <Input
                        id="equipment-name"
                        placeholder="Conveyor Belt #1"
                        value={equipmentData.name}
                        onChange={(e) =>
                          setEquipmentData({ ...equipmentData, name: e.target.value })
                        }
                        data-testid="input-equipment-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipment-type">Type (Optional)</Label>
                      <Input
                        id="equipment-type"
                        placeholder="Conveyor System"
                        value={equipmentData.equipmentType}
                        onChange={(e) =>
                          setEquipmentData({ ...equipmentData, equipmentType: e.target.value })
                        }
                        data-testid="input-equipment-type"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipment-location">Location (Optional)</Label>
                      <Input
                        id="equipment-location"
                        placeholder="Building A, Floor 2"
                        value={equipmentData.location}
                        onChange={(e) =>
                          setEquipmentData({ ...equipmentData, location: e.target.value })
                        }
                        data-testid="input-equipment-location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipment-description">
                        Description (Optional)
                      </Label>
                      <Textarea
                        id="equipment-description"
                        placeholder="Additional details about this equipment..."
                        value={equipmentData.description}
                        onChange={(e) =>
                          setEquipmentData({ ...equipmentData, description: e.target.value })
                        }
                        className="min-h-[80px]"
                        data-testid="input-equipment-description"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSkipEquipment}
                        data-testid="button-skip-equipment"
                      >
                        Skip for Now
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createEquipment.isPending}
                        data-testid="button-add-equipment"
                      >
                        {createEquipment.isPending ? "Adding..." : "Add Equipment"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="import" className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-medium mb-2">Import Equipment List</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a CSV, Excel, PDF, or Word file with your equipment list.
                      We'll use C4 to extract and import the data.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="mb-3"
                      data-testid="button-select-file"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Select File
                    </Button>
                    {selectedFile && (
                      <div className="text-sm text-muted-foreground mb-4">
                        Selected: <span className="font-medium">{selectedFile.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSkipEquipment}
                      data-testid="button-skip-import"
                    >
                      Skip for Now
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isUploading}
                      data-testid="button-upload-file"
                    >
                      {isUploading ? "Importing..." : "Import Equipment"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-chart-3" />
              </div>
              <CardTitle>You're All Set!</CardTitle>
              <CardDescription>
                Your MaintenanceHub account is ready. Here's what you can do next:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invite Your Team</p>
                      <p className="text-sm text-muted-foreground">
                        Add team members from Admin → Users to start collaborating
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Add More Equipment</p>
                      <p className="text-sm text-muted-foreground">
                        Build your asset registry with QR codes, photos, and manuals
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Explore C4 Features</p>
                      <p className="text-sm text-muted-foreground">
                        Try the troubleshooting assistant, RCA oracle, and C4 planner
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleComplete}
                disabled={completeOnboarding.isPending}
                data-testid="button-complete-onboarding"
              >
                {completeOnboarding.isPending ? "Finishing..." : "Go to Dashboard"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
