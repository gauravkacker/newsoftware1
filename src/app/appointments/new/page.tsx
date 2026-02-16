"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { appointmentDb, patientDb, slotDb, feeHistoryDb, feeDb } from "@/lib/db/database";
import type { Appointment, Patient, Slot, FeeType, FeeHistoryEntry } from "@/types";

export default function NewAppointmentPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    slotId: "",
    time: "09:00",
    duration: 10,
    type: "follow-up" as const,
    visitMode: "in-person" as const,
    priority: "normal" as const,
    notes: "",
    tokenNumber: 0,
    // Fee handling
    feeTypeId: "",
    feeStatus: "pending" as const,
    feeAmount: 0,
    advancePaid: 0,
    paymentMode: "",
    feeExempt: false,
    feeExemptionReason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewTokenNumber, setPreviewTokenNumber] = useState<number>(0);
  const [bookedPatientIds, setBookedPatientIds] = useState<Set<string>>(new Set());
  const [lastFeeInfo, setLastFeeInfo] = useState<{
    date: string;
    amount: number;
    daysAgo: number;
  } | null>(null);

  const loadData = useCallback(() => {
    const allPatients = patientDb.getAll() as Patient[];
    setPatients(allPatients);
    
    const activeSlots = slotDb.getActive() as Slot[];
    setSlots(activeSlots);
    
    const activeFees = feeDb.getActive() as FeeType[];
    setFeeTypes(activeFees);
    
    if (activeSlots.length > 0) {
      setFormData((prev) => ({ ...prev, slotId: activeSlots[0].id }));
    }
  }, []);

  // Calculate recent patients (last 10 added)
  const recentPatients = patients
    .filter((p) => {
      const patient = p as Patient;
      // Skip if already booked
      if (bookedPatientIds.has(patient.id)) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  // Search patients - searches ALL patients when query exists
  const searchResults = searchQuery.trim()
    ? patients.filter((patient) => {
        const p = patient as { id: string; firstName: string; lastName: string; fullName: string; registrationNumber: string; mobileNumber: string };
        // Skip if already booked
        if (bookedPatientIds.has(p.id)) return false;
        
        const query = searchQuery.toLowerCase().trim();
        return (
          p.registrationNumber.toLowerCase().includes(query) ||
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          p.fullName.toLowerCase().includes(query) ||
          p.mobileNumber.includes(query)
        );
      })
    : [];

  // Display patients: recent when no search, search results when searching
  const displayPatients = searchQuery.trim() ? searchResults : recentPatients;

  // Calculate preview token number when date or slot changes
  useEffect(() => {
    if (formData.date && formData.slotId) {
      const existingAppointments = appointmentDb.getBySlot(new Date(formData.date), formData.slotId);
      const previewToken = (existingAppointments.length || 0) + 1;
      setPreviewTokenNumber(previewToken);
      // Always update token number when slot or date changes
      setFormData((prev) => ({
        ...prev,
        tokenNumber: previewToken,
      }));
    }
  }, [formData.date, formData.slotId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadData();
  }, [loadData]);

  // Handle URL params for patient auto-selection (from "Register & Book Appointment")
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const patientId = params.get('patientId');
      
      if (patientId && patients.length > 0) {
        // Find and select the patient
        const patient = patientDb.getById(patientId) as Patient | undefined;
        if (patient) {
          setSelectedPatient(patient);
          // Clear URL params to clean up
          window.history.replaceState({}, '', '/appointments/new');
        }
      }
    }
  }, [patients]); // Re-run when patients loaded to ensure we have the data

  // Auto-fill fee when appointment type changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (formData.feeExempt) return;
    
    // Map appointment type to fee type name
    const typeToFeeName: Record<string, string> = {
      'new': 'New Patient',
      'follow-up': 'Follow Up',
      'consultation': 'Follow Up',
      'emergency': 'New Patient',
    };
    
    const targetFeeName = typeToFeeName[formData.type] || 'Follow Up';
    const matchingFee = feeTypes.find(f => (f as FeeType).name === targetFeeName);
    
    if (matchingFee) {
      const fee = matchingFee as FeeType;
      setFormData((prev) => ({
        ...prev,
        feeTypeId: fee.id,
        feeAmount: fee.amount,
      }));
    }
  }, [formData.type, feeTypes, formData.feeExempt]);

  // Handle manual fee type selection
  const handleFeeTypeChange = (feeTypeId: string) => {
    const selectedFee = feeTypes.find(f => (f as FeeType).id === feeTypeId);
    if (selectedFee) {
      const fee = selectedFee as FeeType;
      setFormData((prev) => ({
        ...prev,
        feeTypeId: fee.id,
        feeAmount: fee.amount,
      }));
    }
  };

  // Fetch last fee info when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      const lastFee = feeHistoryDb.getLastByPatient(selectedPatient.id) as FeeHistoryEntry | null;
      if (lastFee) {
        const paidDate = new Date(lastFee.paidDate);
        const today = new Date();
        
        // Check if same day
        const isSameDay = 
          paidDate.getDate() === today.getDate() &&
          paidDate.getMonth() === today.getMonth() &&
          paidDate.getFullYear() === today.getFullYear();
        
        if (isSameDay) {
          setLastFeeInfo({
            date: paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            amount: lastFee.amount,
            daysAgo: 0, // 0 means today
          });
        } else {
          const diffTime = Math.abs(today.getTime() - paidDate.getTime());
          const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setLastFeeInfo({
            date: paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            amount: lastFee.amount,
            daysAgo: daysAgo,
          });
        }
      } else {
        setLastFeeInfo(null);
      }
    } else {
      setLastFeeInfo(null);
    }
  }, [selectedPatient]);

  const filteredPatients = displayPatients;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert("Please select a patient");
      return;
    }

    if (!formData.slotId) {
      alert("Please select a slot");
      return;
    }

    setIsSubmitting(true);

    // Get slot info
    const slot = slotDb.getById(formData.slotId) as Slot | undefined;
    
    // Get current user from localStorage
    let doctorId = "user-doctor";
    let doctorName = "Dr. Homeopathic";
    if (typeof window !== "undefined") {
      const currentUser = localStorage.getItem("currentUser");
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser);
          doctorId = user.id || doctorId;
          doctorName = user.name || doctorName;
        } catch {
          // Use defaults
        }
      }
    }

    // Get existing appointments for this slot to determine token number
    const existingAppointments = appointmentDb.getBySlot(new Date(formData.date), formData.slotId);
    const tokenNumber = (existingAppointments.length || 0) + 1;

    // Determine final fee status
    let finalFeeStatus: 'pending' | 'paid' | 'exempt' = formData.feeStatus;
    let finalFeeAmount = formData.feeAmount;
    
    if (formData.feeExempt) {
      finalFeeStatus = 'exempt';
      finalFeeAmount = 0;
    } else if (formData.advancePaid >= formData.feeAmount) {
      finalFeeStatus = 'paid';
    } else if (formData.advancePaid > 0) {
      finalFeeStatus = 'paid';
    }

    // Get selected fee type name
    const selectedFeeType = feeTypes.find(f => (f as FeeType).id === formData.feeTypeId);
    const feeTypeName = selectedFeeType ? (selectedFeeType as FeeType).name : 'Follow Up';

    // Create appointment
    const newAppointment = appointmentDb.create({
      patientId: selectedPatient.id,
      patientName: `${(selectedPatient as { firstName: string }).firstName} ${(selectedPatient as { lastName: string }).lastName}`,
      doctorId,
      appointmentDate: new Date(formData.date),
      appointmentTime: formData.time,
      visitMode: formData.visitMode,
      slotId: formData.slotId,
      slotName: slot?.name || "General",
      tokenNumber,
      duration: formData.duration,
      type: formData.type,
      status: "scheduled",
      priority: formData.priority,
      feeStatus: finalFeeStatus,
      feeAmount: finalFeeAmount,
      feeType: feeTypeName,
      notes: formData.notes,
      isWalkIn: false,
      reminderSent: false,
      feeExempt: formData.feeExempt,
      feeExemptionReason: formData.feeExemptionReason,
    } as unknown as Parameters<typeof appointmentDb.create>[0]);

    const aptId = newAppointment.id;

    // If advance payment made, record in fee history
    if (formData.advancePaid > 0 && !formData.feeExempt) {
      const appointmentType = formData.type as string;
      feeHistoryDb.create({
        patientId: selectedPatient.id,
        appointmentId: aptId,
        amount: formData.advancePaid,
        feeType: appointmentType === 'new' ? 'first-visit' : 'follow-up' as const,
        paymentMode: formData.paymentMode || 'cash',
        paidDate: new Date(),
        receiptId: `RCP-${Date.now()}`,
      });
    }

    // If fee exempt, record exemption
    if (formData.feeExempt) {
      // Log exemption in notes
      appointmentDb.update(aptId, {
        notes: `${formData.notes}\n[Fee Exempt: ${formData.feeExemptionReason}]`.trim(),
      });
    }

    router.push("/appointments");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/appointments" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
              <p className="text-sm text-gray-500">Schedule a new appointment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Patient</h2>
              
              {!selectedPatient ? (
                <>
                  <Input
                    placeholder="Search by name, registration number, or mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-4"
                  />
                  {searchQuery.trim() && (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {filteredPatients.map((patient) => {
                        const p = patient as { id: string; firstName: string; lastName: string; registrationNumber: string; mobileNumber: string };
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setSearchQuery("");
                            }}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              {p.firstName} {p.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {p.registrationNumber} • {p.mobileNumber}
                            </div>
                          </button>
                        );
                      })}
                      {filteredPatients.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No patients found</p>
                      )}
                    </div>
                  )}
                  {!searchQuery.trim() && (
                    <p className="text-gray-500 text-center py-4">Start typing to search for a patient</p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">
                        {(selectedPatient as { firstName: string }).firstName} {(selectedPatient as { lastName: string }).lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {(selectedPatient as { registrationNumber: string }).registrationNumber}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedPatient(null)}
                    >
                      Change
                    </Button>
                  </div>
                  
                  {/* Last Fee Info */}
                  {lastFeeInfo ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">
                          {lastFeeInfo.daysAgo === 0 
                            ? `Fee paid today: ${lastFeeInfo.amount} Rs`
                            : `Last fee paid: ${lastFeeInfo.date} - ${lastFeeInfo.amount} Rs - ${lastFeeInfo.daysAgo} day${lastFeeInfo.daysAgo === 1 ? '' : 's'} ago`
                          }
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">No payment history found</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Form Container with Side-by-Side Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Appointment Details */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Appointment Details</h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        min={new Date().toISOString().split("T")[0]}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Slot</label>
                      <select
                        value={formData.slotId}
                        onChange={(e) => setFormData({ ...formData, slotId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select slot</option>
                        {slots.map((slot) => {
                          const s = slot as Slot;
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.startTime} - {s.endTime})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <select
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="new">New Patient</option>
                        <option value="follow-up">Follow-up</option>
                        <option value="consultation">Consultation</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Token Number</label>
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 min-w-[60px] text-center">
                          <span className="text-xs text-blue-600 block">Preview</span>
                          <span className="text-xl font-bold text-blue-700">{previewTokenNumber}</span>
                        </div>
                        <Input
                          type="number"
                          value={formData.tokenNumber || ""}
                          onChange={(e) => setFormData({ ...formData, tokenNumber: parseInt(e.target.value) || 0 })}
                          min={1}
                          placeholder="Use preview or enter"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Visit Mode</label>
                      <select
                        value={formData.visitMode}
                        onChange={(e) => setFormData({ ...formData, visitMode: e.target.value as typeof formData.visitMode })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="in-person">In-Person</option>
                        <option value="tele">Teleconsultation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as typeof formData.priority })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="normal">Normal</option>
                        <option value="vip">VIP</option>
                        <option value="emergency">Emergency</option>
                        <option value="doctor-priority">Doctor Priority</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Any additional notes..."
                    />
                  </div>
                </Card>
              </div>

              {/* Right Column: Fee Payment */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Fee Payment</h2>
                  
                  {/* Fee Exemption Toggle */}
                  <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.feeExempt}
                        onChange={(e) => setFormData({ ...formData, feeExempt: e.target.checked, advancePaid: 0, feeAmount: 0, feeTypeId: "" })}
                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="font-medium text-gray-900">Exempt from Fee (Doctor Approval)</span>
                    </label>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                      Check this if the doctor has approved fee exemption for this patient
                    </p>
                  </div>

                  {!formData.feeExempt && (
                    <>
                      {/* Fee Type Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                        <select
                          value={formData.feeTypeId}
                          onChange={(e) => handleFeeTypeChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select fee type</option>
                          {feeTypes.map((fee) => {
                            const f = fee as FeeType;
                            return (
                              <option key={f.id} value={f.id}>
                                {f.name} - ₹{f.amount}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-sm text-gray-500 mt-1">
                          Fee amount auto-fills based on appointment type. You can change it here.
                        </p>
                      </div>

                      {/* Fee Amount */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</label>
                        <Input
                          type="number"
                          value={formData.feeAmount || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setFormData({ ...formData, feeAmount: 0 });
                            } else {
                              setFormData({ ...formData, feeAmount: parseInt(val) || 0 });
                            }
                          }}
                          min={0}
                          className="w-full"
                          placeholder="Enter or select fee amount"
                        />
                      </div>

                      {/* Advance Payment */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment (₹)</label>
                        <Input
                          type="number"
                          value={formData.advancePaid || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setFormData({ ...formData, advancePaid: 0 });
                            } else {
                              const advance = parseInt(val) || 0;
                              setFormData({ ...formData, advancePaid: Math.min(advance, formData.feeAmount) });
                            }
                          }}
                          min={0}
                          max={formData.feeAmount}
                          className="w-full"
                          placeholder="Enter advance amount"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Balance: ₹{(formData.feeAmount - formData.advancePaid).toFixed(0)} | 
                          {formData.advancePaid >= formData.feeAmount ? (
                            <span className="text-green-600 font-medium">Fully Paid</span>
                          ) : formData.advancePaid > 0 ? (
                            <span className="text-yellow-600 font-medium">Partial Payment</span>
                          ) : (
                            <span className="text-gray-500">Pay Later</span>
                          )}
                        </p>
                      </div>

                      {/* Payment Mode */}
                      {formData.advancePaid > 0 && (
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                          <select
                            value={formData.paymentMode}
                            onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select payment mode</option>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="upi">UPI</option>
                            <option value="netbanking">Net Banking</option>
                            <option value="cheque">Cheque</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Fee Exemption Reason */}
                  {formData.feeExempt && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exemption Reason</label>
                      <Input
                        value={formData.feeExemptionReason}
                        onChange={(e) => setFormData({ ...formData, feeExemptionReason: e.target.value })}
                        placeholder="Enter reason for fee exemption"
                        className="w-full"
                      />
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Sticky Submit Button */}
            <div className="sticky bottom-4 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-gray-200">
              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Booking..." : "Book Appointment"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => router.push("/appointments")}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
