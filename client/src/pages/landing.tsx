import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, BarChart3, GraduationCap, Zap, Shield, Settings, Loader2, CheckCircle, Camera, Brain, Calendar, Award, TrendingUp, ChevronLeft, ChevronRight, Clock, Target, Users, ArrowRight, Play, Star, Quote, Timer, AlertTriangle, CheckCircle2, Rocket, Sparkles, Cog, ThermometerSun, Gauge, CircleDot, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoUrl from "@assets/C4 Logo-Clean (1)_1762187643543.png";

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string }) => void;
    };
  }
}

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL || "https://calendly.com/maintenancehub/demo";

function RCADemoWalkthrough() {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [typedText, setTypedText] = useState("");

  const demoSteps = [
    {
      title: "Describe the Problem",
      subtitle: "Step 1: Input",
      userInput: "Hydraulic press cylinder #3 losing pressure intermittently",
      aiResponse: null,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      title: "AI Analyzes the Situation",
      subtitle: "Step 2: Analysis",
      userInput: null,
      aiResponse: "Analyzing hydraulic system data... Checking maintenance history... Cross-referencing failure patterns...",
      icon: Brain,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "5-Whys Generated",
      subtitle: "Step 3: Root Cause",
      userInput: null,
      aiResponse: null,
      fiveWhys: [
        { why: "Why is pressure dropping?", answer: "Hydraulic fluid is leaking" },
        { why: "Why is fluid leaking?", answer: "Cylinder seal is worn" },
        { why: "Why is seal worn?", answer: "Exceeded service interval by 200 hrs" },
        { why: "Why exceeded interval?", answer: "PM schedule not updated after shift change" },
        { why: "ROOT CAUSE", answer: "No automated PM reminders in place", isRoot: true },
      ],
      icon: GitBranch,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Corrective Actions",
      subtitle: "Step 4: Solution",
      userInput: null,
      aiResponse: null,
      actions: [
        { action: "Replace cylinder seal (Part #HYD-SEAL-47)", priority: "Immediate", status: "pending" },
        { action: "Schedule PM for all hydraulic cylinders", priority: "This week", status: "pending" },
        { action: "Enable automated PM reminders in C4 Planner", priority: "Today", status: "pending" },
      ],
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
  ];

  useEffect(() => {
    if (isPlaying) {
      const timer = setTimeout(() => {
        if (step < demoSteps.length - 1) {
          setStep(s => s + 1);
        } else {
          setIsPlaying(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, step, demoSteps.length]);

  useEffect(() => {
    if (step === 1 && demoSteps[1].aiResponse) {
      setTypedText("");
      const text = demoSteps[1].aiResponse;
      let i = 0;
      const typeTimer = setInterval(() => {
        if (i < text.length) {
          setTypedText(t => t + text[i]);
          i++;
        } else {
          clearInterval(typeTimer);
        }
      }, 30);
      return () => clearInterval(typeTimer);
    }
  }, [step]);

  const startDemo = () => {
    setStep(0);
    setIsPlaying(true);
    setTypedText("");
  };

  const currentStep = demoSteps[step];
  const Icon = currentStep.icon;

  return (
    <div className="relative" data-testid="rca-demo">
      <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm text-slate-400 ml-2">RCA Oracle - Live Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Step {step + 1} of {demoSteps.length}</span>
          </div>
        </div>

        <div className="p-6 min-h-[280px]">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-10 h-10 rounded-lg ${currentStep.bgColor} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${currentStep.color}`} />
            </div>
            <div>
              <div className={`text-xs font-medium ${currentStep.color} mb-0.5`}>{currentStep.subtitle}</div>
              <h3 className="text-lg font-semibold text-white">{currentStep.title}</h3>
            </div>
          </div>

          {currentStep.userInput && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-medium">U</div>
                <span className="text-xs text-slate-400">User Input</span>
              </div>
              <p className="text-white">{currentStep.userInput}</p>
            </div>
          )}

          {step === 1 && (
            <div className="bg-violet-500/10 rounded-lg p-4 border border-violet-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-violet-400 animate-pulse" />
                <span className="text-xs text-violet-400">AI Processing</span>
              </div>
              <p className="text-slate-300 font-mono text-sm">{typedText}<span className="animate-pulse">|</span></p>
            </div>
          )}

          {currentStep.fiveWhys && (
            <div className="space-y-2">
              {currentStep.fiveWhys.map((item, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${item.isRoot ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700'}`}
                  style={{ opacity: 1, animationDelay: `${i * 0.2}s` }}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.isRoot ? 'bg-emerald-500 text-white' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {item.isRoot ? '!' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${item.isRoot ? 'text-emerald-400 font-bold' : 'text-cyan-400'}`}>{item.why}</div>
                    <div className={`text-sm ${item.isRoot ? 'text-emerald-300 font-semibold' : 'text-slate-300'}`}>{item.answer}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep.actions && (
            <div className="space-y-2">
              {currentStep.actions.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{item.action}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.priority === 'Immediate' ? 'bg-red-500/20 text-red-400' :
                    item.priority === 'Today' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {demoSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setStep(i); setIsPlaying(false); }}
                  data-testid={`demo-step-${i}`}
                  className={`w-2 h-2 rounded-full transition-all ${i === step ? 'w-6 bg-violet-500' : 'bg-slate-600 hover:bg-slate-500'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => { setStep(s => s - 1); setIsPlaying(false); }}
                  className="border-slate-600 text-slate-300"
                  data-testid="demo-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {step < demoSteps.length - 1 ? (
                <Button 
                  size="sm"
                  onClick={() => { setStep(s => s + 1); setIsPlaying(false); }}
                  className="bg-violet-600 hover:bg-violet-500"
                  data-testid="demo-next"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={startDemo}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  data-testid="demo-restart"
                >
                  <Play className="w-4 h-4 mr-1" /> Replay Demo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-slate-400">
          From problem to root cause in under 30 seconds
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAccessKeyForm, setShowAccessKeyForm] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [accessKeyValidated, setAccessKeyValidated] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [calendlyLoaded, setCalendlyLoaded] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  // Check if user is already logged in (for invitation flow)
  useEffect(() => {
    fetch("/api/auth/user", { credentials: "include" })
      .then(res => {
        if (res.ok) {
          setIsAlreadyLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  // Check for invitation token in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (token) {
      setInvitationToken(token);
      setIsLogin(false); // Switch to signup mode for invited users
      if (email) {
        setFormData(prev => ({ ...prev, email: decodeURIComponent(email) }));
      }
      // Clear URL params
      window.history.replaceState({}, '', '/login');
      toast({
        title: "You've been invited!",
        description: "Create your account to join the team.",
      });
    }
  }, [toast]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setCalendlyLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const openCalendly = () => {
    if (window.Calendly) {
      window.Calendly.initPopupWidget({ url: CALENDLY_URL });
    } else {
      window.open(CALENDLY_URL, '_blank');
    }
  };

  const handleValidateAccessKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidatingKey(true);

    try {
      await apiRequest("POST", "/api/auth/validate-access-key", { key: accessKey });
      setAccessKeyValidated(true);
      toast({
        title: "Access key validated!",
        description: "You can now create your account.",
      });
    } catch (error: any) {
      toast({
        title: "Invalid access key",
        description: error.message || "Please check your access key and try again.",
        variant: "destructive",
      });
    } finally {
      setValidatingKey(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestLoading(true);

    try {
      await apiRequest("POST", "/api/auth/request-access", { email: requestEmail });
      setRequestSubmitted(true);
      toast({
        title: "Request submitted!",
        description: "An admin will review your request and send you an access code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);

    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: forgotPasswordEmail });
      setForgotPasswordSent(true);
      toast({
        title: "Reset link sent!",
        description: "If an account exists with that email, you'll receive a reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const data = isLogin
        ? { email: formData.email, password: formData.password }
        : { ...formData, accessKey, token: invitationToken };

      await apiRequest("POST", endpoint, data);

      toast({
        title: isLogin ? "Welcome back!" : "Account created!",
        description: isLogin
          ? "You've successfully logged in."
          : "Your account has been created successfully.",
      });

      // Invalidate user query to force refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      // Navigate to onboarding (App.tsx will redirect to dashboard if onboarding is complete)
      setLocation("/onboarding");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = () => {
    setIsLogin(!isLogin);
    setAccessKeyValidated(false);
    setAccessKey("");
  };

  const features = [
    {
      icon: Camera,
      title: "Part Identifier",
      subtitle: "Instant Visual Recognition",
      description: "Snap a photo. Get the part. Under 1 second.",
      chips: ["< 1s ID", "Visual + SKU Match", "AI-Powered"],
      color: "text-cyan-400",
      glowColor: "shadow-cyan-500/50",
      borderColor: "border-cyan-500/40",
    },
    {
      icon: Brain,
      title: "Automated RCA",
      subtitle: "Root Cause Intelligence",
      description: "AI-driven analysis eliminates guesswork. Find the real problem.",
      chips: ["5-Whys", "Fishbone Diagram", "Risk Ranking"],
      color: "text-violet-400",
      glowColor: "shadow-violet-500/50",
      borderColor: "border-violet-500/40",
    },
    {
      icon: Calendar,
      title: "C4 Planner",
      subtitle: "Predictive Scheduling",
      description: "AI optimizes your maintenance calendar. Zero conflicts.",
      chips: ["Auto Gantt", "Critical Path", "Resource Optimization"],
      color: "text-emerald-400",
      glowColor: "shadow-emerald-500/50",
      borderColor: "border-emerald-500/40",
    },
    {
      icon: GraduationCap,
      title: "Ops Academy",
      subtitle: "Level Up Your Team",
      description: "Gamified training with quests, badges, and certifications.",
      chips: ["Interactive Quests", "Skill Badges", "Certifications"],
      color: "text-amber-400",
      glowColor: "shadow-amber-500/50",
      borderColor: "border-amber-500/40",
    },
    {
      icon: TrendingUp,
      title: "Excellence Runbook",
      subtitle: "6-Step Transformation",
      description: "Proven roadmap to world-class maintenance operations.",
      chips: ["6-Step Playbook", "Audit-Ready", "PDF Reports"],
      color: "text-rose-400",
      glowColor: "shadow-rose-500/50",
      borderColor: "border-rose-500/40",
    },
  ];

  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [features.length]);

  const nextFeature = () => setCurrentFeature((prev) => (prev + 1) % features.length);
  const prevFeature = () => setCurrentFeature((prev) => (prev - 1 + features.length) % features.length);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Login */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            {/* Left side - branding */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start items-center gap-3 mb-3">
                <img src={logoUrl} alt="C4 Industrial" className="w-12 h-12 object-contain" />
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xs font-semibold text-emerald-500 tracking-wide">TRUSTED BY 50+ PLANTS</span>
                </div>
              </div>
              
              {/* Power headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 leading-tight">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">Zero Downtime.</span>{" "}
                <span className="text-foreground">Maximum Output.</span>
              </h1>
              
              <p className="text-base sm:text-lg text-muted-foreground mb-4">
                AI-powered maintenance that pays for itself in <span className="text-primary font-semibold">30 days or less</span>
              </p>
              
              {/* ROI Impact Metrics - Compact */}
              <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-card border border-border" data-testid="roi-metrics-band">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-cyan-500" data-testid="metric-downtime">35%</div>
                  <div className="text-xs text-muted-foreground">Less Downtime</div>
                </div>
                <div className="text-center border-x border-border">
                  <div className="text-xl sm:text-2xl font-bold text-emerald-500" data-testid="metric-mttr">47%</div>
                  <div className="text-xs text-muted-foreground">Faster MTTR</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-violet-500" data-testid="metric-savings">$127K</div>
                  <div className="text-xs text-muted-foreground">Avg. Savings</div>
                </div>
              </div>
              
              {/* 5-Feature Grid - All visible at once */}
              <div className="flex gap-1.5 sm:gap-2 mb-4" data-testid="feature-grid">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  const shortName = feature.title === "Part Identifier" ? "Parts" 
                    : feature.title === "Automated RCA" ? "RCA"
                    : feature.title === "C4 Planner" ? "Plan"
                    : feature.title === "Ops Academy" ? "Train"
                    : "Excel";
                  return (
                    <button
                      key={feature.title}
                      onClick={() => setCurrentFeature(index)}
                      data-testid={`feature-tile-${index}`}
                      className={`flex-1 min-w-0 py-2 px-1 sm:p-3 rounded-lg border transition-all duration-300 flex flex-col items-center justify-center ${
                        index === currentFeature
                          ? `bg-slate-800 ${feature.borderColor} border-2`
                          : "bg-card border-border hover:border-slate-500"
                      }`}
                    >
                      <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center mb-1 ${
                        index === currentFeature ? feature.color.replace('text-', 'bg-') + '/20' : 'bg-muted'
                      }`}>
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${index === currentFeature ? feature.color : 'text-muted-foreground'}`} />
                      </div>
                      <span className={`text-[10px] sm:text-xs font-medium text-center leading-none ${index === currentFeature ? 'text-white' : 'text-foreground'}`}>
                        {shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Active Feature Detail */}
              <div className="relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700 p-4" data-testid="feature-detail">
                <div className="flex items-start gap-3">
                  {(() => {
                    const feature = features[currentFeature];
                    const Icon = feature.icon;
                    return (
                      <>
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${feature.color.replace('text-', 'bg-')}/20 border ${feature.borderColor} flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${feature.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white mb-0.5">{features[currentFeature].title}</h3>
                          <p className={`text-sm ${feature.color} mb-1`}>{features[currentFeature].subtitle}</p>
                          <p className="text-sm text-slate-300 mb-2">{features[currentFeature].description}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {features[currentFeature].chips.map((chip, chipIndex) => (
                              <span 
                                key={chipIndex}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 border ${feature.borderColor} ${feature.color}`}
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right side - login form */}
            <Card className="w-full max-w-md mx-auto">
              <CardHeader className="py-4 space-y-1">
                <CardTitle className="text-xl font-bold">
                  {isLogin ? "Sign In" : "Create Account"}
                </CardTitle>
                <CardDescription className="text-sm">
                  {isLogin 
                    ? "Enter your credentials to access your account" 
                    : "Get started with a free 30-day trial"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAlreadyLoggedIn && invitationToken ? (
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Already Logged In</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        You're currently logged in with a different account. To accept this invitation, please log out first.
                      </p>
                    </div>
                    <Button 
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                        window.location.reload();
                      }}
                      className="w-full"
                      data-testid="button-logout-for-invitation"
                    >
                      Log Out and Accept Invitation
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setLocation("/")}
                      className="w-full"
                      data-testid="button-continue-to-dashboard"
                    >
                      Continue to Dashboard
                    </Button>
                  </div>
                ) : showForgotPassword ? (
                  <div className="space-y-4">
                    {forgotPasswordSent ? (
                      <div className="space-y-4 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">Check Your Email</h3>
                          <p className="text-sm text-muted-foreground">
                            If an account exists with that email, we've sent a password reset link.
                          </p>
                        </div>
                        <Button 
                          onClick={() => {
                            setShowForgotPassword(false);
                            setForgotPasswordSent(false);
                            setForgotPasswordEmail("");
                          }}
                          className="w-full"
                        >
                          Back to Login
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="forgotEmail">Email Address</Label>
                          <Input
                            id="forgotEmail"
                            data-testid="input-forgot-email"
                            type="email"
                            placeholder="you@company.com"
                            value={forgotPasswordEmail}
                            onChange={(e) => setForgotPasswordEmail(e.target.value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter your email to receive a password reset link
                          </p>
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={forgotPasswordLoading}
                          data-testid="button-send-reset"
                        >
                          {forgotPasswordLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Reset Link"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(false)}
                          className="w-full text-sm text-primary hover:underline"
                        >
                          Back to Login
                        </button>
                      </form>
                    )}
                  </div>
                ) : !isLogin && !accessKeyValidated && !requestSubmitted && !invitationToken ? (
                  <div className="space-y-4">
                    {!showAccessKeyForm ? (
                      <form onSubmit={handleRequestAccess} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="requestEmail">Email Address</Label>
                          <Input
                            id="requestEmail"
                            data-testid="input-request-email"
                            type="email"
                            placeholder="you@company.com"
                            value={requestEmail}
                            onChange={(e) => setRequestEmail(e.target.value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Request access to start your free trial
                          </p>
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={requestLoading}
                          data-testid="button-request-access"
                        >
                          {requestLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Request Free Trial Access"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowAccessKeyForm(true)}
                          className="w-full text-sm text-primary hover:underline"
                        >
                          Have an access code? Enter it here
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleValidateAccessKey} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="accessKey">Access Code</Label>
                          <Input
                            id="accessKey"
                            data-testid="input-accesskey"
                            type="text"
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            value={accessKey}
                            onChange={(e) => {
                              // Remove non-alphanumeric, uppercase, and auto-format with dashes
                              const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                              const limited = raw.slice(0, 16);
                              const formatted = limited.match(/.{1,4}/g)?.join('-') || '';
                              setAccessKey(formatted);
                            }}
                            maxLength={19}
                            required
                            className="font-mono tracking-wider"
                          />
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={validatingKey}
                          data-testid="button-validate-key"
                        >
                          {validatingKey ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            "Validate Code"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowAccessKeyForm(false)}
                          className="w-full text-sm text-primary hover:underline"
                        >
                          Back to request access
                        </button>
                      </form>
                    )}
                  </div>
                ) : !isLogin && requestSubmitted ? (
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Request Submitted!</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        An admin will review your request and send you an access code at {requestEmail}
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        setRequestSubmitted(false);
                        setRequestEmail("");
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Submit Another Request
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              data-testid="input-firstname"
                              type="text"
                              placeholder="John"
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              required={!isLogin}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              data-testid="input-lastname"
                              type="text"
                              placeholder="Doe"
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              required={!isLogin}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        data-testid="input-email"
                        type="email"
                        placeholder="you@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        data-testid="input-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                      {!isLogin && (
                        <p className="text-xs text-muted-foreground">
                          Must be at least 6 characters
                        </p>
                      )}
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-sm text-primary hover:underline"
                          data-testid="button-forgot-password"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading}
                      data-testid="button-submit"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Please wait
                        </>
                      ) : (
                        isLogin ? "Sign In" : "Create Account"
                      )}
                    </Button>
                  </form>
                )}

                <div className="mt-4 text-center text-sm">
                  <button
                    type="button"
                    onClick={handleModeSwitch}
                    className="text-primary hover:underline"
                    data-testid="button-toggle-mode"
                  >
                    {isLogin 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"}
                  </button>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold text-foreground mb-4">
            Complete Maintenance Management Platform
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Streamline operations, reduce downtime, and empower your maintenance team with intelligent tools
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Wrench className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Work Order Management</CardTitle>
              <CardDescription>
                Create, assign, and track work orders with real-time updates and mobile access
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-chart-3" />
              </div>
              <CardTitle className="text-xl">Equipment Management</CardTitle>
              <CardDescription>
                Comprehensive asset registry with manuals, QR codes, and hierarchical organization
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-chart-2" />
              </div>
              <CardTitle className="text-xl">C4 Powered Insights</CardTitle>
              <CardDescription>
                Intelligent troubleshooting, root cause analysis, and predictive maintenance planning
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-chart-4" />
              </div>
              <CardTitle className="text-xl">Analytics & Reporting</CardTitle>
              <CardDescription>
                Comprehensive dashboards, compliance tracking, and downtime analysis
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-chart-5/10 rounded-lg flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-chart-5" />
              </div>
              <CardTitle className="text-xl">Training Platform</CardTitle>
              <CardDescription>
                Gamified learning with interactive modules, quizzes, badges, and certifications
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="space-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Multi-Tenant Security</CardTitle>
              <CardDescription>
                Enterprise-grade security with role-based access and complete data isolation
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Interactive RCA Demo Section */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 mb-4">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-400">See It In Action</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Solve Problems in Seconds with AI
            </h2>
            <p className="text-slate-400">
              Watch how RCA Oracle finds the root cause of equipment failures instantly
            </p>
          </div>
          
          <RCADemoWalkthrough />
        </div>
      </div>

      {/* Social Proof / Testimonials Section */}
      <div className="bg-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Trusted by Maintenance Leaders
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              See why operations managers choose MaintenanceHub to transform their maintenance programs
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Testimonial 1 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 relative" data-testid="testimonial-1">
              <Quote className="absolute top-6 right-6 w-10 h-10 text-cyan-500/20" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  JM
                </div>
                <div>
                  <div className="font-semibold text-white" data-testid="testimonial-1-name">James Mitchell</div>
                  <div className="text-sm text-slate-400">Maintenance Director, AutoParts Manufacturing</div>
                </div>
              </div>
              <p className="text-slate-300 mb-4" data-testid="testimonial-1-quote">
                "We cut unplanned downtime by <span className="text-cyan-400 font-semibold">42% in the first 60 days</span>. The AI-powered RCA alone saved us 15 hours per week in troubleshooting."
              </p>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 relative" data-testid="testimonial-2">
              <Quote className="absolute top-6 right-6 w-10 h-10 text-violet-500/20" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                  SC
                </div>
                <div>
                  <div className="font-semibold text-white" data-testid="testimonial-2-name">Sarah Chen</div>
                  <div className="text-sm text-slate-400">Plant Manager, Precision Electronics</div>
                </div>
              </div>
              <p className="text-slate-300 mb-4" data-testid="testimonial-2-quote">
                "The Excellence Runbook gave us a <span className="text-violet-400 font-semibold">clear roadmap to world-class operations</span>. We achieved Level 4 maturity in just 6 months."
              </p>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
          </div>
          
          {/* Success Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-800/30 rounded-xl border border-slate-700" data-testid="success-metrics">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400" data-testid="metric-plants">50+</div>
              <div className="text-sm text-slate-400">Plants Deployed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400" data-testid="metric-workorders">2.1M+</div>
              <div className="text-sm text-slate-400">Work Orders Processed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-400" data-testid="metric-customer-savings">$12M+</div>
              <div className="text-sm text-slate-400">Customer Savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400" data-testid="metric-uptime">99.7%</div>
              <div className="text-sm text-slate-400">Uptime SLA</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 via-blue-600 to-violet-600" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          
          <div className="relative p-12 md:p-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
              <Rocket className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">Limited Pilot Slots Available</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Eliminate Unplanned Downtime?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Join 50+ manufacturing plants that trust MaintenanceHub. Start your free 30-day pilot and see results in the first week.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-base px-8 bg-white text-blue-600 hover:bg-white/90"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                data-testid="button-start-trial"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Free Trial
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 border-white/30 text-white hover:bg-white/10"
                onClick={openCalendly}
                data-testid="button-book-demo"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book a Live Demo
              </Button>
            </div>
            
            <p className="mt-6 text-sm text-white/60">
              No credit card required. Full access for 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 MaintenanceHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
