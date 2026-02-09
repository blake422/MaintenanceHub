import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Sparkles } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  onImport: () => void;
  isImporting: boolean;
  onFileTooLarge: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  selectedFile,
  onFileChange,
  onImport,
  isImporting,
  onFileTooLarge,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Downtime Analysis Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <Sparkles className="w-4 h-4" />
            <AlertTitle>C4 Powered Analysis</AlertTitle>
            <AlertDescription>
              Upload any format (CSV, Excel, PDF, Word) with downtime data. Our
              advanced analysis engine will automatically generate a
              comprehensive professional report with insights, patterns, root
              causes, and recommendations.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 25 * 1024 * 1024) {
                  onFileTooLarge();
                  e.target.value = "";
                  onFileChange(null);
                  return;
                }
                onFileChange(file);
              }}
              data-testid="input-import-file"
            />
            <p className="text-xs text-muted-foreground">
              Maximum file size: 25MB
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onFileChange(null);
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={onImport}
              disabled={!selectedFile || isImporting}
              data-testid="button-start-analysis"
            >
              {isImporting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
