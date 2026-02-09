import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Users, Wrench, Package, ClipboardCheck, BarChart3, Trophy, Building2, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import type { Step, ProgramDocument, OpenFormDrawer } from "./types";
import {
  StepCard,
  HeaderProgress,
  StepOverview,
  ChecklistSection,
  ImprovementActionsSection,
  AssessmentSummarySection,
  NotesSection,
  StepActionsSection,
  ResourcesSection,
  StepDetailDialog
} from "./components";
import {
  useExcellenceProgress,
  useStepDeliverables,
  useStepProgressActions,
  useClientCompanies
} from "./hooks/useExcellenceProgress";
import {
  getStepProgressData,
  countCompletedTasks,
  calculateTotalTaskProgress,
  countCompletedSteps,
  getImplementationPhase
} from "./utils/progressCalculations";

// Step definitions with all their data
const STEPS: Step[] = [
  {
    id: 0,
    title: "Initial Process Assessment",
    icon: ClipboardCheck,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Evaluate current maintenance processes to generate your custom improvement roadmap",
    objective: "Conduct a comprehensive assessment of current maintenance practices using the Maintenance Process Scorecard. This foundational assessment identifies gaps in equipment management, failure tracking, PM strategies, and storeroom practices. Assessment results automatically generate a customized Step 1 checklist tailored to your facility's specific improvement needs.",
    timeline: "1-2 weeks",
    keyDeliverables: [
      "Complete Maintenance Process Scorecard assessment (100 points total)",
      "Gap analysis identifying improvement opportunities by category",
      "Custom Step 1 checklist generated based on assessment gaps",
      "Baseline maturity score for future comparison",
      "Priority ranking of improvement areas by impact (8-point items are critical)",
      "Assessment report with observations and recommendations"
    ],
    checklist: [
      { id: "0-1", text: "Complete the Maintenance Process Assessment Scorecard with cross-functional team", deliverable: "Scored assessment with all 23 elements rated, comments documented, and custom improvement checklist generated" }
    ]
  },
  {
    id: 1,
    title: "Equipment Criticality Assessment",
    icon: Target,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Establish equipment priorities using risk-based methodology",
    objective: "Create a comprehensive ABC criticality classification for all equipment using systematic scoring methodology (FMEA/Risk Matrix). This foundational step ensures maintenance resources are focused on assets with highest business impact.",
    timeline: "4-6 weeks",
    keyDeliverables: [
      "Complete equipment inventory with asset hierarchy",
      "5x5 criticality scoring matrix (Safety, Environment, Production, Quality, MTTR, Cost)",
      "ABC classification applied to all equipment (A=Critical 10-15%, B=Important 20-30%, C=Non-critical 55-70%)",
      "FMEA completed for top 10 critical assets",
      "Risk heat map visualization",
      "Baseline KPI dashboard (MTBF, MTTR, OEE, downtime %)"
    ],
    checklist: [
      { id: "1-1", text: "Collect existing equipment lists from all departments", deliverable: "Equipment lists from operations, EHS, engineering, and finance consolidated" },
      { id: "1-2", text: "Verify equipment nameplate data in field (walk-through)", deliverable: "Physical verification of 100% equipment with photos and nameplate details" },
      { id: "1-3", text: "Build hierarchical equipment registry (Site→Area→Line→Equipment→Component)", deliverable: "Master equipment list with 5-level hierarchy structure in Excel/CMMS" },
      { id: "1-4", text: "Assign unique asset ID tags to all equipment", deliverable: "Sequential asset ID numbering scheme with labels applied to equipment" },
      { id: "1-5", text: "Document equipment specifications (make, model, year, capacity, criticality notes)", deliverable: "Complete equipment database with technical specifications" },
      { id: "1-6", text: "Define criticality scoring matrix with cross-functional team", deliverable: "5x5 matrix across 6 criteria: Safety, Environment, Production Impact, Quality, MTTR, Cost" },
      { id: "1-7", text: "Conduct scoring workshops with operations, maintenance, and engineering", deliverable: "Workshop attendance records with consensus scores for each criterion" },
      { id: "1-8", text: "Score all equipment using defined matrix (Safety 1-5, Environment 1-5, etc.)", deliverable: "Criticality scores calculated for 100% of equipment with total weighted scores" },
      { id: "1-9", text: "Calculate composite criticality scores (weighted average across 6 criteria)", deliverable: "Single criticality score per asset (0-100 scale)" },
      { id: "1-10", text: "Apply ABC classification using Pareto principle", deliverable: "A-Critical (10-15%), B-Important (20-30%), C-Non-critical (55-70%) distribution" },
      { id: "1-11", text: "Validate A-critical equipment with plant manager approval", deliverable: "Sign-off from operations confirming critical asset list accuracy" },
      { id: "1-12", text: "Conduct detailed FMEA on top 10 critical assets", deliverable: "FMEA worksheets with failure modes, effects, and RPN scores >100" },
      { id: "1-13", text: "Extract 12-month historical failure data from CMMS/maintenance logs", deliverable: "Failure records for all A+B equipment with root cause coding" },
      { id: "1-14", text: "Calculate baseline MTBF for each A-critical asset", deliverable: "Mean Time Between Failure calculated from historical downtime data" },
      { id: "1-15", text: "Calculate baseline MTTR for each A-critical asset", deliverable: "Mean Time To Repair averaged from work order completion times" },
      { id: "1-16", text: "Calculate Overall Equipment Effectiveness (OEE) baseline", deliverable: "OEE = Availability x Performance x Quality for critical production lines" },
      { id: "1-17", text: "Build risk matrix visualization (5x5 heat map)", deliverable: "Heat map with equipment plotted by consequence (Y-axis) and frequency (X-axis)" },
      { id: "1-18", text: "Create KPI dashboard showing criticality distribution and baseline metrics", deliverable: "Visual dashboard: ABC pie chart, MTBF/MTTR trends, top 10 bad actors" },
      { id: "1-19", text: "Prepare executive presentation deck with findings and recommendations", deliverable: "20-slide PowerPoint: current state, criticality results, gaps, action plan" },
      { id: "1-20", text: "Present to leadership and obtain approval to proceed to next phase", deliverable: "Signed approval to implement RCA system and optimize maintenance resources" }
    ]
  },
  {
    id: 2,
    title: "Root Cause Analysis System",
    icon: Users,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "Build problem-solving capabilities using 5 Whys and Fishbone methodologies",
    objective: "Transform organization from reactive firefighting to proactive problem-solving. Equip teams with RCA methodologies (5 Whys, Fishbone, FMEA) and embed continuous improvement culture where failures become learning opportunities.",
    timeline: "8-12 weeks",
    keyDeliverables: [
      "RCA training curriculum delivered to 100% of maintenance staff",
      "Documented RCA policy with mandatory triggers",
      "RCA Oracle digital system implemented",
      "Completed RCAs for 5 recent failures (practice exercises)",
      "Weekly RCA review meeting established",
      "3-tier certification program launched",
      "Monthly effectiveness scorecard tracking repeat failures"
    ],
    checklist: [
      { id: "2-1", text: "Research best-practice RCA methodologies (5 Whys, Fishbone, FMEA, Apollo, TapRooT)", deliverable: "Comparison matrix of methodologies with pros/cons for your industry" },
      { id: "2-2", text: "Select primary and secondary RCA methods for organization", deliverable: "Decision document selecting 5 Whys (simple) and Fishbone (complex)" },
      { id: "2-3", text: "Design 8-hour RCA training curriculum", deliverable: "Training agenda, PowerPoint slides, workbooks, and 3 case study exercises" },
      { id: "2-4", text: "Develop RCA policy document with mandatory triggers", deliverable: "2-page policy: When to RCA (safety incident, >4hr downtime, repeat failure, $10K+ cost)" },
      { id: "2-5", text: "Create RCA facilitator guide and templates", deliverable: "Facilitator handbook with meeting scripts, templates, and facilitation tips" },
      { id: "2-6", text: "Schedule and deliver training to all maintenance technicians (Day shift)", deliverable: "8-hour training session with 100% attendance and sign-in sheets" },
      { id: "2-7", text: "Schedule and deliver training to all maintenance technicians (Night shift)", deliverable: "8-hour training session with 100% attendance and sign-in sheets" },
      { id: "2-8", text: "Schedule and deliver training to operations supervisors and engineers", deliverable: "4-hour condensed training for cross-functional team participation" },
      { id: "2-9", text: "Administer post-training assessment quiz (target 80%+ pass rate)", deliverable: "Quiz results showing competency in 5 Whys and Fishbone techniques" },
      { id: "2-10", text: "Implement RCA Oracle digital system in MaintenanceHub", deliverable: "RCA module configured with AI assistant and structured forms" },
      { id: "2-11", text: "Integrate RCA Oracle with work order and equipment databases", deliverable: "System linkages allowing RCAs to reference equipment and failure history" },
      { id: "2-12", text: "Complete first practice RCA on recent unplanned downtime event", deliverable: "Documented RCA with 5 Whys, root causes, and 3+ corrective actions" },
      { id: "2-13", text: "Complete second practice RCA on quality defect or safety near-miss", deliverable: "Fishbone diagram with 6M categories and verified root causes" },
      { id: "2-14", text: "Complete third practice RCA on chronic repeat failure", deliverable: "RCA showing pattern of failures and systemic root cause identified" },
      { id: "2-15", text: "Complete fourth and fifth practice RCAs on additional events", deliverable: "Two more RCAs practicing methodology and building team capability" },
      { id: "2-16", text: "Establish weekly RCA review meeting (standing Friday 10am)", deliverable: "Calendar invites sent, agenda template created, meeting minutes format" },
      { id: "2-17", text: "Conduct first RCA review meeting with leadership attendance", deliverable: "Meeting minutes showing 5 RCAs reviewed with action item assignments" },
      { id: "2-18", text: "Build 3-tier RCA certification program", deliverable: "Level 1 (Participant), Level 2 (Facilitator), Level 3 (Master) with requirements" },
      { id: "2-19", text: "Certify 5+ staff to Level 2 (RCA Facilitator) status", deliverable: "Certification records for facilitators qualified to lead RCA sessions" },
      { id: "2-20", text: "Create RCA effectiveness scorecard", deliverable: "Monthly metrics: # RCAs completed, avg time to close actions, % repeat failures" },
      { id: "2-21", text: "Track repeat failure rate trending downward", deliverable: "Dashboard showing repeat failure rate decreasing month-over-month" },
      { id: "2-22", text: "Document 3 success stories with quantified savings", deliverable: "Case studies: Problem, RCA findings, actions taken, $ savings realized" }
    ]
  },
  {
    id: 3,
    title: "Storeroom MRO Optimization",
    icon: Package,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Transform storeroom using ABC analysis, EOQ, and digital tracking",
    objective: "Optimize MRO storeroom from cost center to strategic reliability asset. Reduce inventory carrying costs by 20-30% while improving parts availability using ABC analysis, EOQ calculations, and modern tracking systems.",
    timeline: "6-8 weeks",
    keyDeliverables: [
      "100% physical inventory audit with reconciliation",
      "ABC analysis applied to all parts",
      "EOQ calculations for A+B items",
      "Min/Max levels set with safety stock",
      "Equipment Bill of Materials for critical assets",
      "Redesigned storeroom layout",
      "Barcode system implemented",
      "Inventory performance dashboard"
    ],
    checklist: [
      { id: "3-1", text: "Freeze storeroom activity for 2-day physical inventory count", deliverable: "Communication plan and schedule for complete inventory shutdown" },
      { id: "3-2", text: "Assemble cross-functional count team (ops, maintenance, finance)", deliverable: "Team of 6-8 people assigned with roles and bin assignments" },
      { id: "3-3", text: "Conduct physical count of all storeroom items with dual verification", deliverable: "Count sheets completed with two independent counters per bin" },
      { id: "3-4", text: "Enter count data into spreadsheet and reconcile to system records", deliverable: "Variance report showing discrepancies >10% or >$1,000 value" },
      { id: "3-5", text: "Investigate and resolve major variances (recount, adjust records)", deliverable: "Reconciled inventory with <2% variance and documented adjustments" },
      { id: "3-6", text: "Calculate total storeroom inventory valuation", deliverable: "Total dollar value of inventory by category (rotating, insurance, consumables)" },
      { id: "3-7", text: "Extract 12-month usage data from work orders and issue transactions", deliverable: "Parts consumption history showing quantity and dollar value per SKU" },
      { id: "3-8", text: "Perform ABC analysis using annual consumption value (Pareto 80/20)", deliverable: "A-items (80% of spend), B-items (15% of spend), C-items (5% of spend)" },
      { id: "3-9", text: "Calculate Economic Order Quantity (EOQ) for all A and B items", deliverable: "EOQ formula results minimizing ordering + carrying costs per SKU" },
      { id: "3-10", text: "Determine lead times from suppliers for all A and B items", deliverable: "Supplier lead time data (avg days from PO to receipt) per part" },
      { id: "3-11", text: "Calculate safety stock levels based on lead time and usage variability", deliverable: "Safety stock quantities protecting against stockouts during lead time" },
      { id: "3-12", text: "Set reorder points (Min = Lead Time Demand + Safety Stock)", deliverable: "Min levels triggering replenishment for all stocked items" },
      { id: "3-13", text: "Set maximum stock levels (Max = Reorder Point + EOQ)", deliverable: "Max levels preventing overstock and excess carrying costs" },
      { id: "3-14", text: "Identify and phase out obsolete/slow-moving parts (>24 months no usage)", deliverable: "Obsolescence list with disposal plan and expected recovery value" },
      { id: "3-15", text: "Build Bill of Materials (BoM) for all A-critical equipment", deliverable: "BoM showing critical spare parts required for each A-critical asset" },
      { id: "3-16", text: "Identify long-lead or sole-source critical spares requiring insurance stock", deliverable: "Insurance stock list with justification and carrying cost analysis" },
      { id: "3-17", text: "Redesign storeroom layout using 5S principles (Sort, Set, Shine, Standardize, Sustain)", deliverable: "Layout drawing with fast-movers near issue window, FIFO flow, ergonomic placement" },
      { id: "3-18", text: "Implement visual controls (bin labels, floor markings, shadow boards)", deliverable: "Photos showing labeled bins, color-coded zones, and tool shadow boards" },
      { id: "3-19", text: "Install barcode labels on all bins and issue barcode scanners", deliverable: "Barcode system integrated with MaintenanceHub parts inventory module" },
      { id: "3-20", text: "Train storeroom staff on new system and procedures", deliverable: "Training records for all staff on ABC, Min/Max, barcode scanning, cycle counting" },
      { id: "3-21", text: "Establish cycle counting program (A-monthly, B-quarterly, C-annually)", deliverable: "Cycle count calendar with daily count assignments and accuracy targets" },
      { id: "3-22", text: "Create storeroom performance dashboard", deliverable: "KPI dashboard: inventory accuracy %, turnover ratio, stockout rate, carrying cost" }
    ]
  },
  {
    id: 4,
    title: "Preventive Maintenance Excellence",
    icon: Wrench,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Optimize PM program using RCM principles and predictive technologies",
    objective: "Transform PM program from time-based to condition-based using Reliability-Centered Maintenance (RCM) principles. Reduce unnecessary PMs by 30-40% while improving critical asset protection through predictive technologies.",
    timeline: "8-12 weeks",
    keyDeliverables: [
      "Current PM program audit findings",
      "RCM analysis for critical equipment",
      "Optimized PM schedules based on failure modes",
      "Condition-based monitoring strategy",
      "PM procedure standardization",
      "Planner/scheduler role established",
      "PM compliance dashboard (target >95%)",
      "Cost-benefit analysis showing savings"
    ],
    checklist: [
      { id: "4-1", text: "Extract all current PMs from CMMS (schedule, frequency, tasks, labor hours)", deliverable: "Complete PM list with current frequencies and estimated annual labor burden" },
      { id: "4-2", text: "Audit PM effectiveness using 12-month failure history", deliverable: "Analysis showing which PMs prevented failures vs. which are ineffective" },
      { id: "4-3", text: "Identify PM gaps (critical equipment with no PM coverage)", deliverable: "Gap list showing A-critical assets lacking adequate preventive maintenance" },
      { id: "4-4", text: "Identify PM overlaps and redundancies (same task multiple frequencies)", deliverable: "Consolidation opportunities reducing duplicate PM effort" },
      { id: "4-5", text: "Research RCM (Reliability-Centered Maintenance) methodology and SAE JA1011 standard", deliverable: "RCM reference guide and decision logic tree for team training" },
      { id: "4-6", text: "Form cross-functional RCM team (ops, maintenance, engineering, EHS)", deliverable: "RCM team roster with assigned equipment focus areas" },
      { id: "4-7", text: "Conduct RCM analysis on top 20 A-critical equipment", deliverable: "RCM worksheets documenting: functions, functional failures, failure modes, effects, consequences" },
      { id: "4-8", text: "Apply RCM decision logic to select optimal maintenance tasks", deliverable: "RCM decisions: Condition-directed, time-directed, failure-finding, or run-to-failure" },
      { id: "4-9", text: "Calculate P-F intervals for condition-based tasks using historical data", deliverable: "P-F curves showing optimal inspection intervals before functional failure" },
      { id: "4-10", text: "Optimize time-based PM frequencies using MTBF (Mean Time Between Failures)", deliverable: "Revised PM frequencies: if MTBF=2000hrs, PM at 1600hrs (80% of MTBF)" },
      { id: "4-11", text: "Develop condition-based monitoring (CBM) strategy for critical rotating equipment", deliverable: "CBM plan: vibration analysis on pumps/motors, thermography on electrical, oil analysis on gearboxes" },
      { id: "4-12", text: "Procure condition monitoring equipment (vibration pen, thermal camera, oil test kits)", deliverable: "Equipment purchased with calibration certificates and user manuals" },
      { id: "4-13", text: "Train technicians on CBM technologies and data interpretation", deliverable: "Training records: vibration analysis (ISO 18436), thermography (Level 1), oil analysis sampling" },
      { id: "4-14", text: "Eliminate low-value PMs (no failures prevented, high cost)", deliverable: "List of eliminated PMs with projected annual labor savings (target 30-40% reduction)" },
      { id: "4-15", text: "Standardize remaining PM task procedures with visual work instructions", deliverable: "PM procedures with step-by-step photos, torque specs, safety warnings, quality checks" },
      { id: "4-16", text: "Create PM task library in CMMS with templated checklists", deliverable: "Standardized PM tasks ready to assign to equipment (e.g., 'Monthly Motor PM Template')" },
      { id: "4-17", text: "Establish dedicated planner/scheduler role (full-time or 50% assignment)", deliverable: "Job description posted, candidate hired/assigned, workspace and tools provided" },
      { id: "4-18", text: "Train planner on CMMS, scheduling rules, and backlog management", deliverable: "Planner training complete: PM generation, work order prioritization, parts kitting, schedule optimization" },
      { id: "4-19", text: "Build 52-week rolling PM schedule optimized by crew, skills, and shutdown windows", deliverable: "Annual PM calendar with labor loading balanced and shutdown coordination" },
      { id: "4-20", text: "Implement PM compliance tracking dashboard", deliverable: "Weekly dashboard: PM compliance % (target >95%), overdue PMs, completion trends" },
      { id: "4-21", text: "Calculate cost-benefit analysis of PM optimization", deliverable: "ROI report: labor hours saved, materials reduced, downtime avoided, projected annual savings" },
      { id: "4-22", text: "Present PM Excellence results to leadership with 3-year roadmap", deliverable: "Executive presentation: current state vs. optimized state, savings realized, next steps (IoT, AI/ML)" }
    ]
  },
  {
    id: 5,
    title: "Data-Driven Performance Management",
    icon: BarChart3,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    description: "Implement KPI dashboards and continuous improvement culture",
    objective: "Build data-driven reliability culture with real-time KPI tracking, automated reporting, and daily management systems. Enable leadership visibility into maintenance performance and establish continuous improvement routines.",
    timeline: "4-6 weeks",
    keyDeliverables: [
      "Maintenance KPI dashboard (15-20 metrics)",
      "Automated weekly/monthly reports",
      "Daily management boards for shop floor",
      "OEE tracking system",
      "Work order metrics analysis",
      "Quarterly business reviews",
      "Benchmarking against industry standards",
      "Improvement project tracking"
    ],
    checklist: [
      { id: "5-1", text: "Research industry-standard maintenance KPIs (SMRP Best Practices)", deliverable: "KPI reference guide with definitions and calculation formulas" },
      { id: "5-2", text: "Select 15-20 KPIs aligned to business objectives", deliverable: "KPI list: MTBF, MTTR, OEE, PM compliance %, reactive %, schedule compliance %, wrench time %, parts availability %, inventory turnover, downtime hours, safety incidents, training hours, backlog weeks, emergency work %, labor productivity" },
      { id: "5-3", text: "Calculate 12-month baseline for each KPI using historical data", deliverable: "Baseline KPI dashboard showing current state performance" },
      { id: "5-4", text: "Set target KPIs based on industry benchmarks and improvement goals", deliverable: "Target KPIs: PM compliance >95%, reactive work <20%, MTBF +25%, MTTR -30%, OEE >85%" },
      { id: "5-5", text: "Identify world-class benchmark performance for each KPI", deliverable: "World-class reference: PM compliance 99%, reactive work 10%, OEE 90%+" },
      { id: "5-6", text: "Design real-time KPI dashboard in MaintenanceHub Reports module", deliverable: "Live dashboard showing color-coded KPIs (red/yellow/green) updated hourly" },
      { id: "5-7", text: "Configure automated data feeds from CMMS to dashboard", deliverable: "Data connections: work orders, equipment, PMs, downtime, inventory pulling automatically" },
      { id: "5-8", text: "Build weekly maintenance report template", deliverable: "Automated report: PM compliance, reactive backlog, top 5 bad actors, safety, action items" },
      { id: "5-9", text: "Build monthly maintenance report template", deliverable: "Automated report: KPI trends, cost analysis, RCA summary, training, budget variance" },
      { id: "5-10", text: "Schedule automated report distribution to leadership", deliverable: "Email automation: weekly reports Monday 8am, monthly reports 1st of month" },
      { id: "5-11", text: "Design daily management boards for shop floor (Tier 1 meetings)", deliverable: "Visual boards showing: today's priorities, yesterday's wins, safety, quality, delivery metrics" },
      { id: "5-12", text: "Install physical boards or digital displays in maintenance shop", deliverable: "Boards mounted in high-traffic area with laminated metrics and dry-erase sections" },
      { id: "5-13", text: "Establish daily 15-minute stand-up meetings at the board (Tier 1)", deliverable: "Standing daily meeting 7:00am with attendance tracking and action log" },
      { id: "5-14", text: "Implement OEE (Overall Equipment Effectiveness) tracking system", deliverable: "OEE calculated: Availability x Performance x Quality for all critical production lines" },
      { id: "5-15", text: "Configure OEE data collection (downtime logging, speed tracking, quality defects)", deliverable: "OEE data flowing from production systems into MaintenanceHub automatically" },
      { id: "5-16", text: "Analyze work order trends to identify chronic problems", deliverable: "Monthly Pareto analysis: top 10 equipment by downtime, top 10 failure modes, top 10 cost drivers" },
      { id: "5-17", text: "Conduct root cause analysis on top bad actors identified in trend analysis", deliverable: "RCAs completed for #1-3 highest downtime assets with corrective action plans" },
      { id: "5-18", text: "Establish quarterly business review (QBR) meeting with leadership", deliverable: "QBR calendar scheduled, 2-hour meeting format, standard agenda template created" },
      { id: "5-19", text: "Create QBR presentation template", deliverable: "PowerPoint deck: executive summary, KPI dashboard, wins, challenges, ROI, 90-day action plan" },
      { id: "5-20", text: "Conduct first QBR presenting maintenance performance and improvement roadmap", deliverable: "QBR meeting minutes with leadership feedback and approved action items" },
      { id: "5-21", text: "Benchmark performance against industry standards (ISEMC, SMRP, plant networks)", deliverable: "Benchmark report showing performance gaps vs. peer companies and best-in-class" },
      { id: "5-22", text: "Develop 90-day continuous improvement action plan based on data insights", deliverable: "Action plan with 5-10 improvement projects, owners, timelines, and expected impact" }
    ]
  },
  {
    id: 6,
    title: "Continuous Improvement & Sustainability",
    icon: Trophy,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Embed maintenance excellence into organizational culture",
    objective: "Sustain gains and drive continuous improvement through TPM (Total Productive Maintenance), operator care programs, and recognition systems. Transform maintenance from cost center to competitive advantage.",
    timeline: "Ongoing",
    keyDeliverables: [
      "Autonomous maintenance program (TPM Pillar 1)",
      "Operator care training curriculum",
      "Daily equipment inspections system",
      "Recognition and rewards program",
      "Continuous improvement Kaizen events",
      "Reliability engineering roadmap",
      "Training competency matrix",
      "Annual excellence assessment"
    ],
    checklist: [
      { id: "6-1", text: "Research TPM (Total Productive Maintenance) methodology and 8 pillars", deliverable: "TPM reference guide explaining all 8 pillars with implementation approach" },
      { id: "6-2", text: "Select TPM Pillar 1 (Autonomous Maintenance) as first focus area", deliverable: "Implementation plan for operator ownership of routine equipment care" },
      { id: "6-3", text: "Define operator ownership zones (assign equipment to specific operators)", deliverable: "Equipment ownership map with operator names assigned to machines/lines" },
      { id: "6-4", text: "Develop autonomous maintenance 7-step methodology", deliverable: "7 Steps: Initial cleaning, eliminate contamination sources, set standards, general inspection, autonomous inspection, organization/tidiness, full autonomous maintenance" },
      { id: "6-5", text: "Design operator care training curriculum", deliverable: "Training modules: clean-inspect-lubricate (CIL), defect identification, minor adjustments, 5S, safety" },
      { id: "6-6", text: "Deliver operator care training to 100% of production operators", deliverable: "Training attendance records for all shifts with hands-on equipment exercises" },
      { id: "6-7", text: "Create visual daily inspection checklists for each equipment type", deliverable: "Laminated pre-shift inspection sheets with photos and normal/abnormal examples" },
      { id: "6-8", text: "Implement defect tagging system (red tags for operators to flag issues)", deliverable: "Red tag process: operator applies tag, maintenance responds within 24hrs, close-out tracking" },
      { id: "6-9", text: "Establish daily 5-minute pre-shift equipment walkaround inspections", deliverable: "Inspection compliance tracking showing >90% daily completion by operators" },
      { id: "6-10", text: "Launch 5S program in maintenance shop (Sort, Set, Shine, Standardize, Sustain)", deliverable: "5S audit checklist with before/after photos and monthly compliance scores" },
      { id: "6-11", text: "Design recognition and rewards program for maintenance excellence", deliverable: "Program charter: Monthly awards (Safety Star, RCA Champion, Uptime Hero), criteria, prizes" },
      { id: "6-12", text: "Launch recognition program with first monthly awards ceremony", deliverable: "Award ceremony photos, winner announcements, tracking of winners over time" },
      { id: "6-13", text: "Plan first Kaizen improvement event (3-5 day focused blitz)", deliverable: "Kaizen charter: problem statement, team, scope, goals, timeline, resources" },
      { id: "6-14", text: "Facilitate Kaizen event following structured A3 problem-solving", deliverable: "Completed A3 report: current state, root cause, countermeasures, results, standardization" },
      { id: "6-15", text: "Document Kaizen results and savings (labor, materials, downtime avoided)", deliverable: "Kaizen storyboard showing before/after metrics and annualized savings ($XX,XXX)" },
      { id: "6-16", text: "Schedule 3 additional Kaizen events for the year (quarterly cadence)", deliverable: "Kaizen calendar with topics, dates, facilitators, and expected participants" },
      { id: "6-17", text: "Build 3-year reliability engineering technology roadmap", deliverable: "Roadmap: Year 1 (CBM expansion), Year 2 (IoT sensors, predictive analytics), Year 3 (AI/ML, digital twins)" },
      { id: "6-18", text: "Pilot IoT condition monitoring on 2-3 critical assets", deliverable: "IoT pilot: sensors installed, data streaming to cloud, alerts configured, ROI tracked" },
      { id: "6-19", text: "Create competency matrix for maintenance technicians", deliverable: "Skills matrix: rows=technicians, columns=skills (electrical, mechanical, welding, PLC, etc.), colored by proficiency" },
      { id: "6-20", text: "Identify training gaps and develop individual development plans (IDPs)", deliverable: "Training needs analysis with annual training budget and course schedule" },
      { id: "6-21", text: "Conduct annual maintenance excellence assessment", deliverable: "Assessment using world-class framework (e.g., SMRP Best Practices, TPM Prize criteria)" },
      { id: "6-22", text: "Develop next-year improvement plan based on assessment findings", deliverable: "Annual improvement plan: gaps identified, priorities, projects, budget, owners, timelines" },
      { id: "6-23", text: "Celebrate wins and communicate success stories across organization", deliverable: "Communication plan: newsletter articles, leadership presentations, team celebrations, lessons learned" }
    ]
  }
];

// Map checklist items to their available forms
const CHECKLIST_FORMS: Record<string, string> = {
  // Step 0: Initial Process Assessment
  "0-1": "process_assessment",

  // Step 1: Equipment Criticality Assessment
  "1-1": "equipment_inventory",
  "1-3": "equipment_inventory",
  "1-6": "criticality_matrix",
  "1-7": "criticality_matrix",
  "1-8": "criticality_matrix",
  "1-9": "criticality_matrix",
  "1-10": "criticality_matrix",
  "1-12": "fmea_analysis",
  "1-14": "rail_tracker",
  "1-15": "roadmap_init",

  // Step 2: Root Cause Analysis System
  "2-2": "bda_analysis",
  "2-3": "bda_analysis",
  "2-10": "bda_analysis",
  "2-15": "rail_tracker",

  // Step 3: Storeroom & MRO Optimization
  "3-8": "parts_abc_analysis",
  "3-9": "parts_abc_analysis",
  "3-10": "parts_abc_analysis",
  "3-11": "parts_abc_analysis",
  "3-12": "parts_abc_analysis",
  "3-13": "parts_abc_analysis",
  "3-15": "rail_tracker",

  // Step 4: PM Excellence
  "4-15": "rail_tracker",

  // Step 5: Data-Driven Performance Management
  "5-3": "scorecard",
  "5-4": "scorecard",
  "5-5": "scorecard",
  "5-15": "rail_tracker",

  // Step 6: Continuous Improvement & Sustainability
  "6-1": "change_agent",
  "6-2": "leadership_interview",
  "6-3": "leadership_observation",
  "6-15": "rail_tracker",
};

// Program Resources/Documents
const PROGRAM_DOCUMENTS: ProgramDocument[] = [
  {
    name: "BDA Process",
    fileName: "BDA Process.pdf",
    description: "Breakdown Analysis process guide for systematic failure investigation",
    type: "pdf",
    steps: [2, 5]
  },
  {
    name: "BDA Template",
    fileName: "BDA Template.xlsx",
    description: "Breakdown Analysis template for documenting failure investigations",
    type: "xlsx",
    steps: [2, 5]
  },
  {
    name: "Change-Agent Strategy and Scoring",
    fileName: "Change-Agent Strategy and Scoring.xlsx",
    description: "Framework for identifying and developing change agents within your organization",
    type: "xlsx",
    steps: [6]
  },
  {
    name: "Cross-Function Alignment",
    fileName: "Cross-Function Alignment .pdf",
    description: "Guide for aligning maintenance with operations, engineering, and other departments",
    type: "pdf",
    steps: [0]
  },
  {
    name: "IR Report",
    fileName: "IR Report.pdf",
    description: "Investigation Report template for structured incident documentation",
    type: "pdf",
    steps: [2]
  },
  {
    name: "Leadership Development Interview",
    fileName: "Leadership Dev Interview.xlsx",
    description: "Structured interview template for assessing and developing maintenance leadership",
    type: "xlsx",
    steps: [6]
  },
  {
    name: "Leadership Observations",
    fileName: "Leadership Observations.xlsx",
    description: "Template for documenting leadership behaviors and development opportunities",
    type: "xlsx",
    steps: [6]
  },
  {
    name: "Maintenance Process Scorecard",
    fileName: "Maint Process Scorecard Template.xltx",
    description: "Scorecard template for measuring maintenance process maturity",
    type: "xltx",
    steps: [5]
  },
  {
    name: "RAIL Assessment",
    fileName: "RAIL - Company-Facility.xlsx",
    description: "Reliability Assessment for Implementation Leadership - facility assessment tool",
    type: "xlsx",
    steps: [1, 0]
  },
  {
    name: "Rapid Turnaround Case Study",
    fileName: "Rapid Turnaround-C4-Mondelez Portland.pdf",
    description: "Real-world case study of maintenance excellence implementation",
    type: "pdf",
    steps: [0]
  },
  {
    name: "Roadmap for Initialization",
    fileName: "Roadmap for Initialization.xlsx",
    description: "Getting started roadmap for launching your maintenance excellence journey",
    type: "xlsx",
    steps: [0]
  },
  {
    name: "Union Improvement Topics",
    fileName: "Union Improvement topics.pdf",
    description: "Guide for engaging union stakeholders in maintenance improvement initiatives",
    type: "pdf",
    steps: [6]
  }
];

export default function ExcellencePath() {
  const [selectedStep, setSelectedStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [openFormDrawer, setOpenFormDrawer] = useState<OpenFormDrawer | null>(null);
  const [selectedClientCompanyId, setSelectedClientCompanyId] = useState<string | undefined>(undefined);
  const [showCreateCompanyDialog, setShowCreateCompanyDialog] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const { clientCompanies, isLoading: isLoadingCompanies } = useClientCompanies();

  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/client-companies", { name });
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/client-companies"] });
      const data = await response.json();
      setSelectedClientCompanyId(data.id);
      setShowCreateCompanyDialog(false);
      setNewCompanyName("");
    }
  });

  const {
    progress,
    isLoading,
    updateProgressMutation,
    overallProgress,
    user,
    toast
  } = useExcellenceProgress(selectedClientCompanyId);

  const { assessmentData } = useStepDeliverables(0, selectedClientCompanyId);

  const currentStepData = STEPS.find(s => s.id === selectedStep)!;

  // Get improvement actions for the current step
  const stepImprovementActions = assessmentData?.improvementActions?.filter(
    action => action.step === selectedStep
  ) || [];

  const stepProgressData = getStepProgressData(progress, selectedStep);
  const { completed: completedCount, total: totalCount } = countCompletedTasks(
    currentStepData.checklist,
    stepProgressData.checklist
  );

  const hasForm = (checklistItemId: string) => {
    return CHECKLIST_FORMS[checklistItemId] !== undefined;
  };

  const openForm = (checklistItemId: string) => {
    const formType = CHECKLIST_FORMS[checklistItemId];
    if (formType) {
      setOpenFormDrawer({ checklistItemId, formType });
    }
  };

  // PDF Generation for single step
  const generateStepReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text("Path to Excellence", 20, 20);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`Step ${selectedStep}: ${currentStepData.title}`, 20, 35);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Completion Date: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Completed by: ${user?.email || 'Unknown'}`, 20, 50);

    doc.setLineWidth(0.5);
    doc.setDrawColor(59, 130, 246);
    doc.line(20, 55, pageWidth - 20, 55);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Objective", 20, 65);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const objectiveLines = doc.splitTextToSize(currentStepData.objective, pageWidth - 40);
    doc.text(objectiveLines, 20, 72);

    let yPos = 72 + (objectiveLines.length * 5) + 10;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Key Deliverables", 20, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    currentStepData.keyDeliverables.forEach((deliverable, idx) => {
      const bullet = `${idx + 1}. ${deliverable}`;
      const lines = doc.splitTextToSize(bullet, pageWidth - 45);
      doc.text(lines, 25, yPos);
      yPos += lines.length * 5 + 2;

      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });

    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Checklist Completion", 20, yPos);
    yPos += 5;

    const checklistData = currentStepData.checklist.map(item => [
      item.text,
      stepProgressData.checklist[item.id] ? 'Complete' : 'Pending',
      item.deliverable
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Task', 'Status', 'Deliverable']],
      body: checklistData,
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 'auto' }
      }
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    if (stepProgressData.notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("Implementation Notes", 20, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const notesLines = doc.splitTextToSize(stepProgressData.notes, pageWidth - 40);
      doc.text(notesLines, 20, yPos);
    }

    doc.save(`Step-${selectedStep}-${currentStepData.title.replace(/\s+/g, '-')}-Report.pdf`);

    toast({
      title: "Report generated",
      description: `Step ${selectedStep} completion report has been downloaded.`
    });
  };

  // PDF Generation for full report
  const generateFullReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Helper functions for full report
    const stepsCompleted = countCompletedSteps(STEPS, progress);
    const { completedTasks, totalTasks } = calculateTotalTaskProgress(STEPS, progress);

    // Cover Page
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 80, 'F');

    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("Path to Excellence", 20, 35);

    doc.setFontSize(16);
    doc.text("Executive Summary Report", 20, 50);

    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 65);

    // Key Performance Indicators Section
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("Key Performance Indicators", 20, 100);

    doc.setLineWidth(0.5);
    doc.setDrawColor(59, 130, 246);
    doc.line(20, 105, pageWidth - 20, 105);

    // KPI Cards
    const kpiData = [
      ["Overall Progress", `${overallProgress}%`, overallProgress >= 80 ? "On Track" : overallProgress >= 50 ? "In Progress" : "Needs Attention"],
      ["Steps Completed", `${stepsCompleted} of 6`, stepsCompleted >= 4 ? "Strong" : stepsCompleted >= 2 ? "Building" : "Starting"],
      ["Tasks Completed", `${completedTasks} of ${totalTasks}`, `${Math.round((completedTasks/totalTasks)*100)}%`],
      ["Implementation Phase", getImplementationPhase(stepsCompleted), ""]
    ];

    autoTable(doc, {
      startY: 115,
      head: [['Metric', 'Value', 'Status']],
      body: kpiData,
      headStyles: { fillColor: [59, 130, 246], fontSize: 11 },
      styles: { fontSize: 11, cellPadding: 6 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center' }
      },
      theme: 'striped'
    });

    let yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

    // Step-by-Step Summary
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("Implementation Progress by Step", 20, yPos);
    yPos += 5;

    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    const stepSummaryData = STEPS.map(step => {
      const stepData = getStepProgressData(progress, step.id);
      const { completed: tasksDone } = countCompletedTasks(step.checklist, stepData.checklist);

      return [
        `Step ${step.id}`,
        step.title,
        `${stepData.progressValue}%`,
        `${tasksDone}/${step.checklist.length}`,
        stepData.completed ? "Complete" : stepData.progressValue > 0 ? "In Progress" : "Not Started"
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Step', 'Focus Area', 'Progress', 'Tasks', 'Status']],
      body: stepSummaryData,
      headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' }
      }
    });

    // New page for detailed step analysis
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("Detailed Step Analysis", 20, yPos);
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;

    // Each step details
    STEPS.forEach(step => {
      const stepData = getStepProgressData(progress, step.id);
      const { completed: tasksDone } = countCompletedTasks(step.checklist, stepData.checklist);

      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Step header
      doc.setFillColor(stepData.completed ? 34 : 59, stepData.completed ? 197 : 130, stepData.completed ? 94 : 246);
      doc.roundedRect(20, yPos, pageWidth - 40, 12, 2, 2, 'F');

      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`Step ${step.id}: ${step.title}`, 25, yPos + 8);
      doc.text(`${stepData.progressValue}%`, pageWidth - 35, yPos + 8);
      yPos += 18;

      // Timeline and status
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Timeline: ${step.timeline}  |  Status: ${stepData.completed ? "Completed" : stepData.progressValue > 0 ? "In Progress" : "Not Started"}  |  Tasks: ${tasksDone}/${step.checklist.length}`, 25, yPos);
      yPos += 8;

      // Key deliverables summary
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const deliverableSummary = step.keyDeliverables.slice(0, 2).join("; ");
      const delivLines = doc.splitTextToSize(`Key Focus: ${deliverableSummary}`, pageWidth - 50);
      doc.text(delivLines, 25, yPos);
      yPos += delivLines.length * 4 + 4;

      // Notes if available
      if (stepData.notes) {
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const noteLines = doc.splitTextToSize(`Notes: ${stepData.notes.substring(0, 150)}${stepData.notes.length > 150 ? '...' : ''}`, pageWidth - 50);
        doc.text(noteLines, 25, yPos);
        yPos += noteLines.length * 3.5 + 4;
      }

      yPos += 8;
    });

    // Recommendations Page
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("Strategic Recommendations", 20, yPos);
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;

    // Generate recommendations based on progress
    const recommendations: string[] = [];

    if (overallProgress < 20) {
      recommendations.push("Focus on completing Step 1 (Equipment Criticality Assessment) as this forms the foundation for all subsequent improvements.");
      recommendations.push("Assign a dedicated project champion to drive the Path to Excellence implementation.");
      recommendations.push("Schedule weekly progress reviews with maintenance leadership to maintain momentum.");
    } else if (overallProgress < 50) {
      recommendations.push("Continue building foundational capabilities in equipment criticality and RCA methodology.");
      recommendations.push("Begin cross-training team members on completed methodologies to ensure sustainability.");
      recommendations.push("Document lessons learned and best practices as you progress through each step.");
    } else if (overallProgress < 80) {
      recommendations.push("Focus on integrating completed steps into daily maintenance operations.");
      recommendations.push("Establish KPI dashboards to track ongoing performance improvements.");
      recommendations.push("Consider conducting peer reviews with other facilities to share best practices.");
    } else {
      recommendations.push("Transition focus to sustaining gains and continuous improvement.");
      recommendations.push("Develop internal trainers to maintain institutional knowledge.");
      recommendations.push("Benchmark against industry standards and set stretch goals for next-level performance.");
    }

    // Find incomplete steps and add specific recommendations
    STEPS.forEach(step => {
      const stepData = getStepProgressData(progress, step.id);
      if (stepData.progressValue < 100 && stepData.progressValue > 0) {
        recommendations.push(`Step ${step.id} (${step.title}): ${100 - stepData.progressValue}% remaining - prioritize completing outstanding checklist items.`);
      }
    });

    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    recommendations.forEach((rec, idx) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 50);
      doc.text(recLines, 25, yPos);
      yPos += recLines.length * 5 + 6;
    });

    // Next Steps
    yPos += 10;
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text("Recommended Next Steps", 20, yPos);
    yPos += 10;

    const nextSteps = [
      "Review this report with your maintenance leadership team",
      "Identify resource constraints and address any blockers",
      "Set target completion dates for each remaining step",
      "Schedule monthly progress reviews with stakeholders",
      "Celebrate completed milestones to maintain team engagement"
    ];

    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    nextSteps.forEach((step, idx) => {
      doc.text(`${idx + 1}. ${step}`, 25, yPos);
      yPos += 7;
    });

    // Footer on last page
    yPos = 280;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Path to Excellence - Consultant-Grade Maintenance Implementation Program", 20, yPos);
    doc.text(`Report generated by MaintenanceHub on ${new Date().toLocaleString()}`, 20, yPos + 5);

    doc.save("Path-to-Excellence-Executive-Summary.pdf");

    toast({
      title: "Executive Summary Generated",
      description: "Full program report has been downloaded with all 6 steps and key indicators."
    });
  };

  const {
    stepData: currentStepProgressData,
    calculatedProgress,
    handleChecklistToggle,
    handleSaveNotes,
    handleCompleteStep,
    handleUncompleteStep
  } = useStepProgressActions({
    progress,
    updateProgressMutation,
    selectedStep,
    currentStepData,
    toast,
    generateStepReport
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Client Company Selector */}
        <div className="flex items-center gap-4 p-4 bg-card border rounded-lg">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-sm text-muted-foreground">Client Company</Label>
            <Select
              value={selectedClientCompanyId || "none"}
              onValueChange={(value) => setSelectedClientCompanyId(value === "none" ? undefined : value)}
              data-testid="select-client-company"
            >
              <SelectTrigger className="w-full md:w-80" data-testid="select-client-company-trigger">
                <SelectValue placeholder="Select a client company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" data-testid="select-item-no-client">No Client (Internal Use)</SelectItem>
                {clientCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id} data-testid={`select-item-company-${company.id}`}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateCompanyDialog(true)}
            data-testid="button-create-client-company"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </div>

        {/* Create Client Company Dialog */}
        <Dialog open={showCreateCompanyDialog} onOpenChange={setShowCreateCompanyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Client Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="Enter client company name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  data-testid="input-new-company-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateCompanyDialog(false)}
                data-testid="button-cancel-create-company"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createCompanyMutation.mutate(newCompanyName)}
                disabled={!newCompanyName.trim() || createCompanyMutation.isPending}
                data-testid="button-confirm-create-company"
              >
                {createCompanyMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <HeaderProgress
          overallProgress={overallProgress}
          onGenerateFullReport={generateFullReport}
        />

        {/* Step Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {STEPS.map(step => {
            const stepData = getStepProgressData(progress, step.id);
            return (
              <StepCard
                key={step.id}
                step={step}
                isSelected={selectedStep === step.id}
                isCompleted={stepData.completed}
                progress={stepData.progressValue}
                onClick={() => setSelectedStep(step.id)}
              />
            );
          })}
        </div>

        {/* Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Overview */}
          <StepOverview
            step={currentStepData}
            calculatedProgress={calculatedProgress}
            completedCount={completedCount}
            totalCount={totalCount}
          />

          {/* Right: Checklist and Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Checklist */}
            <ChecklistSection
              checklist={currentStepData.checklist}
              stepChecklist={currentStepProgressData.checklist}
              isStepComplete={currentStepProgressData.completed}
              isPending={updateProgressMutation.isPending}
              onChecklistToggle={handleChecklistToggle}
              hasForm={hasForm}
              onOpenForm={openForm}
            />

            {/* Assessment-Driven Improvement Actions */}
            {selectedStep > 0 && stepImprovementActions.length > 0 && (
              <ImprovementActionsSection actions={stepImprovementActions} />
            )}

            {/* Assessment Summary for Step 0 */}
            {selectedStep === 0 && assessmentData && (
              <AssessmentSummarySection assessmentData={assessmentData} />
            )}

            {/* Notes */}
            <NotesSection
              notes={notes}
              stepNotes={currentStepProgressData.notes}
              isPending={updateProgressMutation.isPending}
              onNotesChange={setNotes}
              onSaveNotes={() => handleSaveNotes(notes || currentStepProgressData.notes)}
            />

            {/* Actions */}
            <StepActionsSection
              isStepComplete={currentStepProgressData.completed}
              isPending={updateProgressMutation.isPending}
              calculatedProgress={calculatedProgress}
              selectedStep={selectedStep}
              onCompleteStep={handleCompleteStep}
              onUncompleteStep={handleUncompleteStep}
              onGenerateReport={generateStepReport}
              onPreviousStep={() => setSelectedStep(Math.max(0, selectedStep - 1))}
              onNextStep={() => setSelectedStep(Math.min(6, selectedStep + 1))}
            />

            {/* Program Resources */}
            <ResourcesSection
              documents={PROGRAM_DOCUMENTS}
              selectedStep={selectedStep}
            />
          </div>
        </div>
      </div>

      {/* Form Drawer */}
      <StepDetailDialog
        openFormDrawer={openFormDrawer}
        selectedStep={selectedStep}
        onClose={() => setOpenFormDrawer(null)}
      />
    </div>
  );
}
