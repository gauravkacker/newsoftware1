"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { pharmacyQueueDb, doctorPrescriptionDb, doctorVisitDb } from '@/lib/db/doctor-panel';
import { patientDb, appointmentDb, billingQueueDb } from '@/lib/db/database';
import type { PharmacyQueueItem, DoctorPrescription, DoctorVisit } from '@/lib/db/schema';

// Types
interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  registrationNumber: string;
  age?: number;
  sex?: string;
}

interface PharmacyQueueItemWithDetails extends PharmacyQueueItem {
  patient?: PatientInfo;
  visit?: DoctorVisit;
  prescriptions?: DoctorPrescription[];
  hasUpdates?: boolean; // Track if doctor made changes
}

type TabType = 'active' | 'prepared';

// Generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function PharmacyPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [queueItems, setQueueItems] = useState<PharmacyQueueItemWithDetails[]>([]);
  const [preparedItems, setPreparedItems] = useState<PharmacyQueueItemWithDetails[]>([]);
  const [selectedItem, setSelectedItem] = useState<PharmacyQueueItemWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const previousPrescriptionIds = useRef<Map<string, string>>(new Map());
  
  // Load queue data
  const loadQueue = useCallback(() => {
    setIsLoading(true);
    
    // Get all items from pharmacy queue
    const allItems = pharmacyQueueDb.getAll() as PharmacyQueueItem[];
    
    // Separate active and prepared items
    const activeItems = allItems.filter(
      (item) => item.status === 'pending' || item.status === 'preparing'
    );
    const preparedItemsList = allItems.filter(
      (item) => item.status === 'prepared'
    );
    
    // Sort: priority first, then by creation time (oldest first)
    const sortItems = <T extends PharmacyQueueItem>(items: T[]): T[] => {
      return items.sort((a, b) => {
        // Priority patients first
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        
        // Oldest first
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      });
    };
    
    const sortedActiveItems = sortItems(activeItems);
    const sortedPreparedItems = sortItems(preparedItemsList);
    
    // Enrich with patient and prescription details
    const enrichItems = (items: PharmacyQueueItem[]): PharmacyQueueItemWithDetails[] => {
      return items.map((item) => {
        // Get patient info
        const patient = patientDb.getById(item.patientId) as PatientInfo | undefined;
        
        // Get visit details
        const visit = doctorVisitDb.getById(item.visitId);
        
        // Get prescriptions for this visit
        const prescriptions = doctorPrescriptionDb.getByVisit(item.visitId);
        
        // Check if there are updates from doctor (compare prescription IDs/content)
        const currentPrescriptionIds = prescriptions.map(p => p.id).join(',');
        const previousIds = previousPrescriptionIds.current.get(item.id);
        const hasUpdates = previousIds !== undefined && previousIds !== currentPrescriptionIds;
        
        // Update the ref
        previousPrescriptionIds.current.set(item.id, currentPrescriptionIds);
        
        return {
          ...item,
          patient,
          visit: visit || undefined,
          prescriptions,
          hasUpdates,
        };
      });
    };
    
    const enrichedActiveItems = enrichItems(sortedActiveItems);
    const enrichedPreparedItems = enrichItems(sortedPreparedItems);
    
    // Check for new notifications
    const itemsWithUpdates = enrichedActiveItems.filter(item => item.hasUpdates);
    if (itemsWithUpdates.length > 0 && lastUpdateTime > 0) {
      setNotification(`${itemsWithUpdates.length} prescription(s) updated by doctor`);
      setTimeout(() => setNotification(null), 5000);
    }
    
    setQueueItems(enrichedActiveItems);
    setPreparedItems(enrichedPreparedItems);
    setIsLoading(false);
  }, [lastUpdateTime]);

  // Initial load and polling
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQueue();
    
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(() => {
      loadQueue();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Get patient name
  const getPatientName = (patientId: string): string => {
    const patient = patientDb.getById(patientId) as PatientInfo | undefined;
    if (patient) {
      return `${patient.firstName} ${patient.lastName}`;
    }
    return 'Unknown';
  };

  // Get patient registration number
  const getPatientRegNumber = (patientId: string): string => {
    const patient = patientDb.getById(patientId) as PatientInfo | undefined;
    return patient?.registrationNumber || '';
  };

  // Get patient mobile
  const getPatientMobile = (patientId: string): string => {
    const patient = patientDb.getById(patientId) as PatientInfo | undefined;
    return patient?.mobileNumber || '';
  };

  // Get patient age/sex
  const getPatientDetails = (patientId: string): string => {
    const patient = patientDb.getById(patientId) as PatientInfo | undefined;
    if (patient) {
      const parts = [];
      if (patient.age) parts.push(`${patient.age} yrs`);
      if (patient.sex) parts.push(patient.sex);
      return parts.join(', ');
    }
    return '';
  };

  // Handle status change to preparing
  const handleStartPreparing = (itemId: string) => {
    pharmacyQueueDb.update(itemId, { status: 'preparing' });
    loadQueue();
    
    // Update selected item if it's the one being updated
    if (selectedItem?.id === itemId) {
      const updated = queueItems.find(q => q.id === itemId);
      if (updated) {
        setSelectedItem({ ...updated, status: 'preparing' });
      }
    }
  };

  // Handle status change to prepared
  const handleMarkPrepared = (itemId: string) => {
    // Get the pharmacy queue item to find the patient
    const pharmacyItem = pharmacyQueueDb.getById(itemId);
    
    pharmacyQueueDb.markPrepared(itemId, 'pharmacy');
    
    // Update appointment status to medicines-prepared and send to billing
    if (pharmacyItem) {
      const patientAppointments = appointmentDb.getByPatient(pharmacyItem.patientId);
      // Find today's appointment that is in 'completed' status (after doctor visit)
      const today = new Date().toISOString().split('T')[0];
      const relevantAppointment = patientAppointments.find((apt) => {
        const typedApt = apt as { appointmentDate: Date; status: string };
        const aptDate = new Date(typedApt.appointmentDate).toISOString().split('T')[0];
        return aptDate === today && (typedApt.status === 'completed' || typedApt.status === 'in-progress');
      });
      
      if (relevantAppointment) {
        appointmentDb.update((relevantAppointment as { id: string }).id, { status: 'medicines-prepared' });
      }
      
      // Check if billing item already exists for this visit
      const existingBilling = (billingQueueDb.getAll() as any[]).find(
        (b) => b.visitId === pharmacyItem.visitId
      );
      
      if (!existingBilling) {
        // Get patient and visit info for billing
        const patient = patientDb.getById(pharmacyItem.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(pharmacyItem.visitId);
        
        // Get fee from appointment (the actual fee selected during booking)
        let feeAmount = 300; // Default follow-up fee
        let feeType = 'Follow Up';
        
        // Try to get fee from the appointment first
        if (relevantAppointment) {
          const apt = relevantAppointment as { feeAmount?: number; feeType?: string; feeStatus?: string };
          if (apt.feeAmount !== undefined && apt.feeAmount !== null) {
            feeAmount = apt.feeAmount;
          }
          if (apt.feeType) {
            feeType = apt.feeType;
          }
        } else if (visit && visit.visitNumber === 1) {
          // Fallback to visit type based fee only if no appointment fee
          feeAmount = 500;
          feeType = 'New Patient';
        }
        
        // Create billing queue item
        billingQueueDb.create({
          visitId: pharmacyItem.visitId,
          patientId: pharmacyItem.patientId,
          appointmentId: pharmacyItem.appointmentId,
          prescriptionIds: pharmacyItem.prescriptionIds || [],
          status: 'pending',
          feeAmount,
          feeType,
          netAmount: feeAmount,
          paymentStatus: 'pending'
        });
      }
    }
    
    loadQueue();
    
    // Clear selection if the prepared item was selected
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  // Handle reopen - bring prepared item back to active queue
  const handleReopen = (itemId: string) => {
    // Get the pharmacy queue item to find the patient
    const pharmacyItem = pharmacyQueueDb.getById(itemId);
    
    pharmacyQueueDb.update(itemId, { status: 'pending' });
    
    // Update appointment status back to completed
    if (pharmacyItem) {
      const patientAppointments = appointmentDb.getByPatient(pharmacyItem.patientId);
      const today = new Date().toISOString().split('T')[0];
      const relevantAppointment = patientAppointments.find((apt) => {
        const typedApt = apt as { appointmentDate: Date; status: string };
        const aptDate = new Date(typedApt.appointmentDate).toISOString().split('T')[0];
        return aptDate === today && typedApt.status === 'medicines-prepared';
      });
      
      if (relevantAppointment) {
        appointmentDb.update((relevantAppointment as { id: string }).id, { status: 'completed' });
      }
    }
    
    loadQueue();
    
    // Update selected item if it's the one being reopened
    if (selectedItem?.id === itemId) {
      const updated = preparedItems.find(q => q.id === itemId);
      if (updated) {
        setSelectedItem({ ...updated, status: 'pending' });
      }
    }
  };

  // Handle stop prescription
  const handleStop = (itemId: string, reason: string) => {
    pharmacyQueueDb.stop(itemId, reason);
    loadQueue();
    
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'preparing':
        return <Badge variant="info">Preparing</Badge>;
      case 'prepared':
        return <Badge variant="success">Prepared</Badge>;
      case 'delivered':
        return <Badge variant="default">Delivered</Badge>;
      case 'stopped':
        return <Badge variant="danger">Stopped</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // Count stats
  const pendingCount = queueItems.filter(q => q.status === 'pending').length;
  const preparingCount = queueItems.filter(q => q.status === 'preparing').length;
  const preparedCount = preparedItems.length;

  // Get current display items based on active tab
  const displayItems = activeTab === 'active' ? queueItems : preparedItems;

  if (isLoading && queueItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      {/* Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {notification}
        </div>
      )}
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Pharmacy Queue</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage prescriptions sent from doctor panel
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Auto-refresh: 5s
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Preparing</div>
              <div className="text-2xl font-bold text-blue-600">{preparingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Prepared</div>
              <div className="text-2xl font-bold text-green-600">{preparedCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">With Updates</div>
              <div className="text-2xl font-bold text-purple-600">
                {queueItems.filter(q => q.hasUpdates).length}
              </div>
            </Card>
          </div>

          <div className="flex gap-6">
            {/* Queue List - 25% width */}
            <div className="w-1/4 min-w-[280px]">
              <Card className="overflow-hidden h-full">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => { setActiveTab('active'); setSelectedItem(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'active'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Active ({queueItems.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab('prepared'); setSelectedItem(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'prepared'
                        ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Prepared ({preparedCount})
                  </button>
                </div>
                
                {displayItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {activeTab === 'active' ? 'No active prescriptions' : 'No prepared prescriptions'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                    {displayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedItem?.id === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        } ${item.hasUpdates ? 'bg-purple-50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm truncate">
                                {getPatientName(item.patientId)}
                              </span>
                              {item.priority && (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                  PRIORITY
                                </span>
                              )}
                              {item.hasUpdates && (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                                  Updated
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {getPatientRegNumber(item.patientId)}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {item.prescriptions?.length || 0} medicine(s)
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-2">
                            {getStatusBadge(item.status)}
                            {activeTab === 'active' && item.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartPreparing(item.id);
                                }}
                                className="text-xs px-2 py-1"
                              >
                                Start
                              </Button>
                            )}
                            {activeTab === 'active' && item.status === 'preparing' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkPrepared(item.id);
                                }}
                                className="text-xs px-2 py-1"
                              >
                                Ready
                              </Button>
                            )}
                            {activeTab === 'prepared' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReopen(item.id);
                                }}
                                className="text-xs px-2 py-1"
                              >
                                Reopen
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Prescription Details - 75% width */}
            <div className="w-3/4 flex-1">
              <Card className="overflow-hidden h-full">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">Prescription Details</h2>
                  <p className="text-sm text-gray-500">
                    {selectedItem ? `${getPatientName(selectedItem.patientId)} - ${getPatientRegNumber(selectedItem.patientId)}` : 'Select a patient to view details'}
                  </p>
                </div>
                
                {!selectedItem ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Click on a patient to view their prescription
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Patient Info */}
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Patient Name</div>
                          <div className="font-semibold text-gray-900">
                            {getPatientName(selectedItem.patientId)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Reg. Number</div>
                          <div className="font-semibold text-gray-900">
                            {getPatientRegNumber(selectedItem.patientId)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Mobile</div>
                          <div className="font-semibold text-gray-900">
                            {getPatientMobile(selectedItem.patientId)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Age/Sex</div>
                          <div className="font-semibold text-gray-900">
                            {getPatientDetails(selectedItem.patientId)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visit Details */}
                    {selectedItem.visit && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Visit Information</h3>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {selectedItem.visit.chiefComplaint && (
                            <div>
                              <span className="text-xs text-gray-500">Chief Complaint:</span>
                              <div className="text-sm text-gray-900">{selectedItem.visit.chiefComplaint}</div>
                            </div>
                          )}
                          {selectedItem.visit.diagnosis && (
                            <div>
                              <span className="text-xs text-gray-500">Diagnosis:</span>
                              <div className="text-sm text-gray-900">{selectedItem.visit.diagnosis}</div>
                            </div>
                          )}
                          {selectedItem.visit.advice && (
                            <div>
                              <span className="text-xs text-gray-500">Advice:</span>
                              <div className="text-sm text-gray-900">{selectedItem.visit.advice}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Medicines */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Prescribed Medicines
                        {selectedItem.hasUpdates && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                            Updated by Doctor
                          </span>
                        )}
                      </h3>
                      {selectedItem.prescriptions && selectedItem.prescriptions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedItem.prescriptions.map((prescription, index) => (
                            <div key={prescription.id} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {index + 1}. {prescription.medicine}
                                    {prescription.potency && <span className="font-normal text-gray-600"> {prescription.potency}</span>}
                                  </div>
                                  {prescription.combinationName && (
                                    <div className="text-xs text-gray-500">
                                      Combination: {prescription.combinationName}
                                    </div>
                                  )}
                                  <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                                    {prescription.quantity && (
                                      <div>
                                        <span className="text-gray-500">Qty:</span>{' '}
                                        <span className="text-gray-900">{prescription.quantity}</span>
                                      </div>
                                    )}
                                    {prescription.doseForm && (
                                      <div>
                                        <span className="text-gray-500">Form:</span>{' '}
                                        <span className="text-gray-900">{prescription.doseForm}</span>
                                      </div>
                                    )}
                                    {prescription.dosePattern && (
                                      <div>
                                        <span className="text-gray-500">Pattern:</span>{' '}
                                        <span className="text-gray-900">{prescription.dosePattern}</span>
                                      </div>
                                    )}
                                    {prescription.frequency && (
                                      <div>
                                        <span className="text-gray-500">Frequency:</span>{' '}
                                        <span className="text-gray-900">{prescription.frequency}</span>
                                      </div>
                                    )}
                                    {prescription.duration && (
                                      <div>
                                        <span className="text-gray-500">Duration:</span>{' '}
                                        <span className="text-gray-900">{prescription.duration}</span>
                                      </div>
                                    )}
                                    {prescription.bottles && (
                                      <div>
                                        <span className="text-gray-500">Bottles:</span>{' '}
                                        <span className="text-gray-900">{prescription.bottles}</span>
                                      </div>
                                    )}
                                  </div>
                                  {prescription.instructions && (
                                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                                      <span className="font-medium">Instructions:</span> {prescription.instructions}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-4">
                          No medicines in this prescription
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-2">
                      {selectedItem.status === 'pending' && (
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => handleStartPreparing(selectedItem.id)}
                        >
                          Start Preparing Medicines
                        </Button>
                      )}
                      {selectedItem.status === 'preparing' && (
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => handleMarkPrepared(selectedItem.id)}
                        >
                          Mark as Prepared
                        </Button>
                      )}
                      {selectedItem.status === 'prepared' && (
                        <>
                          <div className="flex-1 text-center py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                            Medicines Prepared
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => handleReopen(selectedItem.id)}
                          >
                            Reopen
                          </Button>
                        </>
                      )}
                      {(selectedItem.status === 'pending' || selectedItem.status === 'preparing') && (
                        <Button
                          variant="danger"
                          onClick={() => {
                            const reason = prompt('Enter reason for stopping:');
                            if (reason) {
                              handleStop(selectedItem.id, reason);
                            }
                          }}
                        >
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
