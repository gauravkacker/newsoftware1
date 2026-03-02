import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { extractTextFromPDF, buildSearchIndex, countWords } from '@/lib/pdf-processor';

export async function POST(request: NextRequest) {
  try {
    const { bookId, filePath, metadata, includeText } = await request.json();

    if (!bookId || !filePath) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get full file path
    const fullPath = join(process.cwd(), 'public', filePath);

    // Extract text from PDF
    console.log(`[Process] Starting text extraction for book: ${bookId}`);
    const extractionResult = await extractTextFromPDF(fullPath, bookId);

    // Return processing result with full text if requested
    return NextResponse.json({
      success: true,
      bookId,
      totalPages: extractionResult.totalPages,
      extractionTime: extractionResult.extractionTime,
      pages: includeText ? extractionResult.pages : extractionResult.pages.map(p => ({
        pageNumber: p.pageNumber,
        wordCount: p.wordCount,
        hasImages: p.hasImages
      })),
      message: 'PDF processed successfully'
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process PDF', error: String(error) },
      { status: 500 }
    );
  }
}
