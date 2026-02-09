import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Target } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Schematic } from "@shared/schema";

interface InteractiveSchematicProps {
  schematic: Schematic | null;
  open: boolean;
  onClose: () => void;
}

export function InteractiveSchematic({ schematic, open, onClose }: InteractiveSchematicProps) {
  const { toast } = useToast();
  const [correctParts, setCorrectParts] = useState<string[]>([]);
  const [lastClickedPart, setLastClickedPart] = useState<string | null>(null);
  const [isWrongClick, setIsWrongClick] = useState(false);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  if (!schematic) return null;

  // Parse parts array if it's a JSON string
  let parts: any[] = [];
  try {
    parts = typeof schematic.parts === 'string' 
      ? JSON.parse(schematic.parts) 
      : (schematic.parts || []);
  } catch (error) {
    console.error("Error parsing schematic parts:", error);
    parts = [];
  }
  
  const currentPart = parts[currentPartIndex];

  const handlePartClick = (partId: string) => {
    if (completed || correctParts.includes(partId)) return;

    setLastClickedPart(partId);

    // Check if this is the correct part
    if (partId === currentPart.id) {
      // Correct!
      const newCorrectParts = [...correctParts, partId];
      setCorrectParts(newCorrectParts);
      setIsWrongClick(false);
      setLastClickedPart(null);
      
      if (currentPartIndex < parts.length - 1) {
        setCurrentPartIndex(currentPartIndex + 1);
      } else {
        // All parts identified!
        completeSchematic(newCorrectParts);
      }
    } else {
      // Incorrect - show feedback but allow retry
      setIsWrongClick(true);
      setTimeout(() => {
        setIsWrongClick(false);
        setLastClickedPart(null);
      }, 1000);
    }
  };

  const completeSchematic = async (identifiedParts: string[]) => {
    const correctParts = identifiedParts.filter((id) =>
      parts.some((p: any) => p.id === id)
    );
    const percentage = Math.round((correctParts.length / parts.length) * 100);
    setScore(percentage);
    setCompleted(true);

    try {
      await apiRequest("POST", "/api/schematics/progress", {
        schematicId: schematic.id,
        identifiedParts: correctParts,
        completed: true,
        score: percentage,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/schematics/progress"] });

      toast({
        title: "Schematic Completed!",
        description: `You identified ${correctParts.length} out of ${parts.length} parts correctly (${percentage}%)`,
      });
    } catch (error) {
      console.error("Error saving schematic progress:", error);
    }
  };

  const handleReset = () => {
    setCorrectParts([]);
    setLastClickedPart(null);
    setIsWrongClick(false);
    setCurrentPartIndex(0);
    setCompleted(false);
    setScore(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const progress = ((currentPartIndex + (completed ? 1 : 0)) / parts.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{schematic.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">Click on parts to identify critical components</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completed
                ? `Completed: ${correctParts.length}/${parts.length} parts`
                : `Identify: ${currentPartIndex + 1}/${parts.length}`}
            </p>
          </div>

          {/* Instructions */}
          {!completed && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Find and click:</p>
                    <p className="text-lg text-primary">{currentPart.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactive Diagram */}
          <Card data-testid="schematic-diagram">
            <CardHeader>
              <CardTitle className="text-sm">Click on the parts to identify them</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted rounded-lg overflow-visible h-[600px] flex items-center justify-center">
                {/* Equipment Diagram Image */}
                {schematic.imageUrl ? (
                  <img
                    src={schematic.imageUrl}
                    alt={schematic.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Diagram visualization (Image would be displayed here)</p>
                  </div>
                )}

                {/* Clickable Parts - positioned absolutely over the image */}
                {parts.map((part: any) => {
                  const isCorrect = correctParts.includes(part.id);
                  const isCurrent = !completed && currentPart?.id === part.id;
                  const isWrong = lastClickedPart === part.id && isWrongClick;

                  return (
                    <button
                      key={part.id}
                      onClick={() => handlePartClick(part.id)}
                      data-testid={`part-${part.id}`}
                      className={`absolute w-12 h-12 rounded-full border-2 transition-all z-10 ${
                        isCorrect
                          ? "bg-chart-3/20 border-chart-3"
                          : isWrong
                          ? "bg-destructive/20 border-destructive"
                          : isCurrent
                          ? "bg-primary/20 border-primary animate-pulse"
                          : "bg-background/80 border-border hover-elevate"
                      }`}
                      style={{
                        left: `${part.x}%`,
                        top: `${part.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      disabled={completed || isCorrect}
                    >
                      {isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-chart-3 mx-auto" />
                      )}
                      {isWrong && (
                        <XCircle className="w-5 h-5 text-destructive mx-auto" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Parts Legend */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {parts.map((part: any, index: number) => {
                  const isIdentified = correctParts.includes(part.id);
                  return (
                    <div
                      key={part.id}
                      className="flex items-center gap-2 p-2 rounded bg-muted/50"
                    >
                      <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>
                      <span className={`text-sm flex-1 ${isIdentified ? "" : "text-muted-foreground"}`}>
                        {part.name}
                      </span>
                      {isIdentified && (
                        <CheckCircle2 className="w-4 h-4 text-chart-3 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {completed && (
            <Card className="border-chart-3">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <CheckCircle2 className="w-12 h-12 text-chart-3 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{score}% Accuracy</p>
                    <p className="text-sm text-muted-foreground">
                      {correctParts.length} of {parts.length} parts identified
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handleClose} data-testid="button-close">
              {completed ? "Finish" : "Exit"}
            </Button>
            {completed && (
              <Button onClick={handleReset} data-testid="button-retry">
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
