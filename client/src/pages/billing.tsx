import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CreditCard, Users, CheckCircle, AlertCircle, Clock, Sparkles, Plus, Minus, AlertTriangle, ExternalLink, Building2, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Company } from "@shared/schema";

// blueprint reference: javascript_stripe
const stripePublicKey = import.meta.env.TESTING_VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!stripePublicKey) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY or TESTING_VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(stripePublicKey);

interface SeatBreakdown {
  purchased: { manager: number; tech: number };
  used: { manager: number; tech: number };
  pending: { manager: number; tech: number };
  available: { manager: number; tech: number };
  managerPriceDollars: number;
  techPriceDollars: number;
  troubleshootingPriceDollars: number;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  paymentRestricted: boolean;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  isPlatformAdmin?: boolean;
}

interface PreviewResult {
  immediateCharge: number;
  newMonthlyTotal: number;
  prorationDetails: {
    prorationTotal: number;
    nextCycleTotal: number;
    prorationLines: Array<{ description: string | null; amount: number }>;
    nextCycleLines: Array<{ description: string | null; amount: number }>;
    invoiceSubtotal: number;
    invoiceTotal: number;
  } | null;
}

function PaymentFailedBanner({ onRetryPayment }: { onRetryPayment: () => void }) {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg">Payment Failed</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          Your subscription payment has failed. You are currently in read-only mode and cannot make changes until payment is resolved.
        </p>
        <Button variant="outline" onClick={onRetryPayment} className="bg-white hover:bg-gray-100">
          <CreditCard className="mr-2 h-4 w-4" />
          Update Payment Method
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function SeatManagementCard({
  title,
  roleType,
  seats,
  price,
  hasSubscription,
  allSeats,
  onConfirmChange,
  disabled,
  isUpdating,
}: {
  title: string;
  roleType: "manager" | "tech";
  seats: { purchased: number; used: number; pending: number; available: number };
  price: number;
  hasSubscription: boolean;
  allSeats: { manager: number; tech: number };
  onConfirmChange: (managerSeats: number, techSeats: number) => void;
  disabled: boolean;
  isUpdating: boolean;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(seats.purchased);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  // Minimum seats: usage + pending, but manager seats must be at least 1
  const usageMinSeats = seats.used + seats.pending;
  const minSeats = roleType === "manager" ? Math.max(1, usageMinSeats) : usageMinSeats;
  const canDecrease = newSeatCount > minSeats;
  const hasChanges = newSeatCount !== seats.purchased;
  const isUpgrade = newSeatCount > seats.purchased;
  const isDowngrade = newSeatCount < seats.purchased;
  const seatDifference = newSeatCount - seats.purchased;

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const newManagerSeats = roleType === "manager" ? newSeatCount : allSeats.manager;
      const newTechSeats = roleType === "tech" ? newSeatCount : allSeats.tech;
      const response = await apiRequest("POST", "/api/billing/preview-seat-change", {
        managerSeats: newManagerSeats,
        techSeats: newTechSeats,
      });
      return response.json() as Promise<PreviewResult>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep("confirm");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to preview changes",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = () => {
    setNewSeatCount(seats.purchased);
    setStep("select");
    setPreview(null);
    setDialogOpen(true);
  };

  const handlePreview = () => {
    if (hasSubscription) {
      previewMutation.mutate();
    } else {
      // No subscription - go straight to confirm with calculated values
      const newManagerSeats = roleType === "manager" ? newSeatCount : allSeats.manager;
      const newTechSeats = roleType === "tech" ? newSeatCount : allSeats.tech;
      setPreview({
        immediateCharge: 0,
        newMonthlyTotal: (newManagerSeats * price) + (newTechSeats * (roleType === "manager" ? price * 0.5 : price * 2)),
        prorationDetails: null,
      });
      setStep("confirm");
    }
  };

  const handleBack = () => {
    setStep("select");
    setPreview(null);
  };

  const handleConfirm = () => {
    const newManagerSeats = roleType === "manager" ? newSeatCount : allSeats.manager;
    const newTechSeats = roleType === "tech" ? newSeatCount : allSeats.tech;
    onConfirmChange(newManagerSeats, newTechSeats);
    setDialogOpen(false);
    setStep("select");
    setPreview(null);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setStep("select");
      setPreview(null);
    }
    setDialogOpen(open);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          ${price}/month per seat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Purchased:</span>
            <span className="font-semibold">{seats.purchased}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active:</span>
            <span className="font-medium">{seats.used}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending:</span>
            <span className="font-medium">{seats.pending}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available:</span>
            <span className={`font-semibold ${seats.available > 0 ? "text-green-600" : "text-amber-600"}`}>
              {seats.available}
            </span>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Monthly Cost:</span>
          <span className="text-lg font-bold">${seats.purchased * price}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              disabled={disabled}
              onClick={handleOpenDialog}
            >
              Manage Seats
            </Button>
          </DialogTrigger>
          <DialogContent>
            {step === "select" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Manage {title}</DialogTitle>
                  <DialogDescription>
                    Adjust your {title.toLowerCase()} count.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNewSeatCount(Math.max(minSeats, newSeatCount - 1))}
                      disabled={!canDecrease}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="text-center min-w-[100px]">
                      <div className="text-4xl font-bold">{newSeatCount}</div>
                      <div className="text-sm text-muted-foreground">seats</div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNewSeatCount(newSeatCount + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {!canDecrease && newSeatCount === minSeats && (
                    <p className="text-sm text-amber-600 text-center">
                      {roleType === "manager" && minSeats === 1 && usageMinSeats < 1
                        ? "At least 1 Manager/Admin seat is required"
                        : `Cannot reduce below ${minSeats} seats (${seats.used} active + ${seats.pending} pending)`}
                    </p>
                  )}

                  <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Current seats:</span>
                      <span>{seats.purchased}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New seats:</span>
                      <span className={isUpgrade ? "text-green-600 font-medium" : isDowngrade ? "text-amber-600 font-medium" : ""}>
                        {newSeatCount} {isUpgrade && `(+${seatDifference})`} {isDowngrade && `(${seatDifference})`}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePreview}
                    disabled={!hasChanges || previewMutation.isPending}
                  >
                    {previewMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Review Changes"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {!hasSubscription
                      ? "Configure Seats"
                      : isUpgrade ? "Confirm Seat Purchase" : "Confirm Seat Reduction"
                    }
                  </DialogTitle>
                  <DialogDescription>
                    {!hasSubscription
                      ? "Set your seat count, then complete checkout to activate."
                      : isUpgrade
                        ? "Review the charges before confirming your purchase."
                        : "Review the changes before confirming."
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Change summary */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{title}</span>
                      <span>
                        {seats.purchased} → <span className={isUpgrade ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>{newSeatCount}</span>
                      </span>
                    </div>

                    {hasSubscription && preview && (
                      <>
                        <Separator />
                        {isUpgrade ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Prorated charge (today):</span>
                              <span className="font-semibold text-green-700">
                                ${preview.immediateCharge.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">New monthly total:</span>
                              <span className="font-medium">${preview.newMonthlyTotal.toFixed(2)}/month</span>
                            </div>
                            {preview.prorationDetails?.prorationLines && preview.prorationDetails.prorationLines.length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground space-y-1 border-t pt-2">
                                <div className="font-medium text-foreground mb-1">Proration breakdown:</div>
                                {preview.prorationDetails.prorationLines.map((line, i) => (
                                  <div key={i} className="flex justify-between">
                                    <span className="truncate mr-2">{line.description || 'Proration'}</span>
                                    <span className={line.amount < 0 ? "text-green-600" : ""}>
                                      {line.amount < 0 ? "-" : ""}${Math.abs(line.amount).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">New monthly total:</span>
                              <span className="font-medium">${preview.newMonthlyTotal.toFixed(2)}/month</span>
                            </div>
                            <Alert className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                Seat reduction takes effect immediately. No refund or credit for unused time - you've already paid for this billing cycle.
                              </AlertDescription>
                            </Alert>
                          </>
                        )}
                      </>
                    )}

                    {!hasSubscription && (
                      <div className="text-sm text-muted-foreground">
                        Complete checkout to activate these seats.
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleBack} className="sm:mr-auto">
                    Back
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isUpdating}
                    variant={isUpgrade ? "default" : "secondary"}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : !hasSubscription ? (
                      "Save & Continue to Checkout"
                    ) : isUpgrade && preview?.immediateCharge ? (
                      <>Confirm & Pay ${preview.immediateCharge.toFixed(2)}</>
                    ) : isUpgrade ? (
                      "Confirm Purchase"
                    ) : (
                      "Confirm Reduction"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}

function BillingForm({ seatBreakdown }: { seatBreakdown: SeatBreakdown }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const totalPurchased = seatBreakdown.purchased.manager + seatBreakdown.purchased.tech;
  const monthlyCost =
    (seatBreakdown.purchased.manager * seatBreakdown.managerPriceDollars) +
    (seatBreakdown.purchased.tech * seatBreakdown.techPriceDollars);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing?success=true`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Active",
          description: "Your MaintenanceHub subscription is now active!",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/billing/seats'] });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-semibold text-sm mb-2">Subscription Summary</div>

        {seatBreakdown.purchased.manager > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {seatBreakdown.purchased.manager} Manager/Admin {seatBreakdown.purchased.manager === 1 ? 'Seat' : 'Seats'}
            </span>
            <span className="font-medium">${seatBreakdown.purchased.manager * seatBreakdown.managerPriceDollars}</span>
          </div>
        )}

        {seatBreakdown.purchased.tech > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {seatBreakdown.purchased.tech} Technician {seatBreakdown.purchased.tech === 1 ? 'Seat' : 'Seats'}
            </span>
            <span className="font-medium">${seatBreakdown.purchased.tech * seatBreakdown.techPriceDollars}</span>
          </div>
        )}

        <div className="border-t pt-2 mt-2">
          <div className="flex justify-between">
            <span className="font-semibold">Monthly Total</span>
            <span className="font-semibold text-lg">${monthlyCost}/month</span>
          </div>
        </div>
      </div>

      <PaymentElement />

      <Button
        type="submit"
        disabled={!stripe || isProcessing || totalPurchased === 0}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Subscribe for ${monthlyCost}/month
          </>
        )}
      </Button>
    </form>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasProcessedParams, setHasProcessedParams] = useState(false);
  // Track desired seats for checkout (when user hasn't paid yet)
  const [desiredSeats, setDesiredSeats] = useState<{ manager: number; tech: number } | null>(null);
  
  // Platform admin state
  const isPlatformAdmin = user?.platformRole === "platform_admin";
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [adminManagerSeats, setAdminManagerSeats] = useState<number>(0);
  const [adminTechSeats, setAdminTechSeats] = useState<number>(0);
  const [adminPackageType, setAdminPackageType] = useState<string>("demo");
  
  // Fetch all companies for platform admins
  const { data: allCompanies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isPlatformAdmin,
  });
  
  // Fetch selected company details for platform admin
  const { data: selectedCompany, isLoading: selectedCompanyLoading } = useQuery<Company>({
    queryKey: ['/api/companies', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      const res = await fetch(`/api/companies/${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch company");
      return res.json();
    },
    enabled: isPlatformAdmin && !!selectedCompanyId,
  });
  
  // Sync admin state when selected company changes
  useEffect(() => {
    if (selectedCompany) {
      setAdminManagerSeats(selectedCompany.purchasedManagerSeats || 0);
      setAdminTechSeats(selectedCompany.purchasedTechSeats || 0);
      setAdminPackageType(selectedCompany.packageType || "demo");
    }
  }, [selectedCompany]);
  
  // Mutation to update company package type
  const updatePackageMutation = useMutation({
    mutationFn: async ({ companyId, packageType, purchasedManagerSeats, purchasedTechSeats }: { companyId: string; packageType: string; purchasedManagerSeats?: number; purchasedTechSeats?: number }) => {
      const response = await apiRequest("PUT", `/api/companies/${companyId}/package`, {
        packageType,
        isLive: packageType !== "demo",
        purchasedManagerSeats,
        purchasedTechSeats,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Updated",
        description: `Company settings updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', selectedCompanyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Fetch seat breakdown
  const { data: seatBreakdown, isLoading, refetch } = useQuery<SeatBreakdown>({
    queryKey: ['/api/billing/seats'],
    enabled: !!user,
  });

  // Sync subscription after returning from Stripe checkout
  useEffect(() => {
    if (hasProcessedParams) return;

    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      setHasProcessedParams(true);
      setIsSyncing(true);
      // Call sync endpoint to pull subscription data from Stripe
      apiRequest("POST", "/api/billing/sync-subscription", { sessionId })
        .then(async (response) => {
          const data = await response.json();
          if (data.synced) {
            toast({
              title: "Payment Successful!",
              description: `Your subscription is now active with ${data.managerSeats} manager and ${data.techSeats} technician seats.`,
            });
            // Clear desired seats since we now have real purchased seats
            setDesiredSeats(null);
            // Refetch seat breakdown and company data (for trial status)
            queryClient.invalidateQueries({ queryKey: ['/api/billing/seats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
          }
        })
        .catch((error) => {
          console.error("Failed to sync subscription:", error);
          toast({
            title: "Sync Error",
            description: "Payment was processed but we couldn't sync your subscription. Please refresh the page.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsSyncing(false);
          // Clear URL params by navigating to clean URL
          window.history.replaceState({}, '', '/billing');
        });
    } else if (urlParams.get('canceled') === 'true') {
      setHasProcessedParams(true);
      toast({
        title: "Checkout Canceled",
        description: "Your checkout was canceled. No charges were made.",
      });
      window.history.replaceState({}, '', '/billing');
    }
  }, [hasProcessedParams, toast]);

  // Fetch company data for trial status
  const { data: company } = useQuery<Company>({
    queryKey: ['/api/companies', user?.companyId],
    queryFn: async () => {
      if (!user?.companyId) throw new Error("No company ID");
      const res = await fetch(`/api/companies/${user.companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch company");
      return res.json();
    },
    enabled: !!user?.companyId,
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async () => {
      setIsCreatingSubscription(true);
      const response = await apiRequest("POST", "/api/subscription/create-payment-intent", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else if (data.status === 'active' || data.status === 'trialing') {
        toast({
          title: "Subscription Active",
          description: "Your subscription is already active.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/billing/seats'] });
      }
      setIsCreatingSubscription(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
      setIsCreatingSubscription(false);
    },
  });

  // Update seats mutation (for active subscriptions only)
  const updateSeatsMutation = useMutation({
    mutationFn: async ({ managerSeats, techSeats }: { managerSeats: number; techSeats: number }) => {
      const response = await apiRequest("POST", "/api/billing/update-seats", {
        managerSeats,
        techSeats,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Seats Updated",
          description: "Your seat allocation has been updated successfully.",
        });
        // Clear any stale desired seats and refresh from DB
        setDesiredSeats(null);
        queryClient.invalidateQueries({ queryKey: ['/api/billing/seats'] });
      } else if (data.requiresCheckout) {
        // Shouldn't happen with active subscription, but handle gracefully
        toast({
          title: "Checkout Required",
          description: "Please complete checkout to update seats.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update seats",
        variant: "destructive",
      });
    },
  });

  // Retry payment mutation
  const retryPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/retry-payment", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open payment portal",
        variant: "destructive",
      });
    },
  });

  // Manage subscription mutation (opens Stripe billing portal)
  const manageSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/manage", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  // Trial status calculations
  const getTrialDaysRemaining = () => {
    if (!company?.demoExpiresAt) return null;
    const expiresAt = new Date(company.demoExpiresAt);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const trialDaysRemaining = getTrialDaysRemaining();
  const isTrialExpired = trialDaysRemaining !== null && trialDaysRemaining <= 0;
  const isOnTrial = company?.packageType === "demo" && !company?.isLive;

  // Billing cycle helpers
  const formatBillingDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilRenewal = (timestamp: number) => {
    const renewalDate = new Date(timestamp * 1000);
    const now = new Date();
    const diffTime = renewalDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleConfirmSeatChange = (managerSeats: number, techSeats: number) => {
    if (!seatBreakdown) return;

    const isActive = seatBreakdown.hasSubscription &&
      (seatBreakdown.subscriptionStatus === 'active' || seatBreakdown.subscriptionStatus === 'trialing');

    if (isActive) {
      // Active subscription - update directly via Stripe
      updateSeatsMutation.mutate({ managerSeats, techSeats });
    } else {
      // No subscription - store desired seats for checkout
      setDesiredSeats({ manager: managerSeats, tech: techSeats });
      toast({
        title: "Seats Configured",
        description: "Complete checkout below to activate your seats.",
      });
    }
  };

  // Checkout mutation for setting up billing with seats
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Use desiredSeats if configured, otherwise fall back to existing purchased seats
      const seatsToCheckout = desiredSeats ?? seatBreakdown?.purchased ?? { manager: 1, tech: 0 };
      const response = await apiRequest("POST", "/api/billing/create-checkout", {
        managerSeats: seatsToCheckout.manager,
        techSeats: seatsToCheckout.tech,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const handleSetupBilling = () => {
    // Use checkout flow instead of create-payment-intent
    checkoutMutation.mutate();
  };

  if (isLoading || isSyncing) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {isSyncing && (
          <p className="text-muted-foreground">Syncing your subscription...</p>
        )}
      </div>
    );
  }

  if (!seatBreakdown) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Unable to load billing information</p>
      </div>
    );
  }

  const hasActiveSubscription = seatBreakdown.hasSubscription &&
    (seatBreakdown.subscriptionStatus === 'active' || seatBreakdown.subscriptionStatus === 'trialing');

  // Only use desiredSeats when no active subscription (for pre-checkout configuration)
  // With active subscription, always use actual purchased seats from DB
  const displaySeats = hasActiveSubscription
    ? seatBreakdown.purchased
    : (desiredSeats ?? seatBreakdown.purchased);
  const totalPurchased = displaySeats.manager + displaySeats.tech;
  const totalUsed = seatBreakdown.used.manager + seatBreakdown.used.tech;
  const totalPending = seatBreakdown.pending.manager + seatBreakdown.pending.tech;
  const monthlyCost =
    (displaySeats.manager * seatBreakdown.managerPriceDollars) +
    (displaySeats.tech * seatBreakdown.techPriceDollars);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Billing & Seats</h1>
        <p className="text-muted-foreground">
          {isPlatformAdmin ? (
            "Platform Admin - Manage subscription tiers for all companies"
          ) : user?.company?.name ? (
            <>Manage seats for <span className="font-semibold text-foreground">{user.company.name}</span></>
          ) : (
            "Manage your MaintenanceHub subscription and seats"
          )}
        </p>
      </div>

      {/* Platform Admin Company Management */}
      {isPlatformAdmin && (
        <Card className="border-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              <CardTitle>Platform Admin - Company Management</CardTitle>
            </div>
            <CardDescription>
              Select a company to view and manage their subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Selector */}
            <div className="space-y-2">
              <Label htmlFor="company-select">Select Company</Label>
              <Select
                value={selectedCompanyId || ""}
                onValueChange={(value) => setSelectedCompanyId(value)}
              >
                <SelectTrigger id="company-select" data-testid="select-company-dropdown">
                  <SelectValue placeholder={companiesLoading ? "Loading companies..." : "Choose a company"} />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies?.map((company) => (
                    <SelectItem key={company.id} value={company.id} data-testid={`select-company-${company.id}`}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{company.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {company.packageType}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Package Type and Seats Management */}
            {selectedCompanyId && selectedCompany && (
              <div className="space-y-6 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedCompany.name}</h3>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      Current: <Badge variant="secondary">{selectedCompany.packageType}</Badge>
                      {(selectedCompany.purchasedManagerSeats ?? 0) > 0 || (selectedCompany.purchasedTechSeats ?? 0) > 0 ? (
                        <span className="ml-2">
                          ({selectedCompany.purchasedManagerSeats ?? 0} manager, {selectedCompany.purchasedTechSeats ?? 0} tech seats)
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                
                {/* Subscription Tier */}
                <div className="space-y-3">
                  <Label>Subscription Tier</Label>
                  <RadioGroup
                    value={adminPackageType}
                    onValueChange={setAdminPackageType}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <div className={`flex items-center space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer ${adminPackageType === "full_access" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="full_access" id="tier-full" data-testid="radio-full-access" />
                      <Label htmlFor="tier-full" className="flex-1 cursor-pointer">
                        <div className="font-medium">Full Access</div>
                        <div className="text-sm text-muted-foreground">Manager $100/mo, Tech $50/mo</div>
                      </Label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer ${adminPackageType === "operations" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="operations" id="tier-operations" data-testid="radio-operations" />
                      <Label htmlFor="tier-operations" className="flex-1 cursor-pointer">
                        <div className="font-medium">Operations</div>
                        <div className="text-sm text-muted-foreground">Manager $100/mo, Tech $50/mo</div>
                      </Label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer border-green-200 bg-green-50/50 dark:bg-green-950/20 ${adminPackageType === "troubleshooting" ? "border-green-500 bg-green-100/50" : ""}`}>
                      <RadioGroupItem value="troubleshooting" id="tier-troubleshooting" data-testid="radio-troubleshooting" />
                      <Label htmlFor="tier-troubleshooting" className="flex-1 cursor-pointer">
                        <div className="font-medium flex items-center gap-2">
                          Troubleshooting
                          <Badge variant="default" className="text-xs">New</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">$20/mo per user (RCA & Troubleshooting only)</div>
                      </Label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer ${adminPackageType === "demo" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="demo" id="tier-demo" data-testid="radio-demo" />
                      <Label htmlFor="tier-demo" className="flex-1 cursor-pointer">
                        <div className="font-medium">Demo / Trial</div>
                        <div className="text-sm text-muted-foreground">30-day free trial</div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Seat Configuration */}
                {adminPackageType !== "demo" && (
                  <div className="space-y-4">
                    <Label>License Configuration</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      {adminPackageType === "troubleshooting" ? (
                        <div className="rounded-lg border p-4 space-y-3 col-span-2 md:col-span-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Troubleshooting Licenses</span>
                            <span className="text-sm text-muted-foreground">$20/mo each</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => setAdminTechSeats(Math.max(0, adminTechSeats - 1))}
                              disabled={adminTechSeats <= 0}
                              data-testid="btn-decrease-troubleshooting"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-2xl font-bold w-12 text-center">{adminTechSeats}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => setAdminTechSeats(adminTechSeats + 1)}
                              data-testid="btn-increase-troubleshooting"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Manager/Admin Seats</span>
                              <span className="text-sm text-muted-foreground">$100/mo each</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setAdminManagerSeats(Math.max(0, adminManagerSeats - 1))}
                                disabled={adminManagerSeats <= 0}
                                data-testid="btn-decrease-manager"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-2xl font-bold w-12 text-center">{adminManagerSeats}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setAdminManagerSeats(adminManagerSeats + 1)}
                                data-testid="btn-increase-manager"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Technician Seats</span>
                              <span className="text-sm text-muted-foreground">$50/mo each</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setAdminTechSeats(Math.max(0, adminTechSeats - 1))}
                                disabled={adminTechSeats <= 0}
                                data-testid="btn-decrease-tech"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-2xl font-bold w-12 text-center">{adminTechSeats}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setAdminTechSeats(adminTechSeats + 1)}
                                data-testid="btn-increase-tech"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Monthly Cost Preview */}
                    <div className="rounded-lg bg-muted p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Estimated Monthly Cost</span>
                        <span className="text-2xl font-bold text-primary">
                          ${adminPackageType === "troubleshooting" 
                            ? adminTechSeats * 20 
                            : (adminManagerSeats * 100) + (adminTechSeats * 50)
                          }/mo
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Save Button */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      updatePackageMutation.mutate({
                        companyId: selectedCompanyId,
                        packageType: adminPackageType,
                        purchasedManagerSeats: adminPackageType === "troubleshooting" ? 0 : adminManagerSeats,
                        purchasedTechSeats: adminTechSeats,
                      });
                    }}
                    disabled={updatePackageMutation.isPending}
                    data-testid="btn-save-company-settings"
                  >
                    {updatePackageMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {selectedCompanyId && selectedCompanyLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Failed Banner */}
      {seatBreakdown.paymentRestricted && (
        <PaymentFailedBanner onRetryPayment={() => retryPaymentMutation.mutate()} />
      )}

      {/* Trial Status */}
      {isOnTrial && (
        <Card className={isTrialExpired ? "border-destructive" : "border-primary"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Free Trial
              </CardTitle>
              <Badge variant={isTrialExpired ? "destructive" : "default"}>
                {isTrialExpired ? "Expired" : `${trialDaysRemaining} days left`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isTrialExpired
                ? "Your trial has expired. Purchase seats to continue using MaintenanceHub."
                : "Purchase seats below to ensure uninterrupted access after your trial ends."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Subscription Overview
            </CardTitle>
            {hasActiveSubscription && seatBreakdown.cancelAtPeriodEnd ? (
              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-300">
                <Clock className="h-3 w-3" />
                Canceling
              </Badge>
            ) : hasActiveSubscription ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Active
              </Badge>
            ) : seatBreakdown.hasSubscription ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {seatBreakdown.subscriptionStatus}
              </Badge>
            ) : (
              <Badge variant="outline">No Subscription</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Canceling warning banner */}
          {hasActiveSubscription && seatBreakdown.cancelAtPeriodEnd && seatBreakdown.currentPeriodEnd && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Your subscription will cancel on <span className="font-semibold">{formatBillingDate(seatBreakdown.currentPeriodEnd)}</span>.
                You'll retain access until then. To keep your subscription, click "Manage" below and reactivate.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">
                {isPlatformAdmin ? "∞" : totalPurchased}
              </div>
              <div className="text-sm text-muted-foreground">
                {isPlatformAdmin ? "Unlimited" : (desiredSeats && !hasActiveSubscription ? "Configured" : "Purchased")}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{totalUsed}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{totalPending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {isPlatformAdmin ? "$0" : `$${monthlyCost}`}
              </div>
              <div className="text-sm text-muted-foreground">/month</div>
            </div>
          </div>

          {/* Billing cycle info for active subscriptions */}
          {hasActiveSubscription && seatBreakdown.currentPeriodEnd && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {seatBreakdown.cancelAtPeriodEnd ? (
                      <>
                        Access until: <span className="font-medium">{formatBillingDate(seatBreakdown.currentPeriodEnd)}</span>
                        <span className="text-muted-foreground ml-1">
                          ({getDaysUntilRenewal(seatBreakdown.currentPeriodEnd)} days left)
                        </span>
                      </>
                    ) : (
                      <>
                        Next billing: <span className="font-medium">{formatBillingDate(seatBreakdown.currentPeriodEnd)}</span>
                        <span className="text-muted-foreground ml-1">
                          ({getDaysUntilRenewal(seatBreakdown.currentPeriodEnd)} days)
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => manageSubscriptionMutation.mutate()}
                  disabled={manageSubscriptionMutation.isPending}
                >
                  {manageSubscriptionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Manage
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {seatBreakdown.cancelAtPeriodEnd
                  ? "Reactivate your subscription, update payment method, or view invoices."
                  : "Cancel anytime, update payment method, or view invoices in the Stripe portal."}
              </p>
            </div>
          )}

          {desiredSeats && !hasActiveSubscription && (
            <p className="text-sm text-amber-600 text-center">
              Seats configured but not yet active. Complete checkout below to activate.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seat Management Cards - Same display for demo and paid companies, hidden for platform admins */}
      {!isPlatformAdmin && (() => {
        const currentSeats = hasActiveSubscription
          ? seatBreakdown.purchased
          : (desiredSeats ?? seatBreakdown.purchased);
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <SeatManagementCard
              title="Manager/Admin Seats"
              roleType="manager"
              seats={{
                purchased: currentSeats.manager,
                used: seatBreakdown.used.manager,
                pending: seatBreakdown.pending.manager,
                available: hasActiveSubscription
                  ? seatBreakdown.available.manager
                  : Math.max(0, currentSeats.manager - seatBreakdown.used.manager - seatBreakdown.pending.manager),
              }}
              price={seatBreakdown.managerPriceDollars}
              hasSubscription={hasActiveSubscription}
              allSeats={{ manager: currentSeats.manager, tech: currentSeats.tech }}
              onConfirmChange={handleConfirmSeatChange}
              disabled={(hasActiveSubscription && seatBreakdown.paymentRestricted) || !!seatBreakdown.cancelAtPeriodEnd}
              isUpdating={updateSeatsMutation.isPending}
            />
            <SeatManagementCard
              title="Technician Seats"
              roleType="tech"
              seats={{
                purchased: currentSeats.tech,
                used: seatBreakdown.used.tech,
                pending: seatBreakdown.pending.tech,
                available: hasActiveSubscription
                  ? seatBreakdown.available.tech
                  : Math.max(0, currentSeats.tech - seatBreakdown.used.tech - seatBreakdown.pending.tech),
              }}
              price={seatBreakdown.techPriceDollars}
              hasSubscription={hasActiveSubscription}
              allSeats={{ manager: currentSeats.manager, tech: currentSeats.tech }}
              onConfirmChange={handleConfirmSeatChange}
              disabled={(hasActiveSubscription && seatBreakdown.paymentRestricted) || !!seatBreakdown.cancelAtPeriodEnd}
              isUpdating={updateSeatsMutation.isPending}
            />
          </div>
        );
      })()}

      {/* Setup Payment - Only show if no subscription and not platform admin */}
      {!isPlatformAdmin && !seatBreakdown.hasSubscription && !clientSecret && (
        <Card className={desiredSeats ? "border-primary" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Set Up Payment
            </CardTitle>
            <CardDescription>
              {desiredSeats
                ? "Your seats are configured. Complete checkout to activate them."
                : seatBreakdown.purchased.manager > 0
                  ? "Complete checkout to reactivate your subscription with your existing seats."
                  : "Configure seats above, then complete checkout to activate your subscription."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Show either desired seats or existing purchased seats
              const displaySeats = desiredSeats ?? seatBreakdown.purchased;
              const hasSeats = displaySeats.manager > 0 || displaySeats.tech > 0;

              if (!hasSeats) {
                return (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Click "Manage Seats" above to configure your seats, then return here to complete checkout.
                    </AlertDescription>
                  </Alert>
                );
              }

              return (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  {!desiredSeats && seatBreakdown.purchased.manager > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">Using your existing seat configuration:</p>
                  )}
                  {displaySeats.manager > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{displaySeats.manager} Manager/Admin {displaySeats.manager === 1 ? 'seat' : 'seats'}:</span>
                      <span className="font-medium">${displaySeats.manager * seatBreakdown.managerPriceDollars}/month</span>
                    </div>
                  )}
                  {displaySeats.tech > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{displaySeats.tech} Technician {displaySeats.tech === 1 ? 'seat' : 'seats'}:</span>
                      <span className="font-medium">${displaySeats.tech * seatBreakdown.techPriceDollars}/month</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Monthly total:</span>
                      <span>
                        ${(displaySeats.manager * seatBreakdown.managerPriceDollars) + (displaySeats.tech * seatBreakdown.techPriceDollars)}/month
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            {desiredSeats && desiredSeats.manager < 1 && (
              <p className="text-sm text-amber-600 text-center w-full">
                At least 1 Manager/Admin seat is required to complete checkout
              </p>
            )}
            <Button
              onClick={handleSetupBilling}
              disabled={
                checkoutMutation.isPending ||
                // Allow checkout if: desiredSeats has manager >= 1, OR existing purchased has manager >= 1
                (desiredSeats ? desiredSeats.manager < 1 : (seatBreakdown?.purchased?.manager ?? 0) < 1)
              }
              className="w-full"
              size="lg"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Complete Checkout
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Payment Form */}
      {clientSecret && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>
              Enter your payment details to complete your subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BillingForm seatBreakdown={seatBreakdown} />
            </Elements>
          </CardContent>
        </Card>
      )}

      {/* Pricing Info */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="font-semibold mb-1">Manager/Admin</div>
              <div className="text-2xl font-bold">${seatBreakdown.managerPriceDollars}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
              <p className="text-sm text-muted-foreground mt-1">Full access + user management</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-semibold mb-1">Technician</div>
              <div className="text-2xl font-bold">${seatBreakdown.techPriceDollars}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
              <p className="text-sm text-muted-foreground mt-1">Work orders & equipment access</p>
            </div>
            <div className="rounded-lg border p-4 border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <div className="font-semibold mb-1 flex items-center gap-2">
                Troubleshooting
                <Badge variant="default" className="text-xs">New</Badge>
              </div>
              <div className="text-2xl font-bold">${seatBreakdown.troubleshootingPriceDollars}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
              <p className="text-sm text-muted-foreground mt-1">RCA & Troubleshooting tools only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
