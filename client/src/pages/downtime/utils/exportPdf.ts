import { format } from "date-fns";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { sanitizeText } from "./sanitizeText";
import { constructSegmentsFromLegacyData } from "./segmentHelpers";
import type { DowntimeReport, BreakdownAnalysis, Segments } from "../types";

type ToastFunction = (options: { title: string; description: string; variant?: "destructive" }) => void;

/**
 * Export a finding deep-dive analysis to PDF
 */
export const exportFindingToPDF = async (
  analysis: any,
  finding: any,
  toast: ToastFunction
) => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  const navy = [20, 40, 80] as [number, number, number];
  const green = [16, 185, 129] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 35, 'F');

  try {
    doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25);
  } catch {}

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Comprehensive Breakdown Report', 50, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('C4 Industrial | Deep-Dive Analysis', 50, 24);

  let y = 45;

  // Finding Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(analysis.findingDetails?.title || finding?.cause || finding?.title || 'Key Finding Analysis', margin, y);
  y += 10;

  // Executive Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(sanitizeText(analysis.executiveSummary || ''), contentWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 10;

  // Finding Details
  if (analysis.findingDetails) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Finding Details', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Severity', sanitizeText(analysis.findingDetails.severity || 'N/A')],
        ['Impact Score', `${analysis.findingDetails.impactScore || 'N/A'}/10`],
        ['Downtime Contribution', sanitizeText(analysis.findingDetails.downtimeContribution || 'N/A')]
      ],
      theme: 'grid',
      headStyles: { fillColor: navy, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Root Cause Breakdown
  if (analysis.rootCauseBreakdown) {
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Root Cause Breakdown', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Primary Cause:', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    const causeLines = doc.splitTextToSize(sanitizeText(analysis.rootCauseBreakdown.primaryCause || ''), contentWidth);
    doc.text(causeLines, margin, y);
    y += causeLines.length * 5 + 5;

    if (analysis.rootCauseBreakdown.contributingFactors?.length) {
      doc.setFont('helvetica', 'bold');
      doc.text('Contributing Factors:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      analysis.rootCauseBreakdown.contributingFactors.forEach((f: string) => {
        doc.text(`• ${sanitizeText(f)}`, margin + 4, y);
        y += 5;
      });
      y += 5;
    }
  }

  // Recommended Actions
  if (analysis.recommendedActions?.length) {
    if (y > pageHeight - 80) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Recommended Actions', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Action', 'Priority', 'Owner', 'Timeline']],
      body: analysis.recommendedActions.map((a: any) => [
        sanitizeText(a.action || ''),
        sanitizeText(a.priority || 'N/A'),
        sanitizeText(a.owner || 'TBD'),
        sanitizeText(a.timeline || 'TBD')
      ]),
      theme: 'grid',
      headStyles: { fillColor: green, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Risk Assessment
  if (analysis.riskAssessment) {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Risk Assessment', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Recurrence Probability', sanitizeText(analysis.riskAssessment.recurrenceProbability || 'N/A')],
        ['Consequence Severity', sanitizeText(analysis.riskAssessment.consequenceSeverity || 'N/A')],
        ['Risk Score', `${analysis.riskAssessment.riskScore || 'N/A'}/25`],
        ['Mitigation Priority', sanitizeText(analysis.riskAssessment.mitigationPriority || 'N/A')]
      ],
      theme: 'grid',
      headStyles: { fillColor: navy, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('C4 Industrial | Confidential', margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Finding_Breakdown_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

  toast({
    title: "Report Exported",
    description: "Deep-dive analysis report has been downloaded",
  });
};

/**
 * Export breakdown analysis to PDF
 */
export const exportBreakdownToPDF = async (
  breakdown: BreakdownAnalysis,
  toast: ToastFunction
) => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  const colors = {
    navy: [20, 40, 80] as [number, number, number],
    primary: [59, 130, 246] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    warning: [234, 88, 12] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number],
    gray: [100, 116, 139] as [number, number, number],
    bgLight: [248, 250, 252] as [number, number, number],
  };

  const checkPageBreak = (requiredSpace: number, currentY: number): number => {
    if (currentY + requiredSpace > pageHeight - 30) {
      doc.addPage();
      addPageHeader();
      return 50;
    }
    return currentY;
  };

  const addPageHeader = () => {
    doc.setFillColor(...colors.navy);
    doc.rect(0, 0, pageWidth, 35, 'F');
    try { doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25); } catch {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('C4 INDUSTRIAL', margin + 30, 14);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BREAKDOWN ANALYSIS - 5 WHYS & FISHBONE', margin + 30, 26);
  };

  addPageHeader();
  let y = 45;

  // Title and Segment
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(sanitizeText(breakdown.findingTitle || 'Key Finding Analysis'), margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);
  doc.text(`Segment: ${breakdown.segment?.toUpperCase() || 'GENERAL'}`, margin, y);
  y += 10;

  // Executive Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Executive Summary', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(sanitizeText(breakdown.executiveSummary || ''), contentWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 12;

  // Cost-Benefit Metrics Bar
  if (breakdown.costBenefitAnalysis) {
    y = checkPageBreak(30, y);
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, contentWidth, 22, 'F');
    doc.setDrawColor(34, 197, 94);
    doc.rect(margin, y, contentWidth, 22, 'S');

    const colWidth = contentWidth / 4;
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('Annual Savings', margin + 5, y + 6);
    doc.text('Implementation Cost', margin + colWidth + 5, y + 6);
    doc.text('Payback Period', margin + colWidth * 2 + 5, y + 6);
    doc.text('Risk Reduction', margin + colWidth * 3 + 5, y + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(sanitizeText(breakdown.costBenefitAnalysis.annualSavings || 'N/A'), margin + 5, y + 15);
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizeText(breakdown.costBenefitAnalysis.implementationCost || 'N/A'), margin + colWidth + 5, y + 15);
    doc.setTextColor(59, 130, 246);
    doc.text(sanitizeText(breakdown.costBenefitAnalysis.paybackPeriod || 'N/A'), margin + colWidth * 2 + 5, y + 15);
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizeText(breakdown.costBenefitAnalysis.riskReduction || 'N/A'), margin + colWidth * 3 + 5, y + 15);
    y += 30;
  }

  // 5 Whys Section
  y = checkPageBreak(60, y);
  doc.setFillColor(...colors.primary);
  doc.rect(margin, y, 4, 10, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('5 Whys Analysis', margin + 8, y + 7);
  y += 16;

  if (breakdown.fiveWhys?.length > 0) {
    const whysData = breakdown.fiveWhys.map(why => [
      `Why ${why.step}`,
      sanitizeText(why.question),
      sanitizeText(why.answer),
      why.confidence || 'N/A'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Step', 'Question', 'Answer', 'Confidence']],
      body: whysData,
      theme: 'grid',
      headStyles: { fillColor: colors.navy, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 50 },
        2: { cellWidth: 80 },
        3: { cellWidth: 22 }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Root Cause
  if (breakdown.rootCause) {
    y = checkPageBreak(40, y);
    doc.setFillColor(...colors.danger);
    doc.rect(margin, y, 4, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Identified Root Cause', margin + 8, y + 7);
    y += 14;

    doc.setFillColor(...colors.bgLight);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const rcLines = doc.splitTextToSize(sanitizeText(breakdown.rootCause.statement), contentWidth - 10);
    doc.text(rcLines, margin + 5, y + 8);
    y += 25;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${breakdown.rootCause.category?.toUpperCase() || 'N/A'} | Confidence: ${breakdown.rootCause.confidence?.toUpperCase() || 'N/A'}`, margin, y);
    y += 12;
  }

  // Action Plan
  if (breakdown.actionPlan?.length > 0) {
    y = checkPageBreak(60, y);
    doc.setFillColor(...colors.success);
    doc.rect(margin, y, 4, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Recommended Action Plan', margin + 8, y + 7);
    y += 16;

    const actionData = breakdown.actionPlan.map(action => [
      sanitizeText(action.title),
      sanitizeText(action.description),
      action.priority || 'N/A',
      sanitizeText(action.ownerRole),
      sanitizeText(action.timeline)
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Action', 'Description', 'Priority', 'Owner', 'Timeline']],
      body: actionData,
      theme: 'grid',
      headStyles: { fillColor: colors.navy, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 55 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('C4 Industrial | Confidential', margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Breakdown_Analysis_${breakdown.segment || 'general'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

  toast({
    title: "Report Exported",
    description: "Breakdown analysis report has been downloaded",
  });
};

/**
 * Export full downtime report to PDF
 */
export const exportReportToPDF = async (
  report: DowntimeReport,
  toast: ToastFunction
) => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const analysis = report.analysisData;
  const segments = constructSegmentsFromLegacyData(analysis);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Professional color palette
  const colors = {
    primary: [30, 58, 95] as [number, number, number],
    accent: [59, 130, 246] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    warning: [234, 88, 12] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number],
    purple: [124, 58, 237] as [number, number, number],
    cyan: [6, 182, 212] as [number, number, number],
    textDark: [30, 41, 59] as [number, number, number],
    textMuted: [100, 116, 139] as [number, number, number],
    bgLight: [248, 250, 252] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    safety: [220, 38, 38] as [number, number, number],
    quality: [234, 88, 12] as [number, number, number],
    operations: [124, 58, 237] as [number, number, number],
    maintenance: [59, 130, 246] as [number, number, number]
  };

  // Segment icons and labels
  const segmentConfig: Record<string, { label: string; color: [number, number, number] }> = {
    safety: { label: 'Safety', color: colors.safety },
    quality: { label: 'Quality', color: colors.quality },
    operations: { label: 'Operations', color: colors.operations },
    maintenance: { label: 'Maintenance', color: colors.maintenance }
  };

  // Helper: Add section header with professional styling
  const addSectionHeader = (title: string, color: [number, number, number], y: number): number => {
    doc.setFillColor(...color);
    doc.rect(margin, y, 3, 12, 'F');
    doc.setTextColor(...colors.textDark);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 8, y + 9);
    return y + 18;
  };

  // Helper: Add page header with logo (for all pages)
  const addPageHeader = () => {
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Add logo from embedded base64
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25);
    } catch (e) {
      console.log('Logo rendering skipped');
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('C4 INDUSTRIAL', margin + 30, 14);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DOWNTIME ANALYSIS REPORT', margin + 30, 26);
  };

  // Helper: Add page footer
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(...colors.border);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textMuted);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(format(new Date(), 'MMMM dd, yyyy'), margin, pageHeight - 10);
    doc.text('Confidential', pageWidth - margin, pageHeight - 10, { align: 'right' });
  };

  // Helper: Truncate text cleanly
  const truncate = (text: string, maxLen: number): string => {
    const clean = sanitizeText(text);
    return clean.length > maxLen ? clean.substring(0, maxLen - 3) + '...' : clean;
  };

  // ========== PAGE 1: EXECUTIVE SUMMARY ==========
  addPageHeader();

  // Report Info Box
  let yPos = 42;
  doc.setFillColor(...colors.bgLight);
  doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'S');

  doc.setTextColor(...colors.textMuted);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Source:', margin + 5, yPos + 9);
  doc.text('Generated:', margin + 5, yPos + 17);
  doc.setTextColor(...colors.textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(report.fileName || 'Uploaded Data', margin + 28, yPos + 9);
  doc.text(report.createdAt ? format(new Date(report.createdAt), 'MMMM dd, yyyy') : 'Date unknown', margin + 35, yPos + 17);

  // Key metrics on right side
  doc.setTextColor(...colors.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Records:', pageWidth - margin - 70, yPos + 9);
  doc.text('Total Downtime:', pageWidth - margin - 70, yPos + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.textDark);
  doc.text(`${report.recordCount || 0}`, pageWidth - margin - 35, yPos + 9);
  doc.setTextColor(...colors.danger);
  doc.text(`${report.totalDowntimeHours?.toFixed(1) || 0} hrs`, pageWidth - margin - 35, yPos + 17);

  yPos = 72;

  // ========== COMPREHENSIVE EXECUTIVE OVERVIEW ==========
  // Aggregate all data from segments for overview
  const allFindings: any[] = [];
  const allRecommendations: any[] = [];

  if (segments) {
    Object.entries(segments).forEach(([key, seg]: [string, any]) => {
      const config = segmentConfig[key];
      // Collect findings
      (seg.findings || []).forEach((f: any) => allFindings.push({ ...f, segment: config?.label || key }));
      (seg.rootCauses || []).forEach((r: any) => allFindings.push({ ...r, segment: config?.label || key }));
      // Collect recommendations
      (seg.recommendations || []).forEach((r: any) => allRecommendations.push({ ...r, segment: config?.label || key }));
    });
  }

  // Executive Summary Section
  yPos = addSectionHeader('EXECUTIVE OVERVIEW', colors.accent, yPos);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.textDark);
  const summaryText = sanitizeText(analysis?.summary?.criticalFindings || 'Analysis complete. Review the detailed sections below for key insights and recommendations.');
  const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 10);
  doc.text(splitSummary, margin + 5, yPos);
  yPos += splitSummary.length * 5 + 8;

  // Key Metrics Overview Box
  doc.setFillColor(...colors.bgLight);
  doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'S');

  const metricBoxWidth = contentWidth / 4;
  const overviewMetrics = [
    { label: 'Total Downtime', value: `${report.totalDowntimeHours?.toFixed(1) || 0} hrs`, color: colors.danger },
    { label: 'Records Analyzed', value: `${report.recordCount || 0}`, color: colors.textDark },
    { label: 'Total Findings', value: `${allFindings.length}`, color: colors.warning },
    { label: 'Actions Required', value: `${allRecommendations.length}`, color: colors.success }
  ];

  overviewMetrics.forEach((metric, idx) => {
    const xPos = margin + (metricBoxWidth * idx) + 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textMuted);
    doc.text(metric.label, xPos, yPos + 10);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...metric.color);
    doc.text(metric.value, xPos, yPos + 22);
  });
  yPos += 35;

  // Segment Breakdown Summary Table (compact on first page)
  if (segments) {
    yPos = addSectionHeader('SEGMENT BREAKDOWN', colors.primary, yPos);

    const segmentData = Object.entries(segments).map(([key, seg]: [string, any]) => {
      const config = segmentConfig[key];
      const findingsCount = (seg.findings?.length || 0) + (seg.rootCauses?.length || 0);
      const recsCount = seg.recommendations?.length || 0;
      return [
        config?.label || key,
        `${seg.downtimeHours?.toFixed(1) || 0} hrs`,
        seg.severity?.toUpperCase() || 'LOW',
        findingsCount.toString(),
        recsCount.toString()
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Segment', 'Downtime', 'Severity', 'Findings', 'Actions']],
      body: segmentData,
      theme: 'plain',
      headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: colors.textDark },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: contentWidth * 0.25 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ========== PAGE 2: ALL FINDINGS CONSOLIDATED ==========
  doc.addPage();
  addPageHeader();
  yPos = 45;

  yPos = addSectionHeader('ALL FINDINGS ACROSS SEGMENTS', colors.danger, yPos);

  if (allFindings.length > 0) {
    const findingsTableData = allFindings.slice(0, 15).map((f: any, idx: number) => [
      (idx + 1).toString(),
      f.segment || '',
      truncate(f.title || f.cause || f.description || '', 50),
      f.severity || f.priority || 'Medium'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Segment', 'Finding', 'Severity']],
      body: findingsTableData,
      theme: 'plain',
      headStyles: { fillColor: colors.danger, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: colors.textDark },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: contentWidth - 85 },
        3: { cellWidth: 30, halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...colors.textMuted);
    doc.text('No findings recorded in this analysis.', margin + 5, yPos);
    yPos += 15;
  }

  // ========== PAGE 3: ALL ACTIONS CONSOLIDATED ==========
  doc.addPage();
  addPageHeader();
  yPos = 45;

  yPos = addSectionHeader('CONSOLIDATED ACTION PLAN', colors.success, yPos);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...colors.textMuted);
  doc.text('All recommended actions prioritized by expected impact. Implement systematically to reduce downtime.', margin + 5, yPos);
  yPos += 10;

  if (allRecommendations.length > 0) {
    const actionsTableData = allRecommendations.map((r: any, idx: number) => [
      (idx + 1).toString(),
      r.segment || '',
      truncate(r.title || r.action || r.description || '', 45),
      r.priority || r.timeline || 'Medium',
      truncate(r.expectedImpact || r.impact || 'Reduce downtime', 30)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Segment', 'Action', 'Priority', 'Expected Impact']],
      body: actionsTableData,
      theme: 'plain',
      headStyles: { fillColor: colors.success, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: colors.textDark },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: contentWidth - 110 },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...colors.textMuted);
    doc.text('No actions recorded in this analysis.', margin + 5, yPos);
    yPos += 15;
  }

  // Add footers to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Save
  const pdfFileName = (report.fileName || 'Downtime_Report').replace(/\.[^/.]+$/, '') + '_Analysis.pdf';
  doc.save(pdfFileName);

  toast({
    title: "Report Exported",
    description: `Professional analysis report saved as ${pdfFileName}`,
  });
};

/**
 * Export segment-specific PDF
 */
export const exportSegmentToPDF = async (
  segmentKey: string,
  segment: any,
  report: DowntimeReport,
  toast: ToastFunction
) => {
  if (!segment) {
    toast({
      title: "Export Failed",
      description: "No segment data available to export",
      variant: "destructive"
    });
    return;
  }

  // Ensure we have data to export
  const hasData = (segment.findings?.length > 0) || (segment.rootCauses?.length > 0) || (segment.recommendations?.length > 0);

  if (!hasData) {
    toast({
      title: "No Data to Export",
      description: `The ${segmentKey} segment has no findings, root causes, or recommendations to export.`,
      variant: "destructive"
    });
    return;
  }

  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  const segmentLabels: Record<string, string> = {
    safety: 'Safety',
    quality: 'Quality',
    operations: 'Operations',
    maintenance: 'Maintenance'
  };
  const segmentColors: Record<string, [number, number, number]> = {
    safety: [220, 38, 38],
    quality: [37, 99, 235],
    operations: [217, 119, 6],
    maintenance: [22, 163, 74]
  };

  const segmentLabel = segmentLabels[segmentKey] || segmentKey;
  const headerColor = segmentColors[segmentKey] || [59, 130, 246];

  const colors = {
    primary: headerColor,
    textDark: [31, 41, 55] as [number, number, number],
    textMuted: [107, 114, 128] as [number, number, number],
    bgLight: [249, 250, 251] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    warning: [217, 119, 6] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number]
  };

  const cleanText = (text: string): string => {
    if (!text) return '';
    return sanitizeText(text);
  };

  // Header
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  try {
    doc.addImage(LOGO_BASE64, 'PNG', margin, 6, 24, 24);
  } catch (e) {
    console.log('Logo rendering skipped');
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${segmentLabel} Analysis Report`, margin + 30, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(report.fileName || 'Downtime Analysis', margin + 30, 24);
  doc.text(report.createdAt ? format(new Date(report.createdAt), "MMMM dd, yyyy") : 'Date unknown', pageWidth - margin - 40, 24);

  let yPos = 45;

  // Executive Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.textDark);
  doc.text('Executive Summary', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.textMuted);
  const summaryLines = doc.splitTextToSize(cleanText(segment.executiveSummary || ''), contentWidth);
  doc.text(summaryLines, margin, yPos);
  yPos += summaryLines.length * 5 + 10;

  // Findings Table
  if (segment.findings?.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text('Key Findings', margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Finding', 'Severity', 'Impact']],
      body: segment.findings.map((f: any) => [
        cleanText(f.title || ''),
        cleanText(f.severity || ''),
        cleanText(f.impact || '')
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: colors.textDark,
        overflow: 'linebreak'
      },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto'
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Root Causes
  if (segment.rootCauses?.length > 0) {
    if (yPos > 200) { doc.addPage(); yPos = 25; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text('Root Causes', margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Cause', 'Risk Level', 'Evidence']],
      body: segment.rootCauses.map((c: any) => [
        cleanText(c.cause || ''),
        cleanText(c.riskLevel || ''),
        cleanText(c.evidence || '')
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: colors.danger,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: colors.textDark,
        overflow: 'linebreak'
      },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto'
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Recommendations - New Page
  if (segment.recommendations?.length > 0) {
    doc.addPage();
    yPos = 25;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text(`${segmentLabel} Recommendations`, margin, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Action', 'Priority', 'Owner', 'Timeline']],
      body: segment.recommendations.map((r: any, i: number) => [
        (i + 1).toString(),
        cleanText(r.title || ''),
        cleanText(r.priority || ''),
        cleanText(r.owner || ''),
        cleanText(r.timeline || '')
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: colors.success,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: colors.textDark,
        overflow: 'linebreak'
      },
      alternateRowStyles: { fillColor: colors.bgLight },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto'
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...colors.textMuted);
    doc.text(`${segmentLabel} Analysis Report | Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 10);
    doc.text('MaintenanceHub', pageWidth - margin - 25, doc.internal.pageSize.getHeight() - 10);
  }

  const pdfFileName = `${segmentLabel}_Analysis_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(pdfFileName);

  toast({
    title: `${segmentLabel} Report Exported`,
    description: `Professional ${segmentLabel.toLowerCase()} analysis saved as ${pdfFileName}`,
  });
};

/**
 * Export action checklist to PDF
 */
export const exportActionChecklistToPDF = async (
  actionChecklist: any[],
  toast: ToastFunction
) => {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text('Action Checklist Report', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy")}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`${actionChecklist.filter(a => a.status === 'completed').length} of ${actionChecklist.length} actions completed`, pageWidth / 2, 34, { align: 'center' });

  let yPos = 45;

  // Group by segment
  ['safety', 'quality', 'operations', 'maintenance'].forEach(seg => {
    const segmentActions = actionChecklist.filter(a => a.segment === seg);
    if (segmentActions.length === 0) return;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Segment header
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`${seg.charAt(0).toUpperCase() + seg.slice(1)} Actions (${segmentActions.length})`, margin, yPos);
    yPos += 8;

    segmentActions.forEach((action) => {
      // Check for new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Action title with status
      doc.setFontSize(10);
      doc.setTextColor(40);
      const statusIcon = action.status === 'completed' ? '[X]' : action.status === 'in_progress' ? '[~]' : '[ ]';
      doc.text(`${statusIcon} ${action.title}`, margin, yPos);
      yPos += 5;

      // Action details
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Priority: ${action.priority} | Owner: ${action.owner} | Timeline: ${action.timeline}`, margin + 4, yPos);
      yPos += 4;

      if (action.estimatedCost) {
        doc.text(`Est. Cost: ${action.estimatedCost}`, margin + 4, yPos);
        yPos += 4;
      }

      doc.text(`Success Metric: ${action.successMetric}`, margin + 4, yPos);
      yPos += 4;

      // RACI
      if (action.raci) {
        doc.text(`RACI: R-${action.raci.responsible} | A-${action.raci.accountable} | C-${action.raci.consulted} | I-${action.raci.informed}`, margin + 4, yPos);
        yPos += 4;
      }

      // Implementation Steps
      if (action.implementationSteps && action.implementationSteps.length > 0) {
        doc.text('Implementation Steps:', margin + 4, yPos);
        yPos += 4;
        action.implementationSteps.forEach((step: string, stepIdx: number) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(`  ${stepIdx + 1}. ${step}`, margin + 6, yPos);
          yPos += 3.5;
        });
      }

      if (action.status === 'completed' && action.completedDate) {
        doc.setTextColor(34, 139, 34);
        doc.text(`Completed: ${format(new Date(action.completedDate), "MMM dd, yyyy")}`, margin + 4, yPos);
        yPos += 4;
      }

      yPos += 4;
    });

    yPos += 6;
  });

  doc.save('action-checklist.pdf');
  toast({
    title: "Checklist Exported",
    description: "Action checklist has been exported to PDF",
  });
};
