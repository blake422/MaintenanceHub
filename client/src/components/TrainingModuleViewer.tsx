import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Trophy, Play, Video } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TrainingModule } from "@shared/schema";

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

interface VideoPlayerProps {
  videoUrl: string;
  videoProvider: "youtube" | "vimeo" | "direct" | null;
  title?: string;
}

function VideoPlayer({ videoUrl, videoProvider, title }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);

  if (!videoUrl) return null;

  if (hasError) {
    return (
      <div className="bg-muted rounded-lg p-8 text-center">
        <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Unable to load video</p>
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          Open video in new tab
        </a>
      </div>
    );
  }

  if (videoProvider === "youtube" || (!videoProvider && videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"))) {
    const videoId = getYouTubeVideoId(videoUrl);
    if (videoId) {
      return (
        <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0`}
            title={title || "Training Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            onError={() => setHasError(true)}
            data-testid="video-player-youtube"
          />
        </AspectRatio>
      );
    }
  }

  if (videoProvider === "vimeo" || (!videoProvider && videoUrl.includes("vimeo.com"))) {
    const videoId = getVimeoVideoId(videoUrl);
    if (videoId) {
      return (
        <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            title={title || "Training Video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            onError={() => setHasError(true)}
            data-testid="video-player-vimeo"
          />
        </AspectRatio>
      );
    }
  }

  return (
    <AspectRatio ratio={16 / 9} className="bg-black rounded-lg overflow-hidden">
      <video
        src={videoUrl}
        controls
        className="w-full h-full object-contain"
        onError={() => setHasError(true)}
        data-testid="video-player-direct"
      >
        Your browser does not support the video tag.
      </video>
    </AspectRatio>
  );
}

interface TrainingModuleViewerProps {
  module: TrainingModule | null;
  open: boolean;
  onClose: () => void;
}

export function TrainingModuleViewer({ module, open, onClose }: TrainingModuleViewerProps) {
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  // State for interactive scenario decision points
  const [scenarioAnswers, setScenarioAnswers] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  if (!module || !module.content) return null;

  // Parse JSON content string
  let content: any = {};
  try {
    content = typeof module.content === 'string' ? JSON.parse(module.content) : module.content;
  } catch (error) {
    console.error("Error parsing module content:", error);
    return null;
  }
  
  const sections = content.sections || [];
  const scenarios = content.scenarios || [];
  const quiz = content.quiz || [];
  
  // Build a combined list: sections first, then scenarios, then quiz
  const totalContentSections = sections.length + (scenarios.length > 0 ? 1 : 0);
  const isOnScenarios = currentSection === sections.length && scenarios.length > 0;

  const handleNext = () => {
    if (currentSection < totalContentSections - 1) {
      setCurrentSection(currentSection + 1);
    } else {
      setShowQuiz(true);
    }
  };

  const handlePrevious = () => {
    if (showQuiz) {
      setShowQuiz(false);
      setQuizAnswers({});
      setQuizSubmitted(false);
    } else if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleQuizSubmit = async () => {
    let correctCount = 0;
    quiz.forEach((question: any, index: number) => {
      if (quizAnswers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    const percentage = Math.round((correctCount / quiz.length) * 100);
    setScore(percentage);
    setQuizSubmitted(true);

    // Save progress if passed (70% or higher)
    if (percentage >= 70) {
      try {
        await apiRequest("POST", "/api/training/progress", {
          moduleId: module.id,
          completed: true,
          score: percentage,
          attempts: 1,
          pointsEarned: Math.round((percentage / 100) * (module.points || 0)),
        });

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/training/progress"] });
        queryClient.invalidateQueries({ queryKey: ["/api/badges/user"] });

        toast({
          title: "C4 University Module Completed!",
          description: `You scored ${percentage}% and earned ${Math.round((percentage / 100) * (module.points || 0))} points!`,
        });
      } catch (error) {
        console.error("Error saving progress:", error);
        toast({
          title: "Error",
          description: "Failed to save your progress. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRetry = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setScore(0);
  };

  const handleClose = () => {
    setCurrentSection(0);
    setShowQuiz(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setScore(0);
    setScenarioAnswers({});
    setRevealedAnswers({});
    onClose();
  };

  const progressPercentage = showQuiz
    ? 100
    : ((currentSection + 1) / totalContentSections) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{module.title}</span>
            <Badge variant="outline">
              <Trophy className="w-3 h-3 mr-1" />
              {module.points} pts
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {showQuiz
                ? "Quiz"
                : isOnScenarios
                ? "Interactive Scenario"
                : `Section ${currentSection + 1} of ${totalContentSections}`}
            </p>
          </div>

          {/* Content, Scenarios, or Quiz */}
          {!showQuiz && isOnScenarios ? (
            /* Interactive Scenarios Section */
            <Card data-testid="module-scenarios">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>🎯</span> Interactive Scenario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {scenarios.map((scenario: any, scenarioIdx: number) => {
                  return (
                    <div key={scenarioIdx} className="space-y-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <h3 className="text-lg font-bold">{scenario.title}</h3>
                      <p className="text-muted-foreground">{scenario.description}</p>
                      
                      <div>
                        <h4 className="font-semibold mb-1">Situation:</h4>
                        <p className="text-muted-foreground">{scenario.situation}</p>
                      </div>
                      
                      {scenario.symptoms && (
                        <div>
                          <h4 className="font-semibold mb-1">Symptoms Observed:</h4>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {scenario.symptoms.map((symptom: string, idx: number) => (
                              <li key={idx}>{symptom}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {scenario.measurements && (
                        <div>
                          <h4 className="font-semibold mb-1">Measurements:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(scenario.measurements).map(([key, value], idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium">{key}:</span>{" "}
                                <span className="text-muted-foreground">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {scenario.decisionPoints && scenario.decisionPoints.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold">Decision Points:</h4>
                          {scenario.decisionPoints.map((dp: any, idx: number) => {
                            const answerKey = `scenario-${scenarioIdx}-dp-${idx}`;
                            const isRevealed = revealedAnswers[answerKey];
                            const selectedAnswer = scenarioAnswers[answerKey];
                            const isCorrect = selectedAnswer === dp.correctAnswer;
                            
                            return (
                              <Card key={idx} data-testid={`scenario-decision-point-${scenarioIdx}-${idx}`}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Question {idx + 1}: {dp.question}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <RadioGroup
                                    value={selectedAnswer?.toString()}
                                    onValueChange={(value) => {
                                      if (!isRevealed) {
                                        setScenarioAnswers({ ...scenarioAnswers, [answerKey]: parseInt(value) });
                                      }
                                    }}
                                    disabled={isRevealed}
                                  >
                                    {dp.options.map((option: string, optIdx: number) => (
                                      <div
                                        key={optIdx}
                                        className={`flex items-center space-x-2 p-2 rounded ${
                                          isRevealed
                                            ? optIdx === dp.correctAnswer
                                              ? 'bg-chart-3/10 border border-chart-3'
                                              : selectedAnswer === optIdx && optIdx !== dp.correctAnswer
                                              ? 'bg-destructive/10 border border-destructive'
                                              : 'bg-muted'
                                            : 'bg-muted hover-elevate'
                                        }`}
                                      >
                                        <RadioGroupItem
                                          value={optIdx.toString()}
                                          id={`scenario-${answerKey}-${optIdx}`}
                                          data-testid={`scenario-${scenarioIdx}-option-${idx}-${optIdx}`}
                                        />
                                        <Label
                                          htmlFor={`scenario-${answerKey}-${optIdx}`}
                                          className="flex-1 cursor-pointer"
                                        >
                                          {isRevealed && optIdx === dp.correctAnswer && (
                                            <CheckCircle2 className="w-4 h-4 text-chart-3 inline mr-2" />
                                          )}
                                          {isRevealed && selectedAnswer === optIdx && optIdx !== dp.correctAnswer && (
                                            <XCircle className="w-4 h-4 text-destructive inline mr-2" />
                                          )}
                                          {option}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                  
                                  {!isRevealed ? (
                                    <Button
                                      size="sm"
                                      onClick={() => setRevealedAnswers({ ...revealedAnswers, [answerKey]: true })}
                                      disabled={selectedAnswer === undefined}
                                      data-testid={`check-scenario-answer-${scenarioIdx}-${idx}`}
                                    >
                                      Check Answer
                                    </Button>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className={`text-sm font-medium ${isCorrect ? 'text-chart-3' : 'text-destructive'}`}>
                                        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                      </div>
                                      <div className="text-sm text-muted-foreground italic">
                                        <strong>Explanation:</strong> {dp.explanation}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Only show solution and lessons learned after all decision points are answered */}
                      {scenario.decisionPoints && scenario.decisionPoints.every((_: any, idx: number) => 
                        revealedAnswers[`scenario-${scenarioIdx}-dp-${idx}`]
                      ) && (
                        <>
                          <div className="bg-chart-3/10 p-3 rounded">
                            <h4 className="font-semibold mb-1">Solution:</h4>
                            <p className="text-muted-foreground text-sm">{scenario.solution}</p>
                          </div>
                          
                          {scenario.lessonsLearned && (
                            <div>
                              <h4 className="font-semibold mb-1">Lessons Learned:</h4>
                              <ul className="list-disc list-inside text-muted-foreground text-sm">
                                {scenario.lessonsLearned.map((lesson: string, idx: number) => (
                                  <li key={idx}>{lesson}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : !showQuiz ? (
            <Card data-testid={`module-section-${currentSection}`}>
              <CardHeader>
                <CardTitle>{sections[currentSection]?.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Video Player - show on first section if module has video */}
                {currentSection === 0 && module.videoUrl && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Training Video</span>
                      {module.videoDurationSeconds && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.floor(module.videoDurationSeconds / 60)}:{String(module.videoDurationSeconds % 60).padStart(2, '0')}
                        </Badge>
                      )}
                    </div>
                    <VideoPlayer 
                      videoUrl={module.videoUrl} 
                      videoProvider={module.videoProvider} 
                      title={module.title}
                    />
                  </div>
                )}

                <p className="text-foreground leading-relaxed">
                  {sections[currentSection]?.content}
                </p>

                {/* Embedded Images */}
                {sections[currentSection].images && sections[currentSection].images.length > 0 && (
                  <div className="space-y-4">
                    {sections[currentSection].images.map((img: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-4 bg-card">
                        <img 
                          src={img.url} 
                          alt={img.alt || 'Training image'} 
                          className="w-full max-w-md mx-auto rounded-md"
                          loading="lazy"
                        />
                        {img.caption && (
                          <p className="text-sm text-muted-foreground mt-2 text-center italic">
                            {img.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {sections[currentSection].key_points && (
                  <div>
                    <h4 className="font-semibold mb-2">Key Points:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].key_points.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Procedures */}
                {sections[currentSection].procedures && (
                  <div>
                    <h4 className="font-semibold mb-2">Procedure:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].procedures.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Measurements */}
                {sections[currentSection].measurements && (
                  <div>
                    <h4 className="font-semibold mb-2">Critical Measurements:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].measurements.map((measurement: string, idx: number) => (
                        <li key={idx}>{measurement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Troubleshooting */}
                {sections[currentSection].troubleshooting && (
                  <div>
                    <h4 className="font-semibold mb-2">Troubleshooting Guide:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].troubleshooting.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {sections[currentSection].troubleshooting_steps && (
                  <div>
                    <h4 className="font-semibold mb-2">Troubleshooting Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].troubleshooting_steps.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Interactive Downtime Scenario */}
                {sections[currentSection].type === "downtime_scenario" && sections[currentSection].scenario && (
                  <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <h3 className="text-lg font-bold text-destructive">⚠️ Machinery Downtime Scenario</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold mb-1">Situation:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].scenario.situation}</p>
                      </div>
                      
                      {sections[currentSection].scenario.symptoms && (
                        <div>
                          <h4 className="font-semibold mb-1">Symptoms Observed:</h4>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {sections[currentSection].scenario.symptoms.map((symptom: string, idx: number) => (
                              <li key={idx}>{symptom}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {sections[currentSection].scenario.measurements && (
                        <div>
                          <h4 className="font-semibold mb-1">Measurements Taken:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(sections[currentSection].scenario.measurements).map(([key, value], idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium">{key}:</span>{" "}
                                <span className="text-muted-foreground">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {sections[currentSection].scenario.decisionPoints && sections[currentSection].scenario.decisionPoints.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold">Decision Points:</h4>
                          {sections[currentSection].scenario.decisionPoints.map((dp: any, idx: number) => {
                            const answerKey = `${currentSection}-scenario-${idx}`;
                            const isRevealed = revealedAnswers[answerKey];
                            const selectedAnswer = scenarioAnswers[answerKey];
                            const isCorrect = selectedAnswer === dp.correctAnswer;
                            
                            return (
                              <Card key={idx} data-testid={`decision-point-${idx}`}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Question {idx + 1}: {dp.question}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <RadioGroup
                                    value={selectedAnswer?.toString()}
                                    onValueChange={(value) => {
                                      if (!isRevealed) {
                                        setScenarioAnswers({ ...scenarioAnswers, [answerKey]: parseInt(value) });
                                      }
                                    }}
                                    disabled={isRevealed}
                                  >
                                    {dp.options.map((option: string, optIdx: number) => (
                                      <div
                                        key={optIdx}
                                        className={`flex items-center space-x-2 p-2 rounded ${
                                          isRevealed
                                            ? optIdx === dp.correctAnswer
                                              ? 'bg-chart-3/10 border border-chart-3'
                                              : selectedAnswer === optIdx && optIdx !== dp.correctAnswer
                                              ? 'bg-destructive/10 border border-destructive'
                                              : 'bg-muted'
                                            : 'bg-muted hover-elevate'
                                        }`}
                                      >
                                        <RadioGroupItem
                                          value={optIdx.toString()}
                                          id={`scenario-${answerKey}-${optIdx}`}
                                          data-testid={`scenario-option-${idx}-${optIdx}`}
                                        />
                                        <Label
                                          htmlFor={`scenario-${answerKey}-${optIdx}`}
                                          className="flex-1 cursor-pointer"
                                        >
                                          {isRevealed && optIdx === dp.correctAnswer && (
                                            <CheckCircle2 className="w-4 h-4 text-chart-3 inline mr-2" />
                                          )}
                                          {isRevealed && selectedAnswer === optIdx && optIdx !== dp.correctAnswer && (
                                            <XCircle className="w-4 h-4 text-destructive inline mr-2" />
                                          )}
                                          {option}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                  
                                  {!isRevealed ? (
                                    <Button
                                      size="sm"
                                      onClick={() => setRevealedAnswers({ ...revealedAnswers, [answerKey]: true })}
                                      disabled={selectedAnswer === undefined}
                                      data-testid={`check-answer-${idx}`}
                                    >
                                      Check Answer
                                    </Button>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className={`text-sm font-medium ${isCorrect ? 'text-chart-3' : 'text-destructive'}`}>
                                        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                      </div>
                                      <div className="text-sm text-muted-foreground italic">
                                        <strong>Explanation:</strong> {dp.explanation}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      
                      <div className="bg-chart-3/10 p-3 rounded">
                        <h4 className="font-semibold mb-1">Solution:</h4>
                        <p className="text-muted-foreground text-sm">{sections[currentSection].scenario.solution}</p>
                      </div>
                      
                      {sections[currentSection].scenario.lessonsLearned && (
                        <div>
                          <h4 className="font-semibold mb-1">Lessons Learned:</h4>
                          <ul className="list-disc list-inside text-muted-foreground text-sm">
                            {sections[currentSection].scenario.lessonsLearned.map((lesson: string, idx: number) => (
                              <li key={idx}>{lesson}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Interactive Case Study */}
                {sections[currentSection].type === "case_study" && sections[currentSection].caseStudy && (
                  <div className="space-y-4 p-4 bg-chart-2/5 border border-chart-2/20 rounded-lg">
                    <h3 className="text-lg font-bold text-chart-2">📋 Real-World Case Study: {sections[currentSection].caseStudy.title}</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold mb-1">Background:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].caseStudy.background}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-1">The Problem:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].caseStudy.problem}</p>
                      </div>
                      
                      {sections[currentSection].caseStudy.investigation && (
                        <div>
                          <h4 className="font-semibold mb-1">Investigation Steps:</h4>
                          <ol className="list-decimal list-inside text-muted-foreground">
                            {sections[currentSection].caseStudy.investigation.map((step: string, idx: number) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {sections[currentSection].caseStudy.findings && (
                        <div>
                          <h4 className="font-semibold mb-1">Findings:</h4>
                          <div className="space-y-1 text-muted-foreground">
                            {Object.entries(sections[currentSection].caseStudy.findings).map(([key, value], idx) => (
                              <div key={idx}>• <span className="font-medium">{key}:</span> {String(value)}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-destructive/10 p-3 rounded">
                        <h4 className="font-semibold mb-1">Root Cause:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].caseStudy.rootCause}</p>
                      </div>
                      
                      <div className="bg-chart-3/10 p-3 rounded">
                        <h4 className="font-semibold mb-1">Solution Implemented:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].caseStudy.solution}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-1">Results:</h4>
                        <p className="text-muted-foreground">{sections[currentSection].caseStudy.results}</p>
                      </div>
                      
                      {sections[currentSection].caseStudy.prevention && (
                        <div>
                          <h4 className="font-semibold mb-1">Prevention Measures:</h4>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {sections[currentSection].caseStudy.prevention.map((measure: string, idx: number) => (
                              <li key={idx}>{measure}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sections[currentSection].installation_steps && (
                  <div>
                    <h4 className="font-semibold mb-2">Installation Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {sections[currentSection].installation_steps.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {sections[currentSection].failure_modes && (
                  <div>
                    <h4 className="font-semibold mb-3">Common Failure Modes:</h4>
                    <div className="space-y-3">
                      {sections[currentSection].failure_modes.map((failure: any, idx: number) => (
                        <Card key={idx}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">{failure.mode}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Causes:</span>
                              <ul className="list-disc list-inside ml-2 text-muted-foreground">
                                {failure.causes.map((cause: string, i: number) => (
                                  <li key={i}>{cause}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="font-medium">Symptoms:</span>
                              <span className="text-muted-foreground ml-2">{failure.symptoms}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6" data-testid="module-quiz">
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Check</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Answer all questions to complete the module. You need 70% to pass.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {quiz.map((question: any, qIndex: number) => (
                    <div key={qIndex} className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold">Q{qIndex + 1}.</span>
                        <p className="flex-1">{question.question}</p>
                        {quizSubmitted && (
                          quizAnswers[qIndex] === question.correctAnswer ? (
                            <CheckCircle2 className="w-5 h-5 text-chart-3 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                          )
                        )}
                      </div>
                      <RadioGroup
                        value={quizAnswers[qIndex]?.toString()}
                        onValueChange={(value) =>
                          setQuizAnswers({ ...quizAnswers, [qIndex]: parseInt(value) })
                        }
                        disabled={quizSubmitted}
                      >
                        {question.options.map((option: string, oIndex: number) => (
                          <div key={oIndex} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={oIndex.toString()}
                              id={`q${qIndex}-o${oIndex}`}
                              data-testid={`quiz-${qIndex}-option-${oIndex}`}
                            />
                            <Label
                              htmlFor={`q${qIndex}-o${oIndex}`}
                              className={`flex-1 cursor-pointer ${
                                quizSubmitted && oIndex === question.correctAnswer
                                  ? "text-chart-3 font-medium"
                                  : quizSubmitted && quizAnswers[qIndex] === oIndex && oIndex !== question.correctAnswer
                                  ? "text-destructive"
                                  : ""
                              }`}
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {quizSubmitted && (
                <Card className={score >= 70 ? "border-chart-3" : "border-destructive"} data-testid="training-quiz-result">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div>
                        <p className="text-2xl font-bold" data-testid="quiz-score-display">
                          {score}%
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid="quiz-pass-status">
                          {score >= 70 ? "Passed!" : "Keep trying!"}
                        </p>
                      </div>
                      {score >= 70 ? (
                        <p className="text-sm" data-testid="quiz-points-earned">
                          Congratulations! You've earned {Math.round((score / 100) * (module.points || 0))} points!
                        </p>
                      ) : (
                        <p className="text-sm">
                          You need 70% to pass. Review the material and try again.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentSection === 0 && !showQuiz}
              data-testid="button-previous"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-3">
              {showQuiz && !quizSubmitted && (
                <Button
                  onClick={handleQuizSubmit}
                  disabled={Object.keys(quizAnswers).length < quiz.length}
                  data-testid="button-submit-quiz"
                >
                  Submit Quiz
                </Button>
              )}

              {showQuiz && quizSubmitted && score < 70 && (
                <Button onClick={handleRetry} data-testid="button-retry-quiz">
                  Retry Quiz
                </Button>
              )}

              {showQuiz && quizSubmitted && score >= 70 && (
                <Button onClick={handleClose} data-testid="button-finish">
                  Finish
                </Button>
              )}

              {!showQuiz && (
                <Button onClick={handleNext} data-testid="button-next">
                  {currentSection === sections.length - 1 ? "Take Quiz" : "Next"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
