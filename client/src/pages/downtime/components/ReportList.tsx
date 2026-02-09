import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, Sparkles, TrendingDown } from "lucide-react";
import type { DowntimeReport } from "../types";
import { ReportCard } from "./ReportCard";

interface ReportListProps {
  reports: DowntimeReport[];
  isLoading: boolean;
  isArchiveTab: boolean;
  canManage: boolean;
  onSelectReport: (report: DowntimeReport) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenImportDialog: () => void;
}

export function ReportList({
  reports,
  isLoading,
  isArchiveTab,
  canManage,
  onSelectReport,
  onArchive,
  onUnarchive,
  onDelete,
  onOpenImportDialog,
}: ReportListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          {isArchiveTab ? (
            <>
              <Archive className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Archived Reports</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Archived reports will appear here
              </p>
            </>
          ) : (
            <>
              <TrendingDown className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analysis Reports</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Import downtime data (CSV, Excel, PDF, Word) to generate C4
                Powered analysis reports
              </p>
              {canManage && (
                <Button
                  onClick={onOpenImportDialog}
                  data-testid="button-generate-first"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Your First Report
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          isArchived={isArchiveTab}
          onSelect={onSelectReport}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
