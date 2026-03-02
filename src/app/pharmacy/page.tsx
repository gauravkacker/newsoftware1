"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { pharmacyQueueDb, doctorPrescriptionDb, doctorVisitDb, doctorSettingsDb } from '@/lib/db/doctor-panel';
import { patientDb, appointmentDb, billingQueueDb, db } from '@/lib/db/database';
import type { PharmacyQueueItem, DoctorPrescription, DoctorVisit } from '@/lib/db/schema';

// Helper to format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Helper to get today's date string (YYYY-MM-DD)
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Helper to check if a date is today
function isToday(date: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return today.getTime() === compareDate.getTime();
}

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

type TabType = 'active' | 'pending' | 'prepared';

// Generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function PharmacyPage() {
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [queueItems, setQueueItems] = useState<PharmacyQueueItemWithDetails[]>([]);
  const [allPendingItems, setAllPendingItems] = useState<PharmacyQueueItemWithDetails[]>([]);
  const [preparedItems, setPreparedItems] = useState<PharmacyQueueItemWithDetails[]>([]);
  const [selectedItem, setSelectedItem] = useState<PharmacyQueueItemWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString()); // Default to today
  const previousPrescriptionIds = useRef<Map<string, string>>(new Map());
  const [showDeleteDropdown, setShowDeleteDropdown] = useState<string | null>(null);
  const [showPrintLabelPopup, setShowPrintLabelPopup] = useState<{ prescriptionId: string; medicine: string; bottles: number } | null>(null);
  const [showPrintAllLabelsPopup, setShowPrintAllLabelsPopup] = useState(false);
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [hiddenPrescriptions, setHiddenPrescriptions] = useState<Set<string>>(new Set()); // Track patient-requested deletions
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown
      if (!target.closest('.delete-dropdown-container')) {
        setShowDeleteDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Load queue data
  const loadQueue = useCallback(() => {
    setIsLoading(true);
    
    // Get all items from pharmacy queue
    const allItems = pharmacyQueueDb.getAll() as PharmacyQueueItem[];
    
    // Filter out items for deleted patients
    const validItems = allItems.filter((item) => {
      const patient = patientDb.getById(item.patientId);
      return patient !== undefined && patient !== null;
    });
    
    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Filter by selected date - only show items from selected date in active tab
    const filteredByDate = validItems.filter((item) => {
      const itemDate = new Date(item.createdAt);
      itemDate.setHours(0, 0, 0, 0);
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const itemDateStr = itemDate.toISOString().split('T')[0];
      const filterDateStr = filterDate.toISOString().split('T')[0];
      
      // For active tab: only show items from selected date
      if (item.status === 'pending' || item.status === 'preparing') {
        return itemDateStr === filterDateStr;
      }
      
      // For prepared items, show based on preparedAt date (when they were prepared)
      if (item.status === 'prepared' && item.preparedAt) {
        const preparedDate = new Date(item.preparedAt);
        preparedDate.setHours(0, 0, 0, 0);
        const preparedDateStr = preparedDate.toISOString().split('T')[0];
        return preparedDateStr === filterDateStr;
      }
      
      // Fallback to createdAt if preparedAt is not set
      return itemDateStr === filterDateStr;
    });
    
    // Get all pending items (for pending tab) - regardless of date
    const allPendingItemsList = validItems.filter(
      (item) => item.status === 'pending' || item.status === 'preparing'
    );
    
    // Separate active and prepared items
    const activeItems = filteredByDate.filter(
      (item) => item.status === 'pending' || item.status === 'preparing'
    );
    const preparedItemsList = filteredByDate.filter(
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
    const sortedAllPendingItems = sortItems(allPendingItemsList);
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
    const enrichedAllPendingItems = enrichItems(sortedAllPendingItems);
    const enrichedPreparedItems = enrichItems(sortedPreparedItems);
    
    // Check for new notifications
    const itemsWithUpdates = enrichedActiveItems.filter(item => item.hasUpdates);
    if (itemsWithUpdates.length > 0 && lastUpdateTime > 0) {
      setNotification(`${itemsWithUpdates.length} prescription(s) updated by doctor`);
      setTimeout(() => setNotification(null), 5000);
    }
    
    setQueueItems(enrichedActiveItems);
    setAllPendingItems(enrichedAllPendingItems);
    setPreparedItems(enrichedPreparedItems);
    setIsLoading(false);
  }, [lastUpdateTime, selectedDate]);

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
  
  // Deep link: preselect item by visitId
  useEffect(() => {
    const visitId = searchParams.get('visitId');
    if (visitId) {
      const allItems = pharmacyQueueDb.getAll() as PharmacyQueueItem[];
      const match = allItems.find((q) => q.visitId === visitId);
      if (match) {
        const patient = patientDb.getById(match.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(match.visitId);
        const prescriptions = doctorPrescriptionDb.getByVisit(match.visitId);
        setSelectedItem({
          ...match,
          patient,
          visit: visit || undefined,
          prescriptions,
          hasUpdates: false,
        });
        setSelectedDate(new Date(match.createdAt).toISOString().split('T')[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    const handler = () => {
      loadQueue();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pharmacy-queue-updated', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pharmacy-queue-updated', handler as EventListener);
      }
    };
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
      const updated = [...queueItems, ...allPendingItems].find(q => q.id === itemId);
      if (updated) {
        setSelectedItem({ ...updated, status: 'preparing' });
      }
    }
  };

  // Handle status change to prepared
  const handleMarkPrepared = (itemId: string) => {
    // Get the pharmacy queue item to find the patient
    const pharmacyItem = pharmacyQueueDb.getById(itemId);
    
    console.log('[Pharmacy] Marking item as prepared:', {
      itemId,
      visitId: pharmacyItem?.visitId,
      source: (pharmacyItem as any)?.source,
      status: 'prepared'
    });
    
    pharmacyQueueDb.markPrepared(itemId, 'pharmacy');
    
    // Update appointment status to medicines-prepared and send to billing
    if (pharmacyItem) {
      const patientAppointments = appointmentDb.getByPatient(pharmacyItem.patientId);
      const relevantAppointment = pharmacyItem.appointmentId
        ? appointmentDb.getById(pharmacyItem.appointmentId)
        : patientAppointments.find((apt) => {
            const typedApt = apt as { appointmentDate: Date; status: string };
            const aptDateISO = new Date(typedApt.appointmentDate).toISOString().split('T')[0];
            const todayISO = new Date().toISOString().split('T')[0];
            return (
              aptDateISO === todayISO &&
              (typedApt.status === 'scheduled' ||
                typedApt.status === 'checked-in' ||
                typedApt.status === 'in-progress' ||
                typedApt.status === 'completed' ||
                typedApt.status === 'medicines-prepared')
            );
          });
      
      if (relevantAppointment) {
        appointmentDb.update((relevantAppointment as { id: string }).id, { status: 'medicines-prepared' });
      }
      
      // Resolve latest fee data (from appointment or doctor panel)
      const patient = patientDb.getById(pharmacyItem.patientId) as PatientInfo | undefined;
      const visit = doctorVisitDb.getById(pharmacyItem.visitId);
      let feeAmount = 300;
      let feeType = 'Follow Up';
      let paymentStatus: 'pending' | 'paid' | 'partial' | 'exempt' = 'pending';
      if (relevantAppointment) {
        const apt = relevantAppointment as { feeAmount?: number; feeType?: string; feeStatus?: string };
        if (apt.feeAmount !== undefined && apt.feeAmount !== null) feeAmount = apt.feeAmount;
        if (apt.feeType) feeType = apt.feeType;
        if (apt.feeStatus) paymentStatus = apt.feeStatus as typeof paymentStatus;
      }
      const allFees = db.getAll('fees') as any[];
      const patientFees = allFees.filter((f) => f.patientId === pharmacyItem.patientId);
      const feeByVisit = patientFees.find((f) => f.visitId === pharmacyItem.visitId);
      if (feeByVisit) {
        feeAmount = typeof feeByVisit.amount === 'number' ? feeByVisit.amount : feeAmount;
        feeType = feeByVisit.feeType || feeType;
        paymentStatus = (feeByVisit.paymentStatus as typeof paymentStatus) || paymentStatus;
      } else if (patientFees.length > 0) {
        const latestFee = patientFees
          .sort((a, b) => new Date(b.updatedAt || b.createdAt || new Date()).getTime() - new Date(a.updatedAt || a.createdAt || new Date()).getTime())[0];
        feeAmount = typeof latestFee.amount === 'number' ? latestFee.amount : feeAmount;
        feeType = latestFee.feeType || feeType;
        paymentStatus = (latestFee.paymentStatus as typeof paymentStatus) || paymentStatus;
      } else if (visit && visit.visitNumber === 1) {
        feeAmount = 500;
        feeType = 'New Patient';
      }
      
      // Check if billing item already exists for this visit
      const existingBilling = (billingQueueDb.getAll() as any[]).find((b) => b.visitId === pharmacyItem.visitId);
      if (!existingBilling) {
        billingQueueDb.create({
          visitId: pharmacyItem.visitId,
          patientId: pharmacyItem.patientId,
          appointmentId: pharmacyItem.appointmentId,
          prescriptionIds: pharmacyItem.prescriptionIds || [],
          status: 'pending',
          feeAmount,
          feeType,
          netAmount: feeAmount,
          paymentStatus
        });
      } else {
        const preparedRx = doctorPrescriptionDb.getByVisit(pharmacyItem.visitId) || [];
        const preparedIds = preparedRx.map(p => p.id);
        const existingIds = Array.isArray((existingBilling as any).prescriptionIds) ? (existingBilling as any).prescriptionIds as string[] : [];
        const hasNewMeds = preparedIds.some(id => !existingIds.includes(id));
        billingQueueDb.update(existingBilling.id, {
          feeAmount,
          feeType,
          netAmount: feeAmount - (existingBilling.discountAmount || 0),
          paymentStatus,
          updatedAt: new Date(),
          prescriptionIds: preparedIds,
          status: hasNewMeds ? 'pending' : (existingBilling.status || 'pending'),
        });
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fees-updated', { detail: { patientId: pharmacyItem.patientId, visitId: pharmacyItem.visitId } }));
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
  const allPendingCount = allPendingItems.length;
  const preparedCount = preparedItems.length;

  // Get current display items based on active tab
  const displayItems = activeTab === 'active' ? queueItems : activeTab === 'pending' ? allPendingItems : preparedItems;
  
  // Helper to calculate days pending
  const getDaysPending = (createdAt: Date | string): number => {
    const created = new Date(createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Handle delete medicine
  const handleDeleteMedicine = (prescriptionId: string, reason: 'doctor' | 'patient') => {
    if (!selectedItem) return;
    
    if (reason === 'doctor') {
      // Delete from prescription database completely
      doctorPrescriptionDb.delete(prescriptionId);
      
      // Reload queue to reflect changes
      loadQueue();
      
      // Update selected item
      const updatedPrescriptions = selectedItem.prescriptions?.filter(p => p.id !== prescriptionId) || [];
      setSelectedItem({
        ...selectedItem,
        prescriptions: updatedPrescriptions
      });
    } else {
      // Patient requested - add remark to prescription and hide from pharmacy
      const prescription = doctorPrescriptionDb.getById(prescriptionId);
      if (prescription) {
        const remark = '[Patient Requested Pharma Delete]';
        doctorPrescriptionDb.update(prescriptionId, {
          instructions: prescription.instructions 
            ? `${prescription.instructions} ${remark}`
            : remark
        });
      }
      
      // Add to hidden prescriptions set
      setHiddenPrescriptions(prev => new Set(prev).add(prescriptionId));
      
      loadQueue();
    }
    
    setShowDeleteDropdown(null);
  };

  // Handle undo patient-requested deletion
  const handleUndoDelete = (prescriptionId: string) => {
    const prescription = doctorPrescriptionDb.getById(prescriptionId);
    if (prescription) {
      // Remove the remark from instructions
      const remark = '[Patient Requested Pharma Delete]';
      let updatedInstructions = prescription.instructions || '';
      updatedInstructions = updatedInstructions.replace(remark, '').trim();
      
      doctorPrescriptionDb.update(prescriptionId, {
        instructions: updatedInstructions || undefined
      });
    }
    
    // Remove from hidden prescriptions set
    setHiddenPrescriptions(prev => {
      const newSet = new Set(prev);
      newSet.delete(prescriptionId);
      return newSet;
    });
    
    loadQueue();
  };

  // Handle print single label
  const handlePrintLabel = (prescriptionId: string, quantity: number) => {
    const prescription = selectedItem?.prescriptions?.find(p => p.id === prescriptionId);
    if (!prescription) return;
    
    // Find the serial number (index) of this prescription in the list
    const serialNumber = (selectedItem?.prescriptions?.findIndex(p => p.id === prescriptionId) || 0) + 1;
    
    const patient = selectedItem?.patient;
    
    // Get label settings from new label editor
    let labelSettings: any = {
      width: 2,
      height: 1,
      unit: 'inch',
      border: true,
      padding: 4,
      showGrid: false,
      gridSize: 5,
      elements: [],
      clinicName: '',
      clinicAddress: '',
      clinicPhone: '',
      clinicEmail: '',
    };
    
    try {
      const raw = doctorSettingsDb.get('labelSettings');
      if (raw) {
        labelSettings = JSON.parse(raw as string);
      }
    } catch {}
    
    // Convert units to CSS
    const widthCSS = labelSettings.unit === 'inch' ? `${labelSettings.width}in` : `${labelSettings.width}cm`;
    const heightCSS = labelSettings.unit === 'inch' ? `${labelSettings.height}in` : `${labelSettings.height}cm`;
    
    // Format dose timing like prescription
    const formatDoseTiming = (pattern: string, doseForm: string, duration: string): string => {
      const doses = pattern.split('-').map((d: string) => parseInt(d) || 0);
      const [morning, afternoon, evening] = doses;
      const doseFormLower = doseForm.toLowerCase();

      const timeParts: string[] = [];
      if (morning > 0) {
        timeParts.push(`${morning} ${doseFormLower} Mor`);
      }
      if (afternoon > 0) {
        timeParts.push(`${afternoon} ${doseFormLower} Aft`);
      }
      if (evening > 0) {
        const timeLabel = afternoon > 0 ? 'Nt' : 'Eve';
        timeParts.push(`${evening} ${doseFormLower} ${timeLabel}`);
      }

      let result = timeParts.join(' - ');
      if (duration) {
        result += ` for ${duration}`;
      }
      return result;
    };
    
    // Get field values
    const getFieldValue = (fieldName: string): string => {
      const fieldData: Record<string, string> = {
        clinicName: labelSettings.clinicName,
        clinicAddress: labelSettings.clinicAddress,
        clinicPhone: labelSettings.clinicPhone,
        clinicEmail: labelSettings.clinicEmail,
        patientName: patient?.fullName || patient?.name || '',
        patientMobile: patient?.mobileNumber || patient?.mobile || '',
        patientRegNo: patient?.registrationNumber || '',
        serialNumber: `Sr No: ${serialNumber}`,
        medicineName: prescription.medicine,
        potency: prescription.potency || '',
        quantity: prescription.quantity || '',
        doseForm: prescription.doseForm || '',
        dosePattern: prescription.dosePattern || '',
        doseTiming: formatDoseTiming(prescription.dosePattern || '', prescription.doseForm || '', prescription.duration || ''),
        frequency: prescription.frequency || '',
        duration: prescription.duration || '',
        instructions: prescription.instructions || '',
      };
      
      return fieldData[fieldName] || '';
    };
    
    // Generate elements HTML
    const elementsHTML = labelSettings.elements
      .filter((el: any) => el.visible)
      .map((element: any) => {
        const value = element.type === 'text' ? element.content : getFieldValue(element.content);
        return `
          <div style="
            position: absolute;
            left: ${element.x}mm;
            top: ${element.y}mm;
            font-size: ${element.fontSize}px;
            font-family: ${element.fontFamily};
            font-weight: ${element.fontWeight};
            font-style: ${element.fontStyle};
            text-decoration: ${element.textDecoration};
            text-align: ${element.textAlign || 'left'};
            max-width: calc(100% - ${element.x}mm - ${labelSettings.padding}mm);
            word-wrap: break-word;
            overflow-wrap: break-word;
          ">${value}</div>
        `;
      })
      .join('');
    
    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medicine Label</title>
        <style>
          @page { 
            size: ${widthCSS} ${heightCSS}; 
            margin: 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .label {
              page-break-after: always;
              page-break-inside: avoid;
            }
            /* Last label should not have page break */
            .label:last-child {
              page-break-after: auto;
            }
          }
          body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .label { 
            width: ${widthCSS};
            height: ${heightCSS};
            ${labelSettings.border ? 'border: 1px solid #000;' : ''}
            padding: ${labelSettings.padding}mm;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            display: block;
          }
        </style>
      </head>
      <body>
        ${Array(quantity).fill(0).map((_, index) => `
          <div class="label">
            ${elementsHTML}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    
    setShowPrintLabelPopup(null);
  };

  // Handle print all labels
  const handlePrintAllLabels = () => {
    if (!selectedItem?.prescriptions) return;
    
    // Get label settings from new label editor
    let labelSettings: any = {
      width: 2,
      height: 1,
      unit: 'inch',
      border: true,
      padding: 4,
      showGrid: false,
      gridSize: 5,
      elements: [],
      clinicName: '',
      clinicAddress: '',
      clinicPhone: '',
      clinicEmail: '',
    };
    
    try {
      const raw = doctorSettingsDb.get('labelSettings');
      if (raw) {
        labelSettings = JSON.parse(raw as string);
      }
    } catch {}
    
    // Convert units to CSS
    const widthCSS = labelSettings.unit === 'inch' ? `${labelSettings.width}in` : `${labelSettings.width}cm`;
    const heightCSS = labelSettings.unit === 'inch' ? `${labelSettings.height}in` : `${labelSettings.height}cm`;
    
    // Format dose timing like prescription
    const formatDoseTiming = (pattern: string, doseForm: string, duration: string): string => {
      const doses = pattern.split('-').map((d: string) => parseInt(d) || 0);
      const [morning, afternoon, evening] = doses;
      const doseFormLower = doseForm.toLowerCase();

      const timeParts: string[] = [];
      if (morning > 0) {
        timeParts.push(`${morning} ${doseFormLower} Mor`);
      }
      if (afternoon > 0) {
        timeParts.push(`${afternoon} ${doseFormLower} Aft`);
      }
      if (evening > 0) {
        const timeLabel = afternoon > 0 ? 'Nt' : 'Eve';
        timeParts.push(`${evening} ${doseFormLower} ${timeLabel}`);
      }

      let result = timeParts.join(' - ');
      if (duration) {
        result += ` for ${duration}`;
      }
      return result;
    };
    
    // Create print content for all medicines
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medicine Labels</title>
        <style>
          @page { 
            size: ${widthCSS} ${heightCSS}; 
            margin: 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .label {
              page-break-after: always;
              page-break-inside: avoid;
            }
            /* Last label should not have page break */
            .label:last-child {
              page-break-after: auto;
            }
          }
          body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .label { 
            width: ${widthCSS};
            height: ${heightCSS};
            ${labelSettings.border ? 'border: 1px solid #000;' : ''}
            padding: ${labelSettings.padding}mm;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            display: block;
          }
        </style>
      </head>
      <body>
        ${selectedItem.prescriptions
          .filter((prescription: any) => !prescription.remark?.includes('[Patient Requested Pharma Delete]'))
          .map((prescription: any, index: number) => {
            const quantity = labelQuantities[prescription.id] || prescription.bottles || 1;
            const serialNumber = index + 1; // Serial number based on position in list
            
            // Get field values for this prescription
            const getFieldValue = (fieldName: string): string => {
              const patient = selectedItem?.patient;
              const fieldData: Record<string, string> = {
                clinicName: labelSettings.clinicName,
                clinicAddress: labelSettings.clinicAddress,
                clinicPhone: labelSettings.clinicPhone,
                clinicEmail: labelSettings.clinicEmail,
                patientName: patient?.fullName || patient?.name || '',
                patientMobile: patient?.mobileNumber || patient?.mobile || '',
                patientRegNo: patient?.registrationNumber || '',
                serialNumber: `Sr No: ${serialNumber}`,
                medicineName: prescription.medicine,
                potency: prescription.potency || '',
                quantity: prescription.quantity || '',
                doseForm: prescription.doseForm || '',
                dosePattern: prescription.dosePattern || '',
                doseTiming: formatDoseTiming(prescription.dosePattern || '', prescription.doseForm || '', prescription.duration || ''),
                frequency: prescription.frequency || '',
                duration: prescription.duration || '',
                instructions: prescription.instructions || '',
              };
              return fieldData[fieldName] || '';
            };
            
            // Generate elements HTML for this prescription
            const elementsHTML = labelSettings.elements
              .filter((el: any) => el.visible)
              .map((element: any) => {
                const value = element.type === 'text' ? element.content : getFieldValue(element.content);
                return `
                  <div style="
                    position: absolute;
                    left: ${element.x}mm;
                    top: ${element.y}mm;
                    font-size: ${element.fontSize}px;
                    font-family: ${element.fontFamily};
                    font-weight: ${element.fontWeight};
                    font-style: ${element.fontStyle};
                    text-decoration: ${element.textDecoration};
                    text-align: ${element.textAlign || 'left'};
                    max-width: calc(100% - ${element.x}mm - ${labelSettings.padding}mm);
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                  ">${value}</div>
                `;
              })
              .join('');
            
            return Array(quantity).fill(0).map(() => `
              <div class="label">
                ${elementsHTML}
              </div>
            `).join('');
          }).join('')}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    
    setShowPrintAllLabelsPopup(false);
    setLabelQuantities({});
  };

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
            <div className="flex items-center gap-4">
              {/* Date Picker */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedItem(null);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedDate !== getTodayString() && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedDate(getTodayString());
                      setSelectedItem(null);
                    }}
                    className="text-xs"
                  >
                    Today
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Auto-refresh: 5s
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Date indicator for non-today dates */}
          {selectedDate !== getTodayString() && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-blue-800">
                Viewing pharmacy queue for <strong>{formatDate(new Date(selectedDate))}</strong>
              </span>
            </div>
          )}
          
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Today Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Today Preparing</div>
              <div className="text-2xl font-bold text-blue-600">{preparingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">All Pending</div>
              <div className="text-2xl font-bold text-orange-600">{allPendingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Today Prepared</div>
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
                    Today ({queueItems.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab('pending'); setSelectedItem(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'pending'
                        ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Pending ({allPendingCount})
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
                    {activeTab === 'active' ? 'No prescriptions for today' : activeTab === 'pending' ? 'No pending prescriptions' : 'No prepared prescriptions'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                    {displayItems.map((item) => {
                      const daysPending = getDaysPending(item.createdAt);
                      const createdDate = new Date(item.createdAt);
                      
                      return (
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
                                {item.source === 'self-repeat' && (
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                                    Self Repeat by P/T
                                  </span>
                                )}
                                {item.priority && (
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                    PRIORITY
                                  </span>
                                )}
                                {item.courier && (
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                    COURIER
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
                              {/* Show creation date and days pending for pending tab */}
                              {activeTab === 'pending' && (
                                <div className="text-xs mt-1">
                                  <span className="text-gray-500">Created: </span>
                                  <span className="text-gray-700">{formatDate(createdDate)}</span>
                                  <span className={`ml-2 px-1.5 py-0.5 rounded-full font-medium ${
                                    daysPending === 0 ? 'bg-green-100 text-green-800' :
                                    daysPending === 1 ? 'bg-yellow-100 text-yellow-800' :
                                    daysPending <= 3 ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {daysPending === 0 ? 'Today' : `${daysPending} day${daysPending > 1 ? 's' : ''} pending`}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              {getStatusBadge(item.status)}
                              {(activeTab === 'active' || activeTab === 'pending') && item.status === 'pending' && (
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
                              {(activeTab === 'active' || activeTab === 'pending') && item.status === 'preparing' && (
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
                      );
                    })}
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

                    {/* Visit Details - Chief Complaint removed as per user request */}
                    {selectedItem.visit && (selectedItem.visit.diagnosis || selectedItem.visit.advice) && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Visit Information</h3>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
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
                        <>
                          {/* Visible medicines */}
                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {selectedItem.prescriptions
                              .filter(p => {
                                // Filter out hidden prescriptions (patient-requested deletions)
                                if (hiddenPrescriptions.has(p.id)) return false;
                                // Also filter out prescriptions with delete remark in instructions
                                if (p.instructions && p.instructions.includes('[Patient Requested Pharma Delete]')) return false;
                                return true;
                              })
                              .map((prescription, index) => (
                              <div
                                key={prescription.id}
                                className={`rounded-lg p-2 border relative ${
                                  (Array.isArray((selectedItem as any).preparedPrescriptionIds) && (selectedItem as any).preparedPrescriptionIds.includes(prescription.id))
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-yellow-300 bg-yellow-50'
                                }`}
                              >
                                {/* Delete button with dropdown */}
                                <div className="absolute top-1 right-1 flex gap-1">
                                  {/* Print Label Icon */}
                                  <button
                                    onClick={() => {
                                      setShowPrintLabelPopup({
                                        prescriptionId: prescription.id,
                                        medicine: `${prescription.medicine}${prescription.potency ? ' ' + prescription.potency : ''}`,
                                        bottles: prescription.bottles || 1
                                      });
                                    }}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                    title="Print Label"
                                  >
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                  </button>
                                  
                                  {/* Delete button */}
                                  <div className="relative delete-dropdown-container">
                                    <button
                                      onClick={() => setShowDeleteDropdown(showDeleteDropdown === prescription.id ? null : prescription.id)}
                                      className="p-1 hover:bg-red-100 rounded transition-colors"
                                      title="Delete Medicine"
                                    >
                                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                    
                                    {/* Delete dropdown */}
                                    {showDeleteDropdown === prescription.id && (
                                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-40">
                                        <button
                                          onClick={() => handleDeleteMedicine(prescription.id, 'doctor')}
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors"
                                        >
                                          Doctor Advised
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMedicine(prescription.id, 'patient')}
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors border-t border-gray-200"
                                        >
                                          Patient Requested
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-start justify-between pr-10">
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 text-sm">
                                      {index + 1}. {prescription.medicine}
                                      {prescription.potency && <span className="font-normal text-gray-600 text-xs"> {prescription.potency}</span>}
                                    </div>
                                    <div className="mt-1">
                                      {(Array.isArray((selectedItem as any).preparedPrescriptionIds) && (selectedItem as any).preparedPrescriptionIds.includes(prescription.id)) ? (
                                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                          Prepared
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                                          To Prepare
                                        </span>
                                      )}
                                    </div>
                                    {prescription.combinationName && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {prescription.combinationName}
                                      </div>
                                    )}
                                    {prescription.isCombination && prescription.combinationContent && (
                                      <div className="text-xs text-blue-600 mt-1 italic">
                                        {prescription.combinationContent}
                                      </div>
                                    )}
                                    <div className="mt-1 space-y-0.5 text-xs">
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
                                          <span className="text-gray-500">Freq:</span>{' '}
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
                                      <div className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-1">
                                        {prescription.instructions}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Hidden medicines (patient requested deletion) - show undo option if not prepared */}
                          {selectedItem.prescriptions.filter(p => hiddenPrescriptions.has(p.id)).length > 0 && 
                           selectedItem.status !== 'prepared' && (
                            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                Patient Requested Deletions (Hidden)
                              </h4>
                              <div className="space-y-2">
                                {selectedItem.prescriptions
                                  .filter(p => hiddenPrescriptions.has(p.id))
                                  .map((prescription) => (
                                    <div key={prescription.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-300">
                                      <div className="text-xs text-gray-700">
                                        <span className="font-semibold">{prescription.medicine}</span>
                                        {prescription.potency && <span className="text-gray-600"> {prescription.potency}</span>}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleUndoDelete(prescription.id)}
                                        className="text-xs px-2 py-1"
                                      >
                                        Undo
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-4">
                          No medicines in this prescription
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-2">
                      {selectedItem.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            className="flex-1"
                            onClick={() => handleStartPreparing(selectedItem.id)}
                          >
                            Start Preparing
                          </Button>
                          {selectedItem.prescriptions && selectedItem.prescriptions.length > 0 && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                // Initialize label quantities with bottles count
                                const initialQuantities: Record<string, number> = {};
                                selectedItem.prescriptions?.forEach(p => {
                                  initialQuantities[p.id] = p.bottles || 1;
                                });
                                setLabelQuantities(initialQuantities);
                                setShowPrintAllLabelsPopup(true);
                              }}
                              className="whitespace-nowrap"
                            >
                              Print All Labels
                            </Button>
                          )}
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
                        </>
                      )}
                      {selectedItem.status === 'preparing' && (
                        <>
                          <Button
                            variant="primary"
                            className="flex-1"
                            onClick={() => handleMarkPrepared(selectedItem.id)}
                          >
                            Mark as Prepared
                          </Button>
                          {selectedItem.prescriptions && selectedItem.prescriptions.length > 0 && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                // Initialize label quantities with bottles count
                                const initialQuantities: Record<string, number> = {};
                                selectedItem.prescriptions?.forEach(p => {
                                  initialQuantities[p.id] = p.bottles || 1;
                                });
                                setLabelQuantities(initialQuantities);
                                setShowPrintAllLabelsPopup(true);
                              }}
                              className="whitespace-nowrap"
                            >
                              Print All Labels
                            </Button>
                          )}
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
                        </>
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
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      {/* Print Single Label Popup */}
      {showPrintLabelPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Print Label</h3>
            <p className="text-sm text-gray-600 mb-4">
              Medicine: <span className="font-semibold">{showPrintLabelPopup.medicine}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Labels
              </label>
              <input
                type="number"
                min="1"
                defaultValue={showPrintLabelPopup.bottles}
                onChange={(e) => {
                  setShowPrintLabelPopup({
                    ...showPrintLabelPopup,
                    bottles: parseInt(e.target.value) || 1
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => handlePrintLabel(showPrintLabelPopup.prescriptionId, showPrintLabelPopup.bottles)}
              >
                Print
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowPrintLabelPopup(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Print All Labels Popup */}
      {showPrintAllLabelsPopup && selectedItem?.prescriptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Print All Labels</h3>
            <p className="text-sm text-gray-600 mb-4">
              Set the number of labels to print for each medicine:
            </p>
            <div className="space-y-3 mb-6">
              {selectedItem.prescriptions
                .filter(p => {
                  // Filter out deleted prescriptions
                  if (hiddenPrescriptions.has(p.id)) return false;
                  if (p.instructions && p.instructions.includes('[Patient Requested Pharma Delete]')) return false;
                  return true;
                })
                .map((prescription) => (
                <div key={prescription.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {prescription.medicine}
                      {prescription.potency && <span className="text-gray-600"> {prescription.potency}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {prescription.quantity && `${prescription.quantity} `}
                      {prescription.doseForm && `${prescription.doseForm}`}
                    </div>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      value={labelQuantities[prescription.id] || prescription.bottles || 1}
                      onChange={(e) => {
                        setLabelQuantities({
                          ...labelQuantities,
                          [prescription.id]: parseInt(e.target.value) || 1
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handlePrintAllLabels}
              >
                Print All
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPrintAllLabelsPopup(false);
                  setLabelQuantities({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
