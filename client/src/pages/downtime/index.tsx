import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, FileText, Upload } from "lucide-react";

// Import types
import type { DowntimeReport, BreakdownAnalysis } from "./types";

// Import hooks
import {
  useDowntimeReports,
  useGenerateAnalysisReport,
  useArchiveReport,
  useUnarchiveReport,
  useDeleteReport,
  useAnalyzeKeyFinding,
  useGenerateBreakdownAnalysis,
  useCreateWorkOrderFromAction,
  useActionChecklist,
} from "./hooks";

// Import components
import { ReportList } from "./components/ReportList";
import { ReportDetailView } from "./components/ReportDetailView";
import { ImportDialog } from "./components/ImportDialog";

export default function DowntimePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Tab and dialog state
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedReport, setSelectedReport] = useState<DowntimeReport | null>(null);
  const [creatingWorkOrderForAction, setCreatingWorkOrderForAction] = useState<string | null>(null);

  // Check permissions
  const canManage = user?.role === "admin" || user?.role === "manager";

  // Fetch reports
  const { data: reports = [], isLoading } = useDowntimeReports(user?.id);

  // Filter reports by archive status
  const activeReports = reports.filter((r) => !r.archived);
  const archivedReports = reports.filter((r) => r.archived);
  const displayedReports = activeTab === "active" ? activeReports : archivedReports;

  // Mutations
  const generateAnalysisReport = useGenerateAnalysisReport(toast, () => {
    setShowImportDialog(false);
    setSelectedFile(null);
  });

  const archiveReport = useArchiveReport(toast);
  const unarchiveReport = useUnarchiveReport(toast);
  const deleteReport = useDeleteReport(toast);

  const analyzeKeyFinding = useAnalyzeKeyFinding(selectedReport, toast, () => {});
  const generateBreakdownAnalysis = useGenerateBreakdownAnalysis(
    selectedReport,
    toast,
    () => {}
  );
  const createWorkOrderFromAction = useCreateWorkOrderFromAction(
    toast,
    setCreatingWorkOrderForAction
  );

  // Action checklist hook
  const {
    actionChecklist,
    setActionChecklist,
    showActionChecklist,
    setShowActionChecklist,
    addActionsFromBreakdown,
    toggleActionStatus,
    removeAction,
    clearChecklist,
  } = useActionChecklist(toast);

  // Handle file import
  const handleImport = () => {
    if (selectedFile) {
      generateAnalysisReport.mutate(selectedFile);
    }
  };

  // If a report is selected, show the detail view
  if (selectedReport) {
    return (
      <ReportDetailView
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        toast={toast}
        analyzeKeyFinding={analyzeKeyFinding}
        generateBreakdownAnalysis={generateBreakdownAnalysis}
        actionChecklist={actionChecklist}
        setActionChecklist={setActionChecklist}
        showActionChecklist={showActionChecklist}
        setShowActionChecklist={setShowActionChecklist}
        addActionsFromBreakdown={addActionsFromBreakdown}
        toggleActionStatus={toggleActionStatus}
        removeAction={removeAction}
        clearChecklist={clearChecklist}
        createWorkOrderFromAction={createWorkOrderFromAction}
        creatingWorkOrderForAction={creatingWorkOrderForAction}
      />
    );
  }

  // Main list view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold">Downtime Analysis Reports</h1>
          <p className="text-sm text-muted-foreground">
            C4 Powered downtime analysis from imported data
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowImportDialog(true)} data-testid="button-import">
            <Upload className="w-4 h-4 mr-2" />
            Generate New Report
          </Button>
        )}
      </div>

      {/* Tabs for Active/Archive */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "active" | "archive")}
        className="flex-1 flex flex-col"
      >
        <div className="border-b px-6">
          <TabsList className="h-12">
            <TabsTrigger value="active" className="gap-2" data-testid="tab-active-reports">
              <FileText className="w-4 h-4" />
              Active Reports ({activeReports.length})
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2" data-testid="tab-archived-reports">
              <Archive className="w-4 h-4" />
              Archive ({archivedReports.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 overflow-auto p-6 mt-0">
          <ReportList
            reports={displayedReports}
            isLoading={isLoading}
            isArchiveTab={activeTab === "archive"}
            canManage={canManage}
            onSelectReport={setSelectedReport}
            onArchive={(id) => archiveReport.mutate(id)}
            onUnarchive={(id) => unarchiveReport.mutate(id)}
            onDelete={(id) => deleteReport.mutate(id)}
            onOpenImportDialog={() => setShowImportDialog(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        onImport={handleImport}
        isImporting={generateAnalysisReport.isPending}
        onFileTooLarge={() =>
          toast({
            title: "File Too Large",
            description:
              "Please select a file smaller than 25MB. For larger files, try splitting the data into smaller chunks.",
            variant: "destructive",
          })
        }
      />
    </div>
  );
}
