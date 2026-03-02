import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = JSON.parse(formData.get('metadata') as string);

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Generate unique book ID
    const bookId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'materia-medica', 'books');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const fileName = `${bookId}.pdf`;
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return success with book info
    return NextResponse.json({
      success: true,
      bookId,
      fileName,
      filePath: `materia-medica/books/${fileName}`,
      fileSize: file.size,
      message: 'File uploaded successfully. Processing will begin shortly.',
      processingStatus: 'queued'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload file', error: String(error) },
      { status: 500 }
    );
  }
}
