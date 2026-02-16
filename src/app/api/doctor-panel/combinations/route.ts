// ============================================
// Combinations API Route
// Doctor Panel - Combination Medicines Management
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { combinationDb } from '@/lib/db/doctor-panel';
import type { CombinationMedicine } from '@/lib/db/schema';

// GET - Retrieve combinations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');

    if (id) {
      const combination = combinationDb.getById(id);
      if (!combination) {
        return NextResponse.json({ error: 'Combination not found' }, { status: 404 });
      }
      return NextResponse.json(combination);
    }

    if (search) {
      const combinations = combinationDb.search(search);
      return NextResponse.json(combinations);
    }

    const combinations = combinationDb.getAll();
    return NextResponse.json(combinations);
  } catch (error) {
    console.error('Error fetching combinations:', error);
    return NextResponse.json({ error: 'Failed to fetch combinations' }, { status: 500 });
  }
}

// POST - Create new combination
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if name already exists
    const existing = combinationDb.getByName(body.name);
    if (existing) {
      return NextResponse.json({ error: 'Combination with this name already exists' }, { status: 400 });
    }

    const newCombination = combinationDb.create({
      name: body.name,
      content: body.content,
      showComposition: body.showComposition !== false,
    });

    return NextResponse.json(newCombination, { status: 201 });
  } catch (error) {
    console.error('Error creating combination:', error);
    return NextResponse.json({ error: 'Failed to create combination' }, { status: 500 });
  }
}

// PUT - Update combination
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Partial<CombinationMedicine> = {};
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.content !== undefined) updates.content = body.content;
    if (body.showComposition !== undefined) updates.showComposition = body.showComposition;

    const updated = combinationDb.update(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Combination not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating combination:', error);
    return NextResponse.json({ error: 'Failed to update combination' }, { status: 500 });
  }
}

// DELETE - Delete combination
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const deleted = combinationDb.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Combination not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting combination:', error);
    return NextResponse.json({ error: 'Failed to delete combination' }, { status: 500 });
  }
}
