import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Wrench,
  Package,
  Settings,
  ClipboardList,
  Calendar,
  Clock,
  MessageSquare,
  Lightbulb,
  Cpu,
  GraduationCap,
  BarChart3,
  Building2,
  Users,
  CreditCard,
  Camera,
  Trophy,
  Plug,
  Key,
  History,
  CircleCheck,
  ClipboardCheck,
  Target,
  Brush,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import logoUrl from "@assets/C4 Logo-Clean (1)_1762187643543.png";
import type { Company } from "@shared/schema";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: company } = useQuery<Company>({
    queryKey: user?.companyId ? ["/api/companies", user.companyId] : undefined,
    enabled: !!user?.companyId,
  });
  
  const packageType = company?.packageType || "demo";
  const isPlatformAdmin = user?.platformRole === "platform_admin";
  // When simulating a restricted package, apply restrictions even for platform admins
  const isSimulatingRestrictedPackage = isPlatformAdmin && packageType === "troubleshooting";

  const generalItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "My Work",
      url: "/my-work",
      icon: Wrench,
      roles: ["manager", "tech"],
    },
    {
      title: "Equipment",
      url: "/equipment",
      icon: Settings,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Work Orders",
      url: "/work-orders",
      icon: ClipboardList,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Parts Inventory",
      url: "/inventory",
      icon: Package,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Operations",
      url: "/operations",
      icon: CircleCheck,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "QA Dashboard",
      url: "/qa-dashboard",
      icon: ClipboardCheck,
      roles: ["admin", "manager"],
    },
    {
      title: "CILR Studio",
      url: "/cilr-studio",
      icon: Brush,
      roles: ["admin", "manager"],
    },
    {
      title: "Centerlining Studio",
      url: "/centerlining-studio",
      icon: Target,
      roles: ["admin", "manager"],
    },
    {
      title: "Preventative Maintenance",
      url: "/pm-schedules",
      icon: Calendar,
      roles: ["admin", "manager"],
    },
  ];

  const rcaOracleItems = [
    {
      title: "Root Cause Analysis",
      url: "/rca",
      icon: Lightbulb,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Downtime Analysis",
      url: "/downtime",
      icon: Clock,
      roles: ["admin", "manager"],
    },
  ];

  const analysisItems = [
    {
      title: "Part Finder",
      url: "/image-search",
      icon: Camera,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Troubleshooting",
      url: "/troubleshooting",
      icon: MessageSquare,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "C4 Planner",
      url: "/c4-planner",
      icon: Cpu,
      roles: ["admin", "manager"],
    },
  ];

  const learningItems = [
    {
      title: "Path to Excellence",
      url: "/excellence-path",
      icon: Trophy,
      roles: ["admin", "manager", "tech"],
    },
    {
      title: "Interviews",
      url: "/interviews",
      icon: MessageSquare,
      roles: ["admin", "manager"],
    },
    {
      title: "Assessment History",
      url: "/assessment-history",
      icon: History,
      roles: ["admin", "manager"],
    },
    {
      title: "C4 University",
      url: "/training",
      icon: GraduationCap,
      roles: ["admin", "manager", "tech"],
    },
  ];

  const adminItems = [
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      roles: ["admin", "manager"],
    },
    {
      title: "Integrations",
      url: "/integrations",
      icon: Plug,
      roles: ["admin", "manager"],
    },
    {
      title: "Billing",
      url: "/billing",
      icon: CreditCard,
      roles: ["admin"],
    },
    {
      title: "Access Keys",
      url: "/admin/access-keys",
      icon: Key,
      roles: ["admin"],
      platformAdminOnly: true,
    },
    {
      title: "Signup Requests",
      url: "/admin/signup-requests",
      icon: Key,
      roles: ["admin"],
      platformAdminOnly: true,
    },
    {
      title: "Companies",
      url: "/admin/companies",
      icon: Building2,
      roles: ["admin"],
      platformAdminOnly: true,
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
      roles: ["admin", "manager"],
    },
  ];

  const filterByRole = (items: any[], section?: string) => {
    if (!user) return [];
    return items.filter((item) => {
      const hasRole = item.roles.includes(user.role);
      if (item.platformAdminOnly) {
        return hasRole && user.platformRole === "platform_admin";
      }
      
      // Platform admins bypass package restrictions UNLESS actively simulating
      if (isPlatformAdmin && !isSimulatingRestrictedPackage) {
        return hasRole;
      }
      
      // Troubleshooting package only allows the Troubleshooting portal
      if (packageType === "troubleshooting") {
        const allowedUrls = ["/troubleshooting"];
        if (!allowedUrls.includes(item.url)) {
          return false;
        }
      }
      
      return hasRole;
    });
  };
  
  // Check if any items would be visible for troubleshooting tier
  const showSection = (section: string) => {
    // Platform admins see all sections unless simulating restricted package
    if (isPlatformAdmin && !isSimulatingRestrictedPackage) return true;
    if (packageType === "troubleshooting") {
      // Only show Analysis section (for Troubleshooting page) for troubleshooting tier
      return section === "analysis";
    }
    return true;
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="C4 Industrial" className="w-8 h-8 object-contain" />
          <div>
            <h2 className="text-base font-semibold text-sidebar-foreground">MaintenanceHub</h2>
            <p className="text-xs text-muted-foreground">Industrial Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {showSection("operations") && filterByRole(generalItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(generalItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showSection("rcaOracle") && filterByRole(rcaOracleItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>RCA Oracle</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(rcaOracleItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showSection("analysis") && (filterByRole(analysisItems).length > 0 || filterByRole(learningItems).length > 0) && (
          <SidebarGroup>
            <SidebarGroupLabel>Analysis & Learning</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(analysisItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {filterByRole(learningItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showSection("admin") && filterByRole(adminItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filterByRole(adminItems).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
