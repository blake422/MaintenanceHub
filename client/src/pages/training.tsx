import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap,
  Trophy,
  Star,
  Clock,
  CheckCircle2,
  Award,
  Cpu,
  Play,
  Wrench,
  Users,
  Shield,
  FileCheck,
  BookOpen,
  Download,
  Video,
  Pencil,
  Loader2,
} from "lucide-react";
import { TrainingModuleViewer } from "@/components/TrainingModuleViewer";
import { InteractiveSchematic } from "@/components/InteractiveSchematic";
import { TrainingCertificate } from "@/components/TrainingCertificate";
import { ModuleCertificate } from "@/components/ModuleCertificate";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingModule, TrainingProgress, Schematic, Badge as BadgeType } from "@shared/schema";

type ModuleCategory = "all" | "technical" | "leadership";

const TECHNICAL_KEYWORDS = [
  "electrical", "motor", "bearing", "troubleshoot", "maintenance fundamentals", 
  "6-step", "troubleshooting methodology", "hydraulic", "pneumatic", "plc", 
  "automation", "pump", "conveyor", "material handling", "ladder logic"
];
const LEADERSHIP_KEYWORDS = [
  "leadership", "communication", "safety leadership", "planning", "scheduling",
  "executive", "presence", "influence", "coaching", "mentoring", "conflict",
  "negotiation", "crisis", "learning organization", "team building", "performance management",
  "professionalism", "career", "strategic thinking", "supervisor", "supervisors",
  "emotional intelligence", "decision-making", "feedback", "culture"
];

function categorizeModule(module: TrainingModule): "technical" | "leadership" {
  const titleLower = module.title.toLowerCase();
  const descLower = (module.description || "").toLowerCase();
  
  for (const keyword of LEADERSHIP_KEYWORDS) {
    if (titleLower.includes(keyword) || descLower.includes(keyword)) {
      return "leadership";
    }
  }
  return "technical";
}

function getCategoryIcon(category: "technical" | "leadership") {
  if (category === "leadership") {
    return Users;
  }
  return Wrench;
}

function getCategoryColor(category: "technical" | "leadership") {
  if (category === "leadership") {
    return "text-violet-500 bg-violet-500/10";
  }
  return "text-blue-500 bg-blue-500/10";
}

export default function Training() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [selectedSchematic, setSelectedSchematic] = useState<Schematic | null>(null);
  const [showModuleViewer, setShowModuleViewer] = useState(false);
  const [showSchematic, setShowSchematic] = useState(false);
  const [activeTab, setActiveTab] = useState<ModuleCategory>("all");
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateType, setCertificateType] = useState<"technical" | "leadership" | "master">("technical");
  
  const [editingVideoModule, setEditingVideoModule] = useState<TrainingModule | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoProvider, setVideoProvider] = useState<"youtube" | "vimeo" | "direct" | "">("");
  const [videoDuration, setVideoDuration] = useState("");

  const isAdmin = user?.role === "admin" || user?.role === "manager" || user?.role === "platform_admin";

  const updateVideoMutation = useMutation({
    mutationFn: async (data: { moduleId: string; videoUrl: string; videoProvider: string; videoDurationSeconds: number | null }) => {
      const response = await apiRequest("PATCH", `/api/training/modules/${data.moduleId}`, {
        videoUrl: data.videoUrl || null,
        videoProvider: data.videoProvider || null,
        videoDurationSeconds: data.videoDurationSeconds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/modules"] });
      toast({
        title: "Video Updated",
        description: "The training video has been updated successfully.",
      });
      setEditingVideoModule(null);
      setVideoUrl("");
      setVideoProvider("");
      setVideoDuration("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update the training video.",
        variant: "destructive",
      });
    },
  });

  const handleEditVideo = (module: TrainingModule, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVideoModule(module);
    setVideoUrl(module.videoUrl || "");
    setVideoProvider(module.videoProvider || "");
    setVideoDuration(module.videoDurationSeconds ? String(Math.floor(module.videoDurationSeconds / 60)) : "");
  };

  const handleSaveVideo = () => {
    if (!editingVideoModule) return;
    
    const durationMinutes = parseInt(videoDuration) || 0;
    updateVideoMutation.mutate({
      moduleId: editingVideoModule.id,
      videoUrl: videoUrl.trim(),
      videoProvider: videoProvider,
      videoDurationSeconds: durationMinutes > 0 ? durationMinutes * 60 : null,
    });
  };

  // Fetch training modules
  const { data: modules = [], isLoading: modulesLoading } = useQuery<TrainingModule[]>({
    queryKey: ["/api/training/modules"],
    enabled: !!user,
  });

  // Fetch user progress
  const { data: progress = [], isLoading: progressLoading } = useQuery<TrainingProgress[]>({
    queryKey: ["/api/training/progress"],
    enabled: !!user,
  });

  // Fetch schematics
  const { data: schematics = [] } = useQuery<Schematic[]>({
    queryKey: ["/api/schematics"],
    enabled: !!user,
  });

  // Fetch badges
  const { data: allBadges = [] } = useQuery<BadgeType[]>({
    queryKey: ["/api/badges"],
    enabled: !!user,
  });

  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ["/api/badges/user"],
    enabled: !!user,
  });

  // Categorize modules
  const categorizedModules = useMemo(() => {
    const technical: TrainingModule[] = [];
    const leadership: TrainingModule[] = [];
    
    modules.forEach((module) => {
      if (categorizeModule(module) === "leadership") {
        leadership.push(module);
      } else {
        technical.push(module);
      }
    });
    
    return { technical, leadership, all: modules };
  }, [modules]);

  const filteredModules = useMemo(() => {
    if (activeTab === "all") return modules;
    return categorizedModules[activeTab];
  }, [activeTab, modules, categorizedModules]);

  // Calculate stats
  const completedModules = progress.filter((p) => p.completed).length;
  const totalPoints = progress.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
  const earnedBadges = userBadges.length;

  // Calculate track progress
  const technicalCompleted = categorizedModules.technical.filter(m => 
    progress.some(p => p.moduleId === m.id && p.completed)
  ).length;
  const leadershipCompleted = categorizedModules.leadership.filter(m => 
    progress.some(p => p.moduleId === m.id && p.completed)
  ).length;

  const handleStartModule = (module: TrainingModule) => {
    setSelectedModule(module);
    setShowModuleViewer(true);
  };

  const handleStartSchematic = (schematic: Schematic) => {
    setSelectedSchematic(schematic);
    setShowSchematic(true);
  };

  const getModuleProgress = (moduleId: string) => {
    return progress.find((p) => p.moduleId === moduleId);
  };

  if (modulesLoading || progressLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">C4 University</h1>
        <p className="text-muted-foreground">
          Learn, earn badges, and climb the leaderboard with C4-powered training
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4 text-chart-2" />
              Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-points">
              {totalPoints}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-chart-3" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed">
              {completedModules}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-chart-1" />
              Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-badges">
              {earnedBadges}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-chart-2" />
              Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-modules">
              {modules.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Tracks Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Technical Track</CardTitle>
                  <CardDescription>Hands-on maintenance skills</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-blue-500">
                {technicalCompleted}/{categorizedModules.technical.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress 
              value={categorizedModules.technical.length > 0 ? (technicalCompleted / categorizedModules.technical.length) * 100 : 0} 
              className="h-2"
            />
            {technicalCompleted > 0 && technicalCompleted === categorizedModules.technical.length && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => {
                  setCertificateType("technical");
                  setShowCertificate(true);
                }}
                data-testid="button-download-technical-certificate"
              >
                <Download className="w-4 h-4" />
                Download Certificate
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Leadership Track</CardTitle>
                  <CardDescription>Management & soft skills</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-violet-500">
                {leadershipCompleted}/{categorizedModules.leadership.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress 
              value={categorizedModules.leadership.length > 0 ? (leadershipCompleted / categorizedModules.leadership.length) * 100 : 0} 
              className="h-2"
            />
            {leadershipCompleted > 0 && leadershipCompleted === categorizedModules.leadership.length && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 text-violet-500 border-violet-500/30 hover:bg-violet-500/10"
                onClick={() => {
                  setCertificateType("leadership");
                  setShowCertificate(true);
                }}
                data-testid="button-download-leadership-certificate"
              >
                <Download className="w-4 h-4" />
                Download Certificate
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Master Certificate - Available when both tracks are complete */}
      {technicalCompleted === categorizedModules.technical.length && 
       leadershipCompleted === categorizedModules.leadership.length &&
       categorizedModules.technical.length > 0 && 
       categorizedModules.leadership.length > 0 && (
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    C4 Master Certification
                    <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">
                      Unlocked
                    </Badge>
                  </CardTitle>
                  <CardDescription>You've completed both Technical and Leadership tracks!</CardDescription>
                </div>
              </div>
              <Button
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                onClick={() => {
                  setCertificateType("master");
                  setShowCertificate(true);
                }}
                data-testid="button-download-master-certificate"
              >
                <Award className="w-4 h-4" />
                Claim Master Certificate
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Training Modules with Tabs */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Modules</CardTitle>
              <CardDescription>Complete modules to earn points and badges</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleCategory)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all-modules">
                    <BookOpen className="w-4 h-4" />
                    All ({modules.length})
                  </TabsTrigger>
                  <TabsTrigger value="technical" className="flex items-center gap-2" data-testid="tab-technical">
                    <Wrench className="w-4 h-4" />
                    Technical ({categorizedModules.technical.length})
                  </TabsTrigger>
                  <TabsTrigger value="leadership" className="flex items-center gap-2" data-testid="tab-leadership">
                    <Users className="w-4 h-4" />
                    Leadership ({categorizedModules.leadership.length})
                  </TabsTrigger>
                </TabsList>

                {filteredModules.length === 0 ? (
                  <div className="text-center py-12">
                    <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">No training modules available</p>
                    <p className="text-sm text-muted-foreground">
                      Contact your administrator to set up training content
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredModules.map((module) => {
                      const moduleProgress = getModuleProgress(module.id);
                      const isCompleted = moduleProgress?.completed || false;
                      const score = moduleProgress?.score || 0;
                      const category = categorizeModule(module);
                      const CategoryIcon = getCategoryIcon(category);
                      const categoryColors = getCategoryColor(category);

                      return (
                        <Card
                          key={module.id}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleStartModule(module)}
                          data-testid={`module-card-${module.id}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <CardTitle className="text-base">{module.title}</CardTitle>
                                  <Badge variant="outline" className={`text-xs ${category === "leadership" ? "text-violet-500 border-violet-500/30" : "text-blue-500 border-blue-500/30"}`}>
                                    {category === "leadership" ? "Leadership" : "Technical"}
                                  </Badge>
                                  {isCompleted && (
                                    <Badge variant="outline" className="bg-chart-3/10 text-chart-3">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      {score}%
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription>{module.description}</CardDescription>
                              </div>
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColors}`}>
                                <CategoryIcon className="w-6 h-6" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between text-sm mb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">{module.durationMinutes} min</span>
                                </div>
                                {module.videoUrl && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Video className="w-3 h-3 mr-1" />
                                    Video
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-chart-2" />
                                <span className="font-medium">{module.points} pts</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                className="flex-1"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartModule(module);
                                }}
                                data-testid={`button-start-${module.id}`}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                {isCompleted ? "Review Module" : "Start Module"}
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => handleEditVideo(module, e)}
                                  data-testid={`button-edit-video-${module.id}`}
                                  title="Add/Edit Training Video"
                                >
                                  <Video className="w-4 h-4" />
                                </Button>
                              )}
                              {isCompleted && moduleProgress && (
                                <ModuleCertificate 
                                  module={module} 
                                  progress={moduleProgress} 
                                  variant="full"
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Tabs>
            </CardContent>
          </Card>

          {/* Interactive Schematics */}
          {schematics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Interactive Parts Diagrams</CardTitle>
                <CardDescription>Learn to identify critical components</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schematics.map((schematic) => (
                    <Card
                      key={schematic.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleStartSchematic(schematic)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Cpu className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm truncate">{schematic.name}</CardTitle>
                            <p className="text-xs text-muted-foreground truncate">
                              Interactive parts identification
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartSchematic(schematic);
                          }}
                          data-testid={`button-schematic-${schematic.id}`}
                        >
                          Start Practice
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Badges */}
          {allBadges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Your achievements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {allBadges.slice(0, 6).map((badge) => {
                    const earned = userBadges.some((ub) => ub.badgeId === badge.id);
                    return (
                      <div
                        key={badge.id}
                        className={`text-center p-3 rounded-lg ${
                          earned
                            ? "bg-chart-2/10 border border-chart-2/20"
                            : "bg-muted/50 opacity-50"
                        }`}
                        data-testid={`badge-${badge.id}`}
                      >
                        <div className="flex justify-center mb-1">
                          <Trophy className={`w-8 h-8 ${earned ? "text-chart-2" : "text-muted-foreground"}`} />
                        </div>
                        <p className="text-xs font-medium truncate">{badge.name}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certifications Available */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                Certifications
              </CardTitle>
              <CardDescription>Earn certificates by completing tracks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-3 rounded-lg border ${technicalCompleted === categorizedModules.technical.length && categorizedModules.technical.length > 0 ? "border-chart-3 bg-chart-3/10" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Technical Specialist</span>
                  {technicalCompleted === categorizedModules.technical.length && categorizedModules.technical.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-3" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {technicalCompleted}/{categorizedModules.technical.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Complete all technical modules</p>
              </div>
              
              <div className={`p-3 rounded-lg border ${leadershipCompleted === categorizedModules.leadership.length && categorizedModules.leadership.length > 0 ? "border-chart-3 bg-chart-3/10" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Leadership Excellence</span>
                  {leadershipCompleted === categorizedModules.leadership.length && categorizedModules.leadership.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-3" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {leadershipCompleted}/{categorizedModules.leadership.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Complete all leadership modules</p>
              </div>
              
              <div className={`p-3 rounded-lg border ${completedModules === modules.length && modules.length > 0 ? "border-chart-2 bg-chart-2/10" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">C4 Master Certification</span>
                  {completedModules === modules.length && modules.length > 0 ? (
                    <Award className="w-4 h-4 text-chart-2" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {completedModules}/{modules.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Complete all training modules</p>
              </div>
            </CardContent>
          </Card>

          {/* Progress Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>Keep learning and improving</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Modules Completed</span>
                  <span className="font-medium">{completedModules}/{modules.length}</span>
                </div>
                <Progress
                  value={modules.length > 0 ? (completedModules / modules.length) * 100 : 0}
                  className="h-2"
                />
              </div>
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Complete all modules to unlock advanced certifications
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Module Viewer Dialog */}
      <TrainingModuleViewer
        module={selectedModule}
        open={showModuleViewer}
        onClose={() => {
          setShowModuleViewer(false);
          setSelectedModule(null);
        }}
      />

      {/* Schematic Viewer Dialog */}
      <InteractiveSchematic
        schematic={selectedSchematic}
        open={showSchematic}
        onClose={() => {
          setShowSchematic(false);
          setSelectedSchematic(null);
        }}
      />

      {/* Certificate Dialog */}
      <TrainingCertificate
        open={showCertificate}
        onClose={() => setShowCertificate(false)}
        certificateType={certificateType}
        completedModules={
          certificateType === "technical" ? technicalCompleted :
          certificateType === "leadership" ? leadershipCompleted :
          completedModules
        }
        totalModules={
          certificateType === "technical" ? categorizedModules.technical.length :
          certificateType === "leadership" ? categorizedModules.leadership.length :
          modules.length
        }
        totalPoints={
          certificateType === "technical" 
            ? categorizedModules.technical
                .filter(m => progress.some(p => p.moduleId === m.id && p.completed))
                .reduce((sum, m) => sum + (m.points || 0), 0)
            : certificateType === "leadership"
            ? categorizedModules.leadership
                .filter(m => progress.some(p => p.moduleId === m.id && p.completed))
                .reduce((sum, m) => sum + (m.points || 0), 0)
            : totalPoints
        }
      />

      {/* Video Edit Dialog */}
      <Dialog open={!!editingVideoModule} onOpenChange={(open) => !open && setEditingVideoModule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {editingVideoModule?.videoUrl ? "Edit Training Video" : "Add Training Video"}
            </DialogTitle>
            <DialogDescription>
              Add a YouTube, Vimeo, or direct video URL to this training module.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="font-medium">Module</Label>
              <p className="text-sm text-muted-foreground">{editingVideoModule?.title}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                data-testid="input-video-url"
              />
              <p className="text-xs text-muted-foreground">
                Paste a YouTube, Vimeo, or direct video URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoProvider">Video Provider</Label>
              <Select value={videoProvider || "auto"} onValueChange={(val) => setVideoProvider(val === "auto" ? "" : val as any)}>
                <SelectTrigger data-testid="select-video-provider">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect from URL</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="direct">Direct Video URL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoDuration">Video Duration (minutes)</Label>
              <Input
                id="videoDuration"
                type="number"
                placeholder="e.g., 15"
                value={videoDuration}
                onChange={(e) => setVideoDuration(e.target.value)}
                data-testid="input-video-duration"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVideoModule(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveVideo}
              disabled={updateVideoMutation.isPending}
              data-testid="button-save-video"
            >
              {updateVideoMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Video"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
