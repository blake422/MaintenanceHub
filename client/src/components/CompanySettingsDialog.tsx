import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, Loader2, Package } from "lucide-react";
import type { Company } from "@shared/schema";

interface CompanySettingsDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Available modules in the system
const ALL_MODULES = [
  { id: "dashboard", name: "Dashboard", description: "Overview and analytics" },
  { id: "equipment", name: "Equipment Management", description: "Asset tracking and QR codes" },
  { id: "work_orders", name: "Work Orders", description: "Task management and tracking" },
  { id: "inventory", name: "Parts Inventory", description: "Spare parts management" },
  { id: "pm_schedules", name: "PM Schedules", description: "Preventive maintenance" },
  { id: "downtime", name: "Downtime Analysis", description: "AI-powered downtime reports" },
  { id: "rca", name: "RCA Oracle", description: "Root cause analysis" },
  { id: "troubleshooting", name: "Troubleshooting", description: "6-step diagnostic process" },
  { id: "ai_planner", name: "C4 Planner", description: "AI maintenance planning" },
  { id: "training", name: "C4 University", description: "Training and certifications" },
  { id: "reports", name: "Reports", description: "Analytics and insights" },
];

// Package configurations (per-user pricing)
const PACKAGES = {
  full_access: {
    name: "Full Access",
    price: 100,
    description: "All modules included - For Managers & Admins",
    modules: ALL_MODULES.map(m => m.id),
  },
  operations: {
    name: "Operations",
    price: 50,
    description: "Core operations modules - For Technicians",
    modules: ["dashboard", "equipment", "work_orders", "inventory", "pm_schedules", "rca", "troubleshooting", "ai_planner"],
  },
  demo: {
    name: "Demo",
    price: 0,
    description: "30-day free trial",
    modules: ALL_MODULES.map(m => m.id),
  },
};

export function CompanySettingsDialog({ company, open, onOpenChange }: CompanySettingsDialogProps) {
  const { toast } = useToast();
  const [packageType, setPackageType] = useState<"full_access" | "operations" | "demo">("demo");
  const [isLive, setIsLive] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  // Initialize state when company changes
  useEffect(() => {
    if (company && open) {
      setPackageType(company.packageType || "demo");
      setIsLive(company.isLive || false);
      // Use nullish coalescing to preserve intentionally empty module arrays
      setEnabledModules(company.enabledModules ?? PACKAGES[company.packageType || "demo"].modules);
    }
  }, [company, open]);

  // Handle package type changes by admin (but not on initial load)
  const handlePackageChange = (newPackageType: "full_access" | "operations" | "demo") => {
    setPackageType(newPackageType);
    // Only reset modules to package defaults when admin actively changes the package
    setEnabledModules(PACKAGES[newPackageType].modules);
  };

  const updatePackageMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const response = await apiRequest("PUT", `/api/companies/${company.id}/package`, {
        packageType,
        isLive,
        enabledModules,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Company package settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company settings",
        variant: "destructive",
      });
    },
  });

  const handleToggleModule = (moduleId: string) => {
    setEnabledModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const getDaysRemaining = () => {
    if (!company?.demoExpiresAt || isLive) return null;
    const now = new Date();
    const expiration = new Date(company.demoExpiresAt);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-company-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Settings: {company?.name}
          </DialogTitle>
          <DialogDescription>
            Configure subscription package and module permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Live/Demo Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Environment</CardTitle>
              <CardDescription>
                {isLive ? "Production environment" : "Demo environment for beta testing"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="is-live" className="text-sm font-medium">
                    {isLive ? "Live Version" : "Demo Version"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isLive ? "Billing active" : "Free 30-day trial for beta testing"}
                  </p>
                  {!isLive && daysRemaining !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {daysRemaining} days remaining
                      </span>
                    </div>
                  )}
                </div>
                <Switch
                  id="is-live"
                  checked={isLive}
                  onCheckedChange={setIsLive}
                  data-testid="switch-is-live"
                />
              </div>
            </CardContent>
          </Card>

          {/* Package Selection */}
          {isLive && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription Package</CardTitle>
                <CardDescription>
                  Select the package tier for this company
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={packageType} onValueChange={(value: any) => handlePackageChange(value)}>
                  <div className="space-y-3">
                    {/* Full Access Package */}
                    <div className="flex items-center space-x-3 border rounded-lg p-4 hover-elevate" data-testid="radio-package-full-access">
                      <RadioGroupItem value="full_access" id="full_access" />
                      <Label htmlFor="full_access" className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {PACKAGES.full_access.name}
                              <Badge variant="default">
                                <Package className="h-3 w-3 mr-1" />
                                Premium
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {PACKAGES.full_access.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${PACKAGES.full_access.price}</div>
                            <div className="text-xs text-muted-foreground">per user/month</div>
                          </div>
                        </div>
                      </Label>
                    </div>

                    {/* Operations Package */}
                    <div className="flex items-center space-x-3 border rounded-lg p-4 hover-elevate" data-testid="radio-package-operations">
                      <RadioGroupItem value="operations" id="operations" />
                      <Label htmlFor="operations" className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{PACKAGES.operations.name}</div>
                            <p className="text-sm text-muted-foreground">
                              {PACKAGES.operations.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${PACKAGES.operations.price}</div>
                            <div className="text-xs text-muted-foreground">per user/month</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Module Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enabled Modules</CardTitle>
              <CardDescription>
                {isLive 
                  ? `Modules included in ${PACKAGES[packageType].name} package`
                  : "All modules available during demo period"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_MODULES.map((module) => {
                  const isIncluded = PACKAGES[packageType].modules.includes(module.id);
                  const isEnabled = enabledModules.includes(module.id);

                  return (
                    <div
                      key={module.id}
                      className={`flex items-start space-x-3 border rounded-lg p-3 ${
                        isEnabled ? "bg-accent/50" : ""
                      }`}
                      data-testid={`module-${module.id}`}
                    >
                      <Checkbox
                        id={module.id}
                        checked={isEnabled}
                        onCheckedChange={() => handleToggleModule(module.id)}
                        disabled={!isIncluded}
                      />
                      <Label htmlFor={module.id} className="flex-1 cursor-pointer space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{module.name}</span>
                          {isEnabled && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {module.description}
                        </p>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-settings"
          >
            Cancel
          </Button>
          <Button
            onClick={() => updatePackageMutation.mutate()}
            disabled={updatePackageMutation.isPending}
            data-testid="button-save-settings"
          >
            {updatePackageMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
