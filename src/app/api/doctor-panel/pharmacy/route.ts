// ============================================
// Pharmacy API Route
// Doctor Panel - Pharmacy Queue Management
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { pharmacyQueueDb, medicineMemoryDb } from '@/lib/db/doctor-panel';
import type { PharmacyQueueItem } from '@/lib/db/schema';

// GET - Retrieve pharmacy queue items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const visitId = searchParams.get('visitId');
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');

    if (id) {
      const item = pharmacyQueueDb.getById(id);
      if (!item) {
        return NextResponse.json({ error: 'Pharmacy item not found' }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    if (visitId) {
      const item = pharmacyQueueDb.getByVisit(visitId);
      return NextResponse.json(item || null);
    }

    if (patientId) {
      const items = pharmacyQueueDb.getByPatient(patientId);
      return NextResponse.json(items);
    }

    if (status === 'pending') {
      const items = pharmacyQueueDb.getPending();
      return NextResponse.json(items);
    }

    const items = pharmacyQueueDb.getAll();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching pharmacy queue:', error);
    return NextResponse.json({ error: 'Failed to fetch pharmacy queue' }, { status: 500 });
  }
}

// POST - Add to pharmacy queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newItem = pharmacyQueueDb.create({
      visitId: body.visitId,
      patientId: body.patientId,
      prescriptionIds: body.prescriptionIds || [],
      priority: body.priority || false,
      status: body.status || 'pending',
    });

    // Update medicine usage memory for each prescription
    if (body.medicines && Array.isArray(body.medicines)) {
      body.medicines.forEach((med: { medicine: string; potency?: string; quantity?: string }) => {
        medicineMemoryDb.incrementUse(med.medicine, med.potency, med.quantity);
      });
    }

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error adding to pharmacy queue:', error);
    return NextResponse.json({ error: 'Failed to add to pharmacy queue' }, { status: 500 });
  }
}

// PUT - Update pharmacy item status
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const body = await request.json();
    
    let updated;

    switch (body.action) {
      case 'markPrepared':
        updated = pharmacyQueueDb.markPrepared(id, body.preparedBy || 'staff');
        break;
      case 'markDelivered':
        updated = pharmacyQueueDb.markDelivered(id);
        break;
      case 'stop':
        updated = pharmacyQueueDb.stop(id, body.reason || 'Stopped by doctor');
        break;
      default:
        // Generic update
        const updates: Partial<PharmacyQueueItem> = {};
        if (body.status !== undefined) updates.status = body.status;
        if (body.priority !== undefined) updates.priority = body.priority;
        if (body.prescriptionIds !== undefined) updates.prescriptionIds = body.prescriptionIds;
        updated = pharmacyQueueDb.update(id, updates);
    }

    if (!updated) {
      return NextResponse.json({ error: 'Pharmacy item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating pharmacy item:', error);
    return NextResponse.json({ error: 'Failed to update pharmacy item' }, { status: 500 });
  }
}

// DELETE - Remove from pharmacy queue
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const deleted = pharmacyQueueDb.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Pharmacy item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pharmacy item:', error);
    return NextResponse.json({ error: 'Failed to delete pharmacy item' }, { status: 500 });
  }
}
