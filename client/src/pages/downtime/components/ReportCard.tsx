import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { DowntimeReport } from "../types";

interface ReportCardProps {
  report: DowntimeReport;
  isArchived: boolean;
  onSelect: (report: DowntimeReport) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReportCard({
  report,
  isArchived,
  onSelect,
  onArchive,
  onUnarchive,
  onDelete,
}: ReportCardProps) {
  return (
    <Card data-testid={`card-report-${report.id}`}>
      <CardHeader
        className="cursor-pointer hover-elevate"
        onClick={() => onSelect(report)}
      >
        <div className="flex items-start justify-between mb-2">
          <FileText className="w-5 h-5 text-primary" />
          <Badge variant="outline">{report.fileType}</Badge>
        </div>
        <CardTitle className="text-lg truncate">{report.fileName}</CardTitle>
        <CardDescription>
          {report.createdAt ? format(new Date(report.createdAt), "MMM dd, yyyy 'at' h:mm a") : "Date unknown"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Records Analyzed:</span>
              <span className="font-semibold">{report.recordCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Downtime:</span>
              <span className="font-semibold">
                {report.totalDowntimeHours?.toFixed(1)} hrs
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Most Affected:</span>
              <span className="font-semibold truncate ml-2">
                {report.analysisData?.summary?.mostAffectedEquipment || "N/A"}
              </span>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            {isArchived ? (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchive(report.id);
                }}
                data-testid={`button-unarchive-${report.id}`}
              >
                <ArchiveRestore className="w-3 h-3 mr-1" />
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(report.id);
                }}
                data-testid={`button-archive-${report.id}`}
              >
                <Archive className="w-3 h-3 mr-1" />
                Move to Archive
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    "Are you sure you want to delete this report? This action cannot be undone."
                  )
                ) {
                  onDelete(report.id);
                }
              }}
              data-testid={`button-delete-${report.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
