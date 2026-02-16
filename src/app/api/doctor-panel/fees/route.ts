// ============================================
// Fees API Route
// Doctor Panel - Fee Management
// Using existing Homeo PMS fee system
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/database';

// Helper to generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Fee type matching Homeo PMS structure
interface FeeRecord {
  id: string;
  patientId: string;
  visitId?: string;
  amount: number;
  feeType: string;
  paymentStatus: string;
  discountPercent?: number;
  discountReason?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// GET - Retrieve fees
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const patientId = searchParams.get('patientId');
    const visitId = searchParams.get('visitId');

    if (id) {
      const fees = db.getAll<FeeRecord>('fees');
      const fee = fees.find((f) => f.id === id);
      if (!fee) {
        return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
      }
      return NextResponse.json(fee);
    }

    if (patientId) {
      const fees = db.getAll<FeeRecord>('fees');
      const patientFees = fees
        .filter((f) => f.patientId === patientId)
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      return NextResponse.json(patientFees);
    }

    if (visitId) {
      const fees = db.getAll<FeeRecord>('fees');
      const visitFee = fees.find((f) => f.visitId === visitId);
      return NextResponse.json(visitFee || null);
    }

    const fees = db.getAll<FeeRecord>('fees');
    return NextResponse.json(fees);
  } catch (error) {
    console.error('Error fetching fees:', error);
    return NextResponse.json({ error: 'Failed to fetch fees' }, { status: 500 });
  }
}

// POST - Create new fee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newFee: FeeRecord = {
      id: generateId(),
      patientId: body.patientId,
      visitId: body.visitId,
      amount: body.amount,
      feeType: body.feeType,
      paymentStatus: body.paymentStatus || 'pending',
      discountPercent: body.discountPercent,
      discountReason: body.discountReason,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.create('fees', newFee as unknown as Record<string, unknown>);

    return NextResponse.json(newFee, { status: 201 });
  } catch (error) {
    console.error('Error creating fee:', error);
    return NextResponse.json({ error: 'Failed to create fee' }, { status: 500 });
  }
}

// PUT - Update fee
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Partial<FeeRecord> = { updatedAt: new Date() };
    
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.feeType !== undefined) updates.feeType = body.feeType;
    if (body.paymentStatus !== undefined) updates.paymentStatus = body.paymentStatus;
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.discountReason !== undefined) updates.discountReason = body.discountReason;
    if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
    if (body.notes !== undefined) updates.notes = body.notes;

    const updated = db.update<FeeRecord>('fees', id, updates as unknown as Record<string, unknown>);

    if (!updated) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating fee:', error);
    return NextResponse.json({ error: 'Failed to update fee' }, { status: 500 });
  }
}

// DELETE - Delete fee
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const deleted = db.delete('fees', id);

    if (!deleted) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting fee:', error);
    return NextResponse.json({ error: 'Failed to delete fee' }, { status: 500 });
  }
}
