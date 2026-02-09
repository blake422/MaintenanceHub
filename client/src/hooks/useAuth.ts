import { useQuery } from "@tanstack/react-query";
import type { UserWithCompany } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<UserWithCompany>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isManager: user?.role === "manager",
    isTech: user?.role === "tech",
    canManage: user?.role === "admin" || user?.role === "manager",
  };
}
