// PDF Processing Utilities
// This module handles PDF text extraction and indexing

interface PageContent {
  pageNumber: number;
  text: string;
  wordCount: number;
  hasImages: boolean;
}

interface ExtractionResult {
  bookId: string;
  totalPages: number;
  pages: PageContent[];
  extractionTime: number;
  errors: string[];
}

interface SearchIndexEntry {
  word: string;
  positions: number[];
  frequency: number;
}

/**
 * Extract text from PDF file
 * Note: This is a placeholder implementation. In production, you would use:
 * - pdf-parse (Node.js)
 * - pdfjs-dist (Browser/Node.js)
 * - pdf.js (Browser)
 */
export async function extractTextFromPDF(
  pdfPath: string,
  bookId: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // TODO: Implement actual PDF text extraction
    // For now, return mock data for testing
    console.log(`[PDF Processor] Extracting text from: ${pdfPath}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock extraction result
    const mockPages: PageContent[] = [
      {
        pageNumber: 1,
        text: 'Sample page 1 content. This is a test page from the PDF.',
        wordCount: 12,
        hasImages: false
      },
      {
        pageNumber: 2,
        text: 'Sample page 2 content. More text for testing search functionality.',
        wordCount: 11,
        hasImages: false
      }
    ];

    const extractionTime = Date.now() - startTime;

    return {
      bookId,
      totalPages: mockPages.length,
      pages: mockPages,
      extractionTime,
      errors
    };

  } catch (error) {
    errors.push(`Extraction failed: ${error}`);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Build search index from extracted text
 */
export function buildSearchIndex(
  bookId: string,
  pageNumber: number,
  text: string
): SearchIndexEntry[] {
  const indices: SearchIndexEntry[] = [];
  const wordMap = new Map<string, number[]>();

  // Tokenize text into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0);

  // Build word position map
  words.forEach((word, position) => {
    if (wordMap.has(word)) {
      wordMap.get(word)!.push(position);
    } else {
      wordMap.set(word, [position]);
    }
  });

  // Convert map to index entries
  wordMap.forEach((positions, word) => {
    indices.push({
      word,
      positions,
      frequency: positions.length
    });
  });

  return indices;
}

/**
 * Generate snippet with highlighted search terms
 */
export function generateSnippet(
  text: string,
  keywords: string[],
  contextLength: number = 200
): string {
  const lowerText = text.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  // Find first occurrence of any keyword
  let firstIndex = -1;
  for (const keyword of lowerKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
      firstIndex = index;
    }
  }

  if (firstIndex === -1) {
    // No keyword found, return beginning of text
    return text.substring(0, contextLength) + '...';
  }

  // Calculate snippet boundaries
  const start = Math.max(0, firstIndex - contextLength / 2);
  const end = Math.min(text.length, firstIndex + contextLength / 2);

  let snippet = text.substring(start, end);

  // Add ellipsis
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  // Highlight keywords (wrap in **keyword** for now)
  lowerKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})`, 'gi');
    snippet = snippet.replace(regex, '**$1**');
  });

  return snippet;
}

/**
 * Calculate relevance score for search results (TF-IDF)
 */
export function calculateRelevanceScore(
  matchCount: number,
  totalWords: number,
  queryTerms: number
): number {
  // Simple relevance scoring
  // TF (Term Frequency) = matchCount / totalWords
  // Boost by number of query terms matched
  const tf = matchCount / Math.max(totalWords, 1);
  const boost = queryTerms / Math.max(queryTerms, 1);
  return tf * boost * 100;
}

/**
 * Normalize text for search (lowercase, trim, remove special chars)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}
