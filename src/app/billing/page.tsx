"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { billingQueueDb, billingReceiptDb, patientDb, appointmentDb, feeHistoryDb, db, medicineBillDb, medicineAmountMemoryDb } from '@/lib/db/database';
import { pharmacyQueueDb, doctorPrescriptionDb, doctorVisitDb } from '@/lib/db/doctor-panel';
import type { PharmacyQueueItem, MedicineBill, MedicineBillItem } from '@/lib/db/schema';
import type { BillingQueueItem, BillingReceipt, BillingReceiptItem } from '@/lib/db/schema';
import type { DoctorPrescription, DoctorVisit } from '@/lib/db/schema';

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

interface BillingQueueItemWithDetails extends BillingQueueItem {
  patient?: PatientInfo;
  visit?: DoctorVisit;
  prescriptions?: DoctorPrescription[];
}

type TabType = 'pending' | 'completed' | 'history';

// Generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format currency
function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

// Format date
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function BillingPage() {
  const [queueItems, setQueueItems] = useState<BillingQueueItemWithDetails[]>([]);
  const [completedItems, setCompletedItems] = useState<BillingQueueItemWithDetails[]>([]);
  const [selectedItem, setSelectedItem] = useState<BillingQueueItemWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  
  // Date filter state - use ref to track current date for interval callback
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateRef = useRef<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Fee editing state
  const [showFeePopup, setShowFeePopup] = useState(false);
  const [editingFee, setEditingFee] = useState<{
    feeAmount: number;
    discountPercent: number;
    discountAmount: number;
    netAmount: number;
    paymentMethod: string;
    notes: string;
  }>({
    feeAmount: 0,
    discountPercent: 0,
    discountAmount: 0,
    netAmount: 0,
    paymentMethod: 'cash',
    notes: ''
  });
  
  // Prescription view state
  const [showPrescriptionPopup, setShowPrescriptionPopup] = useState(false);
  const [viewingPrescriptions, setViewingPrescriptions] = useState<DoctorPrescription[]>([]);
  const [viewingPatient, setViewingPatient] = useState<PatientInfo | null>(null);
  const [viewingBillingItem, setViewingBillingItem] = useState<BillingQueueItemWithDetails | null>(null);
  
  // Bill creation state
  const [isBillMode, setIsBillMode] = useState(false);
  const [billItems, setBillItems] = useState<Array<{
    id: string;
    prescriptionId: string;
    medicine: string;
    potency?: string;
    quantityDisplay: string; // Original quantity string like "2dr"
    quantity: number; // Number of bottles for billing
    dosePattern?: string;
    frequency?: string;
    duration?: string;
    isCombination?: boolean;
    combinationContent?: string;
    amount: number;
  }>>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [billTax, setBillTax] = useState(0);
  const [billNotes, setBillNotes] = useState('');
  const [savedMedicineBill, setSavedMedicineBill] = useState<MedicineBill | null>(null);
  
  // View saved bill state
  const [showViewBillPopup, setShowViewBillPopup] = useState(false);
  const [viewingMedicineBill, setViewingMedicineBill] = useState<MedicineBill | null>(null);
  
  // Fee history state
  const [showFeeHistory, setShowFeeHistory] = useState(false);
  const [feeHistoryPatient, setFeeHistoryPatient] = useState<PatientInfo | null>(null);
  const [feeHistoryData, setFeeHistoryData] = useState<any[]>([]);
  
  // Receipt state
  const [showReceiptPopup, setShowReceiptPopup] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<BillingReceipt | null>(null);

  // Load queue data
  const loadQueue = useCallback(() => {
    setIsLoading(true);
    
    // Get all items from billing queue
    const allItems = billingQueueDb.getAll() as BillingQueueItem[];
    
    // Filter by selected date (use ref for current value)
    const currentDate = selectedDateRef.current;
    const selectedDateStr = currentDate.toDateString();
    const filteredByDate = allItems.filter((item) => {
      const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      return itemDate.toDateString() === selectedDateStr;
    });
    
    // Update fees from appointments for pending items (only for today's items)
    filteredByDate.forEach((item) => {
      if (item.status === 'pending') {
        let correctFee = item.feeAmount;
        let correctFeeType = item.feeType;
        let correctPaymentStatus = item.paymentStatus;
        let foundAppointment = false;
        
        // Try to get fee from appointmentId first
        if (item.appointmentId) {
          const appointment = appointmentDb.getById(item.appointmentId);
          if (appointment) {
            const apt = appointment as { feeAmount?: number; feeType?: string; feeStatus?: string };
            if (apt.feeAmount !== undefined && apt.feeAmount !== null) {
              correctFee = apt.feeAmount;
              correctFeeType = apt.feeType || correctFeeType;
              correctPaymentStatus = (apt.feeStatus as 'pending' | 'paid' | 'partial' | 'refunded') || correctPaymentStatus;
              foundAppointment = true;
              console.log('[Billing] Found fee from appointmentId:', apt.feeAmount, 'status:', apt.feeStatus);
            }
          }
        }
        
        // If no appointmentId or not found, try to find today's appointment for this patient
        if (!foundAppointment) {
          const patientAppointments = appointmentDb.getByPatient(item.patientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          
          const todayAppointment = patientAppointments.find((apt: any) => {
            const aptDate = new Date(apt.appointmentDate);
            return aptDate >= today && aptDate <= todayEnd;
          });
          
          if (todayAppointment) {
            const apt = todayAppointment as { feeAmount?: number; feeType?: string; feeStatus?: string };
            if (apt.feeAmount !== undefined && apt.feeAmount !== null) {
              correctFee = apt.feeAmount;
              correctFeeType = apt.feeType || correctFeeType;
              correctPaymentStatus = (apt.feeStatus as 'pending' | 'paid' | 'partial' | 'refunded') || correctPaymentStatus;
              console.log('[Billing] Found fee from today\'s appointment:', apt.feeAmount, 'status:', apt.feeStatus);
            }
          }
        }
        
        // Update if fee, feeType, or status is different
        if (correctFee !== item.feeAmount || correctFeeType !== item.feeType || correctPaymentStatus !== item.paymentStatus) {
          billingQueueDb.update(item.id, {
            feeAmount: correctFee,
            feeType: correctFeeType,
            paymentStatus: correctPaymentStatus,
            netAmount: correctFee - (item.discountAmount || 0)
          });
          console.log('[Billing] Updated fee for existing item:', item.id, 'from', item.feeAmount, item.feeType, 'to', correctFee, correctFeeType, 'status:', correctPaymentStatus);
        }
      }
    });
    
    // Re-fetch items after potential updates (still filter by date)
    const updatedItems = (billingQueueDb.getAll() as BillingQueueItem[]).filter((item) => {
      const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      return itemDate.toDateString() === selectedDateStr;
    });
    
    // Separate pending and completed items
    const pending = updatedItems.filter(
      (item) => item.status === 'pending' || item.status === 'paid'
    );
    const completed = updatedItems.filter(
      (item) => item.status === 'completed'
    );
    
    // Sort by creation time (oldest first for pending, newest first for completed)
    const sortByDateAsc = <T extends { createdAt: Date }>(items: T[]): T[] => {
      return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    };
    
    const sortByDateDesc = <T extends { createdAt: Date }>(items: T[]): T[] => {
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };
    
    // Enrich with patient and prescription details
    const enrichItems = (items: BillingQueueItem[]): BillingQueueItemWithDetails[] => {
      return items.map((item) => {
        const patient = patientDb.getById(item.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(item.visitId);
        const prescriptions = doctorPrescriptionDb.getByVisit(item.visitId);
        
        return {
          ...item,
          patient,
          visit,
          prescriptions
        };
      });
    };
    
    setQueueItems(enrichItems(sortByDateAsc(pending)));
    setCompletedItems(enrichItems(sortByDateDesc(completed)));
    setIsLoading(false);
  }, []);

  // Check pharmacy queue for prepared items and add to billing
  const checkPharmacyQueue = useCallback(() => {
    const allPharmacyItems = pharmacyQueueDb.getAll() as PharmacyQueueItem[];
    const preparedPharmacyItems = allPharmacyItems.filter(item => item.status === 'prepared');
    
    preparedPharmacyItems.forEach((pharmacyItem: PharmacyQueueItem) => {
      // Check if already in billing queue (any status - including completed)
      const existingBilling = (billingQueueDb.getAll() as BillingQueueItem[]).find(
        (b) => b.visitId === pharmacyItem.visitId
      );
      
      if (!existingBilling) {
        // Get patient and visit info
        const patient = patientDb.getById(pharmacyItem.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(pharmacyItem.visitId);
        
        // Get fee from appointment (the actual fee selected during booking)
        let feeAmount = 300; // Default fee
        let feeType = 'Consultation';
        
        // Try to get fee from the appointment first
        if (pharmacyItem.appointmentId) {
          const appointment = appointmentDb.getById(pharmacyItem.appointmentId);
          console.log('[Billing] Looking up appointment by ID:', pharmacyItem.appointmentId);
          console.log('[Billing] Found appointment:', appointment);
          if (appointment) {
            const apt = appointment as { feeAmount?: number; feeType?: string };
            console.log('[Billing] Appointment feeAmount:', apt.feeAmount, 'feeType:', apt.feeType);
            if (apt.feeAmount !== undefined && apt.feeAmount !== null) {
              feeAmount = apt.feeAmount;
            }
            if (apt.feeType) {
              feeType = apt.feeType;
            }
          }
        } else {
          console.log('[Billing] No appointmentId on pharmacyItem, pharmacyItem:', pharmacyItem);
          // No appointmentId - try to find today's appointment for this patient
          const patientAppointments = appointmentDb.getByPatient(pharmacyItem.patientId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          
          const todayAppointment = patientAppointments.find((apt: any) => {
            const aptDate = new Date(apt.appointmentDate);
            return aptDate >= today && aptDate <= todayEnd;
          });
          
          if (todayAppointment) {
            const apt = todayAppointment as { feeAmount?: number; feeType?: string };
            if (apt.feeAmount !== undefined && apt.feeAmount !== null) {
              feeAmount = apt.feeAmount;
            }
            if (apt.feeType) {
              feeType = apt.feeType;
            }
          } else if (visit) {
            // Fallback to visit type based fee only if no appointment fee
            if (visit.visitNumber === 1) {
              feeAmount = 500;
              feeType = 'New Patient';
            } else {
              feeAmount = 300;
              feeType = 'Follow Up';
            }
          }
        }
        
        // Create billing queue item
        const billingItem = {
          visitId: pharmacyItem.visitId,
          patientId: pharmacyItem.patientId,
          appointmentId: pharmacyItem.appointmentId,
          prescriptionIds: pharmacyItem.prescriptionIds,
          status: 'pending' as const,
          feeAmount,
          feeType,
          netAmount: feeAmount,
          paymentStatus: 'pending' as const
        };
        
        billingQueueDb.create(billingItem);
        
        // Update pharmacy item to indicate it's been sent to billing
        pharmacyQueueDb.update(pharmacyItem.id, { status: 'billed' });
      }
    });
    
    loadQueue();
  }, [loadQueue]);

  // Initial load and interval for pharmacy queue check
  useEffect(() => {
    // Set up interval to check for new items from pharmacy
    const interval = setInterval(() => {
      checkPharmacyQueue();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [checkPharmacyQueue]);

  // Initial load on mount
  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle fee edit
  const handleEditFee = (item: BillingQueueItemWithDetails) => {
    setSelectedItem(item);
    setEditingFee({
      feeAmount: item.feeAmount,
      discountPercent: item.discountPercent || 0,
      discountAmount: item.discountAmount || 0,
      netAmount: item.netAmount,
      paymentMethod: item.paymentMethod || 'cash',
      notes: item.notes || ''
    });
    setShowFeePopup(true);
  };

  // Calculate net amount
  const calculateNetAmount = (feeAmount: number, discountPercent: number) => {
    const discountAmount = (feeAmount * discountPercent) / 100;
    return feeAmount - discountAmount;
  };

  // Handle fee amount change
  const handleFeeAmountChange = (value: number) => {
    const netAmount = calculateNetAmount(value, editingFee.discountPercent);
    setEditingFee(prev => ({
      ...prev,
      feeAmount: value,
      discountAmount: (value * prev.discountPercent) / 100,
      netAmount
    }));
  };

  // Handle discount change
  const handleDiscountChange = (value: number) => {
    const discountAmount = (editingFee.feeAmount * value) / 100;
    const netAmount = editingFee.feeAmount - discountAmount;
    setEditingFee(prev => ({
      ...prev,
      discountPercent: value,
      discountAmount,
      netAmount
    }));
  };

  // Save fee changes
  const handleSaveFee = () => {
    if (!selectedItem) return;
    
    billingQueueDb.update(selectedItem.id, {
      feeAmount: editingFee.feeAmount,
      discountPercent: editingFee.discountPercent,
      discountAmount: editingFee.discountAmount,
      netAmount: editingFee.netAmount,
      paymentMethod: editingFee.paymentMethod,
      notes: editingFee.notes
    });
    
    // Sync fee changes back to appointment
    if (selectedItem.appointmentId) {
      appointmentDb.update(selectedItem.appointmentId, {
        feeAmount: editingFee.feeAmount,
        feeType: selectedItem.feeType,
      });
      console.log('[Billing] Synced fee back to appointment:', selectedItem.appointmentId);
    }
    
    // Also update the fees table if there's a fee record
    const feeRecords = (db.getAll('fees') || []) as any[];
    const relatedFee = feeRecords.find((f) => 
      f.patientId === selectedItem.patientId && 
      f.visitId === selectedItem.visitId
    );
    if (relatedFee) {
      db.update('fees', relatedFee.id, {
        amount: editingFee.feeAmount,
        updatedAt: new Date(),
      });
      console.log('[Billing] Synced fee to fees table:', relatedFee.id);
    }
    
    setShowFeePopup(false);
    loadQueue();
  };

  // View prescription
  const handleViewPrescription = (item: BillingQueueItemWithDetails) => {
    setViewingPrescriptions(item.prescriptions || []);
    setViewingPatient(item.patient || null);
    setViewingBillingItem(item);
    setIsBillMode(false);
    
    // Check for existing saved medicine bill
    const existingBill = medicineBillDb.getByBillingQueueId(item.id) as MedicineBill | undefined;
    
    if (existingBill) {
      // Load existing bill
      setSavedMedicineBill(existingBill);
      setBillItems(existingBill.items.map(billItem => ({
        id: generateId(),
        prescriptionId: billItem.prescriptionId,
        medicine: billItem.medicine,
        potency: billItem.potency,
        quantityDisplay: billItem.quantityDisplay || '', // Original quantity string
        quantity: billItem.quantity, // Number of bottles
        dosePattern: billItem.dosePattern,
        frequency: billItem.frequency,
        duration: billItem.duration,
        isCombination: billItem.isCombination,
        combinationContent: billItem.combinationContent,
        amount: billItem.amount
      })));
      setBillDiscount(existingBill.discountPercent);
      setBillTax(existingBill.taxPercent);
      setBillNotes(existingBill.notes || '');
    } else {
      // Initialize with prescriptions and load amounts from memory
      setSavedMedicineBill(null);
      setBillItems((item.prescriptions || []).map(rx => {
        // Try to get last used amount from memory
        const memory = medicineAmountMemoryDb.getByMedicine(rx.medicine, rx.potency);
        const lastAmount = memory ? (memory as { amount: number }).amount : 0;
        
        return {
          id: generateId(),
          prescriptionId: rx.id || generateId(),
          medicine: rx.medicine,
          potency: rx.potency,
          quantityDisplay: rx.quantity || '', // Original quantity string like "2dr"
          quantity: rx.bottles || 1, // Number of bottles for billing
          dosePattern: rx.dosePattern,
          frequency: rx.frequency,
          duration: rx.duration,
          isCombination: rx.isCombination,
          combinationContent: rx.combinationContent,
          amount: lastAmount
        };
      }));
      setBillDiscount(0);
      setBillTax(0);
      setBillNotes('');
    }
    
    setShowPrescriptionPopup(true);
  };
  
  // Enter bill creation mode
  const handleCreateBill = () => {
    setIsBillMode(true);
  };
  
  // Update bill item amount
  const handleBillItemAmountChange = (index: number, amount: number) => {
    setBillItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount };
      return updated;
    });
  };
  
  // Calculate bill totals
  const getBillSubtotal = () => {
    return billItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };
  
  const getBillDiscountAmount = () => {
    return (getBillSubtotal() * billDiscount) / 100;
  };
  
  const getBillTaxAmount = () => {
    return ((getBillSubtotal() - getBillDiscountAmount()) * billTax) / 100;
  };
  
  const getBillTotal = () => {
    return getBillSubtotal() - getBillDiscountAmount() + getBillTaxAmount();
  };
  
  // Print bill
  const handlePrintBill = () => {
    if (!viewingPatient) return;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill - ${viewingPatient.firstName} ${viewingPatient.lastName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .bill-title { font-size: 18px; font-weight: bold; }
          .patient-info { margin-bottom: 15px; }
          .patient-info div { margin: 5px 0; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
          .item-name { flex: 1; }
          .item-qty { width: 60px; text-align: center; }
          .item-amount { width: 80px; text-align: right; }
          .totals { margin-top: 15px; }
          .totals div { display: flex; justify-content: space-between; margin: 5px 0; }
          .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">HomeoPMS Clinic</h2>
          <p style="margin: 5px 0;">Medicine Bill</p>
          <div class="bill-title">Date: ${formatDate(new Date())}</div>
        </div>
        <div class="patient-info">
          <div><strong>Patient:</strong> ${viewingPatient.firstName} ${viewingPatient.lastName}</div>
          <div><strong>Regd No:</strong> ${viewingPatient.registrationNumber}</div>
          <div><strong>Mobile:</strong> ${viewingPatient.mobileNumber}</div>
        </div>
        <div class="items">
          <div class="item" style="font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            <span class="item-name">Medicine</span>
            <span class="item-qty">Qty</span>
            <span class="item-amount">Amount</span>
          </div>
          ${billItems.filter(item => item.amount > 0).map(item => `
            <div class="item">
              <span class="item-name">${item.medicine}${item.potency ? ` (${item.potency})` : ''}</span>
              <span class="item-qty">${item.quantityDisplay || item.quantity}</span>
              <span class="item-amount">${formatCurrency(item.amount)}</span>
            </div>
          `).join('')}
        </div>
        <div class="totals">
          <div>
            <span>Subtotal:</span>
            <span>${formatCurrency(getBillSubtotal())}</span>
          </div>
          ${billDiscount > 0 ? `
            <div style="color: green;">
              <span>Discount (${billDiscount}%):</span>
              <span>-${formatCurrency(getBillDiscountAmount())}</span>
            </div>
          ` : ''}
          ${billTax > 0 ? `
            <div>
              <span>Tax (${billTax}%):</span>
              <span>+${formatCurrency(getBillTaxAmount())}</span>
            </div>
          ` : ''}
          <div class="grand-total">
            <span>Grand Total:</span>
            <span>${formatCurrency(getBillTotal())}</span>
          </div>
        </div>
        ${billNotes ? `<div style="margin-top: 15px; font-size: 12px;"><strong>Notes:</strong> ${billNotes}</div>` : ''}
        <div class="footer">
          <p>Thank you for your visit!</p>
          <p>Get well soon.</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };
  
  // Send bill via WhatsApp
  const handleWhatsAppBill = () => {
    if (!viewingPatient) return;
    
    const phone = viewingPatient.mobileNumber?.replace(/[^0-9]/g, '');
    
    const itemsText = billItems
      .filter(item => item.amount > 0)
      .map(item => `• ${item.medicine}${item.potency ? ` (${item.potency})` : ''} - Qty: ${item.quantityDisplay || item.quantity} - ${formatCurrency(item.amount)}`)
      .join('\n');
    
    const message = `
*HomeoPMS Clinic - Medicine Bill*
----------------------------------
Date: ${formatDate(new Date())}

*Patient:* ${viewingPatient.firstName} ${viewingPatient.lastName}
*Regd No:* ${viewingPatient.registrationNumber}

*Items:*
${itemsText}

*Subtotal:* ${formatCurrency(getBillSubtotal())}
${billDiscount > 0 ? `*Discount (${billDiscount}%):* -${formatCurrency(getBillDiscountAmount())}\n` : ''}${billTax > 0 ? `*Tax (${billTax}%):* +${formatCurrency(getBillTaxAmount())}\n` : ''}
*Grand Total:* ${formatCurrency(getBillTotal())}
${billNotes ? `\n*Notes:* ${billNotes}` : ''}

Thank you for your visit!
Get well soon.
    `.trim();
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  
  // Save medicine bill
  const handleSaveBill = () => {
    if (!viewingBillingItem || !viewingPatient) return;
    
    const billItemsData: MedicineBillItem[] = billItems.map(item => ({
      prescriptionId: item.prescriptionId,
      medicine: item.medicine,
      potency: item.potency,
      quantityDisplay: item.quantityDisplay, // Original quantity string like "2dr"
      quantity: item.quantity, // Number of bottles
      dosePattern: item.dosePattern,
      frequency: item.frequency,
      duration: item.duration,
      isCombination: item.isCombination,
      combinationContent: item.combinationContent,
      amount: item.amount
    }));
    
    const billData = {
      billingQueueId: viewingBillingItem.id,
      patientId: viewingPatient.id,
      visitId: viewingBillingItem.visitId,
      items: billItemsData,
      subtotal: getBillSubtotal(),
      discountPercent: billDiscount,
      discountAmount: getBillDiscountAmount(),
      taxPercent: billTax,
      taxAmount: getBillTaxAmount(),
      grandTotal: getBillTotal(),
      notes: billNotes,
      status: 'saved' as const
    };
    
    if (savedMedicineBill) {
      // Update existing bill
      medicineBillDb.update(savedMedicineBill.id, billData);
    } else {
      // Create new bill
      const newBill = medicineBillDb.create(billData) as unknown as MedicineBill;
      setSavedMedicineBill(newBill);
    }
    
    // Save amounts to memory for each medicine
    billItems.forEach(item => {
      if (item.amount > 0) {
        medicineAmountMemoryDb.upsert(item.medicine, item.potency, item.amount);
      }
    });
    
    alert('Bill saved successfully!');
    loadQueue();
  };
  
  // View saved medicine bill
  const handleViewSavedBill = (item: BillingQueueItemWithDetails) => {
    const bill = medicineBillDb.getByBillingQueueId(item.id) as MedicineBill | undefined;
    if (bill) {
      setViewingMedicineBill(bill);
      setViewingBillingItem(item); // Store for edit functionality
      setShowViewBillPopup(true);
    }
  };

  // View fee history
  const handleViewFeeHistory = (item: BillingQueueItemWithDetails) => {
    if (!item.patient) return;
    
    setFeeHistoryPatient(item.patient);
    const history = feeHistoryDb.getByPatient(item.patient.id);
    setFeeHistoryData(history);
    setShowFeeHistory(true);
  };

  // Generate and show receipt
  const handleGenerateReceipt = (item: BillingQueueItemWithDetails) => {
    const receiptNumber = billingQueueDb.generateReceiptNumber();
    
    const receiptItems: BillingReceiptItem[] = [
      {
        description: item.feeType,
        quantity: 1,
        unitPrice: item.feeAmount,
        total: item.feeAmount
      }
    ];
    
    const receipt = {
      receiptNumber,
      billingQueueId: item.id,
      patientId: item.patientId,
      visitId: item.visitId,
      items: receiptItems,
      subtotal: item.feeAmount,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      netAmount: item.netAmount,
      paymentMethod: (item.paymentMethod || 'cash') as 'cash' | 'card' | 'upi' | 'cheque' | 'insurance' | 'exempt',
      paymentStatus: 'paid' as const
    };
    
    const createdReceipt = billingReceiptDb.create(receipt) as unknown as BillingReceipt;
    setCurrentReceipt(createdReceipt);
    
    // Update billing queue item
    billingQueueDb.markPaid(item.id, item.paymentMethod || 'cash', receiptNumber);
    
    setShowReceiptPopup(true);
    loadQueue();
  };

  // Print receipt
  const handlePrintReceipt = () => {
    if (!currentReceipt) return;
    
    const patient = patientDb.getById(currentReceipt.patientId) as PatientInfo;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${currentReceipt.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .receipt-no { font-size: 14px; font-weight: bold; }
          .patient-info { margin-bottom: 15px; }
          .patient-info div { margin: 5px 0; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
          .total div { display: flex; justify-content: space-between; margin: 5px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">HomeoPMS Clinic</h2>
          <p style="margin: 5px 0;">Receipt</p>
          <div class="receipt-no">${currentReceipt.receiptNumber}</div>
        </div>
        <div class="patient-info">
          <div><strong>Patient:</strong> ${patient?.firstName} ${patient?.lastName}</div>
          <div><strong>Regd No:</strong> ${patient?.registrationNumber}</div>
          <div><strong>Mobile:</strong> ${patient?.mobileNumber}</div>
          <div><strong>Date:</strong> ${formatDate(currentReceipt.createdAt)}</div>
        </div>
        <div class="items">
          ${currentReceipt.items.map(item => `
            <div class="item">
              <span>${item.description}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
        </div>
        <div class="total">
          <div>
            <span>Subtotal:</span>
            <span>${formatCurrency(currentReceipt.subtotal)}</span>
          </div>
          ${currentReceipt.discountAmount ? `
            <div>
              <span>Discount (${currentReceipt.discountPercent}%):</span>
              <span>-${formatCurrency(currentReceipt.discountAmount)}</span>
            </div>
          ` : ''}
          <div style="border-top: 1px solid #000; padding-top: 5px;">
            <span>Net Amount:</span>
            <span>${formatCurrency(currentReceipt.netAmount)}</span>
          </div>
          <div>
            <span>Payment Method:</span>
            <span>${currentReceipt.paymentMethod.toUpperCase()}</span>
          </div>
        </div>
        <div class="footer">
          <p>Thank you for your visit!</p>
          <p>Get well soon.</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
    
    billingReceiptDb.markPrinted(currentReceipt.id);
  };

  // Send via WhatsApp
  const handleWhatsAppReceipt = () => {
    if (!currentReceipt) return;
    
    const patient = patientDb.getById(currentReceipt.patientId) as PatientInfo;
    const phone = patient?.mobileNumber?.replace(/[^0-9]/g, '');
    
    const message = `
*HomeoPMS Clinic - Receipt*
----------------------------
Receipt No: ${currentReceipt.receiptNumber}
Date: ${formatDate(currentReceipt.createdAt)}

*Patient:* ${patient?.firstName} ${patient?.lastName}
*Regd No:* ${patient?.registrationNumber}

*Items:*
${currentReceipt.items.map(item => `• ${item.description}: ${formatCurrency(item.total)}`).join('\n')}

*Subtotal:* ${formatCurrency(currentReceipt.subtotal)}
${currentReceipt.discountAmount ? `*Discount:* -${formatCurrency(currentReceipt.discountAmount)}` : ''}
*Net Amount:* ${formatCurrency(currentReceipt.netAmount)}
*Payment:* ${currentReceipt.paymentMethod.toUpperCase()}

Thank you for your visit!
Get well soon.
    `.trim();
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    billingReceiptDb.markWhatsappSent(currentReceipt.id);
  };

  // Download as PDF
  const handleDownloadPDF = () => {
    // For simplicity, we'll use the print functionality
    // In a real app, you'd use a PDF library like jspdf
    handlePrintReceipt();
  };

  // Complete billing
  const handleComplete = (item: BillingQueueItemWithDetails) => {
    // Update billing queue
    billingQueueDb.markCompleted(item.id);
    
    // Update appointment status
    if (item.appointmentId) {
      appointmentDb.update(item.appointmentId, { status: 'completed' });
    }
    
    // Create fee history entry
    feeHistoryDb.create({
      patientId: item.patientId,
      visitId: item.visitId,
      receiptId: item.receiptNumber || '',
      feeType: item.feeType === 'New Patient' ? 'first-visit' : 'follow-up',
      amount: item.netAmount,
      paymentMethod: (item.paymentMethod as any) || 'cash',
      paymentStatus: 'paid',
      paidDate: new Date()
    });
    
    loadQueue();
  };

  // Reopen completed billing
  const handleReopen = (item: BillingQueueItemWithDetails) => {
    // Update billing queue - set status back to paid (receipt generated but not completed)
    billingQueueDb.update(item.id, {
      status: 'paid'
    });
    
    loadQueue();
  };

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    selectedDateRef.current = newDate; // Update ref first
    setSelectedDate(newDate);
    setShowDatePicker(false);
    setSelectedItem(null);
    loadQueue(); // Immediately load data for new date
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Format date for input
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Get status badge color
  const getStatusColor = (status: string): "success" | "warning" | "danger" | "info" | "default" => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'paid':
        return 'info';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <main className="flex-1 transition-all duration-300 ml-64">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
              <p className="text-gray-600">Manage patient billing and receipts</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Date Selector */}
              <div className="flex items-center gap-2">
                {isToday(selectedDate) ? (
                  <span className="text-sm font-medium text-gray-700">Today</span>
                ) : (
                  <span className="text-sm font-medium text-gray-700">
                    {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Select date"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                {!isToday(selectedDate) && (
                  <button
                    onClick={() => {
                      const today = new Date();
                      selectedDateRef.current = today;
                      setSelectedDate(today);
                      setSelectedItem(null);
                      loadQueue();
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Go to Today
                  </button>
                )}
              </div>
              {showDatePicker && (
                <div className="absolute right-24 top-20 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
                  <input
                    type="date"
                    value={formatDateForInput(selectedDate)}
                    onChange={handleDateChange}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <Badge variant="info">{queueItems.length} Pending</Badge>
              <Button onClick={loadQueue} variant="outline">
                Refresh
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'pending'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending ({queueItems.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'completed'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed ({completedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Fee History
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : activeTab === 'history' ? (
            <Card className="p-6">
              <p className="text-gray-500 text-center py-8">
                Select a patient from Pending or Completed tab to view their fee history.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {(activeTab === 'pending' ? queueItems : completedItems).length === 0 ? (
                <Card className="p-6">
                  <p className="text-gray-500 text-center py-8">
                    No {activeTab} items in the billing queue.
                  </p>
                </Card>
              ) : (
                (activeTab === 'pending' ? queueItems : completedItems).map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Patient Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-lg">
                            {item.patient?.firstName?.charAt(0)}{item.patient?.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {item.patient?.firstName} {item.patient?.lastName}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Regd: {item.patient?.registrationNumber}</span>
                            <span>Mobile: {item.patient?.mobileNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Fee Info */}
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm text-gray-500">{item.feeType}</div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(item.netAmount)}
                            {item.discountAmount && item.discountAmount > 0 && (
                              <span className="text-sm text-gray-500 line-through ml-2">
                                {formatCurrency(item.feeAmount)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <Badge variant={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                          {item.paymentStatus === 'exempt' && (
                            <Badge variant="purple">Exempt</Badge>
                          )}
                          {item.paymentStatus === 'partial' && (
                            <Badge variant="warning">Partial</Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPrescription(item)}
                        >
                          View Prescription
                        </Button>
                        {(medicineBillDb.getByBillingQueueId(item.id) as MedicineBill | undefined) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewSavedBill(item)}
                          >
                            View Bill
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewFeeHistory(item)}
                        >
                          Fee History
                        </Button>
                        {item.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFee(item)}
                            >
                              Edit Fee
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleGenerateReceipt(item)}
                            >
                              Generate Receipt
                            </Button>
                          </>
                        )}
                        {item.status === 'paid' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFee(item)}
                            >
                              Edit Fee
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleComplete(item)}
                            >
                              Complete
                            </Button>
                          </>
                        )}
                        {item.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReopen(item)}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fee Edit Popup */}
      {showFeePopup && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Edit Fee Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fee Amount (₹)
                </label>
                <input
                  type="number"
                  value={editingFee.feeAmount}
                  onChange={(e) => handleFeeAmountChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingFee.discountPercent}
                  onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Amount (₹)
                </label>
                <input
                  type="number"
                  value={editingFee.discountAmount}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Net Amount (₹)
                </label>
                <input
                  type="number"
                  value={editingFee.netAmount}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 font-semibold text-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={editingFee.paymentMethod}
                  onChange={(e) => setEditingFee(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="insurance">Insurance</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingFee.notes}
                  onChange={(e) => setEditingFee(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowFeePopup(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveFee}>
                Save Changes
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Prescription View Popup */}
      {showPrescriptionPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{isBillMode ? 'Create Bill' : 'Prescription'}</h2>
                {viewingPatient && (
                  <p className="text-sm text-gray-500">
                    {viewingPatient.firstName} {viewingPatient.lastName} - {viewingPatient.registrationNumber}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => {
                setShowPrescriptionPopup(false);
                setIsBillMode(false);
              }}>
                Close
              </Button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {billItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No prescriptions found.</p>
              ) : isBillMode ? (
                /* Bill Creation Mode */
                <div className="space-y-4">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Medicine</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Potency</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Dose</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {billItems.map((item, index) => (
                        <tr key={item.id || index}>
                          <td className="px-4 py-2">
                            <div className="font-medium">{item.medicine}</div>
                            {item.isCombination && (
                              <div className="text-xs text-gray-500">{item.combinationContent}</div>
                            )}
                          </td>
                          <td className="px-4 py-2">{item.potency || '-'}</td>
                          <td className="px-4 py-2 text-center">{item.quantity}</td>
                          <td className="px-4 py-2">
                            {item.dosePattern || '-'}
                            {item.frequency && <span className="text-xs text-gray-500"> ({item.frequency})</span>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount || ''}
                              onChange={(e) => handleBillItemAmountChange(index, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Bill Summary */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(getBillSubtotal())}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Discount (%):</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={billDiscount}
                            onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {billDiscount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount Amount:</span>
                            <span>-{formatCurrency(getBillDiscountAmount())}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Tax (%):</span>
                          <input
                            type="number"
                            min="0"
                            value={billTax}
                            onChange={(e) => setBillTax(parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {billTax > 0 && (
                          <div className="flex justify-between">
                            <span>Tax Amount:</span>
                            <span>+{formatCurrency(getBillTaxAmount())}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Grand Total:</span>
                          <span>{formatCurrency(getBillTotal())}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Notes */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={billNotes}
                        onChange={(e) => setBillNotes(e.target.value)}
                        rows={2}
                        placeholder="Add any notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* View Prescription Mode */
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Medicine</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Potency</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Dose</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {billItems.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{item.medicine}</div>
                          {item.isCombination && (
                            <div className="text-xs text-gray-500">{item.combinationContent}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">{item.potency || '-'}</td>
                        <td className="px-4 py-2">{item.quantityDisplay || item.quantity}</td>
                        <td className="px-4 py-2">
                          {item.dosePattern || '-'}
                          {item.frequency && <span className="text-xs text-gray-500"> ({item.frequency})</span>}
                        </td>
                        <td className="px-4 py-2">{item.duration || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              {isBillMode ? (
                <>
                  <Button variant="outline" onClick={() => setIsBillMode(false)}>
                    Back to Prescription
                  </Button>
                  <Button variant="primary" onClick={handleSaveBill}>
                    {savedMedicineBill ? 'Update Bill' : 'Save Bill'}
                  </Button>
                  <Button variant="outline" onClick={handlePrintBill}>
                    Print Bill
                  </Button>
                  <Button variant="outline" onClick={handleWhatsAppBill}>
                    WhatsApp
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" onClick={handleCreateBill}>
                    Create Bill
                  </Button>
                  <Button variant="outline" onClick={handleWhatsAppReceipt}>
                    WhatsApp
                  </Button>
                  <Button variant="outline" onClick={handlePrintReceipt}>
                    Print
                  </Button>
                  <Button variant="outline" onClick={handleDownloadPDF}>
                    Download PDF
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Fee History Popup */}
      {showFeeHistory && feeHistoryPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Fee History</h2>
                <p className="text-sm text-gray-500">
                  {feeHistoryPatient.firstName} {feeHistoryPatient.lastName} - {feeHistoryPatient.registrationNumber}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowFeeHistory(false)}>
                Close
              </Button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {feeHistoryData.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No fee history found.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Receipt</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Amount</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Payment</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {feeHistoryData.map((entry, index) => (
                      <tr key={entry.id || index}>
                        <td className="px-4 py-2">{formatDate(entry.paidDate)}</td>
                        <td className="px-4 py-2">{entry.receiptId}</td>
                        <td className="px-4 py-2 capitalize">{entry.feeType}</td>
                        <td className="px-4 py-2 font-medium">{formatCurrency(entry.amount)}</td>
                        <td className="px-4 py-2 capitalize">{entry.paymentMethod}</td>
                        <td className="px-4 py-2">
                          <Badge variant={entry.paymentStatus === 'paid' ? 'success' : 'warning'}>
                            {entry.paymentStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <Button variant="outline" onClick={() => setShowFeeHistory(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Receipt Popup */}
      {showReceiptPopup && currentReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">Receipt Generated</h2>
              <p className="text-sm text-gray-500">{currentReceipt.receiptNumber}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(currentReceipt.subtotal)}</span>
              </div>
              {currentReceipt.discountAmount && currentReceipt.discountAmount > 0 && (
                <div className="flex justify-between mb-2 text-green-600">
                  <span>Discount ({currentReceipt.discountPercent}%):</span>
                  <span>-{formatCurrency(currentReceipt.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Net Amount:</span>
                <span>{formatCurrency(currentReceipt.netAmount)}</span>
              </div>
            </div>
            
            <div className="flex justify-center gap-2 mb-4">
              <Badge variant="info">{currentReceipt.paymentMethod.toUpperCase()}</Badge>
              <Badge variant="success">{currentReceipt.paymentStatus}</Badge>
            </div>
            
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handlePrintReceipt}>
                Print
              </Button>
              <Button variant="outline" onClick={handleWhatsAppReceipt}>
                WhatsApp
              </Button>
              <Button variant="primary" onClick={() => {
                setShowReceiptPopup(false);
                loadQueue();
              }}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* View Saved Medicine Bill Popup */}
      {showViewBillPopup && viewingMedicineBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Medicine Bill</h2>
                <p className="text-sm text-gray-500">
                  Created: {formatDate(viewingMedicineBill.createdAt)}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowViewBillPopup(false)}>
                Close
              </Button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Medicine</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Potency</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {viewingMedicineBill.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.medicine}</div>
                        {item.isCombination && (
                          <div className="text-xs text-gray-500">{item.combinationContent}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">{item.potency || '-'}</td>
                      <td className="px-4 py-2 text-center">{item.quantityDisplay || item.quantity}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Bill Summary */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(viewingMedicineBill.subtotal)}</span>
                    </div>
                    {viewingMedicineBill.discountPercent > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({viewingMedicineBill.discountPercent}%):</span>
                        <span>-{formatCurrency(viewingMedicineBill.discountAmount)}</span>
                      </div>
                    )}
                    {viewingMedicineBill.taxPercent > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({viewingMedicineBill.taxPercent}%):</span>
                        <span>+{formatCurrency(viewingMedicineBill.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(viewingMedicineBill.grandTotal)}</span>
                    </div>
                  </div>
                </div>
                {viewingMedicineBill.notes && (
                  <div className="mt-4 text-sm text-gray-600">
                    <strong>Notes:</strong> {viewingMedicineBill.notes}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowViewBillPopup(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => {
                // Open the prescription popup in bill edit mode
                if (viewingBillingItem) {
                  setShowViewBillPopup(false);
                  handleViewPrescription(viewingBillingItem);
                  setIsBillMode(true);
                }
              }}>
                Edit Bill
              </Button>
              <Button variant="outline" onClick={() => {
                // Print the saved bill
                const printContent = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>Medicine Bill</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; }
                      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                      .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
                      .item { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
                      .totals { margin-top: 15px; }
                      .totals div { display: flex; justify-content: space-between; margin: 5px 0; }
                      .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; }
                      @media print { body { padding: 0; } }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <h2 style="margin: 0;">HomeoPMS Clinic</h2>
                      <p style="margin: 5px 0;">Medicine Bill</p>
                      <div style="font-size: 14px;">Date: ${formatDate(viewingMedicineBill.createdAt)}</div>
                    </div>
                    <div class="items">
                      ${viewingMedicineBill.items.filter(item => item.amount > 0).map(item => `
                        <div class="item">
                          <span>${item.medicine}${item.potency ? ` (${item.potency})` : ''}</span>
                          <span>Qty: ${item.quantityDisplay || item.quantity}</span>
                          <span>${formatCurrency(item.amount)}</span>
                        </div>
                      `).join('')}
                    </div>
                    <div class="totals">
                      <div><span>Subtotal:</span><span>${formatCurrency(viewingMedicineBill.subtotal)}</span></div>
                      ${viewingMedicineBill.discountPercent > 0 ? `<div style="color: green;"><span>Discount (${viewingMedicineBill.discountPercent}%):</span><span>-${formatCurrency(viewingMedicineBill.discountAmount)}</span></div>` : ''}
                      ${viewingMedicineBill.taxPercent > 0 ? `<div><span>Tax (${viewingMedicineBill.taxPercent}%):</span><span>+${formatCurrency(viewingMedicineBill.taxAmount)}</span></div>` : ''}
                      <div class="grand-total"><span>Grand Total:</span><span>${formatCurrency(viewingMedicineBill.grandTotal)}</span></div>
                    </div>
                    <script>window.print();</script>
                  </body>
                  </html>
                `;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(printContent);
                  printWindow.document.close();
                }
              }}>
                Print
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
