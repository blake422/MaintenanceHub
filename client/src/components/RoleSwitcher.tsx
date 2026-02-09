import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Shield, User, Users, ChevronDown, Wrench } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

export function RoleSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch company to check current package simulation
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/companies", user?.companyId ?? "none"],
    enabled: !!user?.companyId,
  });

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: "admin" | "manager" | "tech") => {
      const response = await apiRequest("POST", "/api/auth/switch-role", { role: newRole });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Role Switched",
        description: `You are now viewing as ${data.role}`,
      });
      window.location.reload(); // Reload to update sidebar permissions
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch role",
        variant: "destructive",
      });
    },
  });

  const switchPackageMutation = useMutation({
    mutationFn: async (packageType: string | null) => {
      const response = await apiRequest("POST", "/api/auth/switch-package", { packageType });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all queries to ensure fresh data after package change
      queryClient.invalidateQueries();
      toast({
        title: "Package Simulation Changed",
        description: data.packageType 
          ? `Now simulating ${data.packageType} tier` 
          : "Simulation disabled - viewing as full access",
      });
      // Force full page reload to ensure all components re-render with new permissions
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch package simulation",
        variant: "destructive",
      });
    },
  });

  // Only show role switcher for platform admins
  if (!user || user.platformRole !== "platform_admin") return null;

  const roleConfig = {
    admin: {
      icon: Shield,
      label: "Admin",
      variant: "default" as const,
      description: "Full system access",
    },
    manager: {
      icon: Users,
      label: "Manager",
      variant: "secondary" as const,
      description: "Team oversight",
    },
    tech: {
      icon: User,
      label: "Tech",
      variant: "outline" as const,
      description: "Technician view",
    },
  };

  const packageConfig = {
    troubleshooting: {
      icon: Wrench,
      label: "Troubleshooting Only",
      variant: "outline" as const,
      description: "RCA & Troubleshooting tier",
    },
  };

  const currentRole = (user.role || "tech") as "admin" | "manager" | "tech";
  const RoleIcon = roleConfig[currentRole].icon;
  const simulatedPackage = company?.packageType === "troubleshooting" ? "troubleshooting" : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-role-switcher">
          {simulatedPackage ? (
            <>
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Troubleshooting</span>
            </>
          ) : (
            <>
              <RoleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{roleConfig[currentRole].label}</span>
            </>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon;
          const isActive = currentRole === role && !simulatedPackage;
          
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => {
                // Clear package simulation when switching roles
                if (simulatedPackage) {
                  switchPackageMutation.mutate(null);
                }
                switchRoleMutation.mutate(role as "admin" | "manager" | "tech");
              }}
              disabled={switchRoleMutation.isPending || switchPackageMutation.isPending || isActive}
              className="cursor-pointer"
              data-testid={`menu-item-role-${role}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{config.label}</span>
                  {isActive && (
                    <Badge variant={config.variant} className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Simulate Package Tier</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => switchPackageMutation.mutate("troubleshooting")}
          disabled={switchPackageMutation.isPending || simulatedPackage === "troubleshooting"}
          className="cursor-pointer"
          data-testid="menu-item-package-troubleshooting"
        >
          <Wrench className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span>Troubleshooting Only</span>
              {simulatedPackage === "troubleshooting" && (
                <Badge variant="outline" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">RCA & Troubleshooting tier ($20/mo)</p>
          </div>
        </DropdownMenuItem>
        
        {simulatedPackage && (
          <DropdownMenuItem
            onClick={() => switchPackageMutation.mutate(null)}
            disabled={switchPackageMutation.isPending}
            className="cursor-pointer"
            data-testid="menu-item-package-clear"
          >
            <Shield className="h-4 w-4 mr-2" />
            <div className="flex-1">
              <span>Clear Simulation</span>
              <p className="text-xs text-muted-foreground">Return to full access</p>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
