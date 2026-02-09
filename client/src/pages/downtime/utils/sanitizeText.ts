/**
 * Professional text sanitizer - removes ALL markdown and formatting artifacts
 * Used to clean text for PDF exports and display
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    // Remove markdown headers
    .replace(/^#{1,6}\s*/gm, '')
    // Remove bold markers (handles nested cases)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Remove italic markers
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove bullet points and list markers
    .replace(/^\s*[-*+•]\s*/gm, '')
    .replace(/^\s*\d+[.)]\s*/gm, '')
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove backticks
    .replace(/`+([^`]*)`+/g, '$1')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove smart quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Clean up extra whitespace and newlines
    .replace(/\n{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
