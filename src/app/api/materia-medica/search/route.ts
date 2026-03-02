import { NextRequest, NextResponse } from 'next/server';
import { 
  materiaMedicaSearchIndexDb, 
  materiaMedicaBookPageDb, 
  materiaMedicaBookDb 
} from '@/lib/db/database';
import { generateSnippet, calculateRelevanceScore, normalizeText } from '@/lib/pdf-processor';

export async function POST(request: NextRequest) {
  try {
    const { query, bookIds, maxResults = 50 } = await request.json();

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Query is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Normalize and tokenize query
    const normalizedQuery = normalizeText(query);
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 0);

    // Search index for each keyword
    const matchingPages = new Map<string, any>();

    for (const keyword of keywords) {
      const indexRecords = materiaMedicaSearchIndexDb.searchWord(keyword, bookIds);

      for (const record of indexRecords) {
        const pageKey = `${record.bookId}:${record.pageNumber}`;

        if (matchingPages.has(pageKey)) {
          const existing = matchingPages.get(pageKey);
          existing.matchCount += 1;
          existing.keywords.push(keyword);
          existing.totalFrequency += record.frequency;
        } else {
          matchingPages.set(pageKey, {
            bookId: record.bookId,
            pageNumber: record.pageNumber,
            matchCount: 1,
            keywords: [keyword],
            totalFrequency: record.frequency
          });
        }
      }
    }

    // Build results with snippets
    const results: any[] = [];

    for (const pageMatch of matchingPages.values()) {
      // Get page content
      const page: any = materiaMedicaBookPageDb.getByBookAndPage(
        pageMatch.bookId,
        pageMatch.pageNumber
      );

      if (!page) continue;

      // Get book info
      const book: any = materiaMedicaBookDb.getById(pageMatch.bookId);

      if (!book) continue;

      // Calculate relevance score
      const relevanceScore = calculateRelevanceScore(
        pageMatch.matchCount,
        page.wordCount,
        keywords.length
      );

      // Generate snippet with highlights
      const snippet = generateSnippet(page.text, pageMatch.keywords, 200);

      results.push({
        bookId: pageMatch.bookId,
        bookTitle: book.title,
        bookAuthor: book.author,
        pageNumber: pageMatch.pageNumber,
        snippet,
        relevanceScore,
        matchCount: pageMatch.matchCount
      });
    }

    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    const limitedResults = results.slice(0, maxResults);

    const searchTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      query,
      totalResults: results.length,
      results: limitedResults,
      searchTime
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, message: 'Search failed', error: String(error) },
      { status: 500 }
    );
  }
}
