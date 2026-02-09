import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import MyWork from "@/pages/my-work";
import Equipment from "@/pages/equipment";
import EquipmentImport from "@/pages/equipment-import";
import WorkOrders from "@/pages/work-orders";
import Inventory from "@/pages/inventory";
import ImageSearch from "@/pages/image-search";
import PMSchedules from "@/pages/pm-schedules";
import Integrations from "@/pages/integrations";
import Downtime from "@/pages/downtime";
import RCA from "@/pages/rca";
import Troubleshooting from "@/pages/troubleshooting";
import C4Planner from "@/pages/ai-planner";
import Training from "@/pages/training";
import ExcellencePath from "@/pages/excellence-path";
import Interviews from "@/pages/interviews";
import AssessmentHistory from "@/pages/assessment-history";
import Reports from "@/pages/reports";
import AdminCompanies from "@/pages/admin-companies";
import AdminAccessKeys from "@/pages/admin-access-keys";
import AdminSignupRequests from "@/pages/admin-signup-requests";
import ResetPassword from "@/pages/reset-password";
import Users from "@/pages/users";
import Billing from "@/pages/billing";
import Operations from "@/pages/operations";
import QADashboard from "@/pages/qa-dashboard";
import CilrStudio from "@/pages/cilr-studio";
import CenterliningStudio from "@/pages/centerlining-studio";
import CilrRun from "@/pages/cilr-run";
import CenterliningRun from "@/pages/centerlining-run";
import NotFound from "@/pages/not-found";
import type { Company } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/" component={Dashboard} />
      <Route path="/my-work" component={MyWork} />
      <Route path="/equipment" component={Equipment} />
      <Route path="/equipment/import" component={EquipmentImport} />
      <Route path="/work-orders" component={WorkOrders} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/image-search" component={ImageSearch} />
      <Route path="/pm-schedules" component={PMSchedules} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/downtime" component={Downtime} />
      <Route path="/rca" component={RCA} />
      <Route path="/troubleshooting" component={Troubleshooting} />
      <Route path="/c4-planner" component={C4Planner} />
      <Route path="/ai-planner">
        {() => { window.location.href = "/c4-planner"; return null; }}
      </Route>
      <Route path="/training" component={Training} />
      <Route path="/excellence-path" component={ExcellencePath} />
      <Route path="/interviews" component={Interviews} />
      <Route path="/assessment-history" component={AssessmentHistory} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin/companies" component={AdminCompanies} />
      <Route path="/admin/access-keys" component={AdminAccessKeys} />
      <Route path="/admin/signup-requests" component={AdminSignupRequests} />
      <Route path="/admin/users" component={Users} />
      <Route path="/billing" component={Billing} />
      <Route path="/operations" component={Operations} />
      <Route path="/qa-dashboard" component={QADashboard} />
      <Route path="/cilr-studio" component={CilrStudio} />
      <Route path="/centerlining-studio" component={CenterliningStudio} />
      <Route path="/cilr/run/:runId" component={CilrRun} />
      <Route path="/centerlining/run/:runId" component={CenterliningRun} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Fetch company data to check onboarding and subscription status
  const { data: company, isLoading: isCompanyLoading } = useQuery<Company>({
    queryKey: user?.companyId ? ["/api/companies", user.companyId] : undefined,
    enabled: !!user?.companyId,
  });

  // Check if user needs onboarding
  const needsOnboarding = !user?.companyId || (company && !company.onboardingCompleted);

  // Check if user needs to set up billing (subscription lockout)
  const isPlatformAdmin = user?.platformRole === 'platform_admin';
  const hasActiveSubscription = company?.subscriptionStatus === 'active' || company?.subscriptionStatus === 'trialing';
  const hasValidDemo = company?.packageType === 'demo' &&
    company?.demoExpiresAt &&
    new Date(company.demoExpiresAt) > new Date();

  // User needs billing if: not platform admin, has company, completed onboarding,
  // but no active subscription and no valid demo
  const needsBilling = !isPlatformAdmin &&
    company &&
    company.onboardingCompleted &&
    !hasActiveSubscription &&
    !hasValidDemo;

  // Troubleshooting tier users should go directly to troubleshooting page
  const isTroubleshootingTier = company?.packageType === "troubleshooting";

  // Handle redirects using useEffect to avoid state updates during render
  useEffect(() => {
    if (!isAuthenticated || isLoading || isCompanyLoading) return;

    // Priority 1: Onboarding (must complete before anything else)
    if (needsOnboarding && location !== "/onboarding") {
      setLocation("/onboarding");
      return;
    }

    // Priority 2: Billing lockout (after onboarding is complete)
    if (needsBilling && location !== "/billing") {
      setLocation("/billing");
      return;
    }

    // Priority 3: Troubleshooting tier users go directly to troubleshooting page
    if (isTroubleshootingTier && location === "/") {
      setLocation("/troubleshooting");
      return;
    }

    // If on onboarding but doesn't need it, go to home
    if (location === "/onboarding" && !needsOnboarding) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, isCompanyLoading, needsOnboarding, needsBilling, isTroubleshootingTier, location, setLocation]);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Allow reset-password page to be accessed without auth
    if (location.startsWith("/reset-password")) {
      return <ResetPassword />;
    }
    return <Landing />;
  }

  // If authenticated but URL has invitation token, show landing page
  // This handles the case where a user clicks an invitation link while already logged in
  const urlParams = new URLSearchParams(window.location.search);
  const hasInvitationToken = urlParams.has('token');
  if (hasInvitationToken && location === '/login') {
    return <Landing />;
  }

  // If on onboarding page, show without sidebar
  if (location === "/onboarding") {
    return <Onboarding />;
  }

  // If user needs billing setup (subscription lockout), show billing page with minimal header
  if (needsBilling && location === "/billing") {
    return (
      <div className="flex flex-col h-screen w-full">
        <header className="flex items-center justify-between p-4 border-b border-border bg-background">
          <div className="text-lg font-semibold">MaintenanceHub</div>
          <a
            href="/api/logout"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-logout"
          >
            Sign Out
          </a>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Billing />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as any}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <RoleSwitcher />
              <a
                href="/api/logout"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-logout"
              >
                Sign Out
              </a>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
