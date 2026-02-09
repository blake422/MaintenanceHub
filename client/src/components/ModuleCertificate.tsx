import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { TrainingModule, TrainingProgress } from "@shared/schema";

interface ModuleCertificateProps {
  module: TrainingModule;
  progress: TrainingProgress;
  variant?: "icon" | "full";
}

export function ModuleCertificate({ module, progress, variant = "icon" }: ModuleCertificateProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const recipientName = user 
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Participant"
    : "Participant";

  const completionDate = progress.completedAt 
    ? new Date(progress.completedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const moduleColor = module.title.toLowerCase().includes("leadership") || 
                      module.title.toLowerCase().includes("communication") ||
                      module.title.toLowerCase().includes("supervisor")
    ? "#8B5CF6" 
    : "#3B82F6";

  const generatePDF = async () => {
    if (!progress.completed) return;
    
    setGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(250, 250, 252);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      const rgb = hexToRgb(moduleColor);

      doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      doc.setLineWidth(3);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "S");
      
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.5);
      doc.rect(15, 15, pageWidth - 30, pageHeight - 30, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text("C4 UNIVERSITY", pageWidth / 2, 32, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.setTextColor(30, 30, 30);
      doc.text("CERTIFICATE OF COMPLETION", pageWidth / 2, 50, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("This certifies that", pageWidth / 2, 72, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.text(recipientName, pageWidth / 2, 88, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("has successfully completed the training module", pageWidth / 2, 103, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      const titleLines = doc.splitTextToSize(module.title, pageWidth - 60);
      doc.text(titleLines, pageWidth / 2, 118, { align: "center" });

      const descY = 118 + (titleLines.length * 8);
      if (module.description) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const descLines = doc.splitTextToSize(module.description, pageWidth - 80);
        doc.text(descLines.slice(0, 2), pageWidth / 2, descY + 5, { align: "center" });
      }

      const statsY = 152;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      
      const score = progress.score || 0;
      const points = progress.pointsEarned || 0;
      const duration = module.durationMinutes || 30;
      
      doc.text(`Score: ${score}%`, pageWidth / 2 - 60, statsY, { align: "center" });
      doc.text(`Points Earned: ${points}`, pageWidth / 2, statsY, { align: "center" });
      doc.text(`Duration: ${duration} min`, pageWidth / 2 + 60, statsY, { align: "center" });

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(50, 172, 130, 172);
      doc.line(pageWidth - 130, 172, pageWidth - 50, 172);

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text("Date of Completion", 90, 179, { align: "center" });
      doc.text("Director of Training", pageWidth - 90, 179, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text(completionDate, 90, 169, { align: "center" });
      doc.text("C4 University", pageWidth - 90, 169, { align: "center" });

      const certId = `C4-MOD-${module.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Certificate ID: ${certId}`, pageWidth / 2, pageHeight - 15, { align: "center" });

      const fileName = `C4_Module_${module.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}_${recipientName.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);

      toast({
        title: "Certificate Generated!",
        description: `Your certificate for "${module.title}" has been downloaded.`,
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast({
        title: "Error",
        description: "Failed to generate certificate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!progress.completed) {
    return null;
  }

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          generatePDF();
        }}
        disabled={generating}
        className="h-8 w-8"
        title="Download Module Certificate"
        data-testid={`button-download-certificate-${module.id}`}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Award className="h-4 w-4 text-amber-500" />
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        generatePDF();
      }}
      disabled={generating}
      variant="outline"
      size="sm"
      className="gap-2"
      data-testid={`button-download-certificate-full-${module.id}`}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Certificate
    </Button>
  );
}
