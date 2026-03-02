"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { patientDb, feeHistoryDb, appointmentDb } from '@/lib/db/database';
import { doctorPrescriptionDb, doctorVisitDb, doctorSettingsDb, pharmacyQueueDb } from '@/lib/db/doctor-panel';
import type { Patient } from '@/types';
import type { DoctorPrescription, DoctorVisit } from '@/lib/db/schema';
import { generatePrescriptionHTML } from '@/lib/prescription-formatter';

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  registrationNumber: string;
  mobileNumber: string;
  age?: number;
  sex?: string;
  dateOfBirth?: string;
}

interface PrescriptionWithVisit {
  prescription: DoctorPrescription;
  visit: DoctorVisit;
  prescriptionDate: Date;
  feeAmount?: number;
  feeStatus?: string;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default function PrescriptionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientInfo[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionWithVisit[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [lastFeeInfo, setLastFeeInfo] = useState<{
    date: string;
    amount: number;
    daysAgo: number;
    status: string;
  } | null>(null);
  const [showPrescriptionView, setShowPrescriptionView] = useState(false);
  const [viewingPrescription, setViewingPrescription] = useState<PrescriptionWithVisit | null>(null);
  const [prescriptionSettings, setPrescriptionSettings] = useState<any>(null);
  const [showEditPrescriptionModal, setShowEditPrescriptionModal] = useState(false);
  const [editingPrescriptions, setEditingPrescriptions] = useState<DoctorPrescription[]>([]);
  const [editingVisit, setEditingVisit] = useState<DoctorVisit | null>(null);
  const [selectedFeeType, setSelectedFeeType] = useState<string>('Self Repeat by P/T');
  const [selectedTag, setSelectedTag] = useState<string>('self-repeat'); // Visual tag for the prescription

  // Load prescription settings
  useEffect(() => {
    try {
      const raw = doctorSettingsDb.get('prescriptionSettings');
      if (raw) {
        const parsed = JSON.parse(raw as string);
        setPrescriptionSettings(parsed);
      }
    } catch {}
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedSearchIndex(-1);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const results = (patientDb.search(query) as Patient[]).map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      registrationNumber: p.registrationNumber,
      mobileNumber: p.mobileNumber,
      age: p.age,
      sex: p.gender,
      dateOfBirth: p.dateOfBirth
    }));
    setSearchResults(results.slice(0, 10));
  };

  // Handle keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSearchIndex >= 0 && selectedSearchIndex < searchResults.length) {
        handleSelectPatient(searchResults[selectedSearchIndex]);
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
      setSelectedSearchIndex(-1);
    }
  };

  // Handle patient selection
  const handleSelectPatient = (patient: PatientInfo) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setSearchResults([]);
    loadPatientPrescriptions(patient);
    loadLastFeeInfo(patient);
  };

  // Load patient prescriptions
  const loadPatientPrescriptions = (patient: PatientInfo) => {
    const allPrescriptions = doctorPrescriptionDb.getByPatient(patient.id);
    const allVisits = doctorVisitDb.getByPatient(patient.id);
    
    // Group prescriptions by visit
    const prescriptionsByVisit = new Map<string, DoctorPrescription[]>();
    allPrescriptions.forEach((rx) => {
      if (!prescriptionsByVisit.has(rx.visitId)) {
        prescriptionsByVisit.set(rx.visitId, []);
      }
      prescriptionsByVisit.get(rx.visitId)!.push(rx);
    });

    // Create prescription entries with visit info
    const prescriptionList: PrescriptionWithVisit[] = [];
    allVisits.forEach((visit) => {
      const visitPrescriptions = prescriptionsByVisit.get(visit.id) || [];
      if (visitPrescriptions.length > 0) {
        // Get fee info for this visit
        const feeRecords = (feeHistoryDb.getAll() as any[]).filter(
          (f) => f.patientId === patient.id && f.visitId === visit.id
        );
        const feeRecord = feeRecords.length > 0 ? feeRecords[0] : null;

        visitPrescriptions.forEach((rx) => {
          prescriptionList.push({
            prescription: rx,
            visit,
            prescriptionDate: visit.visitDate instanceof Date ? visit.visitDate : new Date(visit.visitDate),
            feeAmount: feeRecord?.amount,
            feeStatus: feeRecord?.paymentStatus || 'pending'
          });
        });
      }
    });

    // Sort by date (newest first)
    prescriptionList.sort((a, b) => b.prescriptionDate.getTime() - a.prescriptionDate.getTime());
    setPrescriptions(prescriptionList);
  };

  // Load last fee info
  const loadLastFeeInfo = (patient: PatientInfo) => {
    const allFees = (feeHistoryDb.getAll() as any[]).filter((f) => f.patientId === patient.id);
    if (allFees.length === 0) {
      setLastFeeInfo(null);
      return;
    }

    // Filter fees with amount > 0 only
    const paidFees = allFees.filter((f) => f.amount > 0);
    if (paidFees.length === 0) {
      setLastFeeInfo(null);
      return;
    }

    const sortedFees = paidFees.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date);
      const dateB = new Date(b.createdAt || b.date);
      return dateB.getTime() - dateA.getTime();
    });

    const lastFee = sortedFees[0];
    const feeDate = new Date(lastFee.createdAt || lastFee.date);
    const today = new Date();
    const daysAgo = Math.floor((today.getTime() - feeDate.getTime()) / (1000 * 60 * 60 * 24));

    setLastFeeInfo({
      date: formatDate(feeDate),
      amount: lastFee.amount,
      daysAgo,
      status: lastFee.paymentStatus || 'pending'
    });
  };

  // View prescription
  const handleViewPrescription = (item: PrescriptionWithVisit) => {
    setViewingPrescription(item);
    setShowPrescriptionView(true);
  };

  // Print prescription
  const handlePrintPrescription = (item: PrescriptionWithVisit) => {
    if (!selectedPatient) return;

    const visit = item.visit;
    const visitPrescriptions = doctorPrescriptionDb.getByVisit(visit.id);
    const doctorName = 'Dr. [Doctor Name]'; // You can fetch this from settings

    const prescriptionHTML = generatePrescriptionHTML(
      selectedPatient,
      visitPrescriptions,
      visit,
      doctorName
    );

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(prescriptionHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Download as PDF (using print to PDF)
  const handleDownloadPDF = (item: PrescriptionWithVisit) => {
    handlePrintPrescription(item);
    // User will use browser's "Save as PDF" option
  };

  // Share on WhatsApp
  const handleShareWhatsApp = (item: PrescriptionWithVisit) => {
    if (!selectedPatient) return;

    const visit = item.visit;
    const visitPrescriptions = doctorPrescriptionDb.getByVisit(visit.id);
    
    let message = `*Prescription for ${selectedPatient.firstName} ${selectedPatient.lastName}*\n`;
    message += `Reg No: ${selectedPatient.registrationNumber}\n`;
    message += `Date: ${formatDate(visit.visitDate)}\n\n`;
    message += `*℞ Medicines:*\n`;
    
    visitPrescriptions.forEach((rx, idx) => {
      message += `${idx + 1}. ${rx.medicine}${rx.potency ? ` ${rx.potency}` : ''}\n`;
      if (rx.quantity) message += `   Qty: ${rx.quantity}`;
      if (rx.dosePattern) message += ` | Dose: ${rx.dosePattern}`;
      if (rx.frequency) message += ` | ${rx.frequency}`;
      if (rx.duration) message += ` | ${rx.duration}`;
      message += `\n`;
    });

    if (visit.advice) {
      message += `\n*Advice:* ${visit.advice}\n`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // Send to Pharmacy
  const handleSendToPharmacy = (item: PrescriptionWithVisit) => {
    if (!selectedPatient) return;

    const visit = item.visit;
    const visitPrescriptions = doctorPrescriptionDb.getByVisit(visit.id);
    
    if (visitPrescriptions.length === 0) {
      alert('No prescriptions found for this visit');
      return;
    }

    // Open edit modal with prescriptions and default fee type
    setEditingVisit(visit);
    setEditingPrescriptions([...visitPrescriptions]);
    setSelectedFeeType('Self Repeat by P/T'); // Default to self-repeat
    setSelectedTag('self-repeat'); // Default tag
    setShowEditPrescriptionModal(true);
  };

  // Confirm and send to pharmacy after editing
  const handleConfirmSendToPharmacy = () => {
    if (!selectedPatient || !editingVisit) return;

    // Validate fee type is selected
    if (!selectedFeeType) {
      alert('Please select a fee type before sending to pharmacy');
      return;
    }

    // Create a NEW visit for today with self-repeat flag and fee type
    const newVisit = doctorVisitDb.create({
      patientId: selectedPatient.id,
      visitDate: new Date(), // Today's date
      visitNumber: editingVisit.visitNumber,
      chiefComplaint: editingVisit.chiefComplaint,
      caseText: editingVisit.caseText,
      diagnosis: editingVisit.diagnosis,
      prognosis: editingVisit.prognosis,
      advice: editingVisit.advice,
      nextVisit: editingVisit.nextVisit,
      testsRequired: editingVisit.testsRequired,
      remarksToFrontdesk: `FEE_TYPE:${selectedFeeType}`, // Store fee type for billing
      bp: editingVisit.bp,
      pulse: editingVisit.pulse,
      tempF: editingVisit.tempF,
      weightKg: editingVisit.weightKg,
      status: 'completed',
      isSelfRepeat: selectedFeeType === 'Self Repeat by P/T',
      selfRepeatDate: new Date(),
    });

    // Create prescriptions for the new visit
    const newPrescriptionIds: string[] = [];
    editingPrescriptions.forEach((rx, index) => {
      const newRx = doctorPrescriptionDb.create({
        visitId: newVisit.id,
        patientId: selectedPatient.id,
        medicine: rx.medicine,
        potency: rx.potency,
        doseForm: rx.doseForm,
        quantity: rx.quantity,
        dosePattern: rx.dosePattern,
        frequency: rx.frequency,
        duration: rx.duration,
        instructions: rx.instructions,
        isCombination: rx.isCombination,
        combinationContent: rx.combinationContent,
        rowOrder: index,
      });
      newPrescriptionIds.push(newRx.id);
    });

    // Send to pharmacy with the new visit and tag
    pharmacyQueueDb.create({
      visitId: newVisit.id,
      patientId: selectedPatient.id,
      appointmentId: undefined,
      prescriptionIds: newPrescriptionIds,
      status: 'pending',
      priority: false,
      source: selectedTag, // Use the selected tag (self-repeat, regular, etc.)
    } as any);

    setShowEditPrescriptionModal(false);
    setEditingVisit(null);
    setEditingPrescriptions([]);
    
    alert('Prescription sent to pharmacy successfully!');
    loadPatientPrescriptions(selectedPatient);
  };

  // Handle prescription editing in modal
  const handleDeletePrescription = (index: number) => {
    const updated = [...editingPrescriptions];
    updated.splice(index, 1);
    setEditingPrescriptions(updated);
  };

  const handleAddPrescription = () => {
    if (!editingVisit || !selectedPatient) return;
    
    const newRx = {
      id: `temp-${Date.now()}`,
      visitId: editingVisit.id,
      patientId: selectedPatient.id,
      medicine: '',
      potency: '',
      doseForm: '',
      quantity: '',
      dosePattern: '',
      frequency: '',
      duration: '',
      instructions: '',
      isCombination: false,
      combinationContent: '',
      rowOrder: editingPrescriptions.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DoctorPrescription;
    
    setEditingPrescriptions([...editingPrescriptions, newRx]);
  };

  const handleUpdatePrescription = (index: number, field: string, value: any) => {
    const updated = [...editingPrescriptions];
    (updated[index] as any)[field] = value;
    setEditingPrescriptions(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">Prescriptions</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage patient prescriptions</p>
        </div>
        
        <main className="p-6">
          {/* Search Section */}
          <Card className="mb-6">
            <div className="p-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    placeholder="Search patient by name, mobile, or registration number..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((patient, index) => {
                        const age = patient.age || (patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null);
                        return (
                          <div
                            key={patient.id}
                            className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                              index === selectedSearchIndex ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleSelectPatient(patient)}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              Reg: {patient.registrationNumber} • Mobile: {patient.mobileNumber}
                              {age && ` • Age: ${age} yrs`}
                              {patient.sex && ` • ${patient.sex}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => {
                    if (selectedPatient) {
                      loadPatientPrescriptions(selectedPatient);
                    }
                  }}
                  disabled={!selectedPatient}
                >
                  Show Prescriptions
                </Button>
              </div>
            </div>
          </Card>

          {/* Patient Info */}
          {selectedPatient && (
            <Card className="mb-6">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Name</div>
                    <div className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Age</div>
                    <div className="font-medium">
                      {selectedPatient.age || (selectedPatient.dateOfBirth ? calculateAge(selectedPatient.dateOfBirth) : 'N/A')} yrs
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Sex</div>
                    <div className="font-medium">{selectedPatient.sex || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Reg No</div>
                    <div className="font-medium">{selectedPatient.registrationNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Mobile</div>
                    <div className="font-medium">{selectedPatient.mobileNumber}</div>
                  </div>
                  {lastFeeInfo && (
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">Last Fee Paid</div>
                      <div className="font-medium">
                        {lastFeeInfo.date} - {formatCurrency(lastFeeInfo.amount)} - {lastFeeInfo.daysAgo} days ago
                        <Badge 
                          variant={lastFeeInfo.status === 'paid' ? 'success' : 'warning'} 
                          size="sm" 
                          className="ml-2"
                        >
                          {lastFeeInfo.status}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Prescriptions List */}
          {selectedPatient && prescriptions.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Prescriptions ({prescriptions.length})
                </h3>
                <div className="space-y-4">
                  {prescriptions.map((item, index) => {
                    const visit = item.visit;
                    const visitPrescriptions = doctorPrescriptionDb.getByVisit(visit.id);
                    
                    return (
                      <div key={`${visit.id}-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              Visit #{visit.visitNumber} - {formatDate(item.prescriptionDate)}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {visitPrescriptions.length} medicine(s) prescribed
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.feeAmount !== undefined && (
                              <div className="text-right">
                                <div className="text-sm font-medium">{formatCurrency(item.feeAmount)}</div>
                                <Badge 
                                  variant={item.feeStatus === 'paid' ? 'success' : 'warning'} 
                                  size="sm"
                                >
                                  {item.feeStatus}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Medicine preview */}
                        <div className="mb-3 text-sm text-gray-600">
                          {visitPrescriptions.slice(0, 3).map((rx, idx) => (
                            <div key={rx.id}>
                              • {rx.medicine}{rx.potency ? ` ${rx.potency}` : ''}
                            </div>
                          ))}
                          {visitPrescriptions.length > 3 && (
                            <div className="text-gray-400">+ {visitPrescriptions.length - 3} more...</div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSendToPharmacy(item)}
                          >
                            Send to Pharmacy
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewPrescription(item)}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePrintPrescription(item)}
                          >
                            Print
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDownloadPDF(item)}
                          >
                            Download PDF
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleShareWhatsApp(item)}
                          >
                            Share WhatsApp
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* No prescriptions message */}
          {selectedPatient && prescriptions.length === 0 && (
            <Card>
              <div className="p-12 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg">No prescriptions found for this patient</p>
              </div>
            </Card>
          )}

          {/* Empty state */}
          {!selectedPatient && (
            <Card>
              <div className="p-12 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg">Search for a patient to view their prescriptions</p>
              </div>
            </Card>
          )}
        </main>
      </div>

      {/* Prescription View Modal */}
      {showPrescriptionView && viewingPrescription && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-semibold">Prescription Details</h3>
              <button
                onClick={() => setShowPrescriptionView(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Patient info */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Patient</div>
                    <div className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Reg No</div>
                    <div className="font-medium">{selectedPatient.registrationNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Age / Sex</div>
                    <div className="font-medium">
                      {selectedPatient.age || (selectedPatient.dateOfBirth ? calculateAge(selectedPatient.dateOfBirth) : 'N/A')} yrs / {selectedPatient.sex || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="font-medium">{formatDate(viewingPrescription.prescriptionDate)}</div>
                  </div>
                </div>
              </div>

              {/* Prescriptions */}
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-4">℞ Medicines</h4>
                <div className="space-y-4">
                  {doctorPrescriptionDb.getByVisit(viewingPrescription.visit.id).map((rx, idx) => (
                    <div key={rx.id} className="border-l-4 border-indigo-500 pl-4 py-2 bg-gray-50 rounded">
                      <div className="font-medium text-gray-900">
                        {idx + 1}. {rx.medicine}{rx.potency ? ` ${rx.potency}` : ''}
                      </div>
                      {rx.isCombination && rx.combinationContent && (
                        <div className="text-sm text-gray-500 mt-1">{rx.combinationContent}</div>
                      )}
                      <div className="text-sm text-gray-600 mt-2">
                        {rx.quantity && `Quantity: ${rx.quantity}`}
                        {rx.doseForm && ` | Form: ${rx.doseForm}`}
                        {rx.dosePattern && ` | Dose: ${rx.dosePattern}`}
                        {rx.frequency && ` | Frequency: ${rx.frequency}`}
                        {rx.duration && ` | Duration: ${rx.duration}`}
                      </div>
                      {rx.instructions && (
                        <div className="text-sm text-gray-500 italic mt-1">
                          Instructions: {rx.instructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional info */}
              {viewingPrescription.visit.caseText && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Case Notes</h4>
                  <div className="text-gray-700">{viewingPrescription.visit.caseText}</div>
                </div>
              )}
              {viewingPrescription.visit.advice && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Advice</h4>
                  <div className="text-gray-700">{viewingPrescription.visit.advice}</div>
                </div>
              )}
              {viewingPrescription.visit.nextVisit && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Next Visit</h4>
                  <div className="text-gray-700">{formatDate(viewingPrescription.visit.nextVisit)}</div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPrescriptionView(false)}>
                Close
              </Button>
              <Button onClick={() => handlePrintPrescription(viewingPrescription)}>
                Print
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prescription Modal for Self-Repeat */}
      {showEditPrescriptionModal && editingVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Send Prescription to Pharmacy</h2>
              <p className="text-sm text-gray-500 mt-1">
                Review and edit prescription before sending to pharmacy. This will create a new visit for today.
              </p>
            </div>

            <div className="p-6">
              {/* Tag Selector with Icons - MANDATORY */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Prescription Tag <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTag('self-repeat');
                      setSelectedFeeType('Self Repeat by P/T');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTag === 'self-repeat'
                        ? 'border-orange-500 bg-orange-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🔄</div>
                    <div className="font-semibold text-sm">Self Repeat</div>
                    <div className="text-xs text-gray-600">by Patient</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTag('follow-up');
                      setSelectedFeeType('Follow Up');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTag === 'follow-up'
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">👤</div>
                    <div className="font-semibold text-sm">Follow Up</div>
                    <div className="text-xs text-gray-600">Regular visit</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTag('emergency');
                      setSelectedFeeType('Emergency');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTag === 'emergency'
                        ? 'border-red-500 bg-red-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-red-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🚨</div>
                    <div className="font-semibold text-sm">Emergency</div>
                    <div className="text-xs text-gray-600">Urgent case</div>
                  </button>
                </div>
              </div>

              {/* Fee Type Selector */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Fee Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedFeeType}
                  onChange={(e) => setSelectedFeeType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Self Repeat by P/T">Self Repeat by P/T (₹0 - Editable)</option>
                  <option value="Consultation">Consultation (₹300)</option>
                  <option value="Follow Up">Follow Up (₹300)</option>
                  <option value="New Patient">New Patient (₹500)</option>
                  <option value="Emergency">Emergency</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  This fee type will be used in the billing module. Self Repeat starts with ₹0 and can be edited.
                </p>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Medicine</th>
                    <th className="pb-3 font-medium w-20">Potency</th>
                    <th className="pb-3 font-medium w-24">Quantity</th>
                    <th className="pb-3 font-medium w-24">Dose Form</th>
                    <th className="pb-3 font-medium w-24">Pattern</th>
                    <th className="pb-3 font-medium w-24">Frequency</th>
                    <th className="pb-3 font-medium w-28">Duration</th>
                    <th className="pb-3 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {editingPrescriptions.map((rx, index) => (
                    <tr key={index} className="border-b border-gray-50">
                      <td className="py-2">
                        <Input
                          value={rx.medicine}
                          onChange={(e) => handleUpdatePrescription(index, 'medicine', e.target.value)}
                          placeholder="Medicine name"
                          className="w-full"
                        />
                        {rx.isCombination && rx.combinationContent && (
                          <div className="mt-1 pt-1 border-t border-purple-200 text-xs text-gray-500">
                            {rx.combinationContent}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.potency || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'potency', e.target.value)}
                          placeholder="200"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.quantity || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'quantity', e.target.value)}
                          placeholder="2dr"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.doseForm || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'doseForm', e.target.value)}
                          placeholder="Pills"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.dosePattern || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'dosePattern', e.target.value)}
                          placeholder="1-0-1"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.frequency || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'frequency', e.target.value)}
                          placeholder="BD"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          value={rx.duration || ''}
                          onChange={(e) => handleUpdatePrescription(index, 'duration', e.target.value)}
                          placeholder="7 days"
                          className="w-full"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <button
                          onClick={() => handleDeletePrescription(index)}
                          className="text-red-600 hover:text-red-700 p-2"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Button
                variant="secondary"
                onClick={handleAddPrescription}
                className="mt-4"
              >
                + Add Medicine
              </Button>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditPrescriptionModal(false);
                  setEditingVisit(null);
                  setEditingPrescriptions([]);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmSendToPharmacy}>
                Send to Pharmacy
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
