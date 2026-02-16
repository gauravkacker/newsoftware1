// ============================================
// Visit API Route
// Doctor Panel - Visit Management
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { doctorVisitDb } from '@/lib/db/doctor-panel';
import type { DoctorVisit } from '@/lib/db/schema';

// GET - Retrieve visits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('id');
    const patientId = searchParams.get('patientId');

    if (visitId) {
      const visit = doctorVisitDb.getById(visitId);
      if (!visit) {
        return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      }
      return NextResponse.json(visit);
    }

    if (patientId) {
      const visits = doctorVisitDb.getByPatient(patientId);
      return NextResponse.json(visits);
    }

    // Return all visits if no filters
    const visits = doctorVisitDb.getAll();
    return NextResponse.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
  }
}

// POST - Create new visit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newVisit = doctorVisitDb.create({
      patientId: body.patientId,
      visitDate: new Date(body.visitDate || Date.now()),
      visitNumber: body.visitNumber || 1,
      tokenNumber: body.tokenNumber,
      chiefComplaint: body.chiefComplaint,
      caseText: body.caseText,
      diagnosis: body.diagnosis,
      advice: body.advice,
      testsRequired: body.testsRequired,
      nextVisit: body.nextVisit ? new Date(body.nextVisit) : undefined,
      prognosis: body.prognosis,
      remarksToFrontdesk: body.remarksToFrontdesk,
      status: body.status || 'active',
    });

    return NextResponse.json(newVisit, { status: 201 });
  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 });
  }
}

// PUT - Update visit
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('id');

    if (!visitId) {
      return NextResponse.json({ error: 'Visit ID required' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Partial<DoctorVisit> = {};

    if (body.chiefComplaint !== undefined) updates.chiefComplaint = body.chiefComplaint;
    if (body.caseText !== undefined) updates.caseText = body.caseText;
    if (body.diagnosis !== undefined) updates.diagnosis = body.diagnosis;
    if (body.advice !== undefined) updates.advice = body.advice;
    if (body.testsRequired !== undefined) updates.testsRequired = body.testsRequired;
    if (body.nextVisit !== undefined) updates.nextVisit = new Date(body.nextVisit);
    if (body.prognosis !== undefined) updates.prognosis = body.prognosis;
    if (body.remarksToFrontdesk !== undefined) updates.remarksToFrontdesk = body.remarksToFrontdesk;
    if (body.status !== undefined) updates.status = body.status;
    if (body.tokenNumber !== undefined) updates.tokenNumber = body.tokenNumber;

    const updated = doctorVisitDb.update(visitId, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating visit:', error);
    return NextResponse.json({ error: 'Failed to update visit' }, { status: 500 });
  }
}

// DELETE - Delete visit
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('id');

    if (!visitId) {
      return NextResponse.json({ error: 'Visit ID required' }, { status: 400 });
    }

    const deleted = doctorVisitDb.delete(visitId);

    if (!deleted) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting visit:', error);
    return NextResponse.json({ error: 'Failed to delete visit' }, { status: 500 });
  }
}
