import { useQuery } from "@tanstack/react-query";
import type { DowntimeReport } from "../types";

/**
 * Hook to fetch all downtime reports
 */
export function useDowntimeReports(userId: string | undefined) {
  return useQuery<DowntimeReport[]>({
    queryKey: ["/api/downtime/reports"],
    enabled: !!userId,
  });
}
