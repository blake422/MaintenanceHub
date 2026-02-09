import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Loader2,
  Target,
  Clock,
  AlertTriangle,
  CheckCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import type { CenterlineTemplate, CenterlineRun, CenterlineParameter, CenterlineMeasurement, Equipment } from "@shared/schema";

interface CenterlineRunResponse extends CenterlineRun {
  template: CenterlineTemplate;
  equipment?: Equipment;
  parameters: CenterlineParameter[];
  measurements: CenterlineMeasurement[];
}

interface RunParameter extends CenterlineParameter {
  measurement?: CenterlineMeasurement;
  validationStatus?: 'valid' | 'warning' | 'out_of_spec' | 'pending';
}

function getValidationStatus(value: number | null, param: CenterlineParameter): 'valid' | 'warning' | 'out_of_spec' | 'pending' {
  if (value === null || value === undefined) return 'pending';
  
  const min = Number(param.minValue);
  const max = Number(param.maxValue);
  const target = Number(param.targetValue);
  
  if (value < min || value > max) return 'out_of_spec';
  
  const tolerance = (max - min) * 0.1;
  if (value < min + tolerance || value > max - tolerance) return 'warning';
  
  return 'valid';
}

function getDeviationIcon(value: number | null, target: number) {
  if (value === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > target) return <TrendingUp className="h-4 w-4 text-amber-500" />;
  if (value < target) return <TrendingDown className="h-4 w-4 text-amber-500" />;
  return <Target className="h-4 w-4 text-green-500" />;
}

export default function CenterliningRunPage() {
  const params = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentParamIndex, setCurrentParamIndex] = useState(0);
  const [measurementValue, setMeasurementValue] = useState("");
  const [notes, setNotes] = useState("");

  const { data: run, isLoading: runLoading } = useQuery<CenterlineRunResponse>({
    queryKey: ["/api/centerlining/runs", params.runId],
  });

  const submitMeasurementMutation = useMutation({
    mutationFn: async (data: { parameterId: string; measuredValue: number; notes?: string }) => {
      return apiRequest("POST", `/api/centerlining/runs/${params.runId}/measurements`, {
        parameterId: data.parameterId,
        measuredValue: data.measuredValue,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/runs", params.runId] });
      toast({ title: "Measurement recorded", description: "Moving to next parameter..." });
      setMeasurementValue("");
      setNotes("");
      if (parameters && currentParamIndex < parameters.length - 1) {
        setCurrentParamIndex(currentParamIndex + 1);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit measurement", variant: "destructive" });
    },
  });

  const completeRunMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/centerlining/runs/${params.runId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centerlining/runs"] });
      toast({ title: "Run completed!", description: "Centerlining verification finished" });
      setLocation("/operations");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete run", variant: "destructive" });
    },
  });

  const parameters: RunParameter[] = (run?.parameters || []).map((param: CenterlineParameter) => {
    const measurement = run?.measurements?.find(m => m.parameterId === param.id);
    return {
      ...param,
      measurement,
      validationStatus: measurement 
        ? getValidationStatus(Number(measurement.measuredValue), param)
        : 'pending',
    };
  });

  const currentParam = parameters[currentParamIndex];
  const completedCount = parameters.filter(p => p.measurement).length;
  const progress = parameters.length > 0 ? (completedCount / parameters.length) * 100 : 0;

  const outOfSpecCount = parameters.filter(p => p.validationStatus === 'out_of_spec').length;
  const warningCount = parameters.filter(p => p.validationStatus === 'warning').length;

  const handleSubmitMeasurement = () => {
    if (!currentParam || !measurementValue) return;
    const value = parseFloat(measurementValue);
    if (isNaN(value)) {
      toast({ title: "Invalid value", description: "Please enter a valid number", variant: "destructive" });
      return;
    }
    submitMeasurementMutation.mutate({
      parameterId: currentParam.id,
      measuredValue: value,
      notes: notes || undefined,
    });
  };

  const handleCompleteRun = () => {
    completeRunMutation.mutate();
  };

  const getLiveValidation = (): 'valid' | 'warning' | 'out_of_spec' | 'pending' | null => {
    if (!measurementValue || !currentParam) return null;
    const value = parseFloat(measurementValue);
    if (isNaN(value)) return null;
    return getValidationStatus(value, currentParam);
  };

  const liveValidation = getLiveValidation();

  if (runLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Run not found</p>
            <Button className="mt-4" onClick={() => setLocation("/operations")}>
              Back to Operations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allParamsCompleted = completedCount === parameters.length && parameters.length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/operations")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-template-name">{run.template?.name}</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-equipment-name">
            {run.equipment?.name} - {run.equipment?.location}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Target className="h-3 w-3" />
          Verification
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-green-500" data-testid="text-in-spec-count">
              {parameters.filter(p => p.validationStatus === 'valid').length}
            </div>
            <div className="text-xs text-muted-foreground">In Spec</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-amber-500" data-testid="text-warning-count">
              {warningCount}
            </div>
            <div className="text-xs text-muted-foreground">Warning</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-red-500" data-testid="text-out-of-spec-count">
              {outOfSpecCount}
            </div>
            <div className="text-xs text-muted-foreground">Out of Spec</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground" data-testid="text-progress">
              {completedCount} of {parameters.length} parameters
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {parameters.map((param, index) => (
          <button
            key={param.id}
            onClick={() => setCurrentParamIndex(index)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              index === currentParamIndex
                ? "border-primary bg-primary/10"
                : param.validationStatus === 'valid'
                ? "border-green-500/50 bg-green-500/10"
                : param.validationStatus === 'warning'
                ? "border-amber-500/50 bg-amber-500/10"
                : param.validationStatus === 'out_of_spec'
                ? "border-red-500/50 bg-red-500/10"
                : "border-muted hover-elevate"
            }`}
            data-testid={`button-param-nav-${param.id}`}
          >
            {param.validationStatus === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {param.validationStatus === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500" />}
            {param.validationStatus === 'out_of_spec' && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {param.validationStatus === 'pending' && <Target className={`h-4 w-4 ${index === currentParamIndex ? "text-primary" : "text-muted-foreground"}`} />}
            <span className="text-sm whitespace-nowrap">
              {index + 1}. {param.name.slice(0, 12)}{param.name.length > 12 ? "..." : ""}
            </span>
          </button>
        ))}
      </div>

      {currentParam && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6" />
              <div>
                <CardTitle className="text-primary-foreground" data-testid="text-current-param-name">
                  {currentParam.name}
                </CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Parameter {currentParamIndex + 1} of {parameters.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Minimum</div>
                <div className="text-lg font-mono font-bold text-red-500" data-testid="text-min-value">
                  {currentParam.minValue} {currentParam.unit}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Target</div>
                <div className="text-xl font-mono font-bold text-green-500" data-testid="text-target-value">
                  {currentParam.targetValue} {currentParam.unit}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Maximum</div>
                <div className="text-lg font-mono font-bold text-red-500" data-testid="text-max-value">
                  {currentParam.maxValue} {currentParam.unit}
                </div>
              </div>
            </div>

            {currentParam.measurement ? (
              <div className={`p-4 rounded-lg border ${
                currentParam.validationStatus === 'valid'
                  ? "bg-green-500/10 border-green-500/50"
                  : currentParam.validationStatus === 'warning'
                  ? "bg-amber-500/10 border-amber-500/50"
                  : "bg-red-500/10 border-red-500/50"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Recorded Value</div>
                    <div className="text-2xl font-mono font-bold flex items-center gap-2">
                      {currentParam.measurement.measuredValue} {currentParam.unit}
                      {getDeviationIcon(Number(currentParam.measurement.measuredValue), Number(currentParam.targetValue))}
                    </div>
                  </div>
                  <Badge variant={
                    currentParam.validationStatus === 'valid' ? 'default' :
                    currentParam.validationStatus === 'warning' ? 'secondary' : 'destructive'
                  }>
                    {currentParam.validationStatus === 'valid' && "In Spec"}
                    {currentParam.validationStatus === 'warning' && "Near Limit"}
                    {currentParam.validationStatus === 'out_of_spec' && "Out of Spec"}
                  </Badge>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Enter Measured Value ({currentParam.unit})
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="any"
                      value={measurementValue}
                      onChange={(e) => setMeasurementValue(e.target.value)}
                      placeholder={`Target: ${currentParam.targetValue}`}
                      className={`text-xl font-mono pr-20 ${
                        liveValidation === 'valid' ? "border-green-500 focus-visible:ring-green-500" :
                        liveValidation === 'warning' ? "border-amber-500 focus-visible:ring-amber-500" :
                        liveValidation === 'out_of_spec' ? "border-red-500 focus-visible:ring-red-500" : ""
                      }`}
                      data-testid="input-measurement-value"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currentParam.unit}
                    </span>
                  </div>
                  {liveValidation && (
                    <div className={`mt-2 text-sm flex items-center gap-1 ${
                      liveValidation === 'valid' ? "text-green-500" :
                      liveValidation === 'warning' ? "text-amber-500" : "text-red-500"
                    }`}>
                      {liveValidation === 'valid' && <><CheckCircle2 className="h-4 w-4" /> Within specification</>}
                      {liveValidation === 'warning' && <><AlertCircle className="h-4 w-4" /> Near specification limit</>}
                      {liveValidation === 'out_of_spec' && <><AlertTriangle className="h-4 w-4" /> Outside specification range</>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any observations..."
                    className="min-h-20"
                    data-testid="input-measurement-notes"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {currentParamIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentParamIndex(currentParamIndex - 1)}
                  data-testid="button-previous-param"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
              <div className="flex-1" />
              {!currentParam.measurement && (
                <Button
                  onClick={handleSubmitMeasurement}
                  disabled={submitMeasurementMutation.isPending || !measurementValue}
                  data-testid="button-submit-measurement"
                >
                  {submitMeasurementMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Record Measurement
                </Button>
              )}
              {currentParam.measurement && currentParamIndex < parameters.length - 1 && (
                <Button onClick={() => setCurrentParamIndex(currentParamIndex + 1)} data-testid="button-next-param">
                  Next Parameter
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {allParamsCompleted && (
        <Card className={`border-2 ${
          outOfSpecCount > 0 ? "border-red-500/50 bg-red-500/5" :
          warningCount > 0 ? "border-amber-500/50 bg-amber-500/5" :
          "border-green-500/50 bg-green-500/5"
        }`}>
          <CardContent className="py-6 text-center">
            {outOfSpecCount > 0 ? (
              <>
                <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Verification Complete - Action Required</h3>
                <p className="text-muted-foreground mb-4">
                  {outOfSpecCount} parameter(s) are out of specification.
                </p>
              </>
            ) : warningCount > 0 ? (
              <>
                <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Verification Complete - Review Recommended</h3>
                <p className="text-muted-foreground mb-4">
                  {warningCount} parameter(s) are near specification limits.
                </p>
              </>
            ) : (
              <>
                <CheckCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All Parameters In Specification!</h3>
                <p className="text-muted-foreground mb-4">
                  All {parameters.length} parameters are within specification.
                </p>
              </>
            )}
            <Button
              size="lg"
              variant={outOfSpecCount > 0 ? "destructive" : "default"}
              onClick={handleCompleteRun}
              disabled={completeRunMutation.isPending}
              data-testid="button-finish-run"
            >
              {completeRunMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Finish Verification
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
