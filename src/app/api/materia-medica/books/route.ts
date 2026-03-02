import { NextRequest, NextResponse } from 'next/server';
import { materiaMedicaBookDb } from '@/lib/db/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let books = materiaMedicaBookDb.getAll();

    // Filter by category if provided
    if (category) {
      books = books.filter((book: any) => book.category === category);
    }

    // Search if query provided
    if (search) {
      books = materiaMedicaBookDb.search(search);
    }

    // Sort by most recently accessed
    books.sort((a: any, b: any) => {
      const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      books,
      total: books.length
    });

  } catch (error) {
    console.error('Get books error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get books', error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { bookId } = await request.json();

    if (!bookId) {
      return NextResponse.json(
        { success: false, message: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Delete book and all related data
    materiaMedicaBookDb.delete(bookId);

    return NextResponse.json({
      success: true,
      message: 'Book deleted successfully'
    });

  } catch (error) {
    console.error('Delete book error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete book', error: String(error) },
      { status: 500 }
    );
  }
}
