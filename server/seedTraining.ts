import { db } from "./db";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import * as aiService from "./aiService";

export async function seedTrainingModules(companyId: string) {
  console.log("Seeding AI-powered training modules for company:", companyId);
  
  // Generate AI scenarios for interactive training
  console.log("Generating AI-powered downtime scenarios and case studies...");
  
  let lotoCaseStudy, motorFailureScenario, bearingFailureScenario;
  try {
    // Generate case studies and scenarios in parallel
    [lotoCaseStudy, motorFailureScenario, bearingFailureScenario] = await Promise.all([
      aiService.generateTrainingCaseStudy("LOTO procedure failure leading to injury", "intermediate"),
      aiService.generateDowntimeScenario("Electrical Maintenance", "3-phase motor failure"),
      aiService.generateDowntimeScenario("Bearing Maintenance", "premature bearing failure on conveyor")
    ]);
  } catch (error) {
    console.error("Error generating AI content, using fallback scenarios:", error);
    // Fallback scenarios if AI fails
    lotoCaseStudy = {
      title: "LOTO Violation Case Study",
      background: "Manufacturing plant with aging equipment",
      problem: "Technician injured during maintenance",
      investigation: ["Review incident report", "Interview witnesses", "Check LOTO logs"],
      findings: { "procedure": "Not followed", "training": "Inadequate" },
      rootCause: "Lack of enforcement and training",
      solution: "Mandatory retraining and supervision",
      results: "Zero LOTO violations in 6 months",
      prevention: ["Regular audits", "Refresher training", "Disciplinary policy"]
    };
    
    motorFailureScenario = {
      title: "Motor Won't Start",
      situation: "Production line down, motor control center shows fault",
      symptoms: ["No motor rotation", "Contactor not pulling in", "Control voltage present"],
      measurements: { "Voltage L1-L2": "480V", "Control voltage": "120V", "Motor current": "0A" },
      decisionPoints: [{
        question: "What should you check first?",
        options: ["Replace the motor", "Check the E-stop button", "Call electrician", "Reset breaker"],
        correctAnswer: 1,
        explanation: "E-stop is the most common cause and easiest to check"
      }],
      solution: "E-stop was engaged, simple reset resolved issue",
      lessonsLearned: ["Always check simple causes first", "Document E-stop locations"]
    };
    
    bearingFailureScenario = {
      title: "Conveyor Bearing Overheating",
      situation: "Bearing temperature rising during shift",
      symptoms: ["Hot bearing housing (>200°F)", "Increased vibration", "Grinding noise"],
      measurements: { "Temperature": "215°F", "Vibration": "0.8 in/s", "Grease age": "18 months" },
      decisionPoints: [{
        question: "What is the likely cause?",
        options: ["Normal wear", "Over-greasing", "Under-lubrication", "Misalignment"],
        correctAnswer: 2,
        explanation: "High temp with old grease indicates lubrication failure"
      }],
      solution: "Replace bearing and establish relubrication schedule",
      lessonsLearned: ["Follow lubrication schedules religiously", "Monitor bearing temperatures"]
    };
  }

  // Module 1: Maintenance Basics - Comprehensive Industrial Foundation
  const module1 = await storage.createTrainingModule({
    companyId,
    title: "Industrial Maintenance Fundamentals",
    description: "Comprehensive guide to preventive maintenance, LOTO procedures, documentation, and reliability-centered maintenance (RCM) strategies",
    content: JSON.stringify({
      sections: [
        {
          title: "Understanding Preventive Maintenance (PM)",
          content: "Preventive Maintenance is scheduled servicing performed on equipment to reduce the probability of failure. Unlike reactive maintenance which happens after breakdown, PM is proactive and data-driven. Studies show properly implemented PM programs reduce equipment downtime by 35-45% and extend asset life by 20-40%. The key is consistency - a PM schedule must be adhered to religiously, as skipped intervals compound risk exponentially.",
          key_points: [
            "Time-based PM: Schedule by calendar (weekly, monthly, quarterly)",
            "Usage-based PM: Schedule by run hours, cycles, or production units",
            "Condition-based PM: Schedule by equipment condition monitoring (vibration, temperature, oil analysis)",
            "Cost savings: $1 spent on PM saves $4-5 in reactive repairs",
            "Document everything: Date, time, findings, parts replaced, measurements taken"
          ],
          procedures: [
            "Step 1: Review manufacturer's maintenance manual for recommended PM intervals",
            "Step 2: Create PM checklist specific to each equipment asset",
            "Step 3: Schedule PMs during planned downtime when possible",
            "Step 4: Assign qualified technicians to each PM task",
            "Step 5: Log all activities in CMMS (Computerized Maintenance Management System)",
            "Step 6: Analyze PM data quarterly to optimize intervals"
          ]
        },
        {
          title: "LOTO (Lockout/Tagout) - The Life-Saving Procedure",
          content: "Lockout/Tagout is an OSHA-mandated safety procedure ensuring dangerous machines are properly shut off and cannot restart during maintenance. Failure to follow LOTO causes approximately 120 deaths and 50,000 injuries annually in the US. Every energy source (electrical, mechanical, hydraulic, pneumatic, chemical, thermal, gravity) must be isolated and verified at zero-energy state before work begins.",
          key_points: [
            "OSHA Standard 1910.147 requires written LOTO procedures for each machine",
            "Average energy dissipation time: Electrical 30-60s, Pneumatic 2-5min, Hydraulic 5-10min",
            "Use personal padlocks - NEVER share locks or keys",
            "Group lockout: Each worker applies their own lock to a lockbox",
            "Test-before-touch: Use voltage tester, pressure gauge, or try-to-start method"
          ],
          procedures: [
            "Step 1: NOTIFY - Inform affected employees of shutdown and lockout",
            "Step 2: PREPARE - Identify all energy sources (check one-line diagrams, P&IDs)",
            "Step 3: SHUTDOWN - Use normal stop procedures, don't just pull breakers",
            "Step 4: ISOLATE - Open disconnects, close valves, remove fuses",
            "Step 5: LOCKOUT - Apply personal lock and tag to each isolation point",
            "Step 6: DISSIPATE - Release stored energy (capacitors, springs, pressurized lines)",
            "Step 7: VERIFY - Test equipment won't start, use voltmeter/pressure gauge to confirm zero energy",
            "Step 8: WORK SAFELY - Only now is it safe to perform maintenance",
            "Step 9: RESTORE - Remove tools, reinstall guards, remove lockout devices in reverse order",
            "Step 10: TEST - Verify equipment operates normally before returning to production"
          ]
        },
        {
          title: "Documentation and Work Order Management",
          content: "Proper documentation creates a maintenance history that enables predictive analysis, root cause investigation, and warranty claims. Every maintenance action should generate a work order with detailed notes. Industry best practice: 80% of work should be planned with materials staged before technicians arrive. Emergency reactive work should be <20% of total maintenance effort.",
          key_points: [
            "Work order types: PM (Preventive), CM (Corrective), EM (Emergency), PDM (Predictive)",
            "Required fields: Equipment ID, Date/Time, Technician, Problem description, Actions taken, Parts used, Labor hours",
            "Attach photos: Before, during, after - photos are invaluable for training and troubleshooting",
            "Downtime tracking: Record actual vs. planned downtime for OEE calculations",
            "Priority codes: P1=Safety/Production down (respond <30min), P2=Degraded operation (respond <4hrs), P3=Cosmetic (schedule during PM)"
          ]
        },
        {
          title: "Essential Tools and Measuring Instruments",
          content: "The right tool not only makes the job easier - it makes it safer and more accurate. Using a pipe wrench on a precision nut can destroy threads. Using the wrong screwdriver damages screw heads. Always select tools rated for the application.",
          images: [
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Torque_wrench.jpg/320px-Torque_wrench.jpg",
              caption: "Torque wrench with calibrated scale - essential for critical fasteners",
              alt: "Torque wrench"
            },
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Digital_Multimeter_Sanwa_PC773.jpg/320px-Digital_Multimeter_Sanwa_PC773.jpg",
              caption: "Digital multimeter (DMM) - minimum CAT III 600V rating for industrial use",
              alt: "Digital multimeter"
            }
          ],
          key_points: [
            "Torque wrenches: Critical for fasteners - under-torque causes loosening, over-torque causes breakage. Always verify calibration annually.",
            "Digital multimeters (DMM): Minimum CAT III 600V rating for industrial work. Must have resistance, voltage (AC/DC), current, and continuity modes.",
            "Micrometers/calipers: Precision measurement to 0.001\" - essential for bearing fits, shaft wear checks",
            "Vibration analyzer: Detects bearing defects, imbalance, misalignment before failure (typically 2-6 weeks advance warning)",
            "Infrared thermometer/camera: Non-contact temperature - finds hot connections, bearing issues, motor overheating",
            "Dial indicators: Measure shaft runout (max 0.002\" TIR), alignment offsets"
          ]
        },
        {
          title: "INTERACTIVE: Real-World LOTO Case Study",
          type: "case_study",
          caseStudy: lotoCaseStudy
        }
      ],
      scenarios: [{
        title: "Maintenance Planning Simulation",
        description: "You're the maintenance supervisor. A critical production machine needs PM service, but production wants to run another week. What do you do?",
        situation: "Conveyor #3 PM is overdue by 2 days. Production manager requests delay until next planned shutdown (7 days). Last PM found worn bearings.",
        decisionPoints: [
          {
            question: "What is your decision?",
            options: [
              "Delay PM as requested - production is priority",
              "Insist on immediate PM - safety and reliability first",
              "Compromise: inspect now, full PM at shutdown",
              "Escalate to plant manager for decision"
            ],
            correctAnswer: 2,
            explanation: "Quick inspection confirms bearing condition. If acceptable, schedule full PM at shutdown with parts ready. This balances production needs with risk management."
          }
        ],
        outcome: "Inspection revealed bearings at 70% life. Scheduled PM with pre-staged parts prevented unplanned downtime.",
        lessonsLearned: [
          "PM schedules should be firm but allow risk-based decisions",
          "Quick inspections can inform delay decisions",
          "Always have critical spare parts in stock"
        ]
      }],
      quiz: [
        { question: "What does LOTO stand for?", options: ["Lockout/Tagout", "Lock Or Tag Only", "Load On Test Output", "Level Of Tool Operation"], correctAnswer: 0 },
        { question: "When should preventive maintenance be performed?", options: ["Only when equipment breaks", "Based on manufacturer schedule or run hours", "Whenever convenient", "Only during annual shutdowns"], correctAnswer: 1 },
        { question: "What is the correct order for LOTO procedure?", options: ["Lock, Isolate, Verify", "Notify, Shutdown, Isolate, Lock, Verify", "Shutdown, Lock, Test", "Isolate, Lock, Notify"], correctAnswer: 1 },
        { question: "What percentage of maintenance work should ideally be planned vs. reactive?", options: ["50/50", "60/40", "80/20", "90/10"], correctAnswer: 2 },
        { question: "What is the minimum DMM rating for industrial electrical work?", options: ["CAT I", "CAT II 300V", "CAT III 600V", "CAT IV 1000V"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 60,
    points: 200,
  });

  // Module 2: Electrical Maintenance - Advanced Motor Control & Troubleshooting
  const module2 = await storage.createTrainingModule({
    companyId,
    title: "Electrical Systems: Motors, Controls & Troubleshooting",
    description: "Master electrical safety standards, 3-phase motor theory, MCC components, VFD troubleshooting, and systematic diagnostic procedures",
    content: JSON.stringify({
      sections: [
        {
          title: "Electrical Safety - Arc Flash & Shock Protection",
          content: "Electrical incidents cause 300+ deaths and 4,000+ injuries annually in US workplaces. Arc flash temperatures reach 35,000°F (4x surface of the sun), vaporizing metal and causing severe burns. The key is the 'hierarchy of controls': eliminate exposure first (de-energize), then engineer controls, then PPE as last resort. NFPA 70E requires arc flash risk assessment for all electrical work.",
          key_points: [
            "Arc Flash Boundary (AFB): Distance where incident energy = 1.2 cal/cm² (2nd degree burn threshold). Typically 18-36 inches at 480V.",
            "Limited Approach Boundary: 42\" for 480V - only qualified persons may cross",
            "Shock protection: Use voltage-rated gloves (Class 00=500V, Class 0=1000V, Class 2=20kV). Test before each use with inflator.",
            "Arc-rated PPE minimum: 4 cal/cm² for most 480V MCC work, 8 cal/cm² for racking breakers",
            "Rule #1: If you can de-energize, you MUST de-energize. Energized work requires written justification."
          ],
          procedures: [
            "Step 1: Obtain arc flash label data (incident energy in cal/cm², AFB distance, PPE category)",
            "Step 2: Don arc-rated clothing BEFORE approaching equipment (AR shirt/pants, face shield, gloves)",
            "Step 3: Establish safety boundaries with barriers/tape",
            "Step 4: Use insulated tools rated for voltage",
            "Step 5: Test with CAT III/IV meter - verify voltage present",
            "Step 6: Apply LOTO if de-energizing",
            "Step 7: Test again with meter - verify zero voltage",
            "Step 8: Apply grounding clamp if required by procedure"
          ]
        },
        {
          title: "3-Phase AC Induction Motors - The Industrial Workhorse",
          content: "AC induction motors power 70% of industrial machinery due to their simplicity and ruggedness. Unlike DC motors, they have no brushes to wear out. A 3-phase motor contains a stationary stator with electromagnets and a rotating rotor. When 3-phase AC power energizes the stator, it creates a rotating magnetic field that 'induces' current in the rotor bars, which then follows the field and spins. No electrical connection to the rotor is needed!",
          images: [
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/3-phase_AC_induction_motor.gif/400px-3-phase_AC_induction_motor.gif",
              caption: "3-Phase AC Induction Motor - cutaway showing stator windings (stationary) and rotor (rotating)",
              alt: "3-phase motor cutaway"
            },
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Electric_motor_cycle_3.png/440px-Electric_motor_cycle_3.png",
              caption: "Motor Component Nomenclature: 1-Stator, 2-Rotor, 3-Bearing, 4-Shaft, 5-Cooling Fan, 6-Terminal Box",
              alt: "Motor components diagram"
            }
          ],
          key_points: [
            "Nameplate data critical: Voltage (usually 460V or 230/460V), FLA (Full Load Amps), HP, RPM, Service Factor",
            "Normal operating current: 90-105% of nameplate FLA indicates proper loading",
            "Overload trip: Typically set at 115-125% FLA, trips in 2-10 minutes to protect winding insulation",
            "Temperature rise: NEMA permits 80°C rise (ambient + rise should not exceed insulation class rating)",
            "Efficiency: Premium Efficient (IE3) motors are 2-8% more efficient, pay for themselves in <2 years",
            "Speed = (120 x Frequency) / Poles. Example: 60Hz, 4-pole motor = 1800 RPM (minus 2-5% slip)"
          ],
          measurements: [
            "Voltage: Measure L1-L2, L2-L3, L3-L1. Max imbalance <2%. Severe imbalance causes overheating.",
            "Current: Measure all 3 phases. Imbalance >10% indicates winding problem, bad connection, or voltage issue",
            "Insulation Resistance (Megger test): Minimum 1 megohm. New motor: 100+ megohms. If <1MΩ, motor may have winding-to-ground fault",
            "Vibration: Overall velocity <0.3 in/s good, 0.3-0.7 acceptable, >0.7 investigate. Use vibration analyzer.",
            "Temperature: Bearing housings should be warm (130-150°F), not hot (>180°F indicates bearing failure)"
          ]
        },
        {
          title: "INTERACTIVE: Motor Won't Start Downtime Scenario",
          type: "downtime_scenario",
          scenario: motorFailureScenario
        },
        {
          title: "Motor Control Centers (MCC) - Understanding the Control Circuit",
          content: "An MCC bucket contains all components to start/stop a motor safely. The main power circuit (L1, L2, L3) feeds through a circuit breaker → magnetic contactor → thermal overload relay → motor. The control circuit (typically 120VAC) operates at lower power to activate the contactor coil. Understanding the control circuit is key to troubleshooting no-start conditions.",
          key_points: [
            "Main Circuit Breaker: Provides short-circuit protection (trips in <0.1s on dead short). Does NOT protect against overload.",
            "Magnetic Contactor: Heavy-duty relay with 3 power poles. Coil voltage typically 120VAC. Makes loud 'clack' when energizing.",
            "Thermal Overload Relay: Bimetallic heaters that bend when current is excessive, tripping a mechanical linkage. Manually reset.",
            "Control Transformer: Steps 480V down to 120V for control circuit. Usually 75-150VA rating.",
            "E-Stop (Emergency Stop): Hard-wired RED mushroom button that breaks control circuit. Must be manually reset before restart.",
            "Interlocks: Prevent unsafe operations (door open, guard removed). Usually normally-closed contacts in series with start circuit."
          ],
          troubleshooting: [
            "Motor won't start - Step 1: Check if E-stop is engaged (most common cause!)",
            "Step 2: Verify 3-phase voltage at MCC input (measure L1-L2-L3, should be ~480V balanced)",
            "Step 3: Press start button, listen for contactor 'clack'. If no sound, control circuit problem.",
            "Step 4: Measure control voltage across contactor coil (X1-X2). Should be ~120VAC when start is pressed.",
            "Step 5: If 120V present but no contactor pull-in, coil is open (replace contactor)",
            "Step 6: If 0V at coil, trace control circuit: transformer output → fuse → E-stop → interlocks → start/stop → overload contacts",
            "Step 7: Check thermal overload for trip. Red flag indicates trip. Reset and identify cause of overload before restarting.",
            "Motor runs but trips on overload: Measure motor current. If >FLA, check for mechanical binding, bad bearing, or phase imbalance."
          ]
        },
        {
          title: "Variable Frequency Drives (VFD) - Speed Control & Troubleshooting",
          content: "VFDs save energy by varying motor speed to match load requirements. A VFD converts AC to DC (rectifier), filters it, then inverts DC back to variable-frequency AC (0-120Hz). By changing frequency, you change motor speed. Typical energy savings: 30-50% on fan/pump applications. Caveat: VFD output contains high-frequency harmonics that can damage non-inverter-duty motors.",
          key_points: [
            "VFD Parameters: Program for motor nameplate data (HP, voltage, FLA), acceleration/deceleration time, min/max frequency",
            "Common faults: Overcurrent (motor overloaded), Overvoltage (regen braking too fast), Ground fault (motor cable damaged)",
            "Fan/pump affinity laws: 50% speed = 12.5% power (cubic relationship). Huge savings potential!",
            "VFD cable requirements: Use shielded cable, ground shield at drive end only, separate from control wiring",
            "Heat management: VFDs generate heat. Ensure cabinet ventilation, clean filters monthly"
          ],
          troubleshooting: [
            "Overcurrent fault: Check motor amps, reduce load or extend accel time. Verify motor data parameters match nameplate.",
            "Ground fault: Megger test motor and cable - should be >1MΩ to ground. Cable shield must not touch ground at motor end.",
            "Overvoltage: Occurs during rapid deceleration (motor acts as generator). Increase decel time or add braking resistor.",
            "Undervoltage: Incoming power sag or loose connections. Measure input voltage under load.",
            "Drive won't start: Check enable signal (digital input), run/stop command, verify no active faults in display"
          ]
        }
      ],
      scenarios: [{
        title: "VFD Overcurrent Fault Investigation",
        description: "A critical production line VFD keeps faulting on overcurrent. You're called to troubleshoot during a rush order.",
        situation: "Packaging line #2 VFD faults on overcurrent every 15-20 minutes of operation. Motor runs fine on across-the-line starter (bypass mode). Problem started after weekend maintenance on the gearbox.",
        symptoms: ["VFD shows F001 Overcurrent fault", "Motor runs normally on bypass starter", "Gearbox was rebuilt over weekend", "Motor current reads 45A on bypass (FLA=40A)"],
        measurements: { "Motor Amps (VFD)": "Spikes to 65A before fault", "Motor Amps (Bypass)": "Steady 45A", "VFD Accel Time": "3 seconds", "Motor Temp": "Warm but normal" },
        decisionPoints: [
          {
            question: "The motor runs on bypass but faults on VFD. What's the most likely cause?",
            options: [
              "VFD is defective and needs replacement",
              "Motor windings are damaged",
              "Gearbox rebuild changed the load characteristics",
              "Electrical supply voltage is low"
            ],
            correctAnswer: 2,
            explanation: "Motor runs fine on bypass, so motor and wiring are OK. VFD faults suggest acceleration stress. Weekend gearbox work likely changed something - possibly tighter bearings (new) or misalignment causing higher starting torque."
          },
          {
            question: "You suspect the gearbox is causing higher starting torque. What VFD adjustment should you try first?",
            options: [
              "Increase motor HP parameter",
              "Extend acceleration time to reduce starting current",
              "Disable overcurrent protection",
              "Increase voltage boost at low speed"
            ],
            correctAnswer: 1,
            explanation: "Extending accel time reduces inrush current during startup. New gearbox bearings are tight and need break-in. Longer accel time gives the motor time to overcome the higher initial friction without spiking current."
          }
        ],
        solution: "Extended VFD acceleration time from 3 to 8 seconds. New gearbox bearings were tight from rebuild. Scheduled follow-up in 2 weeks to reduce accel time after break-in. Also found gearbox was overfilled with oil - drained to proper level.",
        lessonsLearned: [
          "Problems after maintenance often relate to that maintenance",
          "VFD parameters can compensate for temporary conditions",
          "New bearings and gearboxes need break-in period",
          "Compare bypass vs VFD operation to isolate drive issues"
        ]
      }],
      quiz: [
        { question: "What should you do before testing any electrical circuit?", options: ["Test your multimeter on a known live source", "Put on safety glasses only", "Get supervisor approval", "Call the electrical utility"], correctAnswer: 0 },
        { question: "What component in an MCC switches power to the motor?", options: ["Circuit Breaker", "Magnetic Contactor", "Thermal Overload", "Control Transformer"], correctAnswer: 1 },
        { question: "Normal motor operating current should be within what range of nameplate FLA?", options: ["50-75%", "75-90%", "90-105%", "105-125%"], correctAnswer: 2 },
        { question: "What is the minimum acceptable insulation resistance (Megger test) for a motor?", options: ["0.1 megohm", "1.0 megohm", "10 megohms", "100 megohms"], correctAnswer: 1 },
        { question: "At what distance is the Arc Flash Boundary typically located for 480V equipment?", options: ["6 inches", "12 inches", "18-36 inches", "10 feet"], correctAnswer: 2 },
        { question: "If a VFD shows overcurrent fault, what is the first thing to check?", options: ["Replace the VFD", "Check motor current and reduce load", "Increase voltage", "Bypass the VFD"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 75,
    points: 250,
  });

  // Module 3: Bearing Maintenance - Comprehensive Failure Analysis & Precision Installation
  const module3 = await storage.createTrainingModule({
    companyId,
    title: "Precision Bearing Maintenance & Failure Analysis",
    description: "Deep dive into rolling element bearings: selection criteria, precision installation techniques, lubrication science, vibration analysis, and failure mode identification",
    content: JSON.stringify({
      sections: [
        {
          title: "Rolling Element Bearing Fundamentals",
          content: "Bearings are precision components that enable rotation while supporting loads. A typical antifriction bearing consists of inner race, outer race, rolling elements (balls or rollers), and cage/retainer. Bearing life is rated in L10 hours - the time at which 10% of bearings will fail under rated load. Premium bearings can achieve 100,000+ hours in proper conditions. However, 16% of all bearing failures occur within first year due to improper handling, installation, or lubrication.",
          key_points: [
            "Ball Bearings: Handle combined radial/axial loads, high speed (10,000+ RPM), lower load capacity. Use in motors, fans, pumps.",
            "Cylindrical Roller: Heavy radial loads only, moderate speed (3000 RPM), can accommodate shaft expansion. Use in gearboxes, conveyors.",
            "Spherical Roller: Heaviest radial loads, self-aligning (compensates 1-3° misalignment), moderate speed. Use in paper mills, crushers.",
            "Tapered Roller: Combined heavy radial + axial loads, often used in opposed pairs. Use in gearboxes, truck wheels.",
            "Thrust Bearings: Pure axial loads (compressor thrust, vertical pump shaft). Cannot handle radial loads.",
            "Angular Contact: High-speed, precision applications. Must be preloaded. Use in machine tool spindles."
          ],
          specifications: [
            "Bearing life formula: L10 = (C/P)³ × 10⁶ revolutions (ball), or (C/P)^10/3 (roller)",
            "Load ratings: C=Basic Dynamic Capacity (constant load life of 1 million revs), C₀=Static Capacity",
            "Tolerance classes: ABEC 1 (standard), ABEC 3 (precision), ABEC 7 (ultra-precision). Higher number = tighter tolerances.",
            "Shaft fit: Typical h6 tolerance (rotating shaft, tight fit), Bore fit: Typical H7 (stationary housing, loose fit)",
            "Clearance: C2=tighter than normal, C3=looser than normal. Use C3 for high temps, interference fits, or heavy loads."
          ]
        },
        {
          title: "Precision Bearing Installation - The Right Way",
          content: "Bearing installation is critical - 16% of premature failures trace to installation errors. The golden rules: (1) NEVER strike the bearing directly with a hammer, (2) Apply installation force to the press-fit race only, (3) Use heat or hydraulic pressure, not brute force. A properly installed bearing should slide onto shaft with hand pressure (when heated) or require <1000 lbs force (cold press). If you're hitting it hard with a hammer, something is wrong.",
          key_points: [
            "Pre-Installation Inspection: Check shaft/housing for burrs (use India stone), damage, corrosion. Measure shaft diameter with micrometer (should be within tolerance).",
            "Thermal Installation (Heating): Heat bearing in oil bath (mineral oil, not water!) to 200-250°F (90-120°C). Monitor with thermometer - DO NOT exceed 250°F or you'll damage steel metallurgy.",
            "Alternative: Induction heater provides controlled, fast heating without oil. Set to 230°F, heating time ~5-10 minutes.",
            "Cold Installation: Use hydraulic press with proper adapter sleeve. Apply force to INNER RACE ONLY for shaft mounting. Outer race stays stationary.",
            "Shaft shoulders: Must be square to shaft, with 0.010-0.030\" radius fillet to clear bearing radius. No sharp edges!",
            "Locknut torque: Follow manufacturer specs (typically 70-200 ft-lbs). Under-torque allows bearing to walk, over-torque damages bearing."
          ],
          procedures: [
            "Step 1: Clean shaft and housing with lint-free cloth + solvent. Dry thoroughly. Even fingerprints can cause corrosion.",
            "Step 2: Inspect dimensions - use micrometer on shaft, bore gauge on housing. Compare to bearing manufacturer specs.",
            "Step 3: Remove burrs with fine India stone, especially at shoulders and keyways.",
            "Step 4: Heat bearing in clean oil bath to 200-230°F. Use candy thermometer. Time: 15-30 minutes.",
            "Step 5: Wipe oil off bearing, immediately slide onto shaft. It should drop on with minimal force due to thermal expansion.",
            "Step 6: Hold bearing against shoulder until cool (5 minutes). Cooling shrinks bearing onto shaft.",
            "Step 7: Apply grease immediately - openings allow moisture ingress. Fill 30-50% of free space (see lubrication section).",
            "Step 8: Install seal or shield, install outer components (locknut, washer), torque per spec.",
            "Step 9: Rotate shaft by hand - should turn freely with no binding. If tight, investigate.",
            "Step 10: Document installation date, bearing P/N, and installer initials in maintenance log."
          ]
        },
        {
          title: "Lubrication - The Lifeblood of Bearings",
          content: "Lubrication serves three purposes: (1) Reduce friction between rolling elements and races, (2) Cool bearing, (3) Protect against corrosion. The film thickness between ball and race is only 0.000020\" (0.5 microns) - contamination particles >5 microns cause damage. Rule of thumb: 40% of bearing failures are lubrication-related (wrong grease, over-greasing, contamination). Get it right and bearings last 10x longer.",
          key_points: [
            "Grease vs. Oil: Grease preferred for most applications (easier, seals better, less leakage). Oil used for high speed (>10,000 RPM) or high temp (>300°F).",
            "Grease types: Lithium (most common, -20 to +250°F), Polyurea (high speed, +350°F), EP (extreme pressure additives for shock loads)",
            "NLGI Grade: #2 most common (peanut butter consistency). #1=softer (cold temps), #3=stiffer (hot temps, vertical shafts).",
            "Fill percentage: CRITICAL. 30-50% of free space is optimal. 100% fill causes churning, overheating, and failure in <1 year.",
            "Grease life: Degrades over time even if not running. Typical relubrication interval: 6 months to 2 years depending on speed, temp, environment.",
            "Compatibility: Lithium and polyurea greases are NOT compatible. Mixing causes grease breakdown. Purge old grease when changing types."
          ],
          lubrication_intervals: [
            "General formula: Hours = (14 × 10⁶) / (RPM × shaft_diameter_mm) - but verify with mfr specs",
            "Example: 1800 RPM motor with 2\" (50mm) shaft = 156,000 hours between relubrication (17 years!). Realistic: relube annually due to grease aging.",
            "High-speed motors (3600 RPM): Relube every 6-12 months",
            "Slow speed (<500 RPM): Relube every 2-5 years",
            "Contaminated environment (dust, moisture): Relube every 3-6 months regardless of speed",
            "When relubing: Purge old grease (run motor while adding new grease until purge is clean). Don't just add grease on top of old - causes over-greasing."
          ]
        },
        {
          title: "Bearing Failure Analysis - Reading the Clues",
          content: "Failed bearings tell a story if you know how to read them. Each failure mode leaves distinct signatures on the races and rolling elements. Examining failed bearings prevents repeat failures. Always photograph damaged bearings from multiple angles for investigation records. Common root causes: contamination (36%), improper lubrication (36%), improper installation (16%), normal fatigue (12%).",
          key_points: [
            "Spalling: Flaking/pitting of race surface. Looks like cratered metal. Normal end-of-life fatigue. If premature, check for overload, misalignment, or contamination.",
            "Brinelling: Dents in races spaced at ball/roller intervals. Caused by impact loads while bearing is stationary (dropping motor, transport vibration).",
            "False Brinelling: Looks like brinelling but caused by vibration while bearing is stationary (motor sitting on truck during transport). Red dust from fretting corrosion.",
            "Smearing: Skid marks on race/balls. Caused by rapid acceleration/deceleration, inadequate lubrication, or incorrect preload.",
            "Corrosion: Red/brown rust staining. Caused by moisture contamination. Check seal integrity. Consider sealed bearings for future.",
            "Overheating: Blue/brown discoloration (heat temper colors). Caused by inadequate lubrication, over-greasing, or excessive preload.",
            "Cage damage: Broken/cracked cage. Caused by improper installation (forcing cage against shoulder), over-greasing, or loss of lubrication."
          ],
          troubleshooting: [
            "Bearing noise increasing: Early sign of failure. Use vibration analyzer to track trend. Overall velocity increasing indicates wear.",
            "Specific frequencies: BPFO (ball pass freq outer race), BPFI (inner race), BSF (ball spin freq). Peaks at these frequencies = specific defect.",
            "Temperature rising: Normal bearing temp 130-150°F. If >180°F, investigate immediately. Causes: loss of lubrication, overload, misalignment.",
            "Vibration signature: Healthy bearing shows low, broadband vibration. Defects show high-frequency spikes (10,000+ Hz for bearing defects).",
            "If bearing fails <2 years: Installation or lubrication problem. Review procedures, check alignment, verify proper grease type/amount."
          ]
        }
      ],
      scenarios: [{
        title: "Recurring Blower Motor Bearing Failure",
        description: "The plant air supply blower has failed for the third time in 18 months. Management wants to know why bearings keep failing.",
        situation: "75 HP blower motor DE bearing failed again. Same failure mode each time - bearing seized, motor overheated. Each replacement costs $3,500 in parts and 8 hours downtime. Previous repairs just replaced the bearing.",
        symptoms: ["Bearing seized (third failure in 18 months)", "Blue discoloration on inner race", "Grease appears dried and dark", "Shaft shows no damage"],
        measurements: { "Bearing Type": "6314-2RS sealed", "Grease": "Polyurea (different from original lithium)", "Motor Speed": "1780 RPM", "Operating Temp": "Was running at 185°F before failure" },
        decisionPoints: [
          {
            question: "The bearing shows blue discoloration and dried grease. What failure mode does this indicate?",
            options: [
              "Normal fatigue wear",
              "Contamination damage",
              "Overheating from lubrication failure",
              "Electrical discharge damage"
            ],
            correctAnswer: 2,
            explanation: "Blue discoloration is heat tempering - the steel got hot enough to change color (400°F+). Dried, dark grease confirms the lubricant broke down from heat. This is classic lubrication failure."
          },
          {
            question: "Records show the bearing was relubricated with polyurea grease but the original grease was lithium. What's the implication?",
            options: [
              "No problem - all greases are compatible",
              "Polyurea is better so this improved the bearing",
              "Incompatible greases mixed and degraded, causing failure",
              "The bearing should never be relubricated"
            ],
            correctAnswer: 2,
            explanation: "Polyurea and lithium greases are NOT compatible. When mixed, they can soften, harden, or separate, losing their lubricating properties. This is the root cause - whoever relubed used wrong grease type."
          }
        ],
        solution: "Root cause was grease incompatibility. Maintenance had been using polyurea grease (new plant standard) on bearings originally lubricated with lithium. Created lubrication specification tag system for all motors. Trained team on grease compatibility. Installed new bearing with correct lithium grease.",
        lessonsLearned: [
          "Blue bearing races always indicate overheating",
          "Grease compatibility is critical - lithium and polyurea don't mix",
          "Repeated failures demand root cause investigation, not just replacement",
          "Document original grease type and maintain consistency"
        ]
      }],
      quiz: [
        { question: "What type of bearing is best for heavy radial loads?", options: ["Ball bearing", "Cylindrical roller bearing", "Thrust bearing", "Angular contact bearing"], correctAnswer: 1 },
        { question: "What percentage of free space should grease typically fill in a bearing?", options: ["10-20%", "30-50%", "70-90%", "100%"], correctAnswer: 1 },
        { question: "What temperature should you heat a bearing to for thermal installation?", options: ["100-150°F", "200-250°F", "300-350°F", "400°F+"], correctAnswer: 1 },
        { question: "What percentage of bearing failures are related to lubrication issues?", options: ["10%", "20%", "40%", "60%"], correctAnswer: 2 },
        { question: "What does spalling on a bearing race indicate?", options: ["Impact damage", "Normal fatigue wear", "Corrosion", "Improper installation"], correctAnswer: 1 },
        { question: "When should you apply force during bearing installation?", options: ["To both races evenly", "To outer race only", "To the press-fit race only", "To the cage"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 70,
    points: 225,
  });

  // Module 4: C4 6-Step Troubleshooting Methodology
  const module4 = await storage.createTrainingModule({
    companyId,
    title: "C4 6-Step Troubleshooting Process",
    description: "Master the systematic C4 troubleshooting methodology used in industrial maintenance: identify, verify safety, gather symptoms, review history, test solutions, and verify fix",
    content: JSON.stringify({
      sections: [
        {
          title: "Introduction to Systematic Troubleshooting",
          content: "Effective troubleshooting is not guessing - it's a disciplined process. The C4 6-Step Troubleshooting Process provides a systematic framework used across industries to diagnose and resolve equipment failures efficiently. This methodology reduces downtime by 40-60% compared to unstructured troubleshooting because it prevents repeated false starts, ensures safety, and builds institutional knowledge. Each step builds on the previous, creating a logical path from problem to solution.",
          key_points: [
            "Systematic approach beats trial-and-error by 3:1 in time-to-resolution",
            "Documentation at each step creates searchable knowledge base for future issues",
            "Safety verification prevents injuries and secondary equipment damage",
            "Root cause focus prevents recurrence - fixing symptoms wastes time",
            "C4 AI assistance provides contextual guidance at every step"
          ]
        },
        {
          title: "Step 1: Identify the Problem",
          content: "Proper problem identification is 50% of the solution. A vague problem statement like 'machine doesn't work' leads to wasted hours. A specific statement like 'Conveyor #3 motor trips on thermal overload after 20 minutes of operation, started yesterday after bearing replacement' immediately narrows possibilities. The 5W1H framework helps: Who discovered it? What exactly is happening? When did it start? Where is it occurring? Why is it critical? How does it manifest?",
          key_points: [
            "Problem statement template: [Equipment ID] + [Specific Symptom] + [When it started] + [Impact on production]",
            "Example: 'CNC Mill #7 - X-axis servo alarm 421 - Started 2PM today - Halted production line'",
            "Distinguish between symptom (motor overheating) and problem (bearing failure causing overload)",
            "Quantify impact: Downtime cost, safety risk, quality impact",
            "Get operator input - they know normal vs. abnormal behavior better than anyone"
          ],
          procedures: [
            "Interview operator: What exactly changed? Any unusual sounds, smells, vibrations?",
            "Define boundaries: Does it happen all the time or intermittently? One machine or multiple?",
            "Review recent changes: New parts? Maintenance performed? Process changes?",
            "Document observations with timestamp, photos, and equipment state",
            "Create specific problem statement using 5W1H framework"
          ]
        },
        {
          title: "Step 2: Verify Safety",
          content: "STOP and verify safety before touching anything. 15% of maintenance injuries occur during troubleshooting when technicians rush past safety protocols. The machine that just failed may have energized electrical circuits, pressurized lines, hot surfaces, or stored mechanical energy (springs, counterweights). LOTO is required if you'll be in the danger zone. If troubleshooting can be done with guards in place and machine de-energized, proceed. If not, LOTO first.",
          key_points: [
            "Machine guarding: Can diagnosis be done safely with guards in place? If not, LOTO required.",
            "Electrical hazards: Assume energized until proven otherwise. Use CAT III/IV meter rated for voltage.",
            "Stored energy: Springs, accumulators, capacitors, flywheels. Release before working.",
            "Hot surfaces: Motors, bearings, hydraulic oil can exceed 200°F. Allow cool-down.",
            "Lock-out requirement: If entering danger zone or removing guards → Full LOTO procedure",
            "Arc flash PPE: If working on energized electrical (justified), wear proper cal/cm² rated clothing"
          ],
          procedures: [
            "Step 2.1: Identify all energy sources (electrical, pneumatic, hydraulic, mechanical, thermal)",
            "Step 2.2: Determine if troubleshooting requires guard removal or entering danger zone",
            "Step 2.3: If YES to either → Implement full LOTO procedure (see LOTO module)",
            "Step 2.4: If NO → Verify machine is in safe state for troubleshooting",
            "Step 2.5: Don appropriate PPE (minimum: safety glasses, gloves rated for task)",
            "Step 2.6: Test for live voltage/pressure before assuming safe",
            "Step 2.7: Establish barrier/signage if area is not locked out but under investigation"
          ]
        },
        {
          title: "Step 3: Gather Symptoms and Data",
          content: "This is detective work - collect facts without jumping to conclusions. Modern equipment provides data: error codes, alarms, temperature readings, vibration levels, cycle counters. Operators provide observations: sounds, smells, timing, sequence of events. Physical inspection reveals: leaks, wear, damage, loose connections. The more symptoms you gather, the narrower your diagnosis becomes. Pro tip: Take before photos - invaluable for comparison and documentation.",
          key_points: [
            "Error codes: Record all fault codes from HMI/display. Google manufacturer code or check manual.",
            "Measurements: Voltage, current, pressure, temperature, vibration. Compare to baseline normal values.",
            "Timeline: When did symptoms first appear? Getting worse or stable? Intermittent or constant?",
            "Environmental factors: Recent weather changes? New product being run? Shift change?",
            "Use senses: Smell (burning insulation?), Sound (grinding bearing?), Touch (excessive heat?), Sight (damage?)",
            "Document everything: Photos, measurements, timestamps. Memory fades, data doesn't."
          ],
          procedures: [
            "Collect error codes and alarms from machine display/HMI",
            "Measure key parameters: electrical (voltage, current, resistance), mechanical (vibration, alignment, clearances), process (pressure, flow, temperature)",
            "Interview operator about sequence of events and any unusual observations",
            "Physical inspection: Look for obvious damage, leaks, loose connections, wear",
            "Compare current state to normal baseline (nameplate data, previous measurements)",
            "Take photos from multiple angles for documentation",
            "Create symptom list with specific, measurable observations"
          ]
        },
        {
          title: "Step 4: Review Similar Issues and History",
          content: "Don't reinvent the wheel - check if this problem has been solved before. Maintenance systems track work orders, and 60% of failures are recurring issues. If Pump #3 failed last month with same symptoms, the previous solution likely applies. Review equipment history for: recent work orders, PM records, past failures, modification history. Search your company knowledge base, manufacturer tech bulletins, and online forums for similar symptoms. Pattern recognition accelerates diagnosis dramatically.",
          key_points: [
            "CMMS search: Query equipment history for similar fault codes or symptoms in past 2 years",
            "Pattern recognition: Same failure mode? Same time interval since PM? Same operator?",
            "Manufacturer resources: Technical bulletins, service advisories, recall notices",
            "Peer knowledge: Ask experienced techs - 'Have you seen this before?'",
            "Online resources: Equipment-specific forums, YouTube teardowns, Reddit communities",
            "Document your findings: Add to knowledge base so next person benefits"
          ],
          procedures: [
            "Search work order history for this equipment: Filter by fault codes, symptoms",
            "Identify recurring failures: Same component failing? Same symptom?",
            "Review recent work orders: Did recent PM or repair introduce new problem?",
            "Check manufacturer website for service bulletins or recalls",
            "Consult with senior technicians about similar past issues",
            "Search C4 knowledge base and similar equipment files for matching symptoms",
            "If pattern found, note the previous solution and verify it applies to current situation"
          ]
        },
        {
          title: "Step 5: Test Solutions Methodically",
          content: "Now diagnose and repair - but do it systematically, changing ONE variable at a time. If you replace three parts simultaneously and it works, you don't know which part was bad (and wasted money on two good parts). Start with easiest/cheapest solutions first: Reset? Loose connection? Then progress to component-level diagnosis. Use isolation testing: Disconnect suspect component and test in isolation. Swap with known-good component. Measure before and after each change to confirm impact.",
          key_points: [
            "ONE CHANGE RULE: Change only one variable at a time, test result, document before next change",
            "Start easy: Resets, loose connections, simple adjustments. 40% of issues are simple fixes.",
            "Component isolation: Disconnect suspect part, test equipment without it. Problem gone? Found your culprit.",
            "Swap testing: Replace with known-good part. Problem follows the part? Part is bad. Problem stays? Look elsewhere.",
            "Measure progress: How did measurements change after each intervention?",
            "Don't assume: Just because a relay is new doesn't mean it's good. Test everything."
          ],
          procedures: [
            "Start with simplest/cheapest solutions first (check emergency stops, reset faults, tighten connections)",
            "Progress to component-level testing using diagnostic tools (multimeter, vibration analyzer, thermal camera)",
            "Change ONE component or setting at a time",
            "Test equipment after EACH change - does symptom change?",
            "Document what you changed and the result (better, worse, no change)",
            "Use swap testing when possible: Replace with known-good component",
            "If solution works, run equipment through full cycle to verify complete resolution",
            "If solution fails, revert change and try next hypothesis"
          ]
        },
        {
          title: "Step 6: Verify Fix and Document",
          content: "Don't declare victory until the machine runs through full production cycle without issues. A motor might start fine but trip after 30 minutes under load - you haven't fixed it if you only ran it for 5 minutes empty. Verification means: Run at full load, Full operating cycle, Monitor key parameters, Confirm no new alarms. Then document everything: Root cause, Solution implemented, Parts used, Time spent, Lessons learned. This documentation prevents the same failure next time.",
          key_points: [
            "Full operational test: Run machine through complete production cycle at rated load",
            "Monitor measurements: Temperature, vibration, current - should be in normal range",
            "No new issues: Fix shouldn't create new problems. Check for unintended consequences.",
            "Operator verification: Get operator sign-off that machine is operating normally",
            "Update work order: Detailed notes on root cause, solution, parts used, time",
            "Add to knowledge base: Create searchable entry for this failure mode and solution"
          ],
          procedures: [
            "Run equipment through full production cycle (not just a test start)",
            "Monitor all key parameters: Verify they're in normal operating range",
            "Load test: Run at rated capacity for sufficient time (minimum 30 minutes)",
            "Check for side effects: Did fix cause new issues elsewhere?",
            "Get operator confirmation that operation is normal",
            "Close work order with detailed documentation: Problem statement, Root cause found, Solution implemented, Parts replaced, Labor time, Measurements before/after",
            "Update equipment history and maintenance knowledge base",
            "Schedule follow-up inspection if needed (e.g., recheck bearing temp after 8 hours)"
          ]
        },
        {
          title: "C4 AI Integration in Troubleshooting",
          content: "The C4 platform enhances traditional troubleshooting with AI assistance at each step. At Step 1, C4 helps refine vague problem statements into specific, actionable descriptions. At Step 3, it suggests which measurements are most diagnostic for the symptoms. At Step 4, it searches your company's entire work order history and cross-references with industry databases for similar issues. At Step 5, it recommends testing sequences based on probability and cost. This doesn't replace technician expertise - it amplifies it with data-driven insights.",
          key_points: [
            "Natural language interface: Describe problem in plain English, get structured guidance",
            "Contextual suggestions: AI knows equipment type, failure history, available resources",
            "Probability ranking: AI suggests most likely causes first based on statistical analysis",
            "Learning system: As you document fixes, AI improves recommendations for future",
            "Saves time: Reduces average troubleshooting time by 35% via focused investigation"
          ]
        }
      ],
      scenarios: [{
        title: "Intermittent Packaging Machine Fault",
        description: "The case packer randomly stops with a vague 'System Fault' alarm. It happens 2-3 times per shift with no apparent pattern. Production is frustrated.",
        situation: "Case packer stops randomly showing 'System Fault - Check Machine'. Operator resets and it runs fine for hours, then faults again. No specific error code. Maintenance has replaced sensors, checked wiring, and found nothing. Problem started 3 weeks ago.",
        symptoms: ["Random stops, no pattern found", "Generic 'System Fault' message", "Runs fine after reset for hours", "Started 3 weeks ago after no obvious changes"],
        measurements: { "Fault Frequency": "2-3 times per shift", "Time Between Faults": "Random (1-4 hours)", "Sensors": "All tested good", "Wiring": "Checked, no issues found" },
        decisionPoints: [
          {
            question: "Using the C4 6-Step process, what should be your first focus based on 'Started 3 weeks ago'?",
            options: [
              "Replace all the sensors",
              "Research what changed 3 weeks ago",
              "Install a new PLC",
              "Ignore the timing - it's probably coincidence"
            ],
            correctAnswer: 1,
            explanation: "Step 4 says to review history. The specific timing '3 weeks ago' is a major clue. Something changed - PM work, new product, new operator, software update, environmental change. Find what changed."
          },
          {
            question: "You discover a 'minor software patch' was installed 3 weeks ago. The vendor says it's unrelated. What's your next step?",
            options: [
              "Accept the vendor's word - they're the experts",
              "Roll back the patch and test",
              "Ignore software - this is a hardware problem",
              "Wait for more failures to find a pattern"
            ],
            correctAnswer: 1,
            explanation: "Step 5 says to test one change at a time. The timing correlation is too strong to ignore. Roll back the patch, run for a week, and see if faults stop. Data beats vendor opinion."
          }
        ],
        solution: "Rolled back software patch. No faults for 2 weeks. Vendor investigated and found a timing bug in the patch that caused false faults under specific conditions. Updated patch was developed and tested before re-installation.",
        lessonsLearned: [
          "Always investigate what changed when problems start suddenly",
          "Software changes can cause intermittent, hard-to-diagnose problems",
          "Don't accept 'it's not related' without testing",
          "Document all changes including 'minor' software updates"
        ]
      }],
      quiz: [
        { question: "What is the first step in the C4 6-Step Troubleshooting Process?", options: ["Gather symptoms", "Verify safety", "Identify the problem", "Review history"], correctAnswer: 2 },
        { question: "When is LOTO (Lockout/Tagout) required during troubleshooting?", options: ["Always, for every troubleshooting task", "Only when working on electrical equipment", "When entering danger zones or removing guards", "Never during troubleshooting"], correctAnswer: 2 },
        { question: "What percentage of failures are recurring issues that have been solved before?", options: ["20%", "40%", "60%", "80%"], correctAnswer: 2 },
        { question: "What is the ONE CHANGE RULE in Step 5?", options: ["Only spend one hour troubleshooting", "Only use one tool at a time", "Change only one variable at a time and test", "Only one person should troubleshoot"], correctAnswer: 2 },
        { question: "What should you do before declaring a repair successful?", options: ["Just confirm the error code is gone", "Run a quick 5-minute test", "Run equipment through full production cycle at rated load", "Get supervisor approval"], correctAnswer: 2 },
        { question: "What is the purpose of documenting your troubleshooting steps?", options: ["To justify billable hours", "To create searchable knowledge base for future issues", "Because it's required by OSHA", "To impress management"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 45,
    points: 150,
  });

  // Module 5: Maintenance Leadership Fundamentals
  const module5 = await storage.createTrainingModule({
    companyId,
    title: "Maintenance Leadership Fundamentals",
    description: "Essential leadership skills for maintenance supervisors: team management, effective delegation, performance coaching, and building high-performing maintenance teams",
    content: JSON.stringify({
      sections: [
        {
          title: "The Maintenance Leader's Role",
          content: "A maintenance leader is not just a senior technician - you're responsible for people, processes, and performance. Your job is to multiply your team's effectiveness, not do the work yourself. Great maintenance leaders reduce downtime by 30-40% through better planning, training, and team coordination. The transition from technician to leader requires a fundamental mindset shift: your success is now measured by your team's success, not your personal technical contributions.",
          key_points: [
            "Technical expertise alone doesn't make a leader - communication and people skills are equally critical",
            "Your primary outputs: trained technicians, optimized schedules, reduced downtime, safety compliance",
            "80/20 rule: Spend 80% of time on planning, coaching, and improving processes; 20% on technical issues",
            "Lead by example: Your work ethic, attitude, and professionalism set the standard",
            "Build trust through consistency, transparency, and keeping your commitments",
            "Advocate for your team's needs: tools, training, staffing, and fair treatment"
          ]
        },
        {
          title: "Effective Delegation for Maintenance Supervisors",
          content: "Delegation is not dumping work - it's developing your team while freeing yourself for leadership tasks. Many new supervisors fail because they try to do everything themselves. The key is matching tasks to technician skill levels, providing clear expectations, and following up appropriately. Proper delegation increases team capacity, develops skills, and identifies future leaders.",
          key_points: [
            "Match task complexity to technician skill level - stretch assignments grow people, but not so far they fail",
            "Define success clearly: What needs to be done? By when? What does 'good' look like?",
            "Authority with responsibility: If you delegate the task, delegate the decision-making power",
            "Don't micromanage: Check in at milestones, not every 5 minutes. Trust your training.",
            "Debrief after completion: What went well? What would you do differently? This is where learning happens.",
            "Never delegate safety: Safety oversight is always the leader's direct responsibility"
          ],
          procedures: [
            "Step 1: Identify what to delegate - routine tasks, growth opportunities, tasks others can do better",
            "Step 2: Select the right person - consider skills, development needs, workload, and interest",
            "Step 3: Explain the task and expected outcome clearly - use the 5W1H framework",
            "Step 4: Set checkpoints and deadlines - agree on when you'll check in",
            "Step 5: Provide resources and authority - tools, parts access, decision rights",
            "Step 6: Monitor without hovering - observe from appropriate distance",
            "Step 7: Give feedback - recognize success, coach on improvements"
          ]
        },
        {
          title: "Building a High-Performing Maintenance Team",
          content: "High-performing teams don't happen by accident. They're built through intentional hiring, ongoing training, clear expectations, and a culture of accountability and support. Research shows the best maintenance teams have 40% less turnover, 25% higher productivity, and significantly better safety records. The foundation is psychological safety - team members must feel safe to admit mistakes, ask questions, and propose ideas.",
          key_points: [
            "Hire for attitude, train for skill - technical skills can be taught, work ethic cannot",
            "Create clear role definitions - everyone should know exactly what's expected",
            "Cross-train strategically - avoid single points of failure while respecting specializations",
            "Recognize and reward both individual and team accomplishments publicly",
            "Address performance issues promptly - ignoring problems demotivates top performers",
            "Foster peer mentoring - pair experienced techs with newer ones for knowledge transfer",
            "Regular team meetings - share updates, celebrate wins, solve problems together"
          ]
        },
        {
          title: "Performance Coaching for Technicians",
          content: "Coaching is an ongoing conversation about performance, not an annual review. Effective coaches observe behavior, provide timely feedback, and help technicians develop. The goal is not to criticize but to improve. Use the SBI model: Situation (what happened), Behavior (what you observed), Impact (the effect). This keeps feedback objective and actionable rather than personal.",
          key_points: [
            "Catch people doing things right - positive reinforcement is 5x more effective than criticism",
            "Provide feedback within 24 hours of the behavior - delayed feedback loses impact",
            "SBI Model: 'In yesterday's PM on Pump 3 (Situation), I noticed you skipped the vibration check (Behavior), which means we might miss early bearing failure (Impact)'",
            "Ask before telling: 'What do you think could improve?' Often they already know",
            "Focus on behavior, not personality - you can't change who someone is, but you can change what they do",
            "Document patterns - if performance issues recur, you need written records for HR",
            "Celebrate growth - acknowledge when coaching has led to improvement"
          ],
          procedures: [
            "Step 1: Observe the behavior firsthand or gather facts from reliable sources",
            "Step 2: Prepare your feedback using SBI framework - be specific, not general",
            "Step 3: Have the conversation privately - never criticize publicly",
            "Step 4: Start with what's going well before addressing the improvement area",
            "Step 5: Listen to their perspective - there may be context you're missing",
            "Step 6: Agree on specific actions and timeline for improvement",
            "Step 7: Follow up as agreed - accountability requires follow-through"
          ]
        },
        {
          title: "Managing Conflict and Difficult Conversations",
          content: "Conflict is inevitable on any team - how you handle it defines your leadership. Unresolved conflict destroys morale, productivity, and safety. Address issues early before they escalate. Approach difficult conversations with curiosity rather than judgment. Your goal is to understand the situation fully, then work toward a solution that addresses the underlying issue.",
          key_points: [
            "Don't avoid conflict - unaddressed issues fester and grow worse",
            "Separate people from problems - attack the issue, not the person",
            "Listen first, speak second - understand their perspective before presenting yours",
            "Stay calm - if you get emotional, pause and reschedule the conversation",
            "Focus on interests, not positions - what does each party actually need?",
            "Document serious issues - HR may need records if escalation is required",
            "Know when to escalate - some issues require HR, safety, or upper management involvement"
          ]
        },
        {
          title: "Time Management for Maintenance Leaders",
          content: "Maintenance leaders are constantly interrupted - it's the nature of the job. Effective time management isn't about eliminating interruptions but about protecting time for critical leadership activities. Block time for planning, walk the floor for visibility, and batch similar tasks. The Eisenhower Matrix helps prioritize: Urgent+Important (do now), Important+Not Urgent (schedule), Urgent+Not Important (delegate), Neither (eliminate).",
          key_points: [
            "Start each day with a plan - even if it changes, having a plan keeps you proactive",
            "Block 'protected time' for planning, coaching, and process improvement - treat it like a meeting",
            "Batch similar tasks - handle all emails at set times, do all walk-throughs together",
            "Delegate what others can do - don't do $20/hour tasks when you're paid for $50/hour decisions",
            "Say no to low-value activities - not everything is actually urgent or important",
            "Use your CMMS - if you're doing work orders by hand, you're wasting time",
            "End each day planning tomorrow - you'll sleep better and start faster"
          ]
        }
      ],
      scenarios: [{
        title: "New Supervisor's First Major Challenge",
        description: "You've just been promoted to maintenance supervisor. A senior technician is openly challenging your authority and undermining team morale.",
        situation: "You were promoted over Marcus, a 20-year veteran who expected the supervisor role. He's making sarcastic comments about your decisions, going around you to the plant manager, and telling other techs to ignore your work assignments. Team morale is suffering.",
        symptoms: ["Senior tech undermining your authority", "Going around you to plant manager", "Other techs confused about who to listen to", "Your assignments being ignored"],
        measurements: { "Team Size": "6 technicians", "Marcus Experience": "20 years", "Your Experience": "8 years", "Time Since Promotion": "3 weeks" },
        decisionPoints: [
          {
            question: "What's the best first step to address Marcus's behavior?",
            options: [
              "Write him up immediately for insubordination",
              "Ignore it and hope he comes around",
              "Have a private, direct conversation with Marcus",
              "Ask the plant manager to handle it"
            ],
            correctAnswer: 2,
            explanation: "Direct private conversation first. Address the issue head-on but with respect for his experience. Understand his perspective before jumping to discipline. Ignoring it will make it worse, and escalating too early undermines your authority."
          },
          {
            question: "During your conversation, Marcus says 'You don't have the experience to lead this team.' How do you respond?",
            options: [
              "Remind him you're the boss now and he needs to accept it",
              "Acknowledge his experience and ask for his help making the team successful",
              "Agree that you're not qualified and apologize",
              "Threaten discipline if he doesn't change"
            ],
            correctAnswer: 1,
            explanation: "Acknowledge his valid point (he does have more experience) while also being clear about the reality. Ask him to be part of the solution. Great leaders leverage experienced team members rather than fight them. Make him an ally, not an enemy."
          }
        ],
        solution: "Had private conversation acknowledging Marcus's expertise. Asked him to be the technical mentor for the team while you handle scheduling, planning, and development. Gave him ownership of training new technicians. Within a month, he became your strongest supporter.",
        lessonsLearned: [
          "Address conflict early before it spreads to the team",
          "Respect experience even when you have the title",
          "Look for ways to leverage resistant team members' strengths",
          "The goal is team success, not winning power struggles"
        ]
      }],
      quiz: [
        { question: "What is the 80/20 rule for maintenance leaders?", options: ["80% technical work, 20% meetings", "80% planning/coaching, 20% technical issues", "80% in office, 20% on floor", "80% managing, 20% leading"], correctAnswer: 1 },
        { question: "What is the SBI feedback model?", options: ["Safety, Behavior, Improvement", "Situation, Behavior, Impact", "Standard, Baseline, Improvement", "Skill, Behavior, Intention"], correctAnswer: 1 },
        { question: "What should a maintenance leader NEVER delegate?", options: ["Routine PM tasks", "Work order assignments", "Safety oversight", "Training new technicians"], correctAnswer: 2 },
        { question: "When should you provide feedback on a performance issue?", options: ["During annual review", "Within 24 hours of the behavior", "When you have time", "Only if it happens again"], correctAnswer: 1 },
        { question: "What is the foundation of a high-performing team?", options: ["High salaries", "Advanced tools", "Psychological safety", "Strict discipline"], correctAnswer: 2 },
        { question: "How should difficult conversations be approached?", options: ["With judgment and correction", "With curiosity and understanding", "Publicly to set an example", "Only when absolutely necessary"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 50,
    points: 175,
  });

  // Module 6: Communication Skills for Maintenance Professionals
  const module6 = await storage.createTrainingModule({
    companyId,
    title: "Communication Skills for Maintenance Professionals",
    description: "Master professional communication: shift handoffs, incident reporting, cross-departmental collaboration, presentations, and communicating with all organizational levels",
    content: JSON.stringify({
      sections: [
        {
          title: "The Cost of Poor Communication in Maintenance",
          content: "Poor communication is the root cause of 60% of maintenance-related incidents and rework. Vague work orders lead to wrong parts. Incomplete shift handoffs lead to missed critical issues. Unclear instructions lead to safety incidents. When a $500,000 motor fails because the night shift 'forgot to mention' the unusual vibration they noticed, communication has failed catastrophically. Excellent communication is a professional skill that can be learned and improved.",
          key_points: [
            "Rework due to miscommunication costs average plant $100,000+ annually",
            "Ambiguous work orders are completed incorrectly 40% of the time",
            "Shift handoff failures contribute to 18% of industrial accidents",
            "Clear communication reduces troubleshooting time by 35%",
            "Written documentation creates legal protection and institutional knowledge",
            "Communication skills differentiate good technicians from great ones"
          ]
        },
        {
          title: "Shift Handoffs: The Critical Transition",
          content: "Shift handoffs are the most dangerous 30 minutes in maintenance operations. Critical information must transfer reliably between departing and arriving teams. Use a structured format: Equipment Status (what's running, what's down), Work in Progress (what was started, what's pending), Critical Issues (safety concerns, abnormal conditions), and Priorities for Next Shift. Never rely on memory alone - use written logs and verbal confirmation.",
          key_points: [
            "Walk-through together when possible - show, don't just tell",
            "Use structured handoff form: Equipment Status | Work in Progress | Critical Issues | Priorities",
            "Repeat-back critical information: 'So Pump 3 is running hot at 180F and needs monitoring every hour?'",
            "Never assume the next shift knows - if in doubt, over-communicate",
            "Log abnormal conditions in writing even if you mentioned verbally",
            "Oncoming shift should ask questions - don't just accept handoff passively"
          ],
          procedures: [
            "Step 1: Prepare handoff notes 30 minutes before shift end - don't rush at last minute",
            "Step 2: Review all open work orders and their current status",
            "Step 3: Document any equipment running abnormally, even if not failed yet",
            "Step 4: Note any safety concerns or LOTO still in place",
            "Step 5: Meet face-to-face with oncoming counterpart for verbal handoff",
            "Step 6: Walk problem areas together when possible",
            "Step 7: Get verbal confirmation that critical information was understood",
            "Step 8: Sign handoff log to create accountability record"
          ]
        },
        {
          title: "Work Order Documentation Standards",
          content: "Work orders are legal documents and knowledge repositories. What you write today may be read by lawyers in a lawsuit, auditors during certification, or a future technician trying to solve a recurring problem. Write clearly, professionally, and completely. The 5W1H framework applies: What happened? When? Where? Why (root cause)? How was it fixed? Who did the work?",
          key_points: [
            "Be specific: 'Replaced motor' is useless. 'Replaced 5HP 3-phase motor #XY123 - old motor had open L1 winding per megger test' is useful.",
            "Include measurements: Before and after values prove the repair worked",
            "Attach photos: Pictures of failed parts, nameplate data, installation state",
            "Note parts used: Part numbers, quantities - this builds spare parts data",
            "Record labor time honestly - this drives planning accuracy",
            "Professional language only - no slang, complaints, or blame in official records",
            "Root cause, not just symptom: 'Bearing failed due to lubrication starvation - PM schedule updated'"
          ]
        },
        {
          title: "Communicating with Operations and Management",
          content: "Maintenance and Operations often have conflicting priorities - production wants uptime, maintenance wants time to fix things properly. Successful maintenance leaders learn to speak 'operations language': downtime hours, production impact, safety risk. When requesting shutdown time, lead with business impact: 'If we don't replace this bearing now ($500 parts, 4 hours planned downtime), we risk catastrophic failure ($50,000 motor, 3-day unplanned outage).'",
          key_points: [
            "Learn the language: OEE, throughput, yield, schedule attainment - speak their metrics",
            "Lead with business impact, not technical details",
            "Provide options when possible: 'We can do 2-hour repair now or 8-hour repair later'",
            "Be honest about estimates - sandbagging destroys trust, but so does missing deadlines",
            "Update proactively - don't wait for them to ask 'are you done yet?'",
            "Build relationships before you need them - coffee with supervisors goes a long way",
            "Escalate appropriately - don't go over your boss's head unless safety requires it"
          ]
        },
        {
          title: "Incident and Near-Miss Reporting",
          content: "Reporting incidents and near-misses prevents future injuries and equipment damage. Many organizations have a 'no-blame' reporting culture where the focus is on fixing systems, not punishing people. Your role is to report accurately, completely, and promptly. Include: What happened, Contributing factors, Immediate actions taken, and Recommendations to prevent recurrence. Near-miss reports are actually more valuable than incident reports because you can learn without anyone getting hurt.",
          key_points: [
            "Report promptly - within shift for incidents, within 24 hours for near-misses",
            "Facts only - what you observed, not interpretations or blame",
            "Contributing factors: What conditions allowed this to happen? Environment? Training? Equipment?",
            "Immediate actions: What did you do right after to make the situation safe?",
            "Recommendations: How could systems/procedures change to prevent recurrence?",
            "Photos and diagrams help - a picture is worth 1000 words in incident investigation",
            "Near-misses are free lessons - report them as enthusiastically as actual incidents"
          ]
        },
        {
          title: "Presenting Technical Information to Non-Technical Audiences",
          content: "At some point, you'll present to management, safety committees, or vendor groups. The key is translating technical details into business outcomes. Nobody outside maintenance cares about bearing clearances - they care about downtime, cost, and risk. Use the 'So What?' test: after every technical statement, ask 'So what does this mean for the business?' That's what your audience wants to know.",
          key_points: [
            "Start with the conclusion - busy executives want the bottom line first",
            "Translate to business metrics: 'This repair prevents 8 hours potential downtime worth $50,000'",
            "Use visuals - photos, trends, charts communicate faster than words",
            "Limit jargon - if you must use technical terms, define them briefly",
            "Practice the 'elevator pitch' - can you explain it in 60 seconds?",
            "Anticipate questions - what will they want to know? Prepare those answers.",
            "End with clear recommendations or asks - what do you need from them?"
          ]
        }
      ],
      scenarios: [{
        title: "The Missed Handoff",
        description: "A critical communication failure has led to equipment damage. You need to investigate what went wrong and prevent recurrence.",
        situation: "Day shift noticed Pump #7 running hot (185°F) but continued running it. They mentioned it verbally to night shift but didn't document it. Night shift forgot to monitor. Pump seized at 2 AM causing $45,000 damage and 16 hours downtime.",
        symptoms: ["No written record of abnormal condition", "Verbal-only handoff", "No monitoring performed overnight", "Pump failure during unattended hours"],
        measurements: { "Bearing Temp at 4PM": "185°F (normal <150°F)", "Documentation": "None", "Shift Log": "Empty", "Maintenance Called": "2:15 AM after seizure" },
        decisionPoints: [
          {
            question: "What was the root cause of this incident?",
            options: [
              "Night shift negligence",
              "Day shift should have shut it down",
              "Communication system failure - no structured handoff",
              "The pump was defective"
            ],
            correctAnswer: 2,
            explanation: "While individuals made mistakes, the system allowed those mistakes. A structured handoff process with written documentation and verification would have caught this. The root cause is system failure, not individual blame."
          },
          {
            question: "What corrective actions would prevent recurrence?",
            options: [
              "Discipline both shifts",
              "Implement structured handoff with written log and verbal verification",
              "Add more temperature alarms",
              "Hire more experienced technicians"
            ],
            correctAnswer: 1,
            explanation: "Structured handoffs with documentation and verbal confirmation create redundancy. If either fails, the other catches it. Discipline alone doesn't fix the system that allowed the failure."
          }
        ],
        solution: "Implemented formal handoff procedure with written log, face-to-face verbal handoff, and repeat-back confirmation. Added 'abnormal conditions' section to shift log. Trained all shifts on new procedure.",
        lessonsLearned: [
          "Verbal handoffs alone are unreliable - use written + verbal",
          "Any abnormal condition must be documented in writing",
          "The receiving shift must ask questions and confirm understanding",
          "Fix the system, not just the people"
        ]
      }],
      quiz: [
        { question: "What percentage of maintenance-related incidents are attributed to poor communication?", options: ["20%", "40%", "60%", "80%"], correctAnswer: 2 },
        { question: "What is the most dangerous time in maintenance operations?", options: ["Startup after PM", "Shift handoff transitions", "Emergency repairs", "Weekend shifts"], correctAnswer: 1 },
        { question: "What should you lead with when requesting shutdown time from operations?", options: ["Technical specifications", "Business impact and costs", "Your personal opinion", "OSHA requirements"], correctAnswer: 1 },
        { question: "Why are near-miss reports valuable?", options: ["They satisfy OSHA requirements", "They document blame", "You can learn without anyone getting hurt", "They're easier to write"], correctAnswer: 2 },
        { question: "When presenting to non-technical audiences, you should:", options: ["Use more technical jargon to establish expertise", "Start with detailed background information", "Start with the conclusion and translate to business metrics", "Avoid visuals as they're unprofessional"], correctAnswer: 2 },
        { question: "Work order documentation should include:", options: ["Personal opinions about the failure", "Specific measurements, parts used, and root cause", "Minimal information to save time", "Blame for who caused the problem"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 45,
    points: 150,
  });

  // Module 7: Safety Leadership and Culture
  const module7 = await storage.createTrainingModule({
    companyId,
    title: "Safety Leadership and Culture Building",
    description: "Build and maintain a world-class safety culture: leading safety initiatives, incident investigation, behavior-based safety, and creating psychological safety for reporting",
    content: JSON.stringify({
      sections: [
        {
          title: "The Leader's Role in Safety Culture",
          content: "Safety culture flows from leadership behavior, not safety posters. When leaders prioritize production over safety, everyone notices. When leaders stop unsafe acts immediately regardless of schedule pressure, that becomes the standard. Research shows that 94% of safety incidents involve behavioral/cultural factors - only 6% are purely technical/equipment failures. You, as a leader, are the primary influence on your team's safety behaviors.",
          key_points: [
            "Walk the talk: If you bypass safety rules under pressure, your team will too",
            "Make safety the first topic in every meeting - this signals priority",
            "Stop unsafe acts immediately - 'We don't have time for safety' is never acceptable",
            "Reward safe behaviors, not just safe outcomes (luck ≠ skill)",
            "Share near-miss stories openly - these are learning opportunities, not embarrassments",
            "Take personal responsibility for team safety - if someone gets hurt, ask what you could have done differently",
            "Be visible on the floor - you can't lead safety from your office"
          ]
        },
        {
          title: "Conducting Effective Safety Observations",
          content: "Safety observations are proactive - you're watching work to identify hazards before they cause harm. Unlike audits, observations are not about finding violations to punish. They're about coaching and recognizing safe behaviors. The ratio should be 80% positive recognition, 20% correction. This builds trust and makes people receptive when you do need to correct a behavior.",
          key_points: [
            "Announce your presence - sneaking around destroys trust",
            "Watch the work, not the person - focus on behaviors and conditions",
            "Ask questions: 'What hazards did you consider?' 'What could go wrong?'",
            "Recognize safe behaviors specifically: 'I noticed you verified LOTO before reaching in - that's exactly right'",
            "Correct privately when possible - nobody likes public criticism",
            "For corrections, explain WHY: 'This matters because last year someone lost a finger doing it that way'",
            "Document patterns, not individual incidents - are certain tasks consistently done unsafely?"
          ],
          procedures: [
            "Step 1: Plan observations - vary times, locations, and tasks observed",
            "Step 2: Greet worker and explain you're doing a safety observation",
            "Step 3: Watch the complete task or a representative portion",
            "Step 4: Note both safe behaviors and at-risk behaviors",
            "Step 5: Discuss observations with the worker - start with what went well",
            "Step 6: For at-risk behaviors, ask what they think could be done differently",
            "Step 7: Thank them for participating - observations should be positive experiences",
            "Step 8: Log observation data to track trends over time"
          ]
        },
        {
          title: "Incident Investigation Fundamentals",
          content: "Incident investigations seek to understand how the system allowed failure, not who to blame. Blame cultures hide incidents; just cultures learn from them. Use the 5 Whys technique to dig past symptoms to root causes. If a worker stepped on a loose board and fell, the first 'why' is the loose board. But why was the board loose? Why wasn't it repaired? Why didn't anyone report it? That's where you find systemic issues to fix.",
          key_points: [
            "Investigate near-misses with the same rigor as actual incidents",
            "5 Whys technique: Keep asking 'Why?' until you reach systemic causes (typically 5 levels)",
            "Look for system failures, not just human error - what made the error possible?",
            "Contributing factors: Training? Procedure? Equipment? Environment? Fatigue?",
            "Interview witnesses separately to avoid groupthink",
            "Focus on facts, not blame - people will share more if they don't fear punishment",
            "Close the loop: Implement corrective actions and verify they work"
          ],
          procedures: [
            "Step 1: Secure the scene and provide first aid if needed",
            "Step 2: Preserve evidence - photos, parts, documents",
            "Step 3: Interview witnesses within 24 hours while memory is fresh",
            "Step 4: Create timeline of events leading to incident",
            "Step 5: Apply 5 Whys to identify root causes",
            "Step 6: Identify contributing factors (human, equipment, environmental, organizational)",
            "Step 7: Develop corrective actions that address root causes, not just symptoms",
            "Step 8: Assign owners and deadlines for corrective actions",
            "Step 9: Follow up to verify actions were completed and effective"
          ]
        },
        {
          title: "Creating Psychological Safety for Reporting",
          content: "Workers will only report hazards and near-misses if they believe reporting will lead to fixes, not punishment. Psychological safety means people feel safe to speak up, admit mistakes, and raise concerns. Leaders build this by responding positively to reports, fixing reported issues quickly, and never punishing the messenger. When reporting stops, it doesn't mean problems stopped - it means people stopped telling you.",
          key_points: [
            "Thank every reporter genuinely - 'I appreciate you telling me this'",
            "Fix reported issues quickly - visible action builds trust in the system",
            "Never punish reporters even if they were part of the problem",
            "Share what you learned from reports (anonymized) - show the value",
            "Make reporting easy - paper forms, apps, verbal reports all valid",
            "Track leading indicators (reports, observations) not just lagging (injuries)",
            "Silence is dangerous - if nobody's reporting, they've given up on safety culture"
          ]
        },
        {
          title: "Pre-Job Safety Planning",
          content: "Every task, especially non-routine work, deserves safety planning before tools come out. The Job Safety Analysis (JSA) or Job Hazard Analysis (JHA) breaks work into steps, identifies hazards at each step, and determines controls. For routine tasks, a quick mental JSA is sufficient. For complex or high-risk work, document the JSA and review with the team. The 5 minutes spent planning prevents the 5 days of incident investigation.",
          key_points: [
            "Break job into discrete steps - what happens first, second, third?",
            "Identify hazards at each step - what could go wrong? Energy sources? Ergonomics?",
            "Determine controls for each hazard - elimination > substitution > engineering > admin > PPE",
            "Review with team - they may see hazards you missed",
            "Post JSA at work area for reference",
            "Update JSA when conditions change - new equipment, different personnel",
            "Brief new team members on JSA before they begin work"
          ]
        }
      ],
      scenarios: [{
        title: "The Silent Safety Culture",
        description: "Near-miss reports have dropped to zero over the past quarter. Is your plant suddenly safer, or is something else happening?",
        situation: "You're reviewing quarterly safety metrics. Near-miss reports: Q1=47, Q2=31, Q3=12, Q4=0. Injury rate unchanged. Maintenance supervisor says 'people are being more careful now.'",
        symptoms: ["Near-miss reports dropped from 47 to 0 in one year", "Injury rate stayed constant", "Supervisor claims improved awareness", "No changes to safety programs or staffing"],
        measurements: { "Q1 Near-Misses": "47", "Q2 Near-Misses": "31", "Q3 Near-Misses": "12", "Q4 Near-Misses": "0", "Injury Rate": "Unchanged" },
        decisionPoints: [
          {
            question: "What does the trend of declining near-miss reports most likely indicate?",
            options: [
              "The workplace is getting safer",
              "Safety training is finally working",
              "People have stopped reporting - psychological safety has eroded",
              "Near-misses aren't happening anymore"
            ],
            correctAnswer: 2,
            explanation: "If the workplace was truly safer, injuries would also decline. Constant injury rate + zero near-miss reports = people stopped reporting. This is a serious cultural warning sign."
          },
          {
            question: "How should you address this situation?",
            options: [
              "Celebrate the 'improvement' publicly",
              "Investigate what happened to reporting culture, rebuild psychological safety",
              "Increase safety audits and enforcement",
              "Require mandatory near-miss report quotas"
            ],
            correctAnswer: 1,
            explanation: "Find out why people stopped reporting. Was someone punished? Were reports ignored? Then rebuild trust: thank reporters publicly, fix reported issues quickly, and never punish the messenger."
          }
        ],
        solution: "Investigation revealed a new supervisor dismissed several reports as 'not real hazards' and questioned reporters about their own behaviors. Workers learned that reporting led to scrutiny, not fixes. Coached supervisor, apologized to team, and rebuilt reporting culture over 6 months.",
        lessonsLearned: [
          "Zero near-miss reports is a red flag, not a success",
          "One negative response to a reporter can shut down reporting for months",
          "Psychological safety must be actively maintained by leadership",
          "Compare leading indicators (reports) with lagging indicators (injuries)"
        ]
      }],
      quiz: [
        { question: "What percentage of safety incidents involve behavioral/cultural factors?", options: ["44%", "64%", "84%", "94%"], correctAnswer: 3 },
        { question: "What should be the ratio of positive recognition to correction in safety observations?", options: ["50/50", "60/40", "80/20", "100% correction"], correctAnswer: 2 },
        { question: "What does it mean if safety reporting stops?", options: ["The workplace is now safe", "People have given up on the safety culture", "Training is working", "No more hazards exist"], correctAnswer: 1 },
        { question: "What is the primary purpose of incident investigation?", options: ["Assign blame", "Document for insurance", "Understand how the system allowed failure", "Satisfy OSHA requirements"], correctAnswer: 2 },
        { question: "What is the hierarchy of controls (most to least effective)?", options: ["PPE > Admin > Engineering", "Elimination > Engineering > PPE", "Training > PPE > Engineering", "Warning signs > PPE > Elimination"], correctAnswer: 1 },
        { question: "How should leaders respond when a worker reports a safety concern?", options: ["Investigate whether the reporter was following rules", "Thank them and work to fix the issue quickly", "Document it for their annual review", "Explain why it's not actually a problem"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  // Module 8: Maintenance Planning & Scheduling Excellence
  const module8 = await storage.createTrainingModule({
    companyId,
    title: "Maintenance Planning & Scheduling Excellence",
    description: "Master the art and science of maintenance planning: work order management, resource optimization, scheduling techniques, and KPI-driven continuous improvement",
    content: JSON.stringify({
      sections: [
        {
          title: "The Business Case for Planning",
          content: "Unplanned maintenance costs 3-5x more than planned maintenance. A planned job with staged materials and clear instructions takes 35% less time than the same job done reactively. World-class maintenance organizations achieve 80%+ planned work - most plants are stuck at 20-40%. The planner role, separate from supervision, is the key to breaking through this barrier. Planners create work packages; supervisors assign and manage execution.",
          key_points: [
            "Reactive maintenance = technician hunting for parts, reading manuals, figuring it out on the fly",
            "Planned maintenance = everything staged, instructions ready, estimated time accurate",
            "Every hour of planning saves 3 hours of wrench time (1:3 planning ratio)",
            "One planner can support 15-25 technicians with proper CMMS",
            "Schedule compliance target: 80%+ of scheduled work completed as planned",
            "Backlog management: 2-4 weeks of ready-to-schedule work is healthy",
            "Emergency work target: <10% of total maintenance hours"
          ]
        },
        {
          title: "Creating Effective Work Packages",
          content: "A work package contains everything a technician needs to complete a job without hunting. Scope of work (what exactly to do), safety requirements (permits, LOTO), parts and materials (staged and ready), tools and equipment (specialty items identified), labor estimate (realistic hours), and reference documents (drawings, manuals). The job plan is reusable - invest time once, save time forever.",
          key_points: [
            "Job steps: Clear, numbered sequence of actions - not 'fix motor' but specific steps",
            "Parts list: Part numbers, quantities, and BIN locations - parts should be kitted and staged",
            "Tool list: Standard tools assumed; specialty tools explicitly listed and reserved",
            "Safety requirements: LOTO points, permits needed, PPE requirements",
            "Time estimate: Realistic duration including travel, setup, cleanup",
            "Attachments: Drawings, photos of nameplate data, relevant procedures",
            "Skill requirements: What certifications or skills are needed to perform this work?"
          ],
          procedures: [
            "Step 1: Review work request to understand scope - clarify with requester if vague",
            "Step 2: Visit job site to assess conditions (unless you know the equipment well)",
            "Step 3: Determine all materials needed - check inventory, order if necessary",
            "Step 4: Estimate labor hours using historical data, adjust for current conditions",
            "Step 5: Identify safety requirements - permits, LOTO points, PPE",
            "Step 6: Attach reference documents - drawings, OEM procedures, photos",
            "Step 7: Stage materials when available - link parts reservation to work order",
            "Step 8: Set work order status to 'Ready to Schedule' when complete"
          ]
        },
        {
          title: "Weekly Scheduling Process",
          content: "Scheduling allocates labor hours to ready work orders based on priority and resource availability. The weekly schedule is developed 1-2 weeks ahead, approved by operations (who provide equipment access), and executed by maintenance supervision. Daily adjustments handle emergent work, but the weekly schedule provides the baseline. Schedule compliance is measured weekly - how much of what we planned actually got done?",
          key_points: [
            "Schedule one week ahead minimum - gives operations time to prepare for outages",
            "Only schedule 'ready' work - parts on hand, plan complete, craft available",
            "Fill 100% of available labor hours - don't leave unassigned capacity",
            "Priority order: Safety/Compliance > Production-down > Degraded operation > PM due > Backlog",
            "Coordinate with operations weekly - they approve when equipment can be released",
            "Daily schedule adjustments: Handle emergents by trading off, not adding more",
            "Measure schedule compliance weekly - target 80%+, investigate slippage causes"
          ]
        },
        {
          title: "Key Performance Indicators for Maintenance",
          content: "What gets measured gets managed. Effective maintenance organizations track leading indicators (PM compliance, schedule compliance, backlog weeks) not just lagging indicators (breakdown frequency, MTTR). KPIs should drive behavior toward goals. If PM compliance is low, why? No parts? No labor? No cooperation from operations? The KPI surfaces the issue; root cause analysis finds the fix.",
          key_points: [
            "PM Compliance: % of PMs completed on time. Target: 95%+. Low = resource or priority issues.",
            "Schedule Compliance: % of scheduled work completed as planned. Target: 80%+. Low = poor planning or too much emergent work.",
            "Backlog Weeks: Total ready backlog hours ÷ weekly labor hours. Target: 2-4 weeks. Too low = finding work; too high = falling behind.",
            "Reactive %: Emergency + urgent work ÷ total work. Target: <15%. High = PM program failing.",
            "MTTR: Mean time to repair. Track by equipment type. Rising = skill or parts issues.",
            "MTBF: Mean time between failures. Track critical equipment. Falling = PM or design issues.",
            "Wrench Time: % of shift actually turning wrenches vs. waiting, traveling, hunting. Target: 55%+."
          ]
        },
        {
          title: "Continuous Improvement in Maintenance",
          content: "Excellence is a moving target - what's world-class today is average tomorrow. Build continuous improvement into your routine: weekly KPI reviews, monthly deep-dives on problem equipment, quarterly planning process reviews. Involve technicians in improvement - they see waste that management doesn't. Use PDCA (Plan-Do-Check-Act) cycles to test changes before full implementation.",
          key_points: [
            "Weekly: Review KPIs with team, discuss barriers, assign action items",
            "Monthly: Bad actor review - which equipment is consuming disproportionate resources?",
            "Quarterly: Review planning/scheduling process - what's working? What needs improvement?",
            "Annually: Benchmark against industry standards, set improvement targets",
            "Involve technicians: They know where time is wasted - ask and listen",
            "PDCA: Pilot changes on one line before plant-wide rollout",
            "Celebrate wins: Recognize improvements publicly to reinforce the behavior"
          ]
        }
      ],
      scenarios: [{
        title: "The Reactive Maintenance Trap",
        description: "Your maintenance department is stuck in 'firefighting mode.' You need to break the cycle and move toward planned maintenance.",
        situation: "Current state: 65% reactive/emergency work, 20% PM, 15% projects. Schedule compliance 45%. Technicians frustrated - 'We can never get ahead.' Operations complains maintenance is always behind.",
        symptoms: ["65% reactive work", "45% schedule compliance", "Frustrated technicians", "Operations complaints", "Growing backlog"],
        measurements: { "Reactive %": "65%", "PM Compliance": "72%", "Schedule Compliance": "45%", "Backlog": "14 weeks", "Avg MTTR": "Rising" },
        decisionPoints: [
          {
            question: "What's the root cause of being stuck in reactive mode?",
            options: [
              "Not enough technicians",
              "Poor equipment quality",
              "PMs not being done, causing failures that consume time for PMs",
              "Operations is too demanding"
            ],
            correctAnswer: 2,
            explanation: "It's a vicious cycle: skip PMs due to emergencies → more failures → more emergencies → less PM time. Breaking this cycle requires protecting PM time even when emergencies compete for resources."
          },
          {
            question: "What's the most effective first step to break the reactive cycle?",
            options: [
              "Hire more technicians immediately",
              "Protect PM schedule - complete PMs regardless of emergencies",
              "Focus only on emergencies until backlog clears",
              "Implement new CMMS software"
            ],
            correctAnswer: 1,
            explanation: "You must protect PM time even when it hurts. Let non-critical equipment wait while you complete PMs on critical equipment. Short-term pain leads to long-term gain as failures decrease."
          }
        ],
        solution: "Dedicated PM crew that only does PMs - not pulled for emergencies. Prioritized PMs on 'bad actors' first. Within 6 months, reactive work dropped to 40%. Continued improvement over 18 months to reach 25% reactive.",
        lessonsLearned: [
          "Reactive maintenance is self-perpetuating - must break the cycle deliberately",
          "Protecting PM time feels wrong during emergencies but pays off",
          "Focus PMs on equipment causing most failures first (bad actors)",
          "Progress is gradual - expect 12-18 months to see major improvement"
        ]
      }],
      quiz: [
        { question: "How much more does unplanned maintenance cost compared to planned?", options: ["50% more", "2x more", "3-5x more", "10x more"], correctAnswer: 2 },
        { question: "What is a healthy backlog level?", options: ["0 weeks - all caught up", "2-4 weeks of ready work", "8-12 weeks", "As much as possible"], correctAnswer: 1 },
        { question: "What is the planning ratio (hours of planning saves X hours of wrench time)?", options: ["1:1", "1:2", "1:3", "1:5"], correctAnswer: 2 },
        { question: "What should be the target for PM compliance?", options: ["70%", "80%", "90%", "95%+"], correctAnswer: 3 },
        { question: "What is wrench time?", options: ["Time spent on emergency repairs", "% of shift actually performing maintenance work", "Time to find tools", "Break time"], correctAnswer: 1 },
        { question: "When should you schedule maintenance work?", options: ["When parts arrive", "One week ahead minimum", "Same day as requested", "Only during shutdowns"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 60,
    points: 200,
  });

  // Module 9: Advanced Leadership Fundamentals for Maintenance Supervisors
  const module9 = await storage.createTrainingModule({
    companyId,
    title: "Advanced Leadership Fundamentals for Supervisors",
    description: "Build world-class leadership capabilities: emotional intelligence, situational leadership, decision-making frameworks, and developing high-performance maintenance teams",
    content: JSON.stringify({
      sections: [
        {
          title: "The Transition from Technician to Leader",
          content: "The skills that made you an excellent technician are different from the skills that make an excellent leader. Technical expertise got you promoted, but leadership requires a new mindset: your success is now measured by your team's success, not your personal technical accomplishments. This transition is the hardest part of becoming a supervisor. Many struggle because they keep doing technical work instead of leading.",
          key_points: [
            "Your job is no longer to fix equipment - it's to develop people who fix equipment",
            "Letting go of technical tasks is hard but necessary - delegate to grow your team",
            "Your value is now in removing obstacles, coaching, and strategic thinking",
            "Being the 'smartest in the room' is no longer the goal - developing smart people is",
            "Time spent fixing something yourself is time NOT spent developing your team",
            "Ask: 'Who on my team should learn to do this?' before jumping in yourself"
          ]
        },
        {
          title: "Emotional Intelligence in Leadership",
          content: "Emotional Intelligence (EQ) is the ability to recognize, understand, and manage emotions - both yours and others'. Research shows EQ is twice as important as IQ for leadership success. A supervisor who loses their temper under pressure destroys trust. One who stays calm and supports the team builds loyalty. Self-awareness is the foundation: know your triggers, your stress responses, and your impact on others.",
          key_points: [
            "Self-awareness: Know your emotional triggers (rushed, blamed, disrespected) and your reactions",
            "Self-regulation: Pause before reacting - count to 10, take a breath, walk around the corner",
            "Motivation: Lead with purpose beyond paycheck - reliability, safety, team success",
            "Empathy: Understand what your technicians are experiencing before judging",
            "Social skills: Build relationships, navigate conflict, influence without authority",
            "Your mood is contagious - anxious leaders create anxious teams, calm leaders create calm teams"
          ]
        },
        {
          title: "Situational Leadership: Adapting Your Style",
          content: "There is no single 'best' leadership style. Effective leaders adapt their approach based on the situation and the individual's development level. A new technician needs clear direction and close supervision. An experienced veteran needs autonomy and support. Using directive leadership with an expert is demotivating; using delegating with a novice is abandonment. Match your style to the person and task.",
          key_points: [
            "Directing (S1): High task, low relationship - for new employees or new tasks. Give clear instructions.",
            "Coaching (S2): High task, high relationship - for developing employees. Explain decisions, encourage questions.",
            "Supporting (S3): Low task, high relationship - for capable but uncertain employees. Listen, provide support.",
            "Delegating (S4): Low task, low relationship - for experienced, confident employees. Give autonomy.",
            "Assess each person for each task separately - someone expert at motors may be novice at PLCs",
            "Move toward delegation as competence grows - the goal is maximum team autonomy"
          ]
        },
        {
          title: "Decision-Making Frameworks",
          content: "Leaders make dozens of decisions daily. Having a framework speeds up good decisions and reduces stress. For routine decisions, use standard operating procedures - don't reinvent every wheel. For complex decisions, gather data, consider alternatives, and consult stakeholders. For urgent decisions, act on available information and adjust. The worst decision is often no decision.",
          key_points: [
            "Routine decisions: Use SOPs, checklists, and precedent - don't overthink the obvious",
            "Complex decisions: Define the problem → Gather info → Generate options → Evaluate → Decide → Act",
            "Time-critical decisions: Act on 80% information - waiting for 100% often means too late",
            "Reversible vs. irreversible: For reversible decisions, decide quickly. For irreversible, take more time.",
            "Involve others appropriately: Consult for expertise, don't abdicate responsibility",
            "Document your reasoning: If asked later, you can explain why you decided what you did"
          ]
        },
        {
          title: "Building Trust and Credibility",
          content: "Trust is the foundation of leadership. Without trust, every instruction is questioned, every feedback is resented, every change is resisted. Trust is built slowly through consistent behavior and destroyed quickly through inconsistency or betrayal. Keep your promises, admit your mistakes, and always tell the truth - even when it's uncomfortable.",
          key_points: [
            "Keep commitments: If you say you'll do something, do it. Every broken promise erodes trust.",
            "Be consistent: Apply rules fairly, don't play favorites, treat everyone with respect",
            "Admit mistakes: 'I was wrong' builds more trust than never being wrong destroys",
            "Give credit, take blame: Celebrate team successes, own team failures",
            "Be transparent: Explain the 'why' behind decisions, share information freely",
            "Follow through: When you say you'll look into something, actually look into it and report back"
          ]
        }
      ],
      scenarios: [{
        title: "The Struggling New Supervisor",
        description: "You've just been promoted from top technician to supervisor. Your former peers are now your direct reports, and the transition is rocky.",
        situation: "Week 3 as new supervisor. Former peers making jokes about you being 'boss.' One senior tech openly ignoring your instructions. You're still jumping in to fix equipment yourself because 'it's faster.' Production manager asking why things aren't improving.",
        symptoms: ["Former peers not respecting new authority", "Senior tech undermining you", "Still doing technical work yourself", "No visible improvement in team performance"],
        measurements: { "Work Orders Completed": "Same as before", "Your Wrench Time": "60% (should be <10%)", "Team Morale": "Declining", "Delegation": "Minimal" },
        decisionPoints: [
          {
            question: "What's the core problem with your transition so far?",
            options: [
              "Your former peers are unprofessional",
              "You weren't ready to be promoted",
              "You're still acting like a technician instead of a leader",
              "The production manager is too demanding"
            ],
            correctAnswer: 2,
            explanation: "Every minute you spend turning wrenches is a minute NOT spent developing your team, planning, and leading. You were promoted for your technical skills, but leadership requires different behaviors."
          },
          {
            question: "How should you address the senior tech who's ignoring instructions?",
            options: [
              "Ignore it and hope it resolves itself",
              "Have a private conversation, explain expectations, and listen to their concerns",
              "Write them up immediately to establish authority",
              "Ask your manager to handle it"
            ],
            correctAnswer: 1,
            explanation: "Direct, private conversation is the right approach. The tech may feel passed over, may not understand the change, or may have valid concerns. Listen first, then clarify expectations and consequences."
          }
        ],
        solution: "Stopped doing technical work except emergencies. Had one-on-ones with each team member to understand their concerns. With the senior tech, acknowledged his expertise, asked for his help developing others, and clarified that instructions still need to be followed. Built trust through consistency over 3 months.",
        lessonsLearned: [
          "Technical excellence doesn't equal leadership readiness - new skills required",
          "Doing technical work undermines your leadership role",
          "Address resistance early with direct, respectful conversation",
          "Former peers need time to adjust - be patient but consistent"
        ]
      }],
      quiz: [
        { question: "What is the biggest challenge when transitioning from technician to supervisor?", options: ["Learning new software", "Shifting from doing work to developing people", "Getting a bigger office", "Attending more meetings"], correctAnswer: 1 },
        { question: "Emotional Intelligence is how many times more important than IQ for leadership success?", options: ["Half as important", "Equally important", "Twice as important", "Ten times as important"], correctAnswer: 2 },
        { question: "Which leadership style is best for a new employee learning a new task?", options: ["Delegating", "Supporting", "Coaching", "Directing"], correctAnswer: 3 },
        { question: "When making time-critical decisions, what percentage of information is enough to act?", options: ["100%", "90%", "80%", "50%"], correctAnswer: 2 },
        { question: "What is the foundation of effective leadership?", options: ["Technical expertise", "Positional authority", "Trust and credibility", "Industry experience"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  // Module 10: Team Building and Performance Management
  const module10 = await storage.createTrainingModule({
    companyId,
    title: "Team Building and Performance Management",
    description: "Create high-performing maintenance teams: hiring and onboarding, performance reviews, coaching and development, managing difficult conversations, and building team culture",
    content: JSON.stringify({
      sections: [
        {
          title: "Building a High-Performing Maintenance Team",
          content: "High-performing teams don't happen by accident. They're built through intentional hiring, clear expectations, ongoing development, and strong culture. The best maintenance teams share common traits: mutual respect, open communication, shared accountability, and continuous learning. As a leader, you set the tone for all of these.",
          key_points: [
            "Hire for attitude, train for skill - technical skills can be taught, work ethic cannot",
            "Diversity of experience strengthens teams - different backgrounds bring different perspectives",
            "Clear roles and responsibilities prevent confusion and conflict",
            "Shared goals align individual efforts toward team success",
            "Celebrate wins together - team accomplishments build team identity",
            "Address problems early - small issues become big problems when ignored"
          ]
        },
        {
          title: "Effective Onboarding for New Technicians",
          content: "The first 90 days determine whether a new hire becomes a productive team member or a turnover statistic. Structured onboarding is not 'here's your locker, good luck.' It's a planned progression of training, mentoring, and integration. Assign a buddy, set clear milestones, provide regular feedback, and check in frequently. The goal is competence AND confidence.",
          key_points: [
            "Day 1: Safety orientation, team introductions, facility tour, locker/tools issued",
            "Week 1: Shadow experienced technician, observe all shift routines, start safety training",
            "Month 1: Complete required certifications, begin simple tasks under supervision, daily check-ins",
            "Month 2: Increase responsibility, work more independently, weekly check-ins",
            "Month 3: Full participation, performance review, development plan discussion",
            "Assign a mentor: Experienced technician who can answer questions and provide guidance"
          ]
        },
        {
          title: "Conducting Performance Reviews That Matter",
          content: "Annual performance reviews are often dreaded by both managers and employees because they're done poorly. A good review has no surprises - feedback should happen throughout the year, and the review is a summary discussion. Focus on future development, not just past performance. Make it a conversation, not a lecture. Set clear goals together for the coming year.",
          key_points: [
            "No surprises: If you're telling them something for the first time in a review, you've failed",
            "Prepare thoroughly: Review the whole year, not just recent events (recency bias)",
            "Start with positives: Genuine recognition of accomplishments sets positive tone",
            "Be specific: 'You need to improve' is useless. 'I need you to respond to calls within 30 minutes' is actionable",
            "Listen more than talk: Ask questions, understand their perspective",
            "Set SMART goals: Specific, Measurable, Achievable, Relevant, Time-bound",
            "End with development plan: What training, experiences, or assignments will help them grow?"
          ]
        },
        {
          title: "Having Difficult Conversations",
          content: "Avoiding difficult conversations doesn't make problems go away - it makes them worse. Performance issues, behavior problems, and interpersonal conflicts all require direct conversation. The longer you wait, the harder it gets. Use a structured approach: describe the behavior factually, explain the impact, listen to their perspective, and agree on next steps together.",
          key_points: [
            "Don't avoid: The short-term discomfort of a difficult conversation prevents long-term pain",
            "Private setting: Never embarrass someone publicly, even if frustrated",
            "Behavior, not character: 'You were late three times this week' not 'You're irresponsible'",
            "Impact matters: Explain how the behavior affects the team, safety, or operations",
            "Listen genuinely: There may be context you don't know - home situation, health, misunderstanding",
            "Problem-solve together: 'What can we do to prevent this?' is better than 'Don't do this again'",
            "Document appropriately: Follow HR policies on documentation and progressive discipline"
          ]
        },
        {
          title: "Motivating and Engaging Your Team",
          content: "Motivated technicians go beyond minimum requirements - they take ownership, suggest improvements, and support teammates. Motivation comes from autonomy (control over their work), mastery (getting better at their craft), and purpose (meaningful contribution). Money matters, but beyond fair compensation, these intrinsic motivators drive engagement.",
          key_points: [
            "Autonomy: Give experienced technicians latitude in how they accomplish goals",
            "Mastery: Provide training, challenging assignments, opportunities to learn new skills",
            "Purpose: Connect daily work to larger mission - reliability, safety, supporting production",
            "Recognition: Specific, timely, public (when appropriate) acknowledgment of good work",
            "Involvement: Ask for input on decisions that affect their work",
            "Growth paths: Help technicians see a future - what's next in their career?",
            "Fair treatment: Consistent application of rules, equitable work assignments, respect"
          ]
        }
      ],
      scenarios: [{
        title: "The Underperforming Veteran",
        description: "A 20-year veteran technician's performance has been declining. You need to address it before it affects the whole team.",
        situation: "Mike has been with the company 20 years. Last 6 months: coming in late, taking long breaks, work quality slipping. Other technicians frustrated - 'We're picking up his slack.' HR says he has no documented performance issues.",
        symptoms: ["Chronic lateness (2-3x/week)", "Extended breaks", "Work quality declining", "Team resentment building", "No prior documentation"],
        measurements: { "Late Arrivals": "2-3x weekly, 15-30 min", "Work Orders": "20% fewer completed", "Rework Rate": "Up 40%", "Peer Feedback": "Frustrated" },
        decisionPoints: [
          {
            question: "What's the first step you should take?",
            options: [
              "Document everything and go straight to HR for termination",
              "Have a private, caring conversation to understand what's happening",
              "Ignore it - he has 20 years of service",
              "Publicly call him out to make an example"
            ],
            correctAnswer: 1,
            explanation: "Start with a private conversation. Something may be going on personally. Approach with curiosity and care, not accusations. You might learn he's dealing with health issues, family problems, or burnout."
          },
          {
            question: "Mike shares he's going through a divorce and not sleeping. What's your next step?",
            options: [
              "Tell him to leave personal problems at home",
              "Express support, clarify expectations, offer EAP resources, document the conversation",
              "Give him unlimited time off until things improve",
              "Reduce his workload permanently"
            ],
            correctAnswer: 1,
            explanation: "Balance compassion with expectations. Express genuine support, connect him with EAP resources if available, but also clarify that work expectations remain. Document the conversation. This protects both of you."
          }
        ],
        solution: "Private conversation revealed divorce and depression. Connected Mike with EAP counseling. Set clear expectations with weekly check-ins. Performance improved over 3 months. Mike later thanked supervisor for 'saving his career.'",
        lessonsLearned: [
          "Performance problems often have personal root causes",
          "Approach difficult conversations with curiosity, not accusation",
          "Balance compassion with clear expectations",
          "Document all performance conversations",
          "EAP and support resources can make a real difference"
        ]
      }],
      quiz: [
        { question: "When hiring maintenance technicians, what should you prioritize?", options: ["Years of experience only", "Attitude and work ethic", "Certifications only", "Previous salary"], correctAnswer: 1 },
        { question: "How long should a structured onboarding process last?", options: ["1 day", "1 week", "90 days", "1 year"], correctAnswer: 2 },
        { question: "What should NOT happen during an annual performance review?", options: ["Discussion of development goals", "First-time feedback on issues", "Review of accomplishments", "Setting SMART goals"], correctAnswer: 1 },
        { question: "What are the three intrinsic motivators according to research?", options: ["Money, Title, Office", "Autonomy, Mastery, Purpose", "Recognition, Raises, Promotions", "Coffee, Breaks, Overtime"], correctAnswer: 1 },
        { question: "When should difficult conversations happen?", options: ["During annual review", "When you feel like it", "As soon as the issue arises", "Only if HR requires it"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 60,
    points: 200,
  });

  // Module 11: Professionalism and Career Development
  const module11 = await storage.createTrainingModule({
    companyId,
    title: "Professionalism and Career Development",
    description: "Build a world-class professional reputation: professional conduct, continuous learning, industry certifications, networking, and career advancement strategies",
    content: JSON.stringify({
      sections: [
        {
          title: "What Professionalism Means in Maintenance",
          content: "Professionalism is how you carry yourself - your reliability, your communication, your appearance, your attitude. It's showing up on time, doing what you say you'll do, treating everyone with respect, and taking pride in your work. Professionals are trusted with more responsibility because they've earned it. Your reputation is your most valuable career asset.",
          key_points: [
            "Reliability: Be where you're supposed to be, when you're supposed to be there",
            "Communication: Keep others informed, respond promptly, document thoroughly",
            "Appearance: Clean uniform, appropriate PPE, tools organized - first impressions matter",
            "Attitude: Positive approach to challenges, solution-focused, team-oriented",
            "Integrity: Do the right thing even when no one is watching",
            "Continuous improvement: Always learning, seeking feedback, getting better",
            "Accountability: Own your mistakes, learn from them, don't make excuses"
          ]
        },
        {
          title: "Building Your Professional Reputation",
          content: "Your reputation precedes you - people form opinions based on what others say about you. Building a strong reputation takes years of consistent behavior. Destroying it takes one moment of poor judgment. Be known for something positive: the person who solves hard problems, the one who helps others, the expert in a specific area. Guard your reputation zealously.",
          key_points: [
            "Be known for something: 'Go see John for electrical questions' is a valuable reputation",
            "Under-promise, over-deliver: Meeting expectations is good, exceeding them is memorable",
            "Help others succeed: Being generous with your knowledge builds goodwill",
            "Take on challenging assignments: Visibility comes from solving visible problems",
            "Manage your digital presence: LinkedIn profile, online courses, industry forums",
            "Network within and outside your company: Relationships open doors",
            "Be consistent: One great day doesn't build a reputation, consistent behavior does"
          ]
        },
        {
          title: "Continuous Learning and Certifications",
          content: "The maintenance field evolves constantly - new technologies, new regulations, new best practices. Professionals commit to lifelong learning. Industry certifications validate your expertise and open career doors. Many employers pay for certifications and provide study time. Take advantage of every learning opportunity offered.",
          key_points: [
            "Key certifications: CMRP (Certified Maintenance & Reliability Professional), SMRP membership",
            "Electrical certifications: Master Electrician license, NFPA 70E Arc Flash safety",
            "Specialty certifications: Vibration analysis (CAT I-IV), Thermography, Ultrasound, Oil analysis",
            "Management certifications: PMP (Project Management), Six Sigma Green/Black Belt, Lean Manufacturing",
            "OEM training: Manufacturer-specific certifications for critical equipment",
            "Online learning: Coursera, LinkedIn Learning, equipment vendor universities",
            "Create a personal development plan: What skills do you need for your next role?"
          ]
        },
        {
          title: "Career Advancement Strategies",
          content: "Career advancement requires intentional effort. Waiting to be noticed rarely works. Make your ambitions known to your supervisor, seek stretch assignments, build skills gaps for target roles, and network with decision-makers. Lateral moves can be as valuable as promotions - broader experience makes you a stronger candidate for leadership roles.",
          key_points: [
            "Have a clear target: What role do you want in 3-5 years? What skills does it require?",
            "Communicate your ambitions: Your manager can't help if they don't know what you want",
            "Fill skill gaps proactively: Get training, take assignments that build needed experience",
            "Seek visibility: Volunteer for cross-functional teams, present to leadership, lead initiatives",
            "Build relationships: Connect with people in roles you aspire to, learn from their paths",
            "Consider lateral moves: Experience in multiple areas (PM, projects, reliability) creates breadth",
            "Be patient but persistent: Career building takes years, not months"
          ]
        },
        {
          title: "Work-Life Balance and Personal Sustainability",
          content: "Maintenance can be demanding - emergencies don't respect schedules, overtime is common, stress is real. Sustainable careers require managing your energy, not just your time. Burnout is a real risk. Take care of your physical health, maintain relationships outside work, and set boundaries. You can't take care of equipment if you don't take care of yourself.",
          key_points: [
            "Physical health: Sleep, nutrition, exercise - the foundation of sustained performance",
            "Mental health: Recognize stress signals, seek help when needed, no shame in it",
            "Relationships: Family and friends provide support systems outside work",
            "Boundaries: It's okay to say no sometimes - overcommitment leads to burnout",
            "Recovery time: Use your vacation days - they exist for a reason",
            "Hobbies: Interests outside work provide mental breaks and renewed energy",
            "Long-term thinking: A 30-year career requires sustainable pace, not constant sprints"
          ]
        }
      ],
      scenarios: [{
        title: "The Career Crossroads",
        description: "You've been offered two opportunities. How do you make a strategic career decision?",
        situation: "You're a senior maintenance technician with 8 years experience. Two offers: (A) Shift supervisor at current plant - more money, more responsibility, lead 6 technicians. (B) Reliability engineer role at corporate - less money initially, but exposure to multiple sites and leadership development program.",
        symptoms: ["Comfortable in current role but plateauing", "Good technical skills, leadership untested", "Want to grow but unsure of best path", "Both options have trade-offs"],
        measurements: { "Option A Salary": "+15%", "Option B Salary": "-5%", "Option A Scope": "1 site, 6 direct reports", "Option B Scope": "6 sites, no direct reports" },
        decisionPoints: [
          {
            question: "What factors should weigh most heavily in this decision?",
            options: [
              "Immediate salary - take the money",
              "Long-term career trajectory and skill development",
              "What your family wants",
              "Flip a coin - they're too similar"
            ],
            correctAnswer: 1,
            explanation: "Career decisions should prioritize long-term trajectory over short-term compensation. The reliability engineer role offers exposure, breadth, and development that could lead to plant manager or reliability director roles later."
          },
          {
            question: "You choose the reliability engineer role. How do you maximize this opportunity?",
            options: [
              "Focus only on your specific job duties",
              "Build relationships, seek mentors, volunteer for projects, learn every site",
              "Keep a low profile until you learn the ropes",
              "Immediately start looking for the next promotion"
            ],
            correctAnswer: 1,
            explanation: "Corporate roles are visibility opportunities. Build relationships at every site, find mentors among senior leaders, volunteer for strategic projects, and learn how different plants operate. This builds the network and skills for advancement."
          }
        ],
        solution: "Took reliability engineer role. Built relationships across 6 plants, led a corporate PM optimization initiative, and was promoted to Reliability Manager within 3 years. The broader experience was invaluable for leadership.",
        lessonsLearned: [
          "Long-term career trajectory matters more than short-term salary",
          "Breadth of experience is valuable for leadership roles",
          "Corporate roles offer visibility to senior leadership",
          "Active networking and volunteering accelerates advancement",
          "Sometimes a short-term step back is a long-term leap forward"
        ]
      }],
      quiz: [
        { question: "What is your most valuable career asset?", options: ["Technical certifications", "Years of experience", "Your professional reputation", "Your current salary"], correctAnswer: 2 },
        { question: "Which certification is specifically for Maintenance & Reliability professionals?", options: ["PMP", "CMRP", "MBA", "CPA"], correctAnswer: 1 },
        { question: "What should you do to advance your career?", options: ["Wait to be noticed", "Communicate your ambitions to your manager", "Focus only on current job", "Avoid taking risks"], correctAnswer: 1 },
        { question: "Why are lateral career moves valuable?", options: ["They pay more immediately", "They build broader experience for leadership roles", "They are easier than promotions", "They avoid responsibility"], correctAnswer: 1 },
        { question: "What is the foundation of a sustainable long-term career?", options: ["Working maximum overtime", "Physical and mental health", "Never saying no", "Being available 24/7"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 45,
    points: 175,
  });

  // Module 12: Strategic Thinking for Maintenance Leaders
  const module12 = await storage.createTrainingModule({
    companyId,
    title: "Strategic Thinking for Maintenance Leaders",
    description: "Think beyond daily operations: aligning maintenance with business strategy, budget management, technology adoption, and building a reliability-focused organization",
    content: JSON.stringify({
      sections: [
        {
          title: "Connecting Maintenance to Business Strategy",
          content: "Maintenance is not a cost center to be minimized - it's a strategic function that enables production, protects assets, and ensures safety. The best maintenance leaders understand business strategy and align their activities accordingly. If the business is focused on growth, maintenance enables capacity. If focused on cost, maintenance optimizes spending. If focused on quality, maintenance ensures equipment precision.",
          key_points: [
            "Know your company's strategic priorities: Growth? Cost reduction? Quality? Safety?",
            "Align maintenance KPIs with business KPIs: Connect uptime to production, costs to margins",
            "Speak the language of business: ROI, payback, NPV, operating margin",
            "Translate maintenance needs into business terms: 'This repair prevents $50K production loss'",
            "Participate in planning: Get maintenance voice into capital planning, production scheduling",
            "Demonstrate value: Track and communicate maintenance contribution to business results"
          ]
        },
        {
          title: "Budget Management and Financial Acumen",
          content: "Maintenance budgets are significant investments - often 2-5% of asset replacement value annually. Leaders must manage these resources wisely: balancing preventive investment against reactive costs, managing spare parts inventory, and making business cases for capital improvements. Understanding financial basics is not optional for supervisors aspiring to leadership.",
          key_points: [
            "Operating vs. capital budgets: Repairs are OpEx, replacements are CapEx - different approval processes",
            "Variance analysis: Understand why you're over/under budget, explain proactively",
            "Cost-benefit analysis: For major repairs or replacements, compare total cost of ownership",
            "Spare parts inventory: Balance stock cost against downtime cost of not having parts",
            "Labor productivity: Wrench time, overtime rates, contractor vs. in-house economics",
            "Create compelling business cases: Data-driven proposals get approved, opinions don't"
          ]
        },
        {
          title: "Technology Adoption and Digital Transformation",
          content: "Maintenance technology is evolving rapidly: CMMS systems, IoT sensors, predictive analytics, mobile tools, AR/VR training. Leaders must evaluate which technologies provide real value vs. vendor hype. Adoption requires not just budget, but change management - new tools only work if people use them. Start small, prove value, then scale.",
          key_points: [
            "CMMS/EAM systems: The foundation - if you're not using it effectively, fix that first",
            "Condition monitoring: Vibration, temperature, oil analysis - prevents failures proactively",
            "IoT and sensors: Real-time data from equipment, enables predictive maintenance",
            "Mobile CMMS: Technicians access work orders, manuals, history at the equipment",
            "Predictive analytics/AI: Pattern recognition in equipment data, still maturing technology",
            "Evaluate ROI realistically: Pilot before full deployment, measure actual results",
            "Change management: People resistance kills more technology projects than technical issues"
          ]
        },
        {
          title: "Building a Reliability Culture",
          content: "World-class maintenance organizations think 'reliability' not 'repair.' The goal is zero unplanned downtime through proactive strategies: precision maintenance, root cause elimination, design improvements, and operator involvement. This requires cultural change - from heroes who fix emergencies to professionals who prevent them.",
          key_points: [
            "Shift from reactive to proactive: Measure and drive down emergency work percentage",
            "Root cause elimination: Don't just fix failures, prevent recurrence",
            "Precision maintenance: Laser alignment, proper torque, correct lubrication - do it right",
            "Design for reliability: When equipment is replaced, involve maintenance in specification",
            "Operator care: Basic checks (cleaning, lubrication, tightening) are often best done by operators",
            "Celebrate prevention: Heroes should be those who prevent failures, not just fix them",
            "Continuous improvement: Kaizen mindset - always looking for better ways"
          ]
        },
        {
          title: "Leading Change and Driving Transformation",
          content: "Improving maintenance from 'fire-fighting' to 'reliability-centered' requires transformation - and transformation requires leadership. People resist change because it's uncomfortable and uncertain. Leaders must articulate the vision, build coalition, enable action, and sustain momentum. Most change efforts fail due to insufficient leadership, not insufficient strategy.",
          key_points: [
            "Create urgency: Why change now? What's the cost of staying the same?",
            "Build coalition: Find allies in operations, finance, leadership who support the vision",
            "Vision and strategy: Where are we going? How will we get there?",
            "Communicate relentlessly: Over-communication is impossible during change",
            "Enable action: Remove obstacles, provide resources, empower people to act",
            "Generate quick wins: Early success builds momentum and credibility",
            "Don't let up: Institutionalize changes so they stick after initial enthusiasm fades"
          ]
        }
      ],
      scenarios: [{
        title: "The Maintenance Transformation",
        description: "You've been asked to develop a 3-year plan to transform maintenance from reactive to proactive. Where do you start?",
        situation: "New plant manager wants maintenance transformation. Current state: 60% reactive, PM compliance 65%, wrench time 25%, no reliability engineering. Budget is tight. Team is skeptical of 'another initiative.'",
        symptoms: ["High reactive maintenance", "Low PM compliance", "Poor wrench time", "No reliability focus", "Change-fatigued workforce"],
        measurements: { "Reactive %": "60%", "PM Compliance": "65%", "Wrench Time": "25%", "MTBF": "Declining", "Team Morale": "Skeptical" },
        decisionPoints: [
          {
            question: "What should be your first priority in Year 1?",
            options: [
              "Implement new CMMS software",
              "Hire reliability engineers",
              "Fix PM program and establish planning function",
              "Buy vibration analysis equipment"
            ],
            correctAnswer: 2,
            explanation: "Build the foundation first. A working PM program prevents failures; a planning function improves efficiency. Technology and reliability engineering are Year 2-3 additions once basics are solid."
          },
          {
            question: "How do you address team skepticism about 'another initiative'?",
            options: [
              "Mandate participation and discipline non-compliance",
              "Involve the team in planning, show early wins, celebrate progress",
              "Ignore the skepticism - they'll come around",
              "Replace the skeptical team members"
            ],
            correctAnswer: 1,
            explanation: "Involvement creates buy-in. Ask for their input on problems and solutions. Demonstrate early wins - 'we fixed that chronic problem you've complained about.' Celebrate milestones publicly. Skeptics become advocates when they see real improvement."
          }
        ],
        solution: "Year 1: Fixed PM program (95% compliance), added planner role (wrench time to 40%). Year 2: Added condition monitoring, reduced reactive to 35%. Year 3: Full reliability program, reactive at 20%. Team became proud advocates of the transformation.",
        lessonsLearned: [
          "Build foundation before adding complexity",
          "Involve the team - they become advocates, not obstacles",
          "Show early wins to build credibility and momentum",
          "Transformation takes 3-5 years - set realistic expectations",
          "Celebrate progress along the way"
        ]
      }],
      quiz: [
        { question: "How should maintenance be viewed strategically?", options: ["A cost to minimize", "A strategic enabler of business success", "A necessary evil", "An overhead function"], correctAnswer: 1 },
        { question: "What is the typical maintenance budget as percentage of asset replacement value?", options: ["0.5-1%", "2-5%", "10-15%", "20-25%"], correctAnswer: 1 },
        { question: "What kills more technology projects than technical issues?", options: ["Budget cuts", "Vendor failures", "People resistance to change", "Hardware problems"], correctAnswer: 2 },
        { question: "What is the goal of a reliability culture?", options: ["Faster repairs", "Zero unplanned downtime", "Cheaper parts", "Fewer technicians"], correctAnswer: 1 },
        { question: "Why do most organizational change efforts fail?", options: ["Bad strategy", "Insufficient technology", "Insufficient leadership", "Lack of budget"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 50,
    points: 200,
  });

  // Module 13: Advanced Troubleshooting Methodology (Technical)
  const module13 = await storage.createTrainingModule({
    companyId,
    title: "Advanced Troubleshooting Methodology",
    description: "Master systematic troubleshooting: 6-step troubleshooting process, electrical/mechanical diagnosis, intermittent problems, and building diagnostic expertise",
    content: JSON.stringify({
      sections: [
        {
          title: "The 6-Step Troubleshooting Process",
          content: "Expert troubleshooters follow a systematic process that beginners often skip in their rush to 'just fix it.' The 6-step method prevents wasted time chasing symptoms: (1) Identify the problem clearly, (2) Gather information, (3) Analyze possible causes, (4) Develop a plan, (5) Implement the solution, (6) Verify and document. Skipping steps, especially gathering information, leads to parts swapping and extended downtime.",
          key_points: [
            "Step 1 - Identify: What exactly is the problem? What should happen vs. what is happening?",
            "Step 2 - Gather: What changed? When did it start? Error codes? Operator observations?",
            "Step 3 - Analyze: List possible causes. Start with most likely (80/20 rule applies).",
            "Step 4 - Plan: How will you test your hypotheses? What tools/parts needed?",
            "Step 5 - Implement: Execute your plan, test one variable at a time.",
            "Step 6 - Verify: Confirm the fix worked, document for future reference."
          ]
        },
        {
          title: "Information Gathering Techniques",
          content: "The quality of your troubleshooting depends on the quality of information you gather. Talk to operators - they observed the failure. Check alarms and error codes - the equipment is telling you something. Review maintenance history - is this a repeat failure? Look for what changed recently - new parts, process changes, environmental factors. Data beats assumptions every time.",
          key_points: [
            "Operator interview: What were you doing when it failed? Any unusual sounds/smells/vibrations?",
            "Error codes/alarms: Document exact codes, look up meaning in manual",
            "CMMS history: Has this failed before? What was the fix? When was last PM?",
            "Recent changes: New parts installed? Process changes? Product changes?",
            "Environmental factors: Temperature, humidity, dust, contamination",
            "Operating conditions: Was it at normal load? Normal speed? Anything abnormal?",
            "Physical inspection: What do you see? Smell? Hear? Feel? Touch?"
          ]
        },
        {
          title: "Electrical Troubleshooting Fundamentals",
          content: "Electrical problems follow predictable patterns. No power? Work from source to load - breaker, fuse, connections, device. Intermittent? Often loose connections or failing components. Overload trips? Check for mechanical binding or voltage issues. Use your multimeter systematically, measure at each point in the circuit, and compare to expected values.",
          key_points: [
            "No power: Check from source to load - breaker → fuse → contactor → overload → motor",
            "Check voltage at each point: If present upstream, absent downstream, problem is between",
            "Connection issues: Look for darkened/discolored terminals, feel for loose wires",
            "Overloads: Measure motor amps - if > nameplate, find mechanical cause",
            "Voltage imbalance: Measure all three phases, >2% imbalance causes heating",
            "Grounds: Megger test motor and wiring, <1MΩ indicates insulation failure",
            "Control circuit: If contactor won't pull in, trace 120V path from transformer through stops/interlocks"
          ]
        },
        {
          title: "Mechanical Troubleshooting Fundamentals",
          content: "Mechanical failures give warning signs before catastrophic failure. Learn to read these signs: vibration patterns indicate specific problems (imbalance, misalignment, bearing wear), temperature changes indicate friction or load issues, noise changes indicate wear or looseness. Use your senses - experienced technicians develop 'feel' for when something isn't right.",
          key_points: [
            "Vibration: High velocity = imbalance/misalignment. High acceleration = bearing defects.",
            "Temperature: Bearing running hot? Check lubrication, alignment, load conditions.",
            "Noise: Grinding = metal-to-metal contact. Squealing = belt slip. Knocking = looseness.",
            "Visual: Check for leaks, wear patterns, corrosion, loose fasteners, damaged guards",
            "Alignment: Use dial indicators or laser - misalignment is top bearing killer",
            "Lubrication: Right lubricant? Right amount? Right interval? Check condition of grease/oil",
            "Load: Is equipment being operated within design parameters?"
          ]
        },
        {
          title: "Troubleshooting Intermittent Problems",
          content: "Intermittent problems are the most frustrating - working fine when you arrive, failing when you leave. The key is capturing data when the failure occurs. Set up monitoring, review historical trends, look for correlation with operating conditions. Sometimes the only solution is to observe the failure yourself. Patience and systematic data collection win.",
          key_points: [
            "Document exactly when failures occur - time, conditions, what was happening",
            "Look for patterns: Time of day? Temperature? Production type? Operator?",
            "Set up monitoring: Data loggers, cameras, temporary sensors can catch what you can't observe",
            "Don't change multiple things: Swap one component, observe, then swap next if needed",
            "Check connections under load: Wiggle test while equipment is running (if safe)",
            "Thermal cycling: Some failures only occur when equipment is hot/cold",
            "Stay with the problem: Sometimes you need to be there when it fails to catch it"
          ]
        }
      ],
      scenarios: [{
        title: "The Elusive Intermittent Failure",
        description: "A critical packaging line has random stoppages that maintenance can never catch in action. Production is frustrated.",
        situation: "Line 3 randomly stops 2-4 times per shift. By the time maintenance arrives, it's running again. No fault codes stored. Operators say 'it just stops for no reason.' You've replaced the obvious suspects (sensors, motor starters) with no improvement.",
        symptoms: ["Random stoppages 2-4x per shift", "No fault codes stored", "Running fine when maintenance arrives", "Operators can't describe what happens", "Parts-swapping hasn't helped"],
        measurements: { "Stop Duration": "30 sec to 2 min", "Frequency": "2-4x per shift", "Pattern": "Random - no correlation to product or time", "Fault Log": "Empty" },
        decisionPoints: [
          {
            question: "What's the best approach to catch this intermittent problem?",
            options: [
              "Replace more components until it stops",
              "Install data logger and stay with the machine during operation",
              "Tell operations to live with it",
              "Completely rebuild the machine"
            ],
            correctAnswer: 1,
            explanation: "You need data from when the failure actually occurs. Install a data logger to capture electrical signals, vibration, or other parameters continuously. Stay with the machine during operation to observe what happens at the moment of failure."
          },
          {
            question: "The data logger shows voltage sags occurring just before each stop. What's your next step?",
            options: [
              "Replace the power supply immediately",
              "Trace the voltage sag upstream - what else is on this circuit?",
              "Ignore it - small sags are normal",
              "Add a UPS to the whole line"
            ],
            correctAnswer: 1,
            explanation: "Trace the problem to its source. What's causing the voltage sag? Another large load starting on the same circuit? Loose connection somewhere? Find the root cause rather than just protecting against the symptom."
          }
        ],
        solution: "Data logger revealed voltage sags coinciding with a large compressor starting on the same circuit. The compressor's inrush current caused momentary voltage dip that tripped the line's sensitive VFD. Moved compressor to dedicated circuit. Problem eliminated.",
        lessonsLearned: [
          "Intermittent problems require capturing data during the failure",
          "Random-seeming failures often have hidden correlations",
          "Data loggers are invaluable for problems you can't witness directly",
          "Look for changes in the environment, not just the equipment itself",
          "Stay with the machine - sometimes you must be there when it fails"
        ]
      }],
      quiz: [
        { question: "What is the first step in the 6-step troubleshooting process?", options: ["Replace suspected parts", "Gather information", "Clearly identify the problem", "Test the solution"], correctAnswer: 2 },
        { question: "When tracing an electrical no-power problem, you should work from:", options: ["Load to source", "Source to load", "Middle outward", "Random order"], correctAnswer: 1 },
        { question: "High vibration velocity typically indicates:", options: ["Bearing defects", "Imbalance or misalignment", "Electrical problems", "Lubrication issues"], correctAnswer: 1 },
        { question: "What is the key to troubleshooting intermittent problems?", options: ["Replace all components", "Capturing data when failure occurs", "Ignore until it fails permanently", "Ask the vendor"], correctAnswer: 1 },
        { question: "Why is 'gathering information' critical before analyzing?", options: ["It satisfies documentation requirements", "Data beats assumptions in finding root cause", "It delays the repair", "It's not actually important"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  // Module 14: Executive Presence and Influence
  const module14 = await storage.createTrainingModule({
    companyId,
    title: "Executive Presence and Influence",
    description: "Develop commanding presence: gravitas, communication mastery, personal branding, influencing without authority, and presenting to senior leadership",
    content: JSON.stringify({
      sections: [
        {
          title: "Understanding Executive Presence",
          content: "Executive presence is that intangible quality that makes others pay attention when you speak. Research by the Center for Talent Innovation identifies three pillars: Gravitas (how you act), Communication (how you speak), and Appearance (how you look). Of these, gravitas accounts for 67% of executive presence. It's not about being loud or dominating - it's about confidence, decisiveness, and the ability to remain calm under pressure.",
          key_points: [
            "Gravitas (67%): Confidence, decisiveness, integrity, emotional intelligence, reputation",
            "Communication (28%): Speaking skills, commanding a room, reading an audience, assertiveness",
            "Appearance (5%): Professional dress, grooming, physical vitality, poise",
            "Executive presence can be developed - it's a set of learnable behaviors",
            "Authenticity matters: Fake confidence is detected and destroys credibility",
            "Presence is contextual: Boardroom presence differs from shop floor presence"
          ]
        },
        {
          title: "Developing Gravitas",
          content: "Gravitas is the weight people give to your words and presence. It comes from demonstrated competence, consistent behavior, and how you handle high-stakes situations. Leaders with gravitas speak with conviction, make decisions confidently, and remain composed when others panic. They admit what they don't know without losing credibility. Building gravitas requires intentional practice over time.",
          key_points: [
            "Speak with conviction: Eliminate 'I think,' 'maybe,' 'sort of' - be definitive",
            "Make decisions: Indecision destroys gravitas faster than wrong decisions",
            "Stay calm under pressure: Practice deep breathing, pause before responding",
            "Show grace under fire: How you handle crises defines your reputation",
            "Admit mistakes confidently: 'I was wrong' said with conviction builds trust",
            "Be consistently reliable: Your track record is your most powerful asset",
            "Think before you speak: Measured responses carry more weight than rapid reactions"
          ]
        },
        {
          title: "Mastering Communication for Impact",
          content: "Impactful communication is clear, concise, and compelling. Senior leaders are busy - they want the bottom line first, supporting detail if they ask. Structure your communication with the conclusion first, then reasoning. Use stories and examples to make abstract concepts concrete. Vary your vocal tone, pace, and volume for emphasis. Silence is powerful - pause for effect.",
          key_points: [
            "Bottom Line Up Front (BLUF): Lead with the conclusion, support with details",
            "The Rule of Three: Group points in threes - it's memorable and persuasive",
            "Stories over statistics: 'A technician prevented a $500K failure by...' beats abstract numbers",
            "Eliminate filler words: 'Um,' 'uh,' 'like,' 'you know' destroy credibility",
            "Pace and pause: Slow down at key points, pause after important statements",
            "Eye contact: Hold 3-5 seconds per person when presenting to a group",
            "Voice projection: Speak from your diaphragm, not your throat"
          ]
        },
        {
          title: "Influencing Without Authority",
          content: "Most of your influence happens without direct authority. You need operations to give you downtime, finance to approve budgets, and leadership to support initiatives. Influence works through relationship, reciprocity, and reasoning. Build alliances before you need them. Understand what others value and frame your requests in their terms. Give before you ask.",
          key_points: [
            "Build relationships first: Influence flows through trust - invest in relationships early",
            "Understand their priorities: What keeps them up at night? Frame your ask in their terms",
            "Principle of reciprocity: Do favors freely - people naturally want to reciprocate",
            "Find common ground: 'We both want to hit production targets' creates alignment",
            "Use data and logic: Emotional appeals work short-term, logic wins long-term",
            "Create coalitions: Don't fight alone - find allies who share your interests",
            "Make it easy to say yes: Remove obstacles, address concerns proactively"
          ]
        },
        {
          title: "Presenting to Senior Leadership",
          content: "Presenting to executives is different from presenting to peers. They have limited time, high expectations, and will interrupt with questions. Start with the recommendation, not the background. Be prepared for the deep dive but don't deliver it unless asked. Know your numbers cold. If you don't know an answer, say so and commit to following up. End with a clear ask - what do you need from them?",
          key_points: [
            "Start with the recommendation: 'I recommend we invest $200K in reliability improvements'",
            "Prepare for the 2-minute and 20-minute version: You may get either",
            "Know your numbers: 'Approximately' and 'roughly' signal lack of preparation",
            "Anticipate questions: What would a skeptic ask? Prepare those answers",
            "It's okay to say 'I don't know, but I'll find out'",
            "Read the room: If they're disengaged, stop and ask 'What questions do you have?'",
            "End with a clear ask: What decision or action do you need from them?"
          ]
        },
        {
          title: "Building Your Personal Brand",
          content: "Your personal brand is what people say about you when you're not in the room. It's built over years through consistent behavior and deliberately cultivated through visibility and reputation management. What do you want to be known for? Technical excellence? Developing people? Solving impossible problems? Be intentional about the reputation you're building.",
          key_points: [
            "Define your brand: What three things do you want people to associate with you?",
            "Consistency is key: Every interaction either builds or erodes your brand",
            "Seek visibility: Volunteer for cross-functional projects, present at meetings",
            "Deliver results: Nothing builds a brand like a track record of success",
            "Help others: Being known as helpful and generous is a powerful brand",
            "Manage your digital presence: LinkedIn, internal platforms, industry forums",
            "Seek feedback: Ask trusted colleagues how you're perceived"
          ]
        }
      ],
      scenarios: [{
        title: "The Budget Presentation",
        description: "You need to convince the plant manager and CFO to approve a $350K reliability improvement project. Your last two proposals were rejected.",
        situation: "You've developed a compelling reliability improvement plan: new condition monitoring program, vibration analyst position, and equipment upgrades. Cost: $350K. Expected savings: $800K/year in avoided downtime. Your last two proposals were rejected as 'not compelling.'",
        symptoms: ["Previous proposals rejected", "Senior leaders skeptical of maintenance spending", "CFO focused on cost cutting", "Plant manager prioritizes production over reliability"],
        measurements: { "Proposal Cost": "$350,000", "Expected Annual Savings": "$800,000", "Payback Period": "5.3 months", "Current Downtime Cost": "$1.2M/year" },
        decisionPoints: [
          {
            question: "How should you structure your presentation to executives?",
            options: [
              "Start with technical details about vibration analysis",
              "Lead with the business case and ROI, support with technical details if asked",
              "Focus on how hard your team works",
              "Start with why previous proposals were rejected"
            ],
            correctAnswer: 1,
            explanation: "Executives care about business results. Lead with the bottom line: 'I'm proposing a $350K investment that will save $800K annually with a 5.3-month payback.' Technical details only if they ask. This is BLUF - Bottom Line Up Front."
          },
          {
            question: "The CFO asks: 'How do we know those savings are real?' How do you respond?",
            options: [
              "Get defensive - 'Don't you trust me?'",
              "Present historical data, specific equipment failures, and industry benchmarks",
              "Admit you're not sure",
              "Blame operations for causing the downtime"
            ],
            correctAnswer: 1,
            explanation: "Anticipate skepticism with data. Show last year's major failures, their costs, and how this program would have prevented them. Reference industry benchmarks showing typical ROI for reliability programs. Data-driven answers build credibility."
          }
        ],
        solution: "Presented with business case first: '5.3-month payback, $800K annual savings.' Brought specific examples of recent failures this program would have caught. Referenced SMRP benchmarks. Proposal approved. Program delivered $920K savings in Year 1, exceeding projections.",
        lessonsLearned: [
          "Lead with business impact, not technical details",
          "Know your numbers cold - vagueness destroys credibility",
          "Anticipate objections and prepare data-backed responses",
          "Reference industry benchmarks to validate your projections",
          "Previous rejections often reflect presentation style, not content"
        ]
      }],
      quiz: [
        { question: "What is the largest component of executive presence?", options: ["Appearance", "Communication", "Gravitas", "Intelligence"], correctAnswer: 2 },
        { question: "What is BLUF in communication?", options: ["Best Layout Under Format", "Bottom Line Up Front", "Brief List of Useful Facts", "Basic Leadership Utility Function"], correctAnswer: 1 },
        { question: "When presenting to executives, you should start with:", options: ["Detailed background", "Your recommendation", "A joke to break ice", "Your biography"], correctAnswer: 1 },
        { question: "What destroys gravitas fastest?", options: ["Making mistakes", "Indecision and uncertainty", "Asking questions", "Delegating work"], correctAnswer: 1 },
        { question: "How do you influence without authority?", options: ["Through threats", "Through relationships and reciprocity", "Through manipulation", "Through complaints to HR"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 225,
  });

  // Module 15: Coaching and Mentoring Mastery
  const module15 = await storage.createTrainingModule({
    companyId,
    title: "Coaching and Mentoring Mastery",
    description: "Transform your team through coaching: the GROW model, asking powerful questions, giving developmental feedback, mentoring emerging leaders, and creating a coaching culture",
    content: JSON.stringify({
      sections: [
        {
          title: "The Difference Between Managing and Coaching",
          content: "Managing is telling people what to do. Coaching is developing people to figure it out themselves. Managers direct; coaches develop. The most effective leaders do both, knowing when each approach is appropriate. New employees or crisis situations require direction. Developing experienced employees requires coaching. The goal is to work yourself out of a job by developing self-sufficient, capable team members.",
          key_points: [
            "Managing: Provides answers, directs action, focuses on immediate performance",
            "Coaching: Asks questions, develops thinking, focuses on long-term capability",
            "Telling creates dependency; coaching creates independence",
            "Coaching takes more time initially but saves time as people develop",
            "Match approach to situation: Emergency = direct. Development = coach.",
            "Great leaders develop other leaders, not just followers",
            "Your success is ultimately measured by what your team achieves without you"
          ]
        },
        {
          title: "The GROW Coaching Model",
          content: "GROW is the most widely-used coaching framework: Goal, Reality, Options, Will. Start by clarifying what the person wants to achieve (Goal). Explore where they are now (Reality). Generate possible approaches (Options). Commit to specific actions (Will). The coach's role is to ask questions that help the coachee think through each stage, not to provide answers.",
          key_points: [
            "Goal: What do you want to achieve? What does success look like? By when?",
            "Reality: Where are you now? What have you tried? What's working/not working?",
            "Options: What could you do? What else? What would [someone you admire] do?",
            "Will: What will you do? When? What might get in the way? How will you handle it?",
            "Ask open-ended questions: 'What' and 'How' questions invite thinking",
            "Resist the urge to give advice: 'What do YOU think you should do?'",
            "End with commitment: 'What's your next step?' 'When will you do it?'"
          ]
        },
        {
          title: "Asking Powerful Questions",
          content: "The quality of your coaching depends on the quality of your questions. Powerful questions are open-ended, thought-provoking, and create new insight. They start with 'What' or 'How,' not 'Why' (which can feel accusatory). They're short and direct. They invite reflection rather than justification. Master coaches ask questions that the coachee has never considered.",
          key_points: [
            "'What's important about this?' - Uncovers values and motivation",
            "'What else?' - The magic question that always yields more options",
            "'What would you do if you knew you couldn't fail?' - Removes fear barriers",
            "'What's the real challenge here?' - Gets past symptoms to root issues",
            "'How will you know you've succeeded?' - Clarifies success criteria",
            "'What's holding you back?' - Identifies obstacles to address",
            "'What support do you need?' - Opens door for you to help"
          ]
        },
        {
          title: "Giving Developmental Feedback",
          content: "Feedback is the breakfast of champions - but only if delivered effectively. Developmental feedback focuses on growth, not punishment. It's specific, timely, balanced, and forward-looking. The SBI-I model works well: Situation (when/where), Behavior (what you observed), Impact (the effect), and Improvement (what to do differently). Always have feedback conversations privately.",
          key_points: [
            "Timely: Within 24-48 hours of the behavior while context is fresh",
            "Specific: 'Yesterday when you interrupted the operator...' not 'You always...'",
            "Behavioral: What they did, not who they are - actions can change",
            "Impact-focused: Help them understand the effect of their behavior",
            "Forward-looking: 'Next time, try...' rather than dwelling on the past",
            "Balanced: Recognize strengths while addressing development areas",
            "Two-way: Ask for their perspective, listen to understand"
          ]
        },
        {
          title: "Mentoring Emerging Leaders",
          content: "Mentoring is a longer-term developmental relationship focused on career growth and organizational navigation. Unlike coaching specific skills, mentoring addresses bigger questions: career direction, organizational politics, leadership philosophy. Effective mentors share their experience openly, introduce mentees to their network, and provide candid advice. The best mentoring relationships are built on trust and genuine care.",
          key_points: [
            "Share your story: Your failures are as valuable as your successes",
            "Be honest: Mentees need candor, not cheerleading",
            "Open doors: Introduce them to people who can help their career",
            "Challenge them: Push them beyond their comfort zone with stretch assignments",
            "Be available: Regular meetings plus accessibility for critical moments",
            "Let them lead: They set the agenda, you respond to their needs",
            "Know when to step back: The goal is independence, not dependence"
          ]
        },
        {
          title: "Creating a Coaching Culture",
          content: "Individual coaching is powerful; a coaching culture transforms organizations. In a coaching culture, everyone - from supervisors to technicians - uses coaching approaches. Questions replace commands. Development is everyone's responsibility. Mistakes become learning opportunities. This culture shift doesn't happen overnight; it requires consistent modeling by leaders and reinforcement of coaching behaviors.",
          key_points: [
            "Model coaching: If you're not coaching, you're not credible asking others to",
            "Train coaching skills: Not everyone knows how - teach the GROW model",
            "Reward coaching behavior: Recognize leaders who develop their people",
            "Make time for development: If calendars are full of firefighting, coaching won't happen",
            "Celebrate growth: Publicize when someone develops into a new role",
            "Accept slower decisions: Coaching takes longer than telling, but builds capability",
            "Patience: Culture change takes 2-3 years of consistent effort"
          ]
        }
      ],
      scenarios: [{
        title: "The Stuck Technician",
        description: "A capable technician has plateaued and seems resistant to learning new skills. How do you coach them to grow?",
        situation: "Alex is a solid technician with 12 years experience. Good at what he knows, but won't learn PLC programming or vibration analysis. Says 'That's not my job.' Team needs him to grow as technology changes. He's been passed over for promotion twice.",
        symptoms: ["Refuses to learn new technologies", "Defensive when development discussed", "Passed over for promotion twice", "Says 'That's not my job'", "Good at current skills, stagnating"],
        measurements: { "Years Experience": "12", "Promotions Applied": "2", "New Skills Learned (3 years)": "0", "Performance Reviews": "Meets expectations" },
        decisionPoints: [
          {
            question: "How should you approach the initial coaching conversation?",
            options: [
              "Tell him he needs to learn new skills or find another job",
              "Use GROW model - understand his goals and what's holding him back",
              "Send him to PLC training without discussing it",
              "Accept that some people can't change"
            ],
            correctAnswer: 1,
            explanation: "Start with Goal: What does Alex want for his career? He may have barriers (fear of failure, prior bad training experience, belief it's too late to learn) that only emerge through questioning. Understanding his perspective is essential before prescribing solutions."
          },
          {
            question: "Alex reveals he struggled with a computer class 10 years ago and felt humiliated. How do you proceed?",
            options: [
              "Dismiss his concern - 'That was 10 years ago'",
              "Acknowledge the barrier and explore how to make learning feel safe",
              "Excuse him from learning technical skills",
              "Assign him to classroom training immediately"
            ],
            correctAnswer: 1,
            explanation: "Acknowledge the real barrier. Then explore options together: 'What would make learning feel safer?' Maybe hands-on mentoring instead of classroom. Maybe starting with basic tutorials. Maybe practicing off-hours with no audience. He needs to own the solution."
          }
        ],
        solution: "Paired Alex with a patient mentor for one-on-one PLC basics. No classroom pressure. Small wins built confidence. Within 6 months, Alex was troubleshooting PLCs independently. Promoted to Senior Technician a year later. He now mentors others who are hesitant.",
        lessonsLearned: [
          "Resistance often masks fear - dig deeper to understand",
          "Past experiences shape current attitudes toward learning",
          "The GROW model helps uncover barriers and solutions",
          "Create psychologically safe learning environments",
          "Small wins build confidence for bigger challenges"
        ]
      }],
      quiz: [
        { question: "What is the main difference between managing and coaching?", options: ["Pay level", "Telling vs. developing thinking", "Office location", "Years of experience"], correctAnswer: 1 },
        { question: "What does GROW stand for in the coaching model?", options: ["Great Results Over Work", "Goal, Reality, Options, Will", "Generate, Review, Organize, Win", "Guide, Reflect, Observe, Write"], correctAnswer: 1 },
        { question: "What is 'the magic question' in coaching?", options: ["Why did you do that?", "What else?", "Who told you to?", "When will you finish?"], correctAnswer: 1 },
        { question: "What does the 'I' in SBI-I feedback model stand for?", options: ["Intention", "Improvement", "Impact", "Information"], correctAnswer: 1 },
        { question: "How long does culture change typically take?", options: ["1 month", "6 months", "2-3 years", "It happens instantly"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 60,
    points: 225,
  });

  // Module 16: Conflict Resolution and Negotiation
  const module16 = await storage.createTrainingModule({
    companyId,
    title: "Conflict Resolution and Negotiation",
    description: "Master workplace conflict: understanding conflict styles, de-escalation techniques, principled negotiation, mediating between team members, and turning conflict into collaboration",
    content: JSON.stringify({
      sections: [
        {
          title: "Understanding Conflict in the Workplace",
          content: "Conflict is inevitable when people work together - different priorities, personalities, and perspectives create friction. But conflict isn't inherently bad; managed well, it surfaces important issues and leads to better solutions. Managed poorly, it destroys relationships, teams, and productivity. Your job as a leader is not to eliminate conflict but to channel it constructively.",
          key_points: [
            "Task conflict (what/how to do things) is healthy when respectful",
            "Relationship conflict (personal friction) is destructive and must be addressed",
            "Unaddressed conflict doesn't disappear - it festers and grows",
            "High-performing teams have MORE task conflict, not less - they debate ideas vigorously",
            "Psychological safety allows conflict to be productive, not personal",
            "Your response to conflict sets the tone for your entire team",
            "Early intervention prevents small disagreements from becoming big feuds"
          ]
        },
        {
          title: "The Five Conflict Styles",
          content: "People approach conflict differently based on how much they value their own goals versus the relationship. The Thomas-Kilmann model identifies five styles: Competing (win-lose), Accommodating (lose-win), Avoiding (lose-lose), Compromising (half-win), and Collaborating (win-win). No style is always right; effective leaders adapt their approach to the situation. However, Collaborating should be the default for important issues.",
          key_points: [
            "Competing: High assertiveness, low cooperation. Use when quick decisive action needed or safety.",
            "Accommodating: Low assertiveness, high cooperation. Use when issue matters more to others.",
            "Avoiding: Low assertiveness, low cooperation. Use for trivial issues or to cool down.",
            "Compromising: Medium assertiveness, medium cooperation. Use when time is short and half a loaf is acceptable.",
            "Collaborating: High assertiveness, high cooperation. Use for important issues where relationship matters.",
            "Know your default style - it's probably overused",
            "Ask: 'How important is the issue?' and 'How important is the relationship?' to choose style"
          ]
        },
        {
          title: "De-escalation Techniques",
          content: "When emotions run high, rational problem-solving shuts down. Before you can resolve the conflict, you must de-escalate the emotional temperature. Stay calm yourself - your composure is contagious. Listen actively to show you understand. Acknowledge feelings without necessarily agreeing with positions. Create physical space if needed. The goal is to get everyone back to a place where productive conversation is possible.",
          key_points: [
            "Stay calm: Your anxiety will escalate theirs - breathe, lower your voice, slow down",
            "Listen first: People need to feel heard before they can hear you",
            "Acknowledge emotions: 'I can see you're frustrated' validates without agreeing",
            "Use 'I' statements: 'I'm concerned about...' not 'You always...'",
            "Find something to agree with: 'You're right that we need to address this'",
            "Take a break if needed: 'Let's pause and resume in 30 minutes'",
            "Move to private space: Public conflict escalates due to audience"
          ]
        },
        {
          title: "Principled Negotiation",
          content: "Principled negotiation, from the Harvard Negotiation Project, focuses on interests rather than positions. Positions are what people say they want; interests are why they want it. Operations says 'No shutdown this week' (position) because they need to meet shipping targets (interest). When you understand interests, creative solutions emerge that satisfy everyone's underlying needs.",
          key_points: [
            "Separate people from problem: Attack the issue, not the person",
            "Focus on interests, not positions: Ask 'Why?' and 'Why not?'",
            "Generate options: Brainstorm solutions before evaluating them",
            "Use objective criteria: Industry standards, precedent, expert opinion",
            "BATNA: Know your Best Alternative To Negotiated Agreement - your walk-away point",
            "Expand the pie: Look for trades that give each side what they value most",
            "Build the relationship for future negotiations: Today's adversary is tomorrow's partner"
          ]
        },
        {
          title: "Mediating Conflicts Between Team Members",
          content: "When two team members are in conflict, you may need to mediate. Meet with each separately first to understand perspectives and de-escalate. Then bring them together with clear ground rules: no interrupting, focus on future not past, attack problems not people. Your role is facilitator, not judge. Guide them to find their own solution - imposed solutions rarely stick.",
          key_points: [
            "Meet separately first: Understand each perspective without the other present",
            "Don't take sides: Remain visibly neutral even if you have an opinion",
            "Set ground rules: One person speaks at a time, no personal attacks, focus on solutions",
            "Have each describe the issue from their view: 'Tell me what's happening from your perspective'",
            "Identify common ground: 'You both want the line running smoothly'",
            "Generate solutions together: 'What could you each do differently?'",
            "Get commitment: 'What are you each agreeing to do?' Document it."
          ]
        },
        {
          title: "Turning Conflict into Collaboration",
          content: "The highest form of conflict resolution transforms adversaries into collaborators. This happens when both parties realize they share a common goal and need each other to achieve it. 'We're both trying to keep the plant running safely and efficiently.' Frame conflicts as shared problems to solve together, not battles to win. When people feel they're on the same team, collaboration becomes natural.",
          key_points: [
            "Find the shared goal: 'We both want...' creates common ground",
            "Reframe from positions to interests: Positions divide, interests can align",
            "Ask for their ideas: 'What would you suggest?' builds buy-in",
            "Acknowledge their constraints: 'I understand you're under pressure to...'",
            "Show how you can help: 'If we do it this way, it helps you because...'",
            "Celebrate joint wins: 'We figured this out together' reinforces collaboration",
            "Build relationship for next time: Every resolved conflict strengthens the partnership"
          ]
        }
      ],
      scenarios: [{
        title: "The Maintenance-Operations Feud",
        description: "A long-running conflict between maintenance and operations is hurting plant performance. You need to break the cycle.",
        situation: "Maintenance blames operations: 'They run equipment into the ground and don't give us downtime.' Operations blames maintenance: 'They take forever to fix things and their PMs cause more problems than they solve.' Plant manager tells you to 'fix this relationship.'",
        symptoms: ["Mutual blame between departments", "Poor communication", "Refused downtime requests", "Delayed repair responses", "Declining equipment reliability"],
        measurements: { "Downtime Requests Approved": "30%", "Avg Repair Response": "2.5 hours", "MTBF Trend": "Declining 15%/year", "Interdepartmental Satisfaction": "2/10" },
        decisionPoints: [
          {
            question: "What's your first step to address this conflict?",
            options: [
              "Tell both sides to just get along",
              "Meet separately with both groups to understand their perspectives and interests",
              "Escalate to plant manager for intervention",
              "Document all the problems operations causes"
            ],
            correctAnswer: 1,
            explanation: "Meet with each side separately first. Understand their frustrations, constraints, and underlying interests. You'll likely find both have valid points. This also shows respect for their perspectives before bringing them together."
          },
          {
            question: "Both sides have valid concerns. How do you bring them together?",
            options: [
              "Pick the side you agree with more",
              "Frame a joint meeting around shared goals with clear ground rules",
              "Send an email summarizing both perspectives",
              "Let them work it out themselves"
            ],
            correctAnswer: 1,
            explanation: "Bring them together with a shared goal: 'We all want reliable equipment and efficient production.' Set ground rules: no blame, focus on future solutions. Facilitate the conversation - help them see each other's constraints and find collaborative solutions."
          }
        ],
        solution: "Joint meeting revealed shared frustration with unreliable equipment. Created weekly operations-maintenance coordination meeting. Established 48-hour notice for routine PMs (operations could plan around them). Created emergency vs. planned work categories with agreed response times. Relationship improved dramatically within 3 months.",
        lessonsLearned: [
          "Departmental conflicts often have valid concerns on both sides",
          "Meet separately first to understand perspectives",
          "Frame joint discussions around shared goals",
          "Create structured communication channels to prevent future conflicts",
          "Quick wins build trust for larger collaboration"
        ]
      }],
      quiz: [
        { question: "What type of conflict is healthy when managed well?", options: ["Personal conflict", "Task conflict", "All conflict is bad", "Relationship conflict"], correctAnswer: 1 },
        { question: "Which conflict style should be the default for important issues?", options: ["Competing", "Avoiding", "Compromising", "Collaborating"], correctAnswer: 3 },
        { question: "What should you do FIRST when emotions are running high?", options: ["Solve the problem immediately", "De-escalate the emotional temperature", "Assign blame", "Escalate to HR"], correctAnswer: 1 },
        { question: "In principled negotiation, you should focus on:", options: ["Positions", "Personalities", "Interests", "Past grievances"], correctAnswer: 2 },
        { question: "When mediating between team members, your role is:", options: ["Judge who is right", "Neutral facilitator", "Advocate for one side", "Ignore and hope it resolves"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  // Module 17: Leading Through Crisis
  const module17 = await storage.createTrainingModule({
    companyId,
    title: "Leading Through Crisis",
    description: "Excel when stakes are highest: crisis leadership principles, decision-making under pressure, communicating during emergencies, supporting your team through stress, and post-crisis recovery",
    content: JSON.stringify({
      sections: [
        {
          title: "The Nature of Crisis Leadership",
          content: "Crisis reveals character. When everything is going well, anyone can look like a good leader. Crisis strips away pretense and shows who you really are. The leaders people remember are those who stepped up when it mattered most - who stayed calm when others panicked, made tough calls when information was incomplete, and put their team's welfare first. Every crisis is also an opportunity to build lasting credibility.",
          key_points: [
            "Crises are inevitable: The question is not if but when - prepare mentally now",
            "Character matters: Your values and integrity are tested under pressure",
            "Presence is essential: Show up, be visible, be available during crisis",
            "Calm is contagious: Your composure (or panic) spreads through your team",
            "Speed matters: Perfect information never comes - decide and act",
            "Take care of people: Equipment can be replaced, people cannot",
            "Every crisis is a crucible: How you perform defines your leadership reputation"
          ]
        },
        {
          title: "Decision-Making Under Pressure",
          content: "Crisis decisions are hard because time is short, stakes are high, and information is incomplete. Waiting for perfect information means waiting too long. Use the 70% rule: When you have 70% of the information you'd like, decide and act. A good decision now beats a perfect decision later. Make the best decision you can with available information, then adjust as you learn more.",
          key_points: [
            "The 70% rule: Act when you have 70% of desired information - waiting is its own risk",
            "Prioritize: Life safety first, then equipment, then production",
            "Simplify choices: In crisis, binary options (do this OR that) are easier than complex choices",
            "Announce decisions clearly: 'Here's what we're going to do...' eliminates confusion",
            "Delegate execution: Make the decision, but you don't have to execute everything yourself",
            "Prepare to adjust: First decision rarely survives contact with reality - adapt quickly",
            "Document later: Focus on action now, paperwork after the crisis"
          ]
        },
        {
          title: "Crisis Communication",
          content: "In crisis, communication is as important as action. People need to know what's happening, what they should do, and that leadership is in control. Communicate early, even if you don't have all answers - silence creates vacuum that rumor fills. Be honest about what you know and don't know. Update regularly even if nothing has changed - the update itself is reassuring.",
          key_points: [
            "Communicate early: First message sets the tone - don't wait for perfect information",
            "Be honest: 'I don't know yet' is better than speculation or false reassurance",
            "Simple and direct: Crisis is not the time for nuance - clear instructions only",
            "Repeat key messages: Under stress, people don't hear well - say it multiple times",
            "Use multiple channels: Not everyone checks email - verbal, text, PA, whatever works",
            "Update regularly: Even 'no change' updates show you're in control",
            "Control the narrative: If you don't communicate, rumors will"
          ]
        },
        {
          title: "Supporting Your Team Through Crisis",
          content: "Your team watches you during crisis. They're looking for signals: Is this as bad as it seems? Does our leader know what to do? Are we going to be okay? Beyond making good decisions, you must attend to your team's emotional and physical welfare. Acknowledge the difficulty, show confidence in their abilities, and watch for signs of stress overload.",
          key_points: [
            "Acknowledge reality: 'This is a difficult situation' validates what everyone feels",
            "Express confidence: 'I know this team can handle this' - they need to hear it",
            "Give clear direction: People feel better when they have a job to do",
            "Watch for stress signs: Confusion, short tempers, silence - these signal overload",
            "Rotate people: Fresh eyes and rested bodies make better decisions",
            "Meet basic needs: Ensure water, food, breaks - people forget self-care in crisis",
            "Say thank you: Genuine appreciation during stress strengthens bonds"
          ]
        },
        {
          title: "Post-Crisis Recovery and Learning",
          content: "Crisis doesn't end when the immediate emergency passes. There's cleanup, investigation, return to normal operations, and learning. Resist the urge to immediately move on - the learning is most valuable while memories are fresh. Conduct a proper debrief: What happened? What worked? What didn't? How do we prevent recurrence? Also attend to your team's emotional recovery - crisis leaves marks.",
          key_points: [
            "Stabilize first: Ensure immediate situation is truly resolved before debriefing",
            "Debrief promptly: Within days, while memories are fresh and before rationalization",
            "Blame-free analysis: Focus on system failures, not individual fault",
            "Document thoroughly: Future you (and others) will benefit from good records",
            "Implement improvements: Lessons learned are worthless without action",
            "Recognize contributions: Celebrate those who stepped up during crisis",
            "Check on people: Some struggle after crisis ends - look for signs, offer support"
          ]
        },
        {
          title: "Building Crisis Resilience",
          content: "The best crisis leaders are those who prepare before crisis hits. Build relationships now that you'll need in emergencies. Train your team on emergency procedures. Conduct drills and tabletop exercises. Have backup plans for critical scenarios. Create clear escalation paths. The time to figure out your crisis response is not during the crisis.",
          key_points: [
            "Build relationships now: You need goodwill during crisis - invest in relationships early",
            "Train and drill: Emergency procedures must be practiced, not just written",
            "Tabletop exercises: Walk through scenarios without actual emergency",
            "Pre-position resources: Know where critical spares are, have emergency contacts ready",
            "Clear escalation paths: Who gets called when? At what thresholds?",
            "Develop your people: Others should be able to lead when you're unavailable",
            "Personal resilience: Your own health and stamina enable you to lead through crisis"
          ]
        }
      ],
      scenarios: [{
        title: "The Ammonia Leak",
        description: "A major ammonia leak in the refrigeration area has triggered evacuation. You're the senior maintenance leader on site.",
        situation: "3:15 AM. Security calls: 'Ammonia alarm in refrigeration. Strong smell. Two operators evacuated, one feeling dizzy.' You're 10 minutes away. Night shift has 3 technicians with limited ammonia experience. Fire department en route. Plant manager asking for updates.",
        symptoms: ["Ammonia alarm activated", "Strong ammonia smell in area", "Two operators evacuated", "One person showing symptoms", "Night shift with limited experience"],
        measurements: { "Time": "3:15 AM", "Your ETA": "10 minutes", "Affected Operator": "Dizzy, eyes burning", "Fire Dept ETA": "8 minutes", "Wind Direction": "Toward parking lot" },
        decisionPoints: [
          {
            question: "What's your immediate priority while driving to the site?",
            options: [
              "Try to diagnose the leak source over the phone",
              "Ensure affected person getting first aid and area evacuated, coordinate with fire dept",
              "Start making a repair plan",
              "Document everything for the incident report"
            ],
            correctAnswer: 1,
            explanation: "Life safety first. Ensure the affected operator is getting medical attention (fresh air, eyewash if available, EMS if needed). Confirm evacuation is complete. Coordinate with fire department who will be on scene first. Equipment repair comes later."
          },
          {
            question: "Fire department arrives and contains the area. They ask if you want to isolate the ammonia system. What's your response?",
            options: [
              "Tell them to wait until you arrive to assess",
              "Authorize immediate isolation - safety over production",
              "Ask them to just ventilate the area",
              "Tell them you're not sure what to do"
            ],
            correctAnswer: 1,
            explanation: "Authorize isolation. Stopping the ammonia flow prevents the situation from getting worse. Yes, this means production stops, but safety trumps everything. You can restart production after the source is fixed. Decisiveness in crisis builds confidence."
          }
        ],
        solution: "Affected operator treated on scene, recovered fully. Fire department isolated system. Leak traced to failed shaft seal on compressor. Seal replaced next day. After-action review identified need for ammonia emergency response training for all shifts. Implemented quarterly drills.",
        lessonsLearned: [
          "Life safety is always the first priority - equipment can wait",
          "Decisive action in crisis is better than perfect action too late",
          "Coordinate with emergency responders - they're trained for this",
          "After-action reviews identify gaps for future prevention",
          "Regular drills prepare teams for real emergencies"
        ]
      }],
      quiz: [
        { question: "When should you make decisions in a crisis?", options: ["When you have 100% information", "When you have about 70% of needed information", "After consulting everyone", "Never - wait for instructions"], correctAnswer: 1 },
        { question: "What should you prioritize first in a crisis?", options: ["Production output", "Equipment protection", "Life safety", "Documentation"], correctAnswer: 2 },
        { question: "During crisis, how often should you communicate?", options: ["Only when you have news", "Regularly, even if nothing has changed", "At the end when it's resolved", "Never - focus on action"], correctAnswer: 1 },
        { question: "What reveals true leadership character?", options: ["Annual reviews", "Normal operations", "Crisis situations", "Educational credentials"], correctAnswer: 2 },
        { question: "When should you debrief after a crisis?", options: ["Immediately during the crisis", "Within days while memories fresh", "During next annual review", "Never - move on"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 225,
  });

  // Module 18: Building a Learning Organization
  const module18 = await storage.createTrainingModule({
    companyId,
    title: "Building a Learning Organization",
    description: "Create continuous improvement culture: the learning organization model, knowledge management, learning from failures, building psychological safety, and institutionalizing learning",
    content: JSON.stringify({
      sections: [
        {
          title: "What is a Learning Organization?",
          content: "A learning organization is one that continuously transforms itself by facilitating the learning of all its members. It adapts faster than competitors because learning is built into how it operates. This isn't about training programs - it's about a culture where learning happens continuously through work. Problems become opportunities. Failures become lessons. Knowledge flows freely. Every day, the organization gets a little better.",
          key_points: [
            "Continuous learning: Not events but a way of operating",
            "Collective intelligence: The organization knows more than any individual",
            "Adaptation speed: Learning organizations outcompete by adapting faster",
            "Knowledge sharing: Best practices spread rapidly across the organization",
            "Experimentation encouraged: Try, fail fast, learn, try again",
            "Systems thinking: See patterns and interconnections, not just events",
            "It's cultural: Can't be mandated, must be cultivated"
          ]
        },
        {
          title: "The Five Disciplines of Learning Organizations",
          content: "Peter Senge's 'The Fifth Discipline' identifies five practices: Personal Mastery (individual growth), Mental Models (challenging assumptions), Shared Vision (collective direction), Team Learning (group intelligence), and Systems Thinking (seeing the whole). Together, these create an organization capable of continuous learning and adaptation. Systems thinking - seeing interconnections - is the 'fifth discipline' that integrates the others.",
          key_points: [
            "Personal Mastery: Individuals committed to their own lifelong learning",
            "Mental Models: Surfacing and questioning assumptions that limit thinking",
            "Shared Vision: Collective picture of the future that inspires commitment",
            "Team Learning: Groups that think and learn together, not just individually",
            "Systems Thinking: Seeing patterns, interrelationships, and wholes rather than parts",
            "These disciplines reinforce each other: Strong in one amplifies the others",
            "Start where you can: Perfect implementation isn't required to begin"
          ]
        },
        {
          title: "Learning from Failures",
          content: "Failures are the richest source of learning - but only if the organization treats them that way. Blame cultures hide failures; learning cultures analyze them. Create psychological safety where people report problems without fear. Investigate system causes, not just human error. Share learnings widely so others don't repeat mistakes. Celebrate learning from failures as much as successes.",
          key_points: [
            "Psychological safety: People must feel safe reporting problems",
            "Blame-free analysis: 'What caused this?' not 'Who caused this?'",
            "5 Whys technique: Dig past symptoms to root causes",
            "System focus: Most 'human error' has system causes that made error likely",
            "Share widely: One failure should educate the whole organization",
            "Track and trend: Are the same types of failures recurring?",
            "Celebrate learning: 'Failure of the month' awards (seriously!) build culture"
          ]
        },
        {
          title: "Knowledge Management",
          content: "Organizations lose knowledge constantly - through turnover, retirement, forgetting. Effective knowledge management captures, organizes, and shares critical knowledge so it's available when needed. This includes documented procedures, but also tacit knowledge - the 'tricks of the trade' that experienced technicians know. Make knowledge sharing part of the job, not extra work.",
          key_points: [
            "Document critical knowledge: Standard procedures, troubleshooting guides, lessons learned",
            "Capture tacit knowledge: Record experienced technicians' tips and insights",
            "Make knowledge accessible: Easy-to-find database, mobile access, visual formats",
            "Keep it current: Outdated knowledge is worse than no knowledge",
            "Incentivize sharing: Recognize people who contribute knowledge",
            "Build communities: Groups around technical specialties share organically",
            "Use knowledge in workflows: Embed in work orders, PM checklists, decision tools"
          ]
        },
        {
          title: "Creating Psychological Safety",
          content: "Psychological safety is the belief that you won't be punished for speaking up with ideas, questions, concerns, or mistakes. Without it, people hide problems, avoid risks, and learning stops. Leaders create psychological safety by how they respond to bad news, questions, and mistakes. React with curiosity instead of blame, and safety grows. React with punishment, and silence follows.",
          key_points: [
            "Leaders set the tone: Your reaction to bad news determines if you'll hear it",
            "Welcome questions: 'Good question' encourages more questions",
            "Admit your mistakes: If you can be wrong, others feel safe being wrong too",
            "Thank messengers: 'I appreciate you telling me' rewards openness",
            "Be curious, not judgmental: 'Help me understand what happened' not 'What were you thinking?'",
            "Avoid blame in public: Private correction, public support",
            "Consistency matters: One punishing response undoes months of safety building"
          ]
        },
        {
          title: "Institutionalizing Learning",
          content: "For learning to persist, it must be embedded in organizational systems - not dependent on individual champions. Build learning into processes: After-action reviews after every project, knowledge requirements in job descriptions, learning metrics on scorecards. When learning is 'how we do things here,' it survives leadership changes and competing priorities.",
          key_points: [
            "Build into processes: After-action reviews, pre-project learning reviews",
            "Measure learning: Track knowledge contributions, learning events, improvement ideas",
            "Include in job expectations: Learning and knowledge sharing in job descriptions",
            "Leadership reinforcement: Senior leaders ask 'What did we learn?'",
            "Time allocation: Protected time for learning, not squeezed out by operations",
            "Recognition systems: Rewards for learning, teaching, improving",
            "Succession planning: Knowledge transfer as explicit part of transitions"
          ]
        }
      ],
      scenarios: [{
        title: "The Retiring Expert",
        description: "Your most experienced technician is retiring in 6 months. He knows things about your equipment that aren't written down anywhere.",
        situation: "Bob has 35 years with the company. He knows every quirk of the original equipment, wiring changes made in the 90s, and 'tricks' that make things work. He's tried to share knowledge but younger techs are 'too busy.' In 6 months, that knowledge walks out the door forever.",
        symptoms: ["35 years of undocumented tribal knowledge", "Younger techs too busy to learn", "No formal knowledge capture process", "6 months until retirement", "Critical equipment expertise at risk"],
        measurements: { "Years of Experience": "35", "Documented Procedures": "40%", "Time Until Retirement": "6 months", "Knowledge Transfer Sessions": "Ad hoc, informal" },
        decisionPoints: [
          {
            question: "What's the most effective approach to capture Bob's knowledge?",
            options: [
              "Ask Bob to write everything down before he leaves",
              "Pair Bob with key technicians on real work, record his explanations, create structured sessions",
              "Accept that some knowledge will be lost",
              "Hire a replacement and have Bob train them"
            ],
            correctAnswer: 1,
            explanation: "Knowledge transfer happens best through doing, not writing. Pair Bob with technicians on actual jobs. Record his troubleshooting, explanations, and 'tricks.' Supplement with structured sessions on critical topics. Writing alone misses the tacit knowledge that's most valuable."
          },
          {
            question: "Younger techs say they're too busy to shadow Bob. How do you address this?",
            options: [
              "Accept their excuse - production comes first",
              "Make knowledge transfer a formal priority with protected time",
              "Wait for a slow period that may never come",
              "Let Bob retire without capturing his knowledge"
            ],
            correctAnswer: 1,
            explanation: "Knowledge transfer must be a formal priority, not extra work squeezed in. Reduce other assignments for key technicians. Schedule dedicated transfer sessions. Make it clear this is job-critical. The short-term productivity hit is worth the long-term knowledge preservation."
          }
        ],
        solution: "Created formal knowledge transfer program: weekly shadowing sessions, video recordings of Bob troubleshooting critical equipment, structured interviews on key topics. Two technicians became 'knowledge heirs' for different equipment areas. Bob's knowledge documented in accessible format for future reference.",
        lessonsLearned: [
          "Start knowledge transfer early - 6 months is barely enough",
          "Learning happens best through doing together, not writing alone",
          "Make knowledge transfer a formal priority with protected time",
          "Record explanations - video captures what text cannot",
          "Assign 'knowledge heirs' for critical expertise areas"
        ]
      }],
      quiz: [
        { question: "What is the 'fifth discipline' in Senge's learning organization model?", options: ["Personal Mastery", "Shared Vision", "Systems Thinking", "Team Learning"], correctAnswer: 2 },
        { question: "What type of culture hides failures?", options: ["Learning culture", "Blame culture", "Safety culture", "Performance culture"], correctAnswer: 1 },
        { question: "What is psychological safety?", options: ["OSHA compliance", "Belief you won't be punished for speaking up", "Physical security measures", "Insurance coverage"], correctAnswer: 1 },
        { question: "How should leaders respond to bad news?", options: ["With punishment to prevent recurrence", "With curiosity to understand what happened", "By ignoring it", "By blaming the messenger"], correctAnswer: 1 },
        { question: "For learning to persist, it must be:", options: ["Dependent on one champion", "Embedded in organizational systems", "Optional for employees", "Limited to training events"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 60,
    points: 225,
  });

  // Module 19: Hydraulic Systems Maintenance
  const module19 = await storage.createTrainingModule({
    companyId,
    title: "Hydraulic Systems Maintenance & Troubleshooting",
    description: "Master hydraulic power: fluid dynamics, component identification, contamination control, pressure testing, and systematic troubleshooting of hydraulic circuits",
    content: JSON.stringify({
      sections: [
        {
          title: "Hydraulic System Fundamentals",
          content: "Hydraulic systems use pressurized fluid to transmit power. They're found everywhere in industrial settings: presses, lifts, conveyors, injection molding machines, and mobile equipment. The key principle: pressure applied anywhere in a confined fluid is transmitted equally throughout. This allows small pumps to generate enormous forces. Understanding this principle is essential for effective troubleshooting.",
          key_points: [
            "Pascal's Law: Pressure applied to confined fluid transmits equally in all directions",
            "Force = Pressure x Area: A 3000 PSI system with 10 sq in cylinder = 30,000 lbs force",
            "Key components: Reservoir, pump, relief valve, directional valves, cylinders/motors, filters",
            "Fluid types: Petroleum-based most common, synthetic for high-temp/fire-resistant applications",
            "Operating pressure ranges: Low (<1000 PSI), Medium (1000-3000 PSI), High (>3000 PSI)",
            "System efficiency: Typically 75-85% - losses occur as heat in fluid"
          ]
        },
        {
          title: "Hydraulic Component Identification",
          content: "Effective troubleshooting requires knowing what each component does and how it fails. Pumps create flow (not pressure - pressure comes from resistance to flow). Relief valves protect the system from over-pressure. Directional valves route fluid to actuators. Cylinders and motors convert fluid power to mechanical motion. Filters remove contamination. Each component has characteristic failure modes.",
          key_points: [
            "Pumps: Gear, vane, or piston type. Create flow. Fail from contamination, cavitation, wear.",
            "Relief valves: Limit maximum pressure. Fail stuck open (no pressure) or stuck closed (overpressure danger).",
            "Directional valves: Route fluid. Solenoid or pilot operated. Fail from contamination, worn seals, solenoid failure.",
            "Cylinders: Convert fluid to linear motion. Fail from seal wear (internal/external leakage), rod damage.",
            "Motors: Convert fluid to rotary motion. Similar to pumps in reverse. Fail from wear, contamination.",
            "Filters: Remove contamination. Must be changed regularly - check differential pressure indicators.",
            "Accumulators: Store energy, dampen pulsations. Pre-charge pressure critical - check with nitrogen."
          ]
        },
        {
          title: "Contamination Control - The #1 Priority",
          content: "Contamination causes 70-80% of hydraulic system failures. Particles as small as 5 microns (invisible to the naked eye) damage precision components. Sources: Built-in (manufacturing debris), ingressed (from outside), and generated (wear particles). Contamination control is proactive maintenance - filters, breathers, clean oil handling, and regular fluid analysis are your defenses.",
          key_points: [
            "70-80% of hydraulic failures are contamination-related",
            "Target cleanliness: ISO 16/14/11 for most industrial systems (consult OEM specs)",
            "Filter changes: Don't wait for bypass - change at 75% of rated pressure differential",
            "Breathers: Use desiccant breathers to prevent moisture ingression",
            "New oil is not clean oil: Filter new oil before adding to system",
            "Oil analysis: Sample regularly - particle count, water content, viscosity, acid number",
            "Clean work practices: Cap all open ports, clean around connections before disconnecting"
          ]
        },
        {
          title: "Hydraulic Troubleshooting Methodology",
          content: "Systematic troubleshooting prevents random parts swapping. Start with the symptom: No motion? Slow motion? Erratic motion? Hot oil? Noisy pump? Each symptom points to specific subsystems. Use pressure gauges strategically to isolate problems. Most hydraulic problems are: no flow (pump/valve), low pressure (relief/leak), or restricted flow (filter/valve).",
          key_points: [
            "No motion: Check pump running, relief valve setting, directional valve shifting, cylinder seals",
            "Slow motion: Low flow - worn pump, partially blocked filter, internal leakage, undersized lines",
            "Erratic motion: Air in system, failing pump, sticking valve, load variation",
            "Hot oil: Operating above 140°F indicates inefficiency - relief valve dumping, internal leakage, undersized reservoir",
            "Noisy pump: Cavitation (starved inlet), aeration (air in oil), worn components",
            "Use gauges: Install pressure gauges at pump outlet, before/after valves, at actuators",
            "Check the simple stuff first: Oil level, filter condition, electrical to solenoids"
          ]
        },
        {
          title: "Safety in Hydraulic Work",
          content: "Hydraulic systems store enormous energy and operate at pressures that can cause serious injury or death. A pinhole leak at 2000 PSI can inject oil through skin (injection injury - medical emergency). Never use your hand to check for leaks. Never work on pressurized systems. Always relieve pressure, lock out energy, and verify zero energy before maintenance.",
          key_points: [
            "Injection injuries: High-pressure fluid can penetrate skin - requires immediate surgery, often amputation",
            "Never check for leaks with hands: Use cardboard or paper to detect leaks",
            "Stored energy: Accumulators hold pressure even when pump is off - must be bled down",
            "Lock out ALL energy: Electrical, hydraulic pressure, gravity loads (block cylinders)",
            "Relieve pressure before disconnecting: Crack fittings slowly to verify no pressure",
            "Hot oil burns: Fluid can be 150°F+ - wear gloves, let system cool",
            "Eye protection: Always - hydraulic fluid spray can cause serious eye injury"
          ]
        }
      ],
      scenarios: [{
        title: "Hydraulic Press Emergency",
        description: "The stamping press hydraulic system has failed during production. You're called to troubleshoot.",
        situation: "300-ton hydraulic press won't build pressure. Ram moves slowly down but won't develop clamping force. Oil temperature is 165°F (normally 130°F). Production is stopped.",
        symptoms: ["Ram moves but no force", "Oil temperature elevated", "Pump running but sounds different", "Relief valve venting continuously"],
        measurements: { "System Pressure": "800 PSI (should be 2500)", "Oil Temp": "165°F", "Oil Level": "Low - 2\" below sight glass", "Filter Indicator": "Red - bypass" },
        decisionPoints: [
          {
            question: "What's the most likely root cause based on these symptoms?",
            options: [
              "Failed hydraulic pump",
              "Stuck-open relief valve",
              "Internal cylinder seal bypass",
              "Plugged filter causing cavitation"
            ],
            correctAnswer: 1,
            explanation: "Relief valve venting continuously + low pressure = relief valve stuck open or set too low. This also explains the heat (energy dumping to tank) and noise change."
          },
          {
            question: "The relief valve tests good. What do you check next?",
            options: [
              "Replace the pump immediately",
              "Check for internal leakage at cylinder",
              "Add more oil and restart",
              "Increase relief valve setting"
            ],
            correctAnswer: 1,
            explanation: "With relief valve OK, internal cylinder bypass is next suspect. Worn seals let oil pass around piston, preventing pressure buildup. Heat comes from fluid shearing across worn seals."
          }
        ],
        solution: "Cylinder rod seals were worn, causing internal bypass. Hot oil further degraded seals. Replaced cylinder seals and filtered/cooled oil before restart.",
        lessonsLearned: [
          "High oil temperature often indicates internal leakage somewhere",
          "Low oil level can indicate a leak or consumption problem",
          "Filter bypass means contaminated oil is reaching components",
          "Check the simple things (relief valve setting) before major repairs"
        ]
      }],
      quiz: [
        { question: "What percentage of hydraulic failures are caused by contamination?", options: ["20-30%", "40-50%", "70-80%", "95%"], correctAnswer: 2 },
        { question: "What does a hydraulic pump create?", options: ["Pressure", "Flow", "Force", "Heat"], correctAnswer: 1 },
        { question: "What is an injection injury?", options: ["A vaccination", "High-pressure fluid penetrating skin", "An electrical shock", "A chemical burn"], correctAnswer: 1 },
        { question: "What causes a noisy hydraulic pump?", options: ["Too much oil", "Cavitation or aeration", "Cold weather", "High pressure"], correctAnswer: 1 },
        { question: "Why is new hydraulic oil not considered clean?", options: ["It's too thin", "It contains manufacturing contamination", "It's the wrong color", "It hasn't been heated"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  // Module 20: Pneumatic Systems Fundamentals
  const module20 = await storage.createTrainingModule({
    companyId,
    title: "Pneumatic Systems Fundamentals",
    description: "Understand compressed air systems: air preparation, valve operation, cylinder sizing, leak detection, and energy-efficient pneumatic maintenance",
    content: JSON.stringify({
      sections: [
        {
          title: "Pneumatic System Basics",
          content: "Pneumatic systems use compressed air to transmit power. They're simpler and safer than hydraulics but less powerful. Common applications include actuating valves, clamping fixtures, operating tools, and material handling. Air is compressible (unlike hydraulic fluid), which makes pneumatics inherently cushioned but less precise. Clean, dry, lubricated air is essential for reliability.",
          key_points: [
            "Working pressure: Typically 80-120 PSI for industrial systems",
            "Air is compressible: Provides natural cushioning but less precise positioning",
            "Advantages: Clean, safe, simple, fast cycling, no fire hazard",
            "Disadvantages: Lower force than hydraulics, noisy, expensive to compress air",
            "FRL unit: Filter-Regulator-Lubricator - conditions air before use",
            "Air quality: Water and oil contamination cause valve and cylinder failures"
          ]
        },
        {
          title: "Air Preparation - The FRL Unit",
          content: "The Filter-Regulator-Lubricator (FRL) unit is the heart of air preparation. The filter removes water and particles (compressed air contains significant moisture). The regulator reduces and stabilizes pressure. The lubricator adds oil mist for components that need lubrication (though many modern components are 'lube-free'). Proper FRL maintenance prevents most pneumatic problems.",
          key_points: [
            "Filter: Removes water and particles. Drain bowl regularly - auto-drains are best.",
            "Element rating: 40 micron for general, 5 micron for instrumentation",
            "Regulator: Reduces plant air (100+ PSI) to working pressure (usually 80 PSI)",
            "Set pressure: Only as high as needed - lower pressure = less air consumption",
            "Lubricator: Adds oil mist to air stream. Not needed for 'lube-free' components.",
            "Oil type: Use only approved pneumatic oil - wrong oil damages seals",
            "Mounting: FRL should be close to point of use, at proper height for visibility"
          ]
        },
        {
          title: "Pneumatic Valves and Actuators",
          content: "Directional control valves route air to cylinders and motors. They're described by positions/ways: a 5/2 valve has 5 ports and 2 positions. Valves are actuated by solenoids, pilots, or manual operators. Cylinders convert air pressure to linear motion - available in single-acting (spring return) and double-acting (air-powered both directions) configurations.",
          key_points: [
            "Valve nomenclature: Positions/Ways - 3/2 = 3 ports, 2 positions; 5/2 = 5 ports, 2 positions",
            "Actuation: Solenoid (electrical), pilot (air pressure), manual (lever/button)",
            "Single-acting cylinder: Air extends, spring returns. Simpler, but limited force return.",
            "Double-acting cylinder: Air both extends and retracts. More control, higher force.",
            "Cylinder sizing: Force = Pressure x Piston Area (account for rod area on retract)",
            "Cushions: Built-in deceleration for high-speed applications - adjustable",
            "Flow controls: Meter-in or meter-out to control cylinder speed"
          ]
        },
        {
          title: "Leak Detection and Energy Efficiency",
          content: "Compressed air is expensive - typically $0.25-0.30 per 1000 cubic feet. Leaks waste 20-30% of compressed air in typical plants. A single 1/8\" leak at 100 PSI wastes over $1,000/year. Leak detection and repair is one of the highest-ROI maintenance activities. Use ultrasonic leak detectors during off-hours when background noise is low.",
          key_points: [
            "Leak cost: 20-30% of compressed air is typically wasted through leaks",
            "1/8\" leak at 100 PSI: Wastes ~25 CFM, costs $1,200+ per year",
            "Detection methods: Ultrasonic detector (best), soapy water (connections), listen during quiet times",
            "Common leak points: Fittings, quick-connects, worn cylinder seals, old hoses",
            "Repair priority: Fix largest leaks first for biggest impact",
            "Pressure reduction: Every 2 PSI reduction saves ~1% in energy costs",
            "Leak audit: Conduct quarterly, tag and track repairs"
          ]
        },
        {
          title: "Pneumatic Troubleshooting",
          content: "Pneumatic troubleshooting is often simpler than hydraulic because you can see and feel air flow. No motion? Check air supply, valve actuation, cylinder condition. Slow motion? Check flow controls, supply pressure, restrictions. Erratic motion? Check for water in air, sticky valves, worn seals. Listen for exhaust - it tells you what the system is doing.",
          key_points: [
            "No motion: Air supply on? Valve shifting? Check solenoid power. Block valve ports to test.",
            "Slow motion: Flow controls too restrictive? Low supply pressure? Restricted filter?",
            "Erratic motion: Water in air (freeze in cold), contaminated valve, worn cylinder seals",
            "Listen to exhaust: No exhaust = no valve shift. Constant exhaust = bypass/leak.",
            "Feel the lines: No air flow indicates valve or supply problem",
            "Cylinder won't hold position: Internal seal leakage - rebuild or replace",
            "Valve won't shift: Check electrical (solenoid), pilot pressure, mechanical binding"
          ]
        }
      ],
      scenarios: [{
        title: "Packaging Line Cylinder Failure",
        description: "The carton sealing station has stopped working during peak production. You're called to troubleshoot.",
        situation: "Pneumatic cylinder that seals carton flaps won't extend. Other stations on the same air line are working. Operator reports it was 'sluggish' earlier today before it stopped completely.",
        symptoms: ["Cylinder won't extend", "Faint hissing sound near cylinder", "Other stations working fine", "Was slow before failing"],
        measurements: { "Line Pressure": "95 PSI (normal)", "Pressure at FRL": "90 PSI", "Solenoid Voltage": "24V present", "Cylinder Temp": "Ambient" },
        decisionPoints: [
          {
            question: "Based on the symptoms, where should you focus your investigation?",
            options: [
              "Main compressor - must be failing",
              "The solenoid valve - no output",
              "The cylinder itself - seal failure",
              "The PLC - logic problem"
            ],
            correctAnswer: 2,
            explanation: "Sluggish before stopping + hissing near cylinder = worn seals allowing bypass. Other stations working rules out air supply. Solenoid has voltage so it's shifting. Cylinder is prime suspect."
          },
          {
            question: "You confirm the cylinder rod seals are worn. What else should you check?",
            options: [
              "Nothing - just replace the cylinder",
              "Check FRL for water and contamination",
              "Replace all cylinders on the line",
              "Increase system pressure"
            ],
            correctAnswer: 1,
            explanation: "Premature seal wear often indicates contamination or lack of lubrication. Check the FRL - water in the air or lack of lubrication may have caused the seal failure. Fix root cause to prevent recurrence."
          }
        ],
        solution: "Cylinder seals worn from water contamination. FRL filter bowl was full of water - auto-drain had failed. Replaced cylinder, fixed auto-drain, and drained water from all FRLs.",
        lessonsLearned: [
          "Sluggish operation is an early warning - investigate before complete failure",
          "Always look for root cause of component failure",
          "FRL maintenance (especially water drainage) prevents many pneumatic failures",
          "Hissing sounds indicate air leaks - locate and repair"
        ]
      }],
      quiz: [
        { question: "What does FRL stand for?", options: ["Flow Rate Limiter", "Filter-Regulator-Lubricator", "Force Reduction Lever", "Fluid Return Line"], correctAnswer: 1 },
        { question: "What percentage of compressed air is typically wasted through leaks?", options: ["5-10%", "10-15%", "20-30%", "50-60%"], correctAnswer: 2 },
        { question: "What is the typical working pressure for industrial pneumatic systems?", options: ["20-40 PSI", "80-120 PSI", "500-1000 PSI", "2000-3000 PSI"], correctAnswer: 1 },
        { question: "What is the best method for detecting pneumatic leaks?", options: ["Visual inspection", "Ultrasonic detector", "Temperature measurement", "Pressure testing"], correctAnswer: 1 },
        { question: "What causes erratic pneumatic cylinder motion?", options: ["Too much lubrication", "Water in air or worn seals", "New filters", "High pressure"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 50,
    points: 175,
  });

  // Module 21: PLC and Industrial Automation Basics
  const module21 = await storage.createTrainingModule({
    companyId,
    title: "PLC and Industrial Automation Basics",
    description: "Understand programmable logic controllers: ladder logic fundamentals, I/O troubleshooting, common fault codes, and safe PLC maintenance practices",
    content: JSON.stringify({
      sections: [
        {
          title: "Introduction to PLCs",
          content: "Programmable Logic Controllers (PLCs) are industrial computers that control manufacturing processes. They replaced hard-wired relay logic with flexible, programmable control. PLCs read inputs (sensors, switches), execute logic (the program), and control outputs (motors, valves, lights). Understanding PLCs is essential for modern maintenance technicians - nearly every automated system uses them.",
          key_points: [
            "PLC = Industrial computer designed for harsh environments",
            "Replaced relay logic: Easier to modify, troubleshoot, and document",
            "Scan cycle: Read inputs → Execute program → Update outputs → Repeat (typically 10-50ms)",
            "Major brands: Allen-Bradley (Rockwell), Siemens, Mitsubishi, Omron, GE",
            "Components: CPU, power supply, I/O modules, communication modules",
            "Programming: Done via laptop with manufacturer's software (Studio 5000, TIA Portal, etc.)",
            "Programs are stored in CPU memory - battery backup preserves when power off"
          ]
        },
        {
          title: "Understanding Ladder Logic",
          content: "Ladder logic is the most common PLC programming language - it looks like electrical relay diagrams turned on their side. Power flows from left to right. Contacts (inputs) are conditions that must be true for power to flow. Coils (outputs) are energized when power reaches them. Understanding ladder logic allows you to trace through programs to troubleshoot problems.",
          key_points: [
            "Read left to right: Contacts (conditions) → Coil (action)",
            "Normally Open (NO) contact: True when input is ON - passes power when activated",
            "Normally Closed (NC) contact: True when input is OFF - passes power when not activated",
            "Coil: Energizes when power reaches it - turns on output",
            "Series contacts = AND logic: Both must be true",
            "Parallel contacts = OR logic: Either can be true",
            "Latch/Unlatch: Set and reset instructions that hold state until changed"
          ]
        },
        {
          title: "I/O Troubleshooting",
          content: "Most PLC problems are I/O related - sensors fail, wiring breaks, outputs burn out. The PLC itself rarely fails. Troubleshooting starts with the I/O status lights on the modules. Inputs show what the PLC sees; outputs show what it's commanding. Compare physical reality (is the sensor actually triggered?) with PLC status (does the input show ON?).",
          key_points: [
            "Input module LEDs: Show what PLC sees - if LED off but sensor triggered, check wiring/sensor",
            "Output module LEDs: Show what PLC commands - if LED on but device off, check output/wiring/device",
            "Force function: Temporarily override I/O for testing (use with extreme caution!)",
            "Common input failures: Sensor failure, broken wire, loose terminal, wrong sensor type",
            "Common output failures: Blown fuse, relay contact wear, triac/transistor burnout",
            "Wiring check: Use multimeter to verify voltage at terminals matches expected",
            "Addressing: Verify you're looking at the right I/O point in the program"
          ]
        },
        {
          title: "Common PLC Faults and Recovery",
          content: "PLCs have built-in diagnostics that report faults through error codes and indicator lights. Common faults include I/O faults (module or device problems), program faults (logic errors), communication faults (network issues), and major faults (CPU problems). Most faults can be cleared once the underlying problem is fixed - but never clear a fault without understanding why it occurred.",
          key_points: [
            "I/O fault: Usually a module or device problem - check wiring, fuses, device operation",
            "Communication fault: Network cable, switch, or remote device offline",
            "Battery low: Replace backup battery before power loss or lose program",
            "Major fault: Serious CPU error - may require program download or hardware replacement",
            "Fault code lookup: Check manufacturer documentation for specific codes",
            "Fault history: Most PLCs log faults with timestamps - review for patterns",
            "Never ignore faults: They indicate real problems - investigate root cause"
          ]
        },
        {
          title: "Safe PLC Maintenance Practices",
          content: "PLCs control equipment that can injure or kill. Making changes to a PLC program or forcing I/O while equipment is running is dangerous. Always follow lockout/tagout procedures. Understand what the program does before making changes. Test changes in a safe condition before enabling full operation. Never make 'temporary' fixes to PLC programs - they become permanent.",
          key_points: [
            "LOTO: Always lock out when working on controlled equipment - even for 'minor' changes",
            "Understand before changing: Know what the logic does and what equipment it controls",
            "Force caution: Forcing outputs can cause unexpected equipment motion - deaths have occurred",
            "Test safely: Put equipment in safe mode, test changes, verify correct operation",
            "Document changes: Update program comments, version, and change log",
            "Backup before changes: Save a copy of the working program before any modification",
            "No 'temporary' fixes: Every change should be production-ready and documented"
          ]
        }
      ],
      scenarios: [{
        title: "Automated Assembly Line Fault",
        description: "The robotic assembly cell has faulted and won't restart. You're the on-call technician.",
        situation: "PLC shows a major fault. HMI displays 'Cell Fault - Check Safety'. Robot is in safe position. Operators report they were running normally when it suddenly stopped.",
        symptoms: ["Major fault on PLC", "Safety fault indicated", "All e-stops appear reset", "Light curtain shows clear"],
        measurements: { "PLC Status": "Major Fault - I/O", "Input I:1/5": "OFF (Safety OK signal)", "E-Stop Status": "All reset", "24V Supply": "24.1V" },
        decisionPoints: [
          {
            question: "The safety input (I:1/5) is OFF but all e-stops look reset. What's your next step?",
            options: [
              "Force the input ON to bypass",
              "Replace the I/O module",
              "Trace the safety circuit from the input back to devices",
              "Reset the PLC and try again"
            ],
            correctAnswer: 2,
            explanation: "Never force safety inputs - that's how people get killed. The input is OFF because something in the safety circuit is open. Trace it back from the PLC terminal to find what's open."
          },
          {
            question: "You find a loose wire at terminal 7 of the safety relay. What caused this and how do you prevent recurrence?",
            options: [
              "Just tighten it and move on",
              "Replace the entire safety relay",
              "Check all terminals in the panel, re-torque to spec, add to PM",
              "The wire was too small - replace with larger wire"
            ],
            correctAnswer: 2,
            explanation: "Loose connections often indicate installation issue or thermal cycling. Check all terminals, torque to spec, and add terminal checks to the PM schedule to prevent recurrence."
          }
        ],
        solution: "Loose wire on safety relay terminal caused intermittent open in safety circuit. Re-terminated connection, checked all panel terminals, added terminal torque check to quarterly PM.",
        lessonsLearned: [
          "Never force or bypass safety circuits - trace the problem",
          "Loose connections are common PLC fault causes",
          "Check for vibration or thermal cycling as root cause of loose terminals",
          "Add terminal checks to preventive maintenance schedule"
        ]
      }],
      quiz: [
        { question: "What does a PLC scan cycle consist of?", options: ["Read outputs, execute, update inputs", "Read inputs, execute program, update outputs", "Download program, run, upload results", "Power on, run diagnostics, shut down"], correctAnswer: 1 },
        { question: "In ladder logic, series contacts represent what logic?", options: ["OR logic", "NOT logic", "AND logic", "XOR logic"], correctAnswer: 2 },
        { question: "If an input LED is off but the sensor is triggered, what should you check?", options: ["The PLC program", "The wiring and sensor", "The output module", "The power supply"], correctAnswer: 1 },
        { question: "What should you always do before making PLC program changes?", options: ["Delete the old program", "Ignore the existing logic", "Backup the working program", "Force all outputs on"], correctAnswer: 2 },
        { question: "Why is forcing outputs dangerous?", options: ["It uses too much power", "It can cause unexpected equipment motion", "It damages the PLC", "It's too complicated"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 60,
    points: 225,
  });

  // Module 22: Pump Maintenance and Troubleshooting
  const module22 = await storage.createTrainingModule({
    companyId,
    title: "Pump Maintenance and Troubleshooting",
    description: "Master centrifugal and positive displacement pumps: operating principles, alignment procedures, seal maintenance, cavitation prevention, and systematic troubleshooting",
    content: JSON.stringify({
      sections: [
        {
          title: "Pump Types and Operating Principles",
          content: "Pumps move fluids by converting mechanical energy into hydraulic energy. The two main categories are centrifugal (dynamic) and positive displacement. Centrifugal pumps use impeller rotation to create flow - they're simple, efficient, and handle large volumes. Positive displacement pumps trap and push fixed volumes - they're better for high pressure, viscous fluids, and precise metering.",
          key_points: [
            "Centrifugal pumps: Impeller creates velocity, volute converts to pressure. Variable flow vs. pressure.",
            "Positive displacement: Gear, lobe, vane, piston, diaphragm types. Fixed volume per revolution.",
            "Centrifugal characteristics: Cannot run dry, need priming, flow varies with pressure",
            "PD characteristics: Can run dry briefly, self-priming, constant flow regardless of pressure",
            "Pump curves: Show relationship between flow, head (pressure), efficiency, and power",
            "Best Efficiency Point (BEP): Operate near BEP for longest pump life and lowest energy use",
            "Application matching: Wrong pump type for application causes premature failure"
          ]
        },
        {
          title: "Pump Installation and Alignment",
          content: "Proper installation prevents 40% of pump failures. Foundation must be rigid and level. Piping must not stress the pump - never pull piping into alignment. Shaft alignment is critical - misalignment causes bearing and seal failure. Use laser alignment for precision. Check alignment both cold and at operating temperature (thermal growth).",
          key_points: [
            "Foundation: Concrete must be cured, grouted, and level - no soft foot allowed",
            "Piping: Support independently, use expansion joints, avoid sharp elbows at suction",
            "Suction piping: Straight run of 10 pipe diameters before pump, eccentric reducer flat-on-top",
            "Alignment tolerance: 0.002-0.005\" TIR for most applications - use laser alignment",
            "Soft foot: All feet must contact baseplate evenly - shim as needed",
            "Thermal growth: Check hot alignment - pumps grow when heated",
            "Document: Record alignment readings for future reference"
          ]
        },
        {
          title: "Mechanical Seal Maintenance",
          content: "Mechanical seals are precision components that prevent leakage where the shaft exits the pump. They fail from: dry running, contamination, misalignment, wrong seal for application, or improper installation. A small weeping is normal - visible streaming is not. Proper seal flush plans maintain seal face lubrication and cooling.",
          key_points: [
            "Seal faces: Rotating and stationary faces separated by thin fluid film - fractions of a micron",
            "Failure modes: Dry running #1 cause, then contamination, heat damage, misalignment",
            "Flush plans: API plans specify how to cool and lubricate seal faces (Plan 11, 21, 32, etc.)",
            "Seal installation: Cleanliness critical, check seal face for damage, set proper compression",
            "Don't run dry: Even brief dry running destroys seals - ensure pump is primed before start",
            "Double seals: For hazardous fluids - barrier fluid between two seals",
            "Seal life expectancy: 2-5 years typical - premature failure indicates system problem"
          ]
        },
        {
          title: "Cavitation - The Pump Killer",
          content: "Cavitation occurs when liquid pressure drops below vapor pressure, forming bubbles that implode on the impeller. It sounds like gravel in the pump and causes rapid impeller erosion. Causes include: low suction pressure (NPSH), high fluid temperature, restricted suction, or running too far from BEP. Prevention is key - cavitation damage cannot be repaired, only replaced.",
          key_points: [
            "NPSH: Net Positive Suction Head - must exceed NPSH required (NPSHr) by margin",
            "Causes: Suction lift too high, suction line restriction, high fluid temperature, low tank level",
            "Symptoms: Gravel-like noise, reduced flow, pressure fluctuation, vibration, impeller erosion",
            "Detection: Sound changes, reduced performance, high vibration at pump",
            "Prevention: Ensure adequate NPSH margin (typically 2-3 ft minimum)",
            "Fixes: Lower pump position, larger suction line, reduce fluid temperature, raise tank level",
            "Damage: Pitting and erosion of impeller - metal removed by imploding bubbles"
          ]
        },
        {
          title: "Pump Troubleshooting Guide",
          content: "Systematic troubleshooting saves time and parts. No flow? Check if pump is primed, suction valve open, impeller not clogged, rotation correct. Low flow? Check suction restrictions, air leaks, worn impeller, plugged strainer. High vibration? Check alignment, cavitation, bearing condition, balance. Overheating? Check lubrication, alignment, running too far from BEP.",
          key_points: [
            "No flow: Prime pump, check suction/discharge valves, verify rotation direction, check impeller",
            "Low flow: Clean strainer, check for suction air leak, inspect wear rings, verify no recirculation",
            "High amperage: Check for blockage, misalignment, binding, low voltage, wrong impeller size",
            "High vibration: Alignment, cavitation, bearing wear, unbalanced impeller, loose foundation",
            "Overheating: Bearing lubrication, alignment, running too far from BEP, blocked cooling",
            "Short seal life: Alignment, vibration, dry running, contamination, wrong seal type",
            "Premature bearing failure: Alignment, lubrication, contamination, overloading"
          ]
        }
      ],
      scenarios: [{
        title: "Cooling Tower Pump Emergency",
        description: "The main cooling tower pump has started making unusual noises and flow has dropped. You need to diagnose and fix before the process overheats.",
        situation: "100 HP cooling water pump making loud gravel-like noise. Flow has dropped from 800 GPM to 600 GPM. Discharge pressure fluctuating. Process temp rising - you have 30 minutes before shutdown required.",
        symptoms: ["Gravel-like noise from pump", "Flow reduced 25%", "Discharge pressure fluctuating wildly", "Suction gauge reading lower than normal"],
        measurements: { "Flow": "600 GPM (normal 800)", "Discharge Pressure": "45-55 PSI fluctuating", "Suction Pressure": "-3 PSI (normally +2)", "Motor Amps": "85A (normal 92A)" },
        decisionPoints: [
          {
            question: "What is the most likely cause of these symptoms?",
            options: [
              "Worn impeller",
              "Cavitation",
              "Bad mechanical seal",
              "Motor bearing failure"
            ],
            correctAnswer: 1,
            explanation: "Gravel noise + negative suction pressure + fluctuating discharge = classic cavitation. The pump is vapor-locking because suction pressure is too low. Causes: plugged strainer, closed valve, low tank level, or air leak."
          },
          {
            question: "You find the suction strainer is 80% blocked with debris. After cleaning, what else must you do?",
            options: [
              "Nothing - just restart",
              "Check for cavitation damage to the impeller",
              "Replace the pump immediately",
              "Reduce motor speed"
            ],
            correctAnswer: 1,
            explanation: "Cavitation causes impeller erosion. Even brief cavitation can pit the impeller. Inspect for damage now, and schedule replacement if erosion is significant. Also, add strainer cleaning to PM."
          }
        ],
        solution: "Strainer blocked with algae and debris. Cleaned strainer, inspected impeller (minor pitting), added bi-weekly strainer inspection to PM schedule. Investigated why algae growth increased - cooling tower treatment had been neglected.",
        lessonsLearned: [
          "Gravel noise = cavitation until proven otherwise",
          "Negative suction pressure indicates blockage or air leak on suction side",
          "Strainer condition is critical - include in regular PM rounds",
          "Look upstream for root cause - why was strainer blocked?"
        ]
      }],
      quiz: [
        { question: "What causes 40% of pump failures?", options: ["Wrong pump type", "Improper installation", "Electrical problems", "Operator error"], correctAnswer: 1 },
        { question: "What does cavitation sound like?", options: ["Smooth hum", "Gravel in the pump", "Silence", "High-pitched whistle"], correctAnswer: 1 },
        { question: "What is the #1 cause of mechanical seal failure?", options: ["Contamination", "Dry running", "Misalignment", "Wrong seal type"], correctAnswer: 1 },
        { question: "What is NPSH?", options: ["National Pump Safety Handbook", "Net Positive Suction Head", "Nominal Pressure Standard Height", "Non-Pressure Sealing Hardware"], correctAnswer: 1 },
        { question: "Where should a centrifugal pump operate for best life and efficiency?", options: ["At maximum flow", "At minimum flow", "Near Best Efficiency Point (BEP)", "At zero flow"], correctAnswer: 2 }
      ]
    }),
    durationMinutes: 60,
    points: 200,
  });

  // Module 23: Conveyor Systems and Material Handling
  const module23 = await storage.createTrainingModule({
    companyId,
    title: "Conveyor Systems and Material Handling",
    description: "Master conveyor maintenance: belt tracking, chain drive systems, roller conveyors, accumulation systems, and predictive maintenance techniques for material handling",
    content: JSON.stringify({
      sections: [
        {
          title: "Conveyor Types and Applications",
          content: "Conveyors are the arteries of manufacturing - they move materials between processes. Types include belt conveyors (bulk materials, packages), chain conveyors (heavy loads, ovens), roller conveyors (packages, pallets), and screw conveyors (bulk solids). Each type has specific maintenance requirements and failure modes. Understanding the basics of each type enables effective troubleshooting.",
          key_points: [
            "Belt conveyors: Continuous belt over pulleys. Best for: bulk materials, inclines, long distances.",
            "Chain conveyors: Chains carry attachments or products. Best for: high temps, heavy loads, accumulation.",
            "Roller conveyors: Gravity or powered rollers. Best for: packages, pallets, accumulation zones.",
            "Screw conveyors: Rotating helical screw in trough. Best for: bulk solids, metering, mixing.",
            "Overhead conveyors: Trolleys on track. Best for: painting, coating, cross-traffic areas.",
            "Key components: Drive unit, take-up, belt/chain, bearings, guides, controls",
            "Selection factors: Material type, weight, speed, environment, accumulation needs"
          ]
        },
        {
          title: "Belt Conveyor Tracking and Tensioning",
          content: "Belt mistracking is the most common belt conveyor problem. Belts track toward the side they're tensioned on first. Tracking adjustments should start at the head pulley and work back. Proper tension is critical - too loose causes slip, too tight causes bearing and belt wear. Tension only enough to prevent slip (typically 1-2% belt stretch).",
          key_points: [
            "Tracking rule: Belt moves toward the end of the roller it contacts first",
            "Adjust from head back: Set head pulley square, then adjust snub and tail",
            "Training idlers: Self-aligning idlers help, but fix root cause don't rely on trainers",
            "Crooked splices: Cause chronic mistracking - must be straight and square",
            "Tension: Only enough to prevent slip - over-tensioning destroys bearings and belt",
            "Take-up adjustment: Gravity take-up auto-adjusts; screw take-up needs manual adjustment",
            "Belt condition: Check for edge wear, cupping, splice condition, damage"
          ]
        },
        {
          title: "Chain Drive Maintenance",
          content: "Chain drives are common on heavy-duty conveyors and throughout manufacturing. Chain elongation (stretch) is actually wear at the pins and bushings. Replace chains before they stretch 3% (precision drives) to 5% (general drives). Always replace sprockets with chains - worn sprockets destroy new chains. Proper lubrication dramatically extends chain life.",
          key_points: [
            "Chain 'stretch': Actually wear at pins and bushings, not physical stretching of metal",
            "Measurement: Measure over 10-12 pitches, compare to new chain length",
            "Replace at: 3% for precision, 5% for general drives - before catastrophic failure",
            "Sprocket rule: Always replace sprockets with chains - worn sprockets ruin new chains",
            "Lubrication: Right lube, right amount, right frequency. Penetrating oil at pin joints.",
            "Tension: Chain should have slight sag (2-4% of span) - too tight accelerates wear",
            "Alignment: Sprockets must be aligned - check with straightedge across sprocket faces"
          ]
        },
        {
          title: "Powered Roller and Accumulation Conveyors",
          content: "Powered roller conveyors use motors to drive rollers that move products. Accumulation conveyors allow products to accumulate without pressure (zero-pressure accumulation). Common problems: roller slip, photo-eye misalignment, zone control issues, and motor overload. Proper spacing and zone configuration prevents product damage and jams.",
          key_points: [
            "Roller drive: Belt-driven, line-shaft, or motor-driven. Each has different maintenance needs.",
            "O-ring drive: Replace o-rings when cracked, stretched, or slip occurs",
            "Photo-eyes: Keep clean, aligned, and properly positioned for zone control",
            "Zero-pressure accumulation: Zones release individually to prevent product pressure",
            "Motor overloads: Often caused by product jams, failed bearings, or overloading",
            "Zone configuration: Properly sized for product weight and accumulation requirements",
            "Roller bearings: Listen for noise, check for heat, replace before seizure"
          ]
        },
        {
          title: "Predictive Maintenance for Conveyors",
          content: "Conveyors are ideal candidates for predictive maintenance. Vibration analysis detects bearing and drive problems weeks before failure. Thermal imaging finds hot motors, bearings, and electrical connections. Belt and chain inspections should be scheduled and documented. Trend data predicts when components need replacement, enabling planned downtime instead of breakdown.",
          key_points: [
            "Vibration: Baseline readings on all drive motors and critical bearings",
            "Infrared: Monthly scans of motors, bearings, electrical, and idler rollers",
            "Visual inspection: Belt condition, chain wear, alignment, lubrication, guards",
            "Lubrication: Documented schedule for all bearings, chains, and gearboxes",
            "Electrical: Check contactors, overloads, cables, photo-eyes, proximity sensors",
            "Trend tracking: Graph measurements over time to predict failure dates",
            "Spare parts: Stock critical items (motors, gearboxes, belts, chains, bearings)"
          ]
        }
      ],
      scenarios: [{
        title: "Distribution Center Belt Conveyor Crisis",
        description: "Main sortation conveyor has stopped during peak shipping hours. 500 packages per hour are backing up. Fix it fast!",
        situation: "200-foot main belt conveyor stopped. Motor running but belt not moving. Burning smell reported earlier. Drive pulley appears to be slipping on belt.",
        symptoms: ["Motor running, belt not moving", "Burning smell earlier", "Belt surface looks shiny/glazed", "Tension appears low"],
        measurements: { "Motor Amps": "45A (normal 38A)", "Belt Tension": "Low - 3\" sag (should be 1\")", "Pulley Condition": "Lagging worn smooth", "Belt Surface": "Glazed on bottom" },
        decisionPoints: [
          {
            question: "What is the root cause of this conveyor failure?",
            options: [
              "Motor failure",
              "Belt too long - needs splicing",
              "Insufficient belt tension causing slip",
              "Wrong belt type"
            ],
            correctAnswer: 2,
            explanation: "Low tension + high motor amps + slip + glazing = belt slipping on drive pulley. The slip causes glazing (friction polish) which makes it worse. The burning smell was rubber degrading from friction heat."
          },
          {
            question: "You tighten the take-up to restore tension. What else needs to be addressed?",
            options: [
              "Nothing - tension was the only problem",
              "Replace the glazed pulley lagging and rough up belt surface",
              "Replace the entire belt immediately",
              "Speed up the conveyor to catch up"
            ],
            correctAnswer: 1,
            explanation: "Glazed lagging has lost its grip coefficient. The belt surface is also polished. Replace the pulley lagging, and either rough up the belt with a wire brush or plan for belt replacement. Also investigate why tension was lost."
          }
        ],
        solution: "Belt tension had been neglected for months. Tightened screw take-up, scheduled lagging replacement for weekend shutdown. Added weekly belt tension check to PM routes. Reviewed why tension wasn't being checked.",
        lessonsLearned: [
          "Belt slip causes glazing which makes slip worse - vicious cycle",
          "Burning rubber smell is an emergency - stop and investigate",
          "Belt tension requires regular monitoring - add to PM rounds",
          "High motor amps with no motion = slip or mechanical jam"
        ]
      }],
      quiz: [
        { question: "What is the most common belt conveyor problem?", options: ["Motor failure", "Belt mistracking", "Control system errors", "Overloading"], correctAnswer: 1 },
        { question: "At what percentage of stretch should general-purpose chains be replaced?", options: ["1%", "3%", "5%", "10%"], correctAnswer: 2 },
        { question: "What should you always replace along with chains?", options: ["Motors", "Sprockets", "Bearings", "Controllers"], correctAnswer: 1 },
        { question: "Which is NOT a predictive maintenance technique for conveyors?", options: ["Vibration analysis", "Thermal imaging", "Run to failure", "Visual inspection"], correctAnswer: 2 },
        { question: "What does 'zero-pressure accumulation' mean?", options: ["No air pressure required", "Products accumulate without touching", "System operates at zero PSI", "Conveyor runs without motor"], correctAnswer: 1 }
      ]
    }),
    durationMinutes: 55,
    points: 200,
  });

  const modules = [module1, module2, module3, module4, module5, module6, module7, module8, module9, module10, module11, module12, module13, module14, module15, module16, module17, module18, module19, module20, module21, module22, module23];
  console.log(`Created ${modules.length} training modules (10 technical, 13 leadership/professional)`);

  // Create interactive schematics for parts identification
  const schematic1 = await db.insert(schema.schematics).values({
    companyId,
    equipmentId: null,
    name: "Electric Motor Components",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Electric_motor_cycle_3.png/640px-Electric_motor_cycle_3.png",
    parts: [
      { id: "stator", name: "Stator", x: 40, y: 50 },
      { id: "rotor", name: "Rotor", x: 50, y: 50 },
      { id: "front-bearing", name: "Front Bearing", x: 25, y: 50 },
      { id: "rear-bearing", name: "Rear Bearing", x: 75, y: 50 },
      { id: "cooling-fan", name: "Cooling Fan", x: 85, y: 50 },
      { id: "shaft", name: "Drive Shaft", x: 50, y: 70 }
    ]
  }).returning();

  const schematic2 = await db.insert(schema.schematics).values({
    companyId,
    equipmentId: null,
    name: "Motor Control Center (MCC) Components",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Motor_control_center.jpg/640px-Motor_control_center.jpg",
    parts: [
      { id: "main-breaker", name: "Main Circuit Breaker", x: 50, y: 20 },
      { id: "contactor", name: "Magnetic Contactor", x: 50, y: 40 },
      { id: "overload", name: "Thermal Overload Relay", x: 50, y: 55 },
      { id: "start-button", name: "Start Button (Green)", x: 70, y: 65 },
      { id: "stop-button", name: "Stop Button (Red)", x: 70, y: 75 }
    ]
  }).returning();

  const schematic3 = await db.insert(schema.schematics).values({
    companyId,
    equipmentId: null,
    name: "Rolling Element Bearing",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Bearing_thrust_ball.svg/640px-Bearing_thrust_ball.svg.png",
    parts: [
      { id: "inner-race", name: "Inner Race (Ring)", x: 50, y: 55 },
      { id: "outer-race", name: "Outer Race (Ring)", x: 50, y: 25 },
      { id: "balls", name: "Rolling Elements (Balls)", x: 50, y: 40 },
      { id: "cage", name: "Cage (Retainer)", x: 65, y: 40 }
    ]
  }).returning();

  const schematics = [schematic1, schematic2, schematic3];
  console.log(`Created ${schematics.length} interactive schematics`);

  return { modules, schematics };
}
