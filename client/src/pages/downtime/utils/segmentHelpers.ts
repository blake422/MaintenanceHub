import type { Segments, SegmentData } from "../types";

/**
 * Categorize an item based on its category field or keywords
 */
const categorizeItem = (item: any): keyof Segments => {
  const category = (item.category || '').toLowerCase();
  const text = ((item.cause || '') + ' ' + (item.title || '') + ' ' + (item.description || '') + ' ' + (item.evidence || '')).toLowerCase();
  const equipList = (item.affectedEquipment || []).map((e: string) => (e || '').toLowerCase()).join(' ');
  const combined = category + ' ' + text + ' ' + equipList;

  // Use category field if available
  if (category === 'mechanical' || category === 'electrical') {
    // Check for specific sub-categories
    if (/sensor|alignment|calibration|inspection/i.test(text)) return 'quality';
    if (/safety|guard|lockout|emergency/i.test(text)) return 'safety';
    return 'maintenance';
  }
  if (category === 'process' || category === 'planned maintenance') {
    // Process = operations, Planned Maintenance (like sanitation) = operations
    if (/sanitation|cleaning|changeover|setup/i.test(text)) return 'operations';
    if (/quality|defect|contamination/i.test(text)) return 'quality';
    return 'operations';
  }

  // Fallback to keyword-based categorization
  // Safety keywords
  if (/safety|hazard|injury|incident|guard|lockout|loto|ppe|emergency|fire|spill|leak|exposure|light.?curtain/i.test(combined)) {
    return 'safety';
  }
  // Quality keywords
  if (/quality|defect|reject|scrap|rework|spec|tolerance|inspection|calibration|contamination|out.?of.?spec|label|misprint/i.test(combined)) {
    return 'quality';
  }
  // Operations keywords
  if (/changeover|change.?over|setup|operator|training|material|supply|scheduling|throughput|speed|rate|staffing|shift|sanitation|cleaning|process/i.test(combined)) {
    return 'operations';
  }
  // Maintenance keywords
  if (/belt|motor|bearing|wear|alignment|breakdown|failure|repair|replace|mechanical|hydraulic|pneumatic|sleeve|machine|dough|mixer/i.test(combined)) {
    return 'maintenance';
  }
  // Default
  return 'maintenance';
};

/**
 * Extract hours from estimatedImpact text (e.g., "300 hours (~35% of total downtime)")
 */
const extractHours = (text: string): number => {
  if (!text) return 0;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  return match ? parseFloat(match[1]) : 0;
};

/**
 * Create empty segment data structure
 */
const createEmptySegment = (
  summary: string,
  keyMetrics: Record<string, string | number>
): SegmentData => ({
  downtimeHours: 0,
  severity: 'low',
  executiveSummary: summary,
  keyMetrics,
  findings: [],
  rootCauses: [],
  recommendations: [],
  kpis: [],
});

/**
 * Helper function to construct segments from legacy data if segments don't exist
 */
export const constructSegmentsFromLegacyData = (analysis: any): Segments | null => {
  if (!analysis) return null;

  // If segments exist, return them
  if (analysis.segments) return analysis.segments;

  const totalHours = analysis.summary?.totalDowntimeHours || analysis.totalDowntimeHours || 0;

  // Create base segments with initial zero hours
  const segments: Segments = {
    safety: createEmptySegment(
      'Safety-related downtime analysis focusing on incidents that could impact worker safety or create hazardous conditions.',
      { incidentCount: 0, nearMissCount: 0, riskScore: 'N/A' }
    ),
    quality: createEmptySegment(
      'Quality-related downtime analysis focusing on defects, rework, and product specification issues.',
      { defectRate: '0%', scrapCost: '$0', firstPassYield: 'N/A' }
    ),
    operations: createEmptySegment(
      'Operations-related downtime focusing on throughput, changeovers, and process inefficiencies.',
      { oeeScore: 'N/A', throughputLoss: '0%', changeoverTime: 'N/A' }
    ),
    maintenance: createEmptySegment(
      'Maintenance-related downtime focusing on equipment failures, breakdowns, and preventive maintenance gaps.',
      { mtbf: 'N/A', mttr: 'N/A', pmCompliance: 'N/A' }
    ),
  };

  // Track hours per segment from root causes
  const segmentHours: Record<keyof Segments, number> = { safety: 0, quality: 0, operations: 0, maintenance: 0 };

  // Distribute rootCauseAnalysis as rootCauses and track hours
  (analysis.rootCauseAnalysis || []).forEach((rca: any) => {
    const segmentKey = categorizeItem(rca);
    const hours = extractHours(rca.estimatedImpact);
    segmentHours[segmentKey] += hours;

    segments[segmentKey].rootCauses.push({
      cause: rca.cause,
      evidence: rca.evidence || rca.estimatedImpact,
      riskLevel: rca.priority || 'medium',
    });
  });

  // Distribute patterns as findings
  (analysis.patterns || []).forEach((pattern: any) => {
    const segmentKey = categorizeItem(pattern);

    segments[segmentKey].findings.push({
      title: pattern.title,
      description: pattern.description,
      severity: pattern.severity,
      affectedEquipment: pattern.affectedEquipment,
      impact: `Frequency: ${pattern.frequency}`,
    });
  });

  // Distribute recommendations
  (analysis.recommendations || []).forEach((rec: any) => {
    const segmentKey = categorizeItem(rec);

    segments[segmentKey].recommendations.push({
      title: rec.title || rec.action,
      description: rec.description || rec.action,
      priority: rec.priority,
      expectedOutcome: rec.expectedImpact,
      timeline: rec.timeframe || rec.implementation || '30 days',
      owner: 'Maintenance Team',
    });
  });

  // Calculate downtime hours per segment
  const totalTrackedHours = Object.values(segmentHours).reduce((a, b) => a + b, 0);
  const untrackedHours = totalHours - totalTrackedHours;

  // Calculate counts for proportional distribution
  const counts = {
    safety: segments.safety.findings.length + segments.safety.rootCauses.length,
    quality: segments.quality.findings.length + segments.quality.rootCauses.length,
    operations: segments.operations.findings.length + segments.operations.rootCauses.length,
    maintenance: segments.maintenance.findings.length + segments.maintenance.rootCauses.length,
  };
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  // Distribute tracked hours directly, then distribute untracked proportionally
  (Object.keys(segments) as Array<keyof Segments>).forEach((key) => {
    const trackedForSegment = segmentHours[key] || 0;
    const proportionalUntracked = (counts[key] / totalCount) * untrackedHours;
    segments[key].downtimeHours = Math.round((trackedForSegment + proportionalUntracked) * 10) / 10;
  });

  // Update severity based on findings and hours
  (Object.keys(segments) as Array<keyof Segments>).forEach((key) => {
    const seg = segments[key];
    const findingsCount = seg.findings.length + seg.rootCauses.length;
    const hoursPercent = totalHours > 0 ? (seg.downtimeHours / totalHours) * 100 : 0;

    if (findingsCount >= 3 || hoursPercent > 30) seg.severity = 'high';
    else if (findingsCount >= 2 || hoursPercent > 15) seg.severity = 'medium';
    else seg.severity = 'low';

    // Update executive summary with actual data
    if (seg.findings.length > 0 || seg.rootCauses.length > 0) {
      const topIssues = [...seg.findings, ...seg.rootCauses]
        .slice(0, 2)
        .map((f: any) => f.title || f.cause)
        .join(', ');
      seg.executiveSummary = `${seg.downtimeHours} hours of downtime attributed to ${key}-related issues. Primary concerns: ${topIssues}.`;
    }
  });

  return segments;
};
