import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Download, Loader2, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface TrainingCertificateProps {
  open: boolean;
  onClose: () => void;
  certificateType: "technical" | "leadership" | "master";
  completedModules: number;
  totalModules: number;
  totalPoints: number;
}

const CERTIFICATE_CONFIG = {
  technical: {
    title: "Technical Specialist Certification",
    description: "Industrial Maintenance Technical Training",
    color: "#3B82F6",
    badge: "Certified C4 Technical Specialist",
  },
  leadership: {
    title: "Leadership Excellence Certification", 
    description: "Maintenance Leadership & Management Training",
    color: "#8B5CF6",
    badge: "Certified C4 Maintenance Leader",
  },
  master: {
    title: "C4 Master Certification",
    description: "Complete Maintenance Excellence Training",
    color: "#F59E0B",
    badge: "Certified C4 Maintenance Master",
  },
};

export function TrainingCertificate({
  open,
  onClose,
  certificateType,
  completedModules,
  totalModules,
  totalPoints,
}: TrainingCertificateProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const config = CERTIFICATE_CONFIG[certificateType];
  const completionDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const recipientName = user 
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Participant"
    : "Participant";

  const generatePDF = async () => {
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

      doc.setDrawColor(config.color);
      doc.setLineWidth(3);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "S");
      
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.5);
      doc.rect(15, 15, pageWidth - 30, pageHeight - 30, "S");

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      const rgb = hexToRgb(config.color);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text("C4 UNIVERSITY", pageWidth / 2, 35, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(30, 30, 30);
      doc.text("CERTIFICATE", pageWidth / 2, 55, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(80, 80, 80);
      doc.text("OF ACHIEVEMENT", pageWidth / 2, 65, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("This certifies that", pageWidth / 2, 85, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.text(recipientName, pageWidth / 2, 100, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("has successfully completed the", pageWidth / 2, 115, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text(config.title, pageWidth / 2, 128, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(config.description, pageWidth / 2, 138, { align: "center" });

      const statsY = 155;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      
      doc.text(`Modules Completed: ${completedModules}/${totalModules}`, pageWidth / 2 - 50, statsY, { align: "center" });
      doc.text(`Total Points Earned: ${totalPoints}`, pageWidth / 2 + 50, statsY, { align: "center" });

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(50, 175, 130, 175);
      doc.line(pageWidth - 130, 175, pageWidth - 50, 175);

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text("Date of Completion", 90, 182, { align: "center" });
      doc.text("Director of Training", pageWidth - 90, 182, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text(completionDate, 90, 172, { align: "center" });
      doc.text("C4 University", pageWidth - 90, 172, { align: "center" });

      const certId = `C4-${certificateType.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Certificate ID: ${certId}`, pageWidth / 2, pageHeight - 15, { align: "center" });

      const fileName = `C4_${config.title.replace(/\s+/g, "_")}_${recipientName.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);

      toast({
        title: "Certificate Generated!",
        description: `Your ${config.title} has been downloaded.`,
      });

      onClose();
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" style={{ color: config.color }} />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            Congratulations on completing the {certificateType} training track!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card 
            className="border-2 overflow-hidden"
            style={{ borderColor: config.color + "40" }}
          >
            <div 
              className="h-2 w-full"
              style={{ backgroundColor: config.color }}
            />
            <CardContent className="pt-6 text-center space-y-4">
              <div 
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                style={{ backgroundColor: config.color + "20" }}
              >
                <Award className="w-8 h-8" style={{ color: config.color }} />
              </div>
              
              <div>
                <p className="text-lg font-semibold">{recipientName}</p>
                <p className="text-sm text-muted-foreground">{config.badge}</p>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-semibold">{completedModules}/{totalModules}</p>
                  <p className="text-muted-foreground">Modules</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{totalPoints}</p>
                  <p className="text-muted-foreground">Points</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-chart-3" />
                Completed on {completionDate}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button 
              className="flex-1" 
              onClick={generatePDF}
              disabled={generating}
              data-testid="button-download-certificate"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
