"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function MateriaMedicaPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'library' | 'upload' | 'reader'>('library');
  const [selectedBook, setSelectedBook] = useState<any>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      // Load directly from database (client-side)
      const { materiaMedicaBookDb } = await import('@/lib/db/database');
      const allBooks = materiaMedicaBookDb.getAll();
      console.log('Loaded books:', allBooks.length);
      setBooks(allBooks);
    } catch (error) {
      console.error('Failed to load books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = () => {
    // Switch back to library view
    setActiveView('library');
    // Reload books
    loadBooks();
  };

  const handleOpenBook = (book: any) => {
    setSelectedBook(book);
    setActiveView('reader');
  };

  const handleCloseReader = () => {
    setSelectedBook(null);
    setActiveView('library');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 transition-all duration-300 ml-64">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Materia Medica Library</h1>
              <p className="text-gray-600">Upload, read, and search homeopathy reference books</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant={activeView === 'library' ? 'primary' : 'secondary'}
                onClick={() => setActiveView('library')}
              >
                📚 Library
              </Button>
              <Button
                variant={activeView === 'upload' ? 'primary' : 'secondary'}
                onClick={() => setActiveView('upload')}
              >
                ⬆️ Upload Book
              </Button>
            </div>
          </div>

          {/* Content */}
          {activeView === 'library' ? (
            <LibraryView books={books} isLoading={isLoading} onRefresh={loadBooks} onOpenBook={handleOpenBook} />
          ) : activeView === 'upload' ? (
            <UploadView onUploadComplete={handleUploadComplete} />
          ) : (
            <BookReaderView book={selectedBook} onClose={handleCloseReader} />
          )}
        </div>
      </main>
    </div>
  );
}

// Library View Component
function LibraryView({ books, isLoading, onRefresh, onOpenBook }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleDebug = async () => {
    const { materiaMedicaBookDb } = await import('@/lib/db/database');
    const allBooks = materiaMedicaBookDb.getAll();
    console.log('=== DEBUG: All books in database ===');
    console.log('Total books:', allBooks.length);
    console.log('Books:', JSON.stringify(allBooks, null, 2));
    alert(`Found ${allBooks.length} books in database. Check console for details.`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading books...</div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Books Yet</h3>
        <p className="text-gray-600 mb-6">
          Upload your first Materia Medica book to get started
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={onRefresh}>Refresh</Button>
          <Button variant="secondary" onClick={handleDebug}>Debug Database</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search books by title, author, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onClick={() => onOpenBook(book)} />
        ))}
      </div>
    </div>
  );
}

// Upload View Component
function UploadView({ onUploadComplete }: any) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    author: '',
    publisher: '',
    edition: '',
    year: '',
    language: 'en',
    category: 'materia-medica',
    tags: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      // Auto-fill title from filename
      if (!metadata.title) {
        const fileName = file.name.replace('.pdf', '');
        setMetadata({ ...metadata, title: fileName });
      }
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !metadata.title || !metadata.author) {
      alert('Please fill in required fields (Title and Author)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('metadata', JSON.stringify(metadata));

      setUploadProgress(20);

      const uploadResponse = await fetch('/api/materia-medica/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.message);
      }

      setUploadProgress(40);

      // Step 2: Save book metadata to database
      const { materiaMedicaBookDb } = await import('@/lib/db/database');
      
      const book = materiaMedicaBookDb.create({
        title: metadata.title,
        author: metadata.author,
        publisher: metadata.publisher || undefined,
        edition: metadata.edition || undefined,
        year: metadata.year ? parseInt(metadata.year) : undefined,
        language: metadata.language,
        category: metadata.category as any,
        tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
        filePath: uploadData.filePath,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        totalPages: 0, // Will be updated after processing
        uploadedBy: 'current-user', // TODO: Get from auth context
        uploadedAt: new Date(),
        accessCount: 0,
        processingStatus: 'pending',
        indexStatus: 'pending'
      });

      setUploadProgress(60);

      // Step 3: Process PDF (extract text)
      const processResponse = await fetch('/api/materia-medica/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          filePath: uploadData.filePath,
          metadata
        })
      });

      const processData = await processResponse.json();

      if (!processData.success) {
        throw new Error(processData.message);
      }

      setUploadProgress(80);

      // Step 4: Save extracted pages and build search index
      const { materiaMedicaBookPageDb, materiaMedicaSearchIndexDb } = await import('@/lib/db/database');
      const { buildSearchIndex } = await import('@/lib/pdf-processor');

      // Get the full page data from the process response
      const fullProcessResponse = await fetch('/api/materia-medica/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          filePath: uploadData.filePath,
          metadata,
          includeText: true // Request full text
        })
      });

      const fullProcessData = await fullProcessResponse.json();

      if (fullProcessData.success && fullProcessData.pages) {
        for (const page of fullProcessData.pages) {
          // Save page
          materiaMedicaBookPageDb.create({
            bookId: book.id,
            pageNumber: page.pageNumber,
            text: page.text || '',
            wordCount: page.wordCount,
            hasImages: page.hasImages
          });

          // Build and save search index for this page
          if (page.text) {
            const indices = buildSearchIndex(book.id, page.pageNumber, page.text);
            for (const index of indices) {
              materiaMedicaSearchIndexDb.create({
                bookId: book.id,
                pageNumber: page.pageNumber,
                word: index.word,
                positions: index.positions,
                frequency: index.frequency
              });
            }
          }
        }
      }

      // Update book with processing results
      materiaMedicaBookDb.update(book.id, {
        totalPages: processData.totalPages,
        processingStatus: 'completed',
        indexStatus: 'indexed'
      });

      setUploadProgress(100);

      console.log('Book uploaded successfully:', book.id);
      alert('Book uploaded and processed successfully!');
      
      // Reset form
      setSelectedFile(null);
      setMetadata({
        title: '',
        author: '',
        publisher: '',
        edition: '',
        year: '',
        language: 'en',
        category: 'materia-medica',
        tags: ''
      });
      
      // Call onUploadComplete to refresh the library
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload book: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-6">Upload New Book</h2>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PDF File <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={isUploading}
        />
        {selectedFile && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      {/* Metadata Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={metadata.title}
            onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Boericke's Materia Medica"
            disabled={isUploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Author <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={metadata.author}
            onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., William Boericke"
            disabled={isUploading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Publisher</label>
            <input
              type="text"
              value={metadata.publisher}
              onChange={(e) => setMetadata({ ...metadata, publisher: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={isUploading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Edition</label>
            <input
              type="text"
              value={metadata.edition}
              onChange={(e) => setMetadata({ ...metadata, edition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 9th Edition"
              disabled={isUploading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <input
              type="number"
              value={metadata.year}
              onChange={(e) => setMetadata({ ...metadata, year: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 2023"
              disabled={isUploading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={metadata.category}
              onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={isUploading}
            >
              <option value="materia-medica">Materia Medica</option>
              <option value="repertory">Repertory</option>
              <option value="philosophy">Philosophy</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={metadata.tags}
            onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., homeopathy, remedies, reference"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Uploading and processing...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setSelectedFile(null);
            setMetadata({
              title: '',
              author: '',
              publisher: '',
              edition: '',
              year: '',
              language: 'en',
              category: 'materia-medica',
              tags: ''
            });
          }}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || !metadata.title || !metadata.author || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Book'}
        </Button>
      </div>
    </Card>
  );
}

// Book Card Component
function BookCard({ book, onClick }: any) {
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <div className="aspect-[3/4] bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-3 flex items-center justify-center text-white text-4xl">
        📖
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{book.title}</h3>
      <p className="text-sm text-gray-600 mb-2">{book.author}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{book.totalPages} pages</span>
        <span>{book.category}</span>
      </div>
    </Card>
  );
}

// Book Reader View Component
function BookReaderView({ book, onClose }: any) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!book) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>No book selected</p>
      </div>
    );
  }

  const totalPages = book.totalPages || 1;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onClose}>
            ← Back to Library
          </Button>
          <div>
            <h2 className="font-semibold text-gray-900">{book.title}</h2>
            <p className="text-sm text-gray-600">{book.author}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
          {book.filePath ? (
            <iframe
              src={`/${book.filePath}#page=${currentPage}`}
              className="w-full h-[800px] border-0"
              title={book.title}
            />
          ) : (
            <p className="text-center text-gray-500">PDF file not found</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 p-4 border-t bg-white">
        <Button
          variant="secondary"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= totalPages) {
              setCurrentPage(page);
            }
          }}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
        />
        <Button
          variant="secondary"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
