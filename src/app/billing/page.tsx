"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { billingQueueDb, billingReceiptDb, patientDb, appointmentDb, feeHistoryDb, db, medicineBillDb, medicineAmountMemoryDb } from '@/lib/db/database';
import { pharmacyQueueDb, doctorPrescriptionDb, doctorVisitDb, doctorSettingsDb } from '@/lib/db/doctor-panel';
import type { PharmacyQueueItem, MedicineBill, MedicineBillItem } from '@/lib/db/schema';
import type { BillingQueueItem, BillingReceipt, BillingReceiptItem } from '@/lib/db/schema';
import type { DoctorPrescription, DoctorVisit } from '@/lib/db/schema';
import type { FeeHistoryEntry } from '@/types';
import { generatePrescriptionHTML } from '@/lib/prescription-formatter';

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

type TabType = 'pending' | 'completed' | 'history' | 'pendingSearch';

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
  const searchParams = useSearchParams();
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
    doseForm?: string;
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
  const [billPayment, setBillPayment] = useState(0);
  const [additionalCurrentPayment, setAdditionalCurrentPayment] = useState(0);
  const [prevPendingAmount, setPrevPendingAmount] = useState(0);
  const [payPrevPending, setPayPrevPending] = useState(0);
  const [billHasChanges, setBillHasChanges] = useState(false);
  const [originalBillData, setOriginalBillData] = useState<string>('');
  
  // View saved bill state
  const [showViewBillPopup, setShowViewBillPopup] = useState(false);
  const [viewingMedicineBill, setViewingMedicineBill] = useState<MedicineBill | null>(null);
  
  // Fee history state
  const [showFeeHistory, setShowFeeHistory] = useState(false);
  const [feeHistoryPatient, setFeeHistoryPatient] = useState<PatientInfo | null>(null);
  const [feeHistoryData, setFeeHistoryData] = useState<any[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyResults, setHistoryResults] = useState<PatientInfo[]>([]);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState<PatientInfo | null>(null);
  const [patientReceipts, setPatientReceipts] = useState<BillingReceipt[]>([]);
  const [patientMedicineBills, setPatientMedicineBills] = useState<MedicineBill[]>([]);
  
  // Pending search state
  const [pendingSearchType, setPendingSearchType] = useState<'fees' | 'bills'>('fees');
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [pendingSearchResults, setPendingSearchResults] = useState<PatientInfo[]>([]);
  const [selectedPendingPatient, setSelectedPendingPatient] = useState<PatientInfo | null>(null);
  const [pendingFees, setPendingFees] = useState<BillingQueueItemWithDetails[]>([]);
  const [pendingBills, setPendingBills] = useState<MedicineBill[]>([]);
  const [showAllPending, setShowAllPending] = useState(false);
  const [pendingSearchSelectedIndex, setPendingSearchSelectedIndex] = useState(-1);
  const handleHistorySearch = (query: string) => {
    setHistoryQuery(query);
    const results = (patientDb.search(query) as any[]).map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      mobileNumber: p.mobileNumber,
      registrationNumber: p.registrationNumber,
      age: p.age,
      sex: p.sex,
    }));
    setHistoryResults(results);
  };
  const loadPatientHistory = (patient: PatientInfo) => {
    setSelectedHistoryPatient(patient);
    const receipts = billingReceiptDb.getByPatient(patient.id) as unknown as BillingReceipt[];
    const bills = medicineBillDb.getByPatientId(patient.id) as unknown as MedicineBill[];
    setPatientReceipts(receipts);
    setPatientMedicineBills(bills);
  };
  
  // Pending search handlers
  const handlePendingSearch = (query: string) => {
    setPendingSearchQuery(query);
    setPendingSearchSelectedIndex(-1);
    if (query.trim().length < 2) {
      setPendingSearchResults([]);
      return;
    }
    const results = (patientDb.search(query) as any[]).map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      mobileNumber: p.mobileNumber,
      registrationNumber: p.registrationNumber,
      age: p.age,
      sex: p.sex,
    }));
    setPendingSearchResults(results);
  };
  
  const handlePendingSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (pendingSearchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPendingSearchSelectedIndex(prev => 
        prev < pendingSearchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPendingSearchSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (pendingSearchSelectedIndex >= 0 && pendingSearchSelectedIndex < pendingSearchResults.length) {
        loadPendingForPatient(pendingSearchResults[pendingSearchSelectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setPendingSearchResults([]);
      setPendingSearchSelectedIndex(-1);
    }
  };
  
  const loadPendingForPatient = (patient: PatientInfo) => {
    setSelectedPendingPatient(patient);
    setShowAllPending(false);
    
    // Clear search results and query to close dropdown
    setPendingSearchResults([]);
    setPendingSearchQuery('');
    setPendingSearchSelectedIndex(-1);
    
    if (pendingSearchType === 'fees') {
      // Get all pending billing queue items for this patient
      const allBilling = billingQueueDb.getAll() as BillingQueueItem[];
      const patientPendingFees = allBilling.filter((item) => 
        item.patientId === patient.id && 
        (item.status === 'pending' || item.paymentStatus === 'pending' || item.paymentStatus === 'partial') &&
        item.netAmount > 0 // Only show items with amount > 0
      );
      
      // Enrich with patient and visit details
      const enriched = patientPendingFees.map((item) => {
        const p = patientDb.getById(item.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(item.visitId);
        const prescriptions = doctorPrescriptionDb.getByVisit(item.visitId);
        return {
          ...item,
          patient: p,
          visit,
          prescriptions
        };
      });
      
      setPendingFees(enriched);
      setPendingBills([]);
    } else {
      // Get all pending medicine bills for this patient
      const allBills = medicineBillDb.getByPatientId(patient.id) as unknown as MedicineBill[];
      const patientPendingBills = allBills.filter((bill) => {
        const pendingAmount = bill.grandTotal - (bill.amountPaid || 0);
        return (bill.paymentStatus === 'pending' || bill.paymentStatus === 'partial') && pendingAmount > 0;
      });
      
      setPendingBills(patientPendingBills);
      setPendingFees([]);
    }
  };
  
  const loadAllPending = () => {
    setShowAllPending(true);
    setSelectedPendingPatient(null);
    
    if (pendingSearchType === 'fees') {
      // Get all pending billing queue items
      const allBilling = billingQueueDb.getAll() as BillingQueueItem[];
      const allPendingFees = allBilling.filter((item) => {
        const patient = patientDb.getById(item.patientId);
        return patient && 
               (item.status === 'pending' || item.paymentStatus === 'pending' || item.paymentStatus === 'partial') &&
               item.netAmount > 0; // Only show items with amount > 0
      });
      
      // Enrich with patient and visit details
      const enriched = allPendingFees.map((item) => {
        const p = patientDb.getById(item.patientId) as PatientInfo | undefined;
        const visit = doctorVisitDb.getById(item.visitId);
        const prescriptions = doctorPrescriptionDb.getByVisit(item.visitId);
        return {
          ...item,
          patient: p,
          visit,
          prescriptions
        };
      });
      
      setPendingFees(enriched);
      setPendingBills([]);
    } else {
      // Get all pending medicine bills
      const allBills = medicineBillDb.getAll() as unknown as MedicineBill[];
      const allPendingBills = allBills.filter((bill) => {
        const patient = patientDb.getById(bill.patientId);
        const pendingAmount = bill.grandTotal - (bill.amountPaid || 0);
        return patient && 
               (bill.paymentStatus === 'pending' || bill.paymentStatus === 'partial') &&
               pendingAmount > 0;
      });
      
      setPendingBills(allPendingBills);
      setPendingFees([]);
    }
  };
  const handleViewReceiptHistory = (receipt: BillingReceipt) => {
    setCurrentReceipt(receipt);
    setShowReceiptPopup(true);
  };
  const handlePrintReceiptDirect = (receipt: BillingReceipt) => {
    const patient = patientDb.getById(receipt.patientId) as PatientInfo;
    
    // Load print settings
    const printSettings = (() => {
      try {
        const raw = doctorSettingsDb.get("printSettings");
        if (raw) {
          return JSON.parse(raw as string);
        }
      } catch {}
      return {
        feeReceiptHeader: "",
        feeReceiptFooter: "",
        feeReceiptPrintEnabled: true
      };
    })();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${receipt.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .header-text { white-space: pre-wrap; font-size: 12px; margin-bottom: 10px; }
          .receipt-no { font-size: 14px; font-weight: bold; }
          .patient-info { margin-bottom: 15px; }
          .patient-info div { margin: 5px 0; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
          .total div { display: flex; justify-content: space-between; margin: 5px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .footer-text { white-space: pre-wrap; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${printSettings.feeReceiptHeader ? `<div class="header-text">${printSettings.feeReceiptHeader}</div>` : '<h2 style="margin: 0;">HomeoPMS Clinic</h2>'}
          <p style="margin: 5px 0;">Receipt</p>
          <div class="receipt-no">${receipt.receiptNumber}</div>
        </div>
        <div class="patient-info">
          <div><strong>Patient:</strong> ${patient?.firstName} ${patient?.lastName}</div>
          <div><strong>Regd No:</strong> ${patient?.registrationNumber}</div>
          <div><strong>Mobile:</strong> ${patient?.mobileNumber}</div>
          <div><strong>Date:</strong> ${formatDate(receipt.createdAt)}</div>
        </div>
        <div class="items">
          ${receipt.items.map(item => `
            <div class="item">
              <span>${item.description}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
        </div>
        <div class="total">
          <div>
            <span>Subtotal:</span>
            <span>${formatCurrency(receipt.subtotal)}</span>
          </div>
          ${receipt.discountAmount ? `
            <div>
              <span>Discount (${receipt.discountPercent}%):</span>
              <span>-${formatCurrency(receipt.discountAmount)}</span>
            </div>
          ` : ''}
          <div style="border-top: 1px solid ${'#'}000; padding-top: 5px;">
            <span>Net Amount:</span>
            <span>${formatCurrency(receipt.netAmount)}</span>
          </div>
          <div>
            <span>Payment:</span>
            <span>${receipt.paymentStatus === 'exempt' ? 'EXEMPT' : receipt.paymentMethod.toUpperCase()}</span>
          </div>
          <div>
            <span>Status:</span>
            <span>${receipt.paymentStatus === 'exempt' ? 'EXEMPT' : 'PAID'}</span>
          </div>
        </div>
        <div class="footer">
          ${printSettings.feeReceiptFooter ? `<div class="footer-text">${printSettings.feeReceiptFooter}</div>` : '<p>Thank you for your visit!</p><p>Get well soon.</p>'}
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
  const handleViewMedicineBillHistory = (bill: MedicineBill) => {
    setViewingMedicineBill(bill);
    setShowViewBillPopup(true);
  };
  const handlePrintMedicineBillDirect = (bill: MedicineBill) => {
    // Load print settings
    const printSettings = (() => {
      try {
        const raw = doctorSettingsDb.get("printSettings");
        if (raw) {
          return JSON.parse(raw as string);
        }
      } catch {}
      return {
        billHeader: "",
        billFooter: "",
        billPrintEnabled: true
      };
    })();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medicine Bill</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header-text { white-space: pre-wrap; font-size: 12px; margin-bottom: 10px; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item-header { display: flex; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px; font-size: 14px; }
          .item { display: flex; margin: 8px 0; font-size: 14px; }
          .item-name { flex: 1; padding-right: 10px; }
          .item-qty { width: 80px; text-align: center; }
          .item-amount { width: 100px; text-align: right; }
          .totals { margin-top: 15px; }
          .totals div { display: flex; justify-content: space-between; margin: 5px 0; }
          .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .footer-text { white-space: pre-wrap; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${printSettings.billHeader ? `<div class="header-text">${printSettings.billHeader}</div>` : '<h2 style="margin: 0;">HomeoPMS Clinic</h2>'}
          <p style="margin: 5px 0;">Medicine Bill</p>
          <div style="font-size: 14px;">Date: ${formatDate(bill.createdAt)}</div>
        </div>
        <div class="items">
          <div class="item-header">
            <span class="item-name">Medicine Name</span>
            <span class="item-qty">Qty</span>
            <span class="item-amount">Amount</span>
          </div>
          ${bill.items.filter(item => item.amount > 0).map(item => {
            // Format: Medicine Potency QuantityDisplay DoseForm
            const medicineName = [
              item.medicine,
              item.potency,
              item.quantityDisplay,
              item.doseForm
            ].filter(Boolean).join(' ');
            
            return `
            <div class="item">
              <span class="item-name">${medicineName}</span>
              <span class="item-qty">${item.quantity}</span>
              <span class="item-amount">${formatCurrency(item.amount)}</span>
            </div>
          `;
          }).join('')}
        </div>
        <div class="totals">
          <div><span>Subtotal:</span><span>${formatCurrency(bill.subtotal)}</span></div>
          ${bill.discountPercent > 0 ? `<div style="color: green;"><span>Discount (${bill.discountPercent}%):</span><span>-${formatCurrency(bill.discountAmount)}</span></div>` : ''}
          ${bill.taxPercent > 0 ? `<div><span>Tax (${bill.taxPercent}%):</span><span>+${formatCurrency(bill.taxAmount)}</span></div>` : ''}
          <div class="grand-total"><span>Grand Total:</span><span>${formatCurrency(bill.grandTotal)}</span></div>
        </div>
        <div class="footer">
          ${printSettings.billFooter ? `<div class="footer-text">${printSettings.billFooter}</div>` : '<p>Thank you for your visit!</p><p>Get well soon.</p>'}
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
  
  // Receipt state
  const [showReceiptPopup, setShowReceiptPopup] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<BillingReceipt | null>(null);

  // Load queue data
  const loadQueue = useCallback(() => {
    setIsLoading(true);
    
    // Clean up old self-repeat items (where visit date is before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allItemsBeforeCleanup = billingQueueDb.getAll() as BillingQueueItem[];
    
    // Filter out items for deleted patients
    const validItems = allItemsBeforeCleanup.filter((item) => {
      const patient = patientDb.getById(item.patientId);
      return patient !== undefined && patient !== null;
    });
    
    const oldSelfRepeats = validItems.filter((item) => {
      if (item.feeType !== 'Self Repeat by P/T') return false;
      
      // Check the visit date, not the billing item creation date
      const visit = doctorVisitDb.getById(item.visitId);
      if (!visit) return true; // Delete if visit not found
      
      const visitDate = visit.visitDate instanceof Date ? visit.visitDate : new Date(visit.visitDate);
      visitDate.setHours(0, 0, 0, 0);
      
      const isOld = visitDate < today;
      const isCompleted = item.status === 'completed';
      
      // Remove if visit is old OR billing is completed
      return isOld || isCompleted;
    });
    
    if (oldSelfRepeats.length > 0) {
      console.log('[Billing] Cleaning up self-repeat items:', {
        count: oldSelfRepeats.length,
        items: oldSelfRepeats.map(i => {
          const visit = doctorVisitDb.getById(i.visitId);
          return {
            id: i.id,
            billingCreatedAt: i.createdAt,
            visitDate: visit?.visitDate,
            status: i.status,
            feeType: i.feeType
          };
        })
      });
      oldSelfRepeats.forEach((item) => {
        billingQueueDb.delete(item.id);
      });
    }
    
    // Get all items from billing queue AFTER cleanup (and filter deleted patients again)
    const allItems = (billingQueueDb.getAll() as BillingQueueItem[]).filter((item) => {
      const patient = patientDb.getById(item.patientId);
      return patient !== undefined && patient !== null;
    });
    
    // Filter by selected date (use ref for current value)
    const currentDate = selectedDateRef.current;
    const selectedDateStr = currentDate.toDateString();
    const filteredByDate = allItems.filter((item) => {
      const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      return itemDate.toDateString() === selectedDateStr;
    });
    
    // Update fees from appointments for pending items (SKIP items from prescription module)
    filteredByDate.forEach((item) => {
      if (item.status === 'pending') {
        // SKIP items from prescription module - they have explicit fee type set
        const visit = doctorVisitDb.getById(item.visitId);
        if (visit && visit.remarksToFrontdesk && visit.remarksToFrontdesk.startsWith('FEE_TYPE:')) {
          console.log('[Billing] Skipping fee update for prescription module item:', item.id, 'Fee type:', visit.remarksToFrontdesk);
          return;
        }
        
        // SKIP self-repeat items - check both feeType and visit flag
        if (item.feeType === 'Self Repeat by P/T' || (visit && visit.isSelfRepeat)) {
          console.log('[Billing] Skipping fee update for self-repeat item:', item.id);
          return;
        }
        
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
    
    // Re-fetch items after potential updates (still filter by date and deleted patients)
    const updatedItems = (billingQueueDb.getAll() as BillingQueueItem[]).filter((item) => {
      const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      const patient = patientDb.getById(item.patientId);
      return itemDate.toDateString() === selectedDateStr && patient !== undefined && patient !== null;
    });
    
    // Separate pending and completed items
    const pending = updatedItems.filter(
      (item) => item.status === 'pending' || item.status === 'paid'
    );
    const completed = updatedItems.filter(
      (item) => item.status === 'completed'
    );
    
    console.log('[Billing] Load queue results:', {
      totalItems: updatedItems.length,
      pendingCount: pending.length,
      completedCount: completed.length,
      selfRepeatItems: updatedItems.filter(i => i.feeType === 'Self Repeat by P/T').map(i => ({
        id: i.id,
        status: i.status,
        feeType: i.feeType
      }))
    });
    
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
    
    setQueueItems(enrichItems(sortByDateDesc(pending))); // Newest first
    setCompletedItems(enrichItems(sortByDateDesc(completed)));
    setIsLoading(false);
  }, []);

  // Check pharmacy queue for prepared items and add to billing
  const checkPharmacyQueue = useCallback(() => {
    const allPharmacyItems = pharmacyQueueDb.getAll() as PharmacyQueueItem[];
    
    // Clean up old self-repeat pharmacy items (created before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oldSelfRepeatPharmacy = allPharmacyItems.filter(item => {
      if (item.source !== 'self-repeat') return false;
      const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() < today.getTime();
    });
    
    if (oldSelfRepeatPharmacy.length > 0) {
      console.log('[Billing] Cleaning up old self-repeat pharmacy items:', {
        count: oldSelfRepeatPharmacy.length,
        items: oldSelfRepeatPharmacy.map(i => ({
          id: i.id,
          createdAt: i.createdAt,
          source: i.source
        }))
      });
      oldSelfRepeatPharmacy.forEach(item => pharmacyQueueDb.delete(item.id));
    }
    
    // Filter prepared items, excluding old self-repeats and deleted patients
    const preparedPharmacyItems = allPharmacyItems.filter(item => {
      if (item.status !== 'prepared') return false;
      
      // Filter out items for deleted patients
      const patient = patientDb.getById(item.patientId);
      if (!patient) return false;
      
      // For self-repeat items, only process if created today
      if (item.source === 'self-repeat') {
        const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
        const itemDateOnly = new Date(itemDate);
        itemDateOnly.setHours(0, 0, 0, 0);
        const isToday = itemDateOnly.getTime() >= today.getTime();
        
        console.log('[Billing] Self-repeat pharmacy item date check:', {
          id: item.id,
          createdAt: itemDate,
          itemDateOnly: itemDateOnly,
          today: today,
          isToday: isToday
        });
        
        return isToday;
      }
      
      return true;
    });
    
    console.log('[Billing] Checking pharmacy queue:', {
      totalItems: allPharmacyItems.length,
      preparedItems: preparedPharmacyItems.length,
      selfRepeatPrepared: preparedPharmacyItems.filter(i => i.source === 'self-repeat').length,
      preparedItemsDetails: preparedPharmacyItems.map(i => ({
        id: i.id,
        visitId: i.visitId,
        source: i.source,
        status: i.status,
        createdAt: i.createdAt
      }))
    });
    
    preparedPharmacyItems.forEach((pharmacyItem: PharmacyQueueItem) => {
      const visit = doctorVisitDb.getById(pharmacyItem.visitId);
      let feeAmount = 300;
      let feeType = 'Consultation';
      let paymentStatus: 'pending' | 'paid' | 'partial' | 'exempt' = 'pending';
      
      // Check if visit has fee type stored in remarksToFrontdesk (from prescription module)
      if (visit && visit.remarksToFrontdesk && visit.remarksToFrontdesk.startsWith('FEE_TYPE:')) {
        const storedFeeType = visit.remarksToFrontdesk.replace('FEE_TYPE:', '');
        feeType = storedFeeType;
        
        // Set fee amount based on fee type
        if (storedFeeType === 'Self Repeat by P/T') {
          feeAmount = 0;
          paymentStatus = 'pending';
        } else if (storedFeeType === 'New Patient') {
          feeAmount = 500;
        } else if (storedFeeType === 'Follow Up' || storedFeeType === 'Consultation') {
          feeAmount = 300;
        }
        
        console.log('[Billing] Using fee type from visit remarks:', {
          visitId: pharmacyItem.visitId,
          feeType: storedFeeType,
          feeAmount,
          paymentStatus
        });
      }
      // Check if this is a self-repeat prescription (fallback check)
      else if (pharmacyItem.source === 'self-repeat' || (visit && visit.isSelfRepeat)) {
        feeAmount = 0; // Self-repeat starts with 0 fee
        feeType = 'Self Repeat by P/T';
        paymentStatus = 'pending'; // Pending, can be edited
        console.log('[Billing] Processing self-repeat item (fallback):', {
          visitId: pharmacyItem.visitId,
          pharmacySource: pharmacyItem.source,
          visitIsSelfRepeat: visit?.isSelfRepeat,
          feeAmount,
          feeType,
          paymentStatus
        });
      } else if (pharmacyItem.appointmentId) {
        const appointment = appointmentDb.getById(pharmacyItem.appointmentId);
        if (appointment) {
          const apt = appointment as { feeAmount?: number; feeType?: string; feeStatus?: string };
          if (apt.feeAmount !== undefined && apt.feeAmount !== null) feeAmount = apt.feeAmount;
          if (apt.feeType) feeType = apt.feeType || feeType;
          if (apt.feeStatus) paymentStatus = (apt.feeStatus as typeof paymentStatus) || paymentStatus;
        }
      } else {
        // No appointment and not self-repeat, check fees table
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
        } else if (visit) {
          if (visit.visitNumber === 1) {
            feeAmount = 500;
            feeType = 'New Patient';
          } else {
            feeAmount = 300;
            feeType = 'Follow Up';
          }
        }
      }
      
      const allBilling = billingQueueDb.getAll() as BillingQueueItem[];
      
      // For self-repeat items, check if billing already exists for this specific visit
      // Since self-repeats create NEW visits with today's date, we just check by visitId
      let existingBilling;
      if (pharmacyItem.source === 'self-repeat') {
        existingBilling = allBilling.find((b) => b.visitId === pharmacyItem.visitId);
      } else {
        // For regular items, check by visitId as before
        existingBilling = allBilling.find((b) => b.visitId === pharmacyItem.visitId);
      }
      
      console.log('[Billing] Checking existing billing for visitId:', pharmacyItem.visitId, {
        isSelfRepeat: pharmacyItem.source === 'self-repeat',
        existingBilling: existingBilling ? 'found' : 'not found',
        willCreate: !existingBilling
      });
      
      if (!existingBilling) {
        const newBillingItem = {
          visitId: pharmacyItem.visitId,
          patientId: pharmacyItem.patientId,
          appointmentId: pharmacyItem.appointmentId,
          prescriptionIds: pharmacyItem.prescriptionIds,
          status: 'pending' as const,
          feeAmount,
          feeType,
          netAmount: feeAmount,
          paymentStatus,
        };
        console.log('[Billing] Creating new billing item:', newBillingItem);
        billingQueueDb.create(newBillingItem);
      } else {
        // For self-repeat items, don't update if already exists (allow manual fee editing)
        if (pharmacyItem.source === 'self-repeat') {
          console.log('[Billing] Self-repeat billing item already exists, skipping update to preserve manual edits');
          return;
        }
        
        // For regular items, update as before
        const preparedIds = (pharmacyItem.preparedPrescriptionIds || pharmacyItem.prescriptionIds || []) as string[];
        const existingIds = (existingBilling.prescriptionIds || []) as string[];
        const hasNewMeds = preparedIds.some((id) => !existingIds.includes(id));
        const pharmacyUpdatedAt = (pharmacyItem.updatedAt instanceof Date) ? pharmacyItem.updatedAt : new Date(pharmacyItem.updatedAt || new Date());
        const billingUpdatedAt = (existingBilling.updatedAt instanceof Date) ? existingBilling.updatedAt : new Date(existingBilling.updatedAt || existingBilling.createdAt || new Date());
        const shouldReopen = (existingBilling.status === 'completed') && hasNewMeds && (pharmacyUpdatedAt.getTime() > billingUpdatedAt.getTime());
        
        billingQueueDb.update(existingBilling.id, {
          feeAmount,
          feeType,
          netAmount: feeAmount - (existingBilling.discountAmount || 0),
          paymentStatus,
          updatedAt: new Date(),
          prescriptionIds: preparedIds,
          status: shouldReopen ? 'pending' : existingBilling.status,
        });
      }
      
      // Keep pharmacy status unchanged (prepared stays visible under Pharmacy's Prepared tab)
    });
    
    loadQueue();
  }, [loadQueue]);

  // Initial load and interval for pharmacy queue check
  useEffect(() => {
    console.log('[Billing] Setting up pharmacy queue check interval');
    
    // Set up interval to check for new items from pharmacy
    const interval = setInterval(() => {
      console.log('[Billing] Running pharmacy queue check...');
      checkPharmacyQueue();
    }, 3000);
    
    return () => {
      console.log('[Billing] Cleaning up pharmacy queue check interval');
      clearInterval(interval);
    };
  }, [checkPharmacyQueue]);

  // Initial load on mount
  useEffect(() => {
    // Clean up old self-repeat items (where visit date is before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allBilling = billingQueueDb.getAll() as BillingQueueItem[];
    const oldSelfRepeats = allBilling.filter((item) => {
      if (item.feeType !== 'Self Repeat by P/T') return false;
      
      // Check the visit date, not the billing item creation date
      const visit = doctorVisitDb.getById(item.visitId);
      if (!visit) return true; // Delete if visit not found
      
      const visitDate = visit.visitDate instanceof Date ? visit.visitDate : new Date(visit.visitDate);
      visitDate.setHours(0, 0, 0, 0);
      
      const isOld = visitDate < today;
      const isCompleted = item.status === 'completed';
      
      // Remove if visit is old OR billing is completed
      return isOld || isCompleted;
    });
    
    if (oldSelfRepeats.length > 0) {
      console.log('[Billing] Initial cleanup of self-repeat items:', {
        count: oldSelfRepeats.length,
        items: oldSelfRepeats.map(i => {
          const visit = doctorVisitDb.getById(i.visitId);
          return {
            id: i.id,
            billingCreatedAt: i.createdAt,
            visitDate: visit?.visitDate,
            status: i.status,
            feeType: i.feeType
          };
        })
      });
      oldSelfRepeats.forEach((item) => {
        billingQueueDb.delete(item.id);
      });
    }
    
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    const handler = () => {
      loadQueue();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('fees-updated', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('fees-updated', handler as EventListener);
      }
    };
  }, [loadQueue]);
  
  // Track changes in bill data
  useEffect(() => {
    if (!savedMedicineBill) {
      // New bill, always allow saving
      setBillHasChanges(true);
      return;
    }
    
    // Create current bill data snapshot
    const currentData = JSON.stringify({
      items: billItems.map(item => ({
        prescriptionId: item.prescriptionId,
        medicine: item.medicine,
        potency: item.potency,
        quantity: item.quantity,
        amount: item.amount
      })),
      discount: billDiscount,
      tax: billTax,
      notes: billNotes,
      payment: billPayment,
      additionalPayment: additionalCurrentPayment,
      payPrevPending: payPrevPending
    });
    
    // Compare with original
    if (originalBillData && currentData !== originalBillData) {
      setBillHasChanges(true);
    } else if (originalBillData) {
      setBillHasChanges(false);
    }
  }, [billItems, billDiscount, billTax, billNotes, billPayment, additionalCurrentPayment, payPrevPending, savedMedicineBill, originalBillData]);

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
    
    // Check if receipt already exists - try both receiptNumber and billingQueueId
    let existingReceipt: BillingReceipt | undefined;
    
    if (selectedItem.receiptNumber) {
      existingReceipt = billingReceiptDb.getByReceiptNumber(selectedItem.receiptNumber) as BillingReceipt | undefined;
    }
    
    // If not found by receipt number, try by billing queue ID
    if (!existingReceipt) {
      existingReceipt = billingReceiptDb.getByBillingQueueId(selectedItem.id) as BillingReceipt | undefined;
    }
    
    // Check if fee amount changed
    const feeAmountChanged = editingFee.feeAmount !== selectedItem.feeAmount || 
                             editingFee.netAmount !== selectedItem.netAmount;
    
    // Determine new payment status based on payment method and receipt existence
    let newPaymentStatus: 'pending' | 'paid' | 'partial' | 'exempt';
    
    if (editingFee.paymentMethod === 'exempt' || editingFee.feeAmount === 0) {
      newPaymentStatus = 'exempt';
    } else {
      // Payment is being made, so mark as paid
      newPaymentStatus = 'paid';
    }
    
    // Generate or update receipt
    let receiptNumber = selectedItem.receiptNumber;
    
    if (!existingReceipt && newPaymentStatus === 'paid') {
      // Generate new receipt
      receiptNumber = billingQueueDb.generateReceiptNumber();
      
      const receiptItems: BillingReceiptItem[] = [
        {
          description: selectedItem.feeType,
          quantity: 1,
          unitPrice: editingFee.feeAmount,
          total: editingFee.feeAmount
        }
      ];
      
      const receipt = {
        receiptNumber,
        billingQueueId: selectedItem.id,
        patientId: selectedItem.patientId,
        visitId: selectedItem.visitId,
        items: receiptItems,
        subtotal: editingFee.feeAmount,
        discountPercent: editingFee.discountPercent,
        discountAmount: editingFee.discountAmount,
        netAmount: editingFee.netAmount,
        paymentMethod: editingFee.paymentMethod as 'cash' | 'card' | 'upi' | 'cheque' | 'insurance' | 'exempt',
        paymentStatus: 'paid' as const
      };
      
      const createdReceipt = billingReceiptDb.create(receipt) as unknown as BillingReceipt;
      setCurrentReceipt(createdReceipt);
      
      console.log('[Billing] Generated new receipt:', receiptNumber);
    } else if (existingReceipt && feeAmountChanged) {
      // Update existing receipt with new amounts
      billingReceiptDb.update(existingReceipt.id, {
        items: [{
          description: selectedItem.feeType,
          quantity: 1,
          unitPrice: editingFee.feeAmount,
          total: editingFee.feeAmount
        }],
        subtotal: editingFee.feeAmount,
        discountPercent: editingFee.discountPercent,
        discountAmount: editingFee.discountAmount,
        netAmount: editingFee.netAmount,
        paymentMethod: editingFee.paymentMethod === 'exempt' || editingFee.feeAmount === 0 
          ? 'exempt' as const 
          : (editingFee.paymentMethod as 'cash' | 'card' | 'upi' | 'cheque' | 'insurance'),
        paymentStatus: editingFee.paymentMethod === 'exempt' || editingFee.feeAmount === 0 
          ? 'exempt' as const 
          : 'paid' as const
      });
      
      setCurrentReceipt(existingReceipt);
      console.log('[Billing] Updated existing receipt:', existingReceipt.receiptNumber);
    } else if (existingReceipt) {
      setCurrentReceipt(existingReceipt);
    }
    
    // Update billing queue item
    billingQueueDb.update(selectedItem.id, {
      feeAmount: editingFee.feeAmount,
      discountPercent: editingFee.discountPercent,
      discountAmount: editingFee.discountAmount,
      netAmount: editingFee.netAmount,
      paymentMethod: editingFee.paymentMethod,
      notes: editingFee.notes,
      paymentStatus: newPaymentStatus,
      receiptNumber: receiptNumber,
      status: newPaymentStatus === 'paid' ? 'paid' : 'pending',
      paidAt: newPaymentStatus === 'paid' ? new Date() : undefined
    });
    
    // Sync fee changes back to appointment
    if (selectedItem.appointmentId) {
      appointmentDb.update(selectedItem.appointmentId, {
        feeAmount: editingFee.feeAmount,
        feeType: selectedItem.feeType,
        feeStatus: newPaymentStatus
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
        paymentStatus: newPaymentStatus,
        updatedAt: new Date(),
      });
      console.log('[Billing] Synced fee to fees table:', relatedFee.id);
    }
    
    setShowFeePopup(false);
    
    // Refresh pending lists if in pending search tab
    if (activeTab === 'pendingSearch') {
      if (selectedPendingPatient) {
        loadPendingForPatient(selectedPendingPatient);
      } else if (showAllPending) {
        loadAllPending();
      }
    }
    
    loadQueue();
    
    // Show receipt print option if payment was made
    if (newPaymentStatus === 'paid' && currentReceipt) {
      setShowReceiptPopup(true);
    }
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
      const billedIds = (existingBill.items || []).map(it => it.prescriptionId);
      const currentPrescriptions = item.prescriptions || [];
      const newRxs = currentPrescriptions.filter(rx => rx.id && !billedIds.includes(rx.id));
      
      if ((existingBill.paymentStatus || 'pending') === 'paid') {
        // Previous prescription billed: start new bill with only new medicines
        setSavedMedicineBill(null);
        setBillItems(newRxs.map(rx => {
          const memory = medicineAmountMemoryDb.getByMedicine(rx.medicine, rx.potency);
          const lastAmount = memory ? (memory as { amount: number }).amount : 0;
          return {
            id: generateId(),
            prescriptionId: rx.id || generateId(),
            medicine: rx.medicine,
            potency: rx.potency,
            quantityDisplay: rx.quantity || '',
            quantity: rx.bottles || 1,
            doseForm: rx.doseForm,
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
        setBillPayment(0);
        setAdditionalCurrentPayment(0);
        setPrevPendingAmount(0);
        setPayPrevPending(0);
      } else {
        // Previous prescription not billed: show old + new together
        setSavedMedicineBill(existingBill);
        const existingItems = existingBill.items.map(billItem => ({
          id: generateId(),
          prescriptionId: billItem.prescriptionId,
          medicine: billItem.medicine,
          potency: billItem.potency,
          quantityDisplay: billItem.quantityDisplay || '',
          quantity: billItem.quantity,
          doseForm: undefined,
          dosePattern: billItem.dosePattern,
          frequency: billItem.frequency,
          duration: billItem.duration,
          isCombination: billItem.isCombination,
          combinationContent: billItem.combinationContent,
          amount: billItem.amount
        }));
        const newItems = newRxs.map(rx => {
          const memory = medicineAmountMemoryDb.getByMedicine(rx.medicine, rx.potency);
          const lastAmount = memory ? (memory as { amount: number }).amount : 0;
          return {
            id: generateId(),
            prescriptionId: rx.id || generateId(),
            medicine: rx.medicine,
            potency: rx.potency,
            quantityDisplay: rx.quantity || '',
            quantity: rx.bottles || 1,
            doseForm: rx.doseForm,
            dosePattern: rx.dosePattern,
            frequency: rx.frequency,
            duration: rx.duration,
            isCombination: rx.isCombination,
            combinationContent: rx.combinationContent,
            amount: lastAmount
          };
        });
        setBillItems([...existingItems, ...newItems]);
        setBillDiscount(existingBill.discountPercent);
        setBillTax(existingBill.taxPercent);
        setBillNotes(existingBill.notes || '');
        setBillPayment(0);
        setAdditionalCurrentPayment(0);
        const previousBills = medicineBillDb.getByPatientId(item.patientId) as MedicineBill[];
        const prevPending = previousBills
          .filter(b => b.id !== existingBill.id)
          .find(b => (b.pendingAmount || 0) > 0);
        setPrevPendingAmount(prevPending ? (prevPending.pendingAmount || 0) : 0);
        setPayPrevPending(0);
      }
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
          doseForm: rx.doseForm,
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
      // Load previous pending for this patient
      const previousBills = medicineBillDb.getByPatientId(item.patientId) as MedicineBill[];
      const prevPending = previousBills.find(b => (b.pendingAmount || 0) > 0);
      setPrevPendingAmount(prevPending ? (prevPending.pendingAmount || 0) : 0);
      setBillPayment(0);
      setAdditionalCurrentPayment(0);
      setPayPrevPending(0);
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
  
  // Update bill item quantity
  const handleBillItemQuantityChange = (index: number, quantity: number) => {
    setBillItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = Math.max(1, quantity);
      
      // Calculate new amount based on quantity change
      // If current amount is set, calculate unit price and multiply by new quantity
      if (item.amount > 0 && item.quantity > 0) {
        const unitPrice = item.amount / item.quantity;
        const newAmount = unitPrice * newQty;
        updated[index] = { ...item, quantity: newQty, amount: newAmount };
      } else {
        updated[index] = { ...item, quantity: newQty };
      }
      
      return updated;
    });
  };
  
  // Delete bill item
  const handleDeleteBillItem = (index: number) => {
    setBillItems(prev => prev.filter((_, i) => i !== index));
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
    
    // Load print settings
    const printSettings = (() => {
      try {
        const raw = doctorSettingsDb.get("printSettings");
        if (raw) {
          return JSON.parse(raw as string);
        }
      } catch {}
      return {
        billHeader: "",
        billFooter: "",
        billPrintEnabled: true
      };
    })();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill - ${viewingPatient.firstName} ${viewingPatient.lastName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header-text { white-space: pre-wrap; font-size: 12px; margin-bottom: 10px; }
          .bill-title { font-size: 18px; font-weight: bold; }
          .patient-info { margin-bottom: 15px; }
          .patient-info div { margin: 5px 0; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item-header { display: flex; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px; font-size: 14px; }
          .item { display: flex; margin: 8px 0; font-size: 14px; }
          .item-name { flex: 1; padding-right: 10px; }
          .item-qty { width: 80px; text-align: center; }
          .item-amount { width: 100px; text-align: right; }
          .totals { margin-top: 15px; }
          .totals div { display: flex; justify-content: space-between; margin: 5px 0; }
          .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .footer-text { white-space: pre-wrap; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${printSettings.billHeader ? `<div class="header-text">${printSettings.billHeader}</div>` : '<h2 style="margin: 0;">HomeoPMS Clinic</h2>'}
          <p style="margin: 5px 0;">Medicine Bill</p>
          <div class="bill-title">Date: ${formatDate(new Date())}</div>
        </div>
        <div class="patient-info">
          <div><strong>Patient:</strong> ${viewingPatient.firstName} ${viewingPatient.lastName}</div>
          <div><strong>Regd No:</strong> ${viewingPatient.registrationNumber}</div>
          <div><strong>Mobile:</strong> ${viewingPatient.mobileNumber}</div>
        </div>
        <div class="items">
          <div class="item-header">
            <span class="item-name">Medicine Name</span>
            <span class="item-qty">Qty</span>
            <span class="item-amount">Amount</span>
          </div>
          ${billItems.filter(item => item.amount > 0).map(item => {
            // Format: Medicine Potency QuantityDisplay DoseForm
            const medicineName = [
              item.medicine,
              item.potency,
              item.quantityDisplay,
              item.doseForm
            ].filter(Boolean).join(' ');
            
            return `
            <div class="item">
              <span class="item-name">${medicineName}</span>
              <span class="item-qty">${item.quantity}</span>
              <span class="item-amount">${formatCurrency(item.amount)}</span>
            </div>
          `;
          }).join('')}
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
          ${printSettings.billFooter ? `<div class="footer-text">${printSettings.billFooter}</div>` : '<p>Thank you for your visit!</p><p>Get well soon.</p>'}
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
      doseForm: item.doseForm, // Dose form like Pills, Drops, etc.
      dosePattern: item.dosePattern,
      frequency: item.frequency,
      duration: item.duration,
      isCombination: item.isCombination,
      combinationContent: item.combinationContent,
      amount: item.amount
    }));
    
    const totalCurrent = getBillTotal();
    let newAmountPaid = 0;
    let newPending = 0;
    let paymentStatus: 'paid' | 'partial' | 'pending' = 'pending';
    let paidToCurrent = 0;
    // For existing bill, add to already paid; for new bill, use billPayment
    if (savedMedicineBill) {
      const existingPaid = savedMedicineBill.amountPaid || 0;
      paidToCurrent = Math.max(0, additionalCurrentPayment);
      newAmountPaid = existingPaid + paidToCurrent;
      newPending = Math.max(0, totalCurrent - newAmountPaid);
    } else {
      paidToCurrent = Math.max(0, billPayment);
      newAmountPaid = paidToCurrent;
      newPending = Math.max(0, totalCurrent - newAmountPaid);
    }
    paymentStatus = newPending === 0 ? 'paid' : (paidToCurrent > 0 ? 'partial' : 'pending');
    
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
      amountPaid: newAmountPaid,
      pendingAmount: newPending,
      paymentStatus,
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
    
    // Update previous bill pending if any payment entered
    const paidToPrev = Math.min(Math.max(0, payPrevPending), prevPendingAmount);
    if (prevPendingAmount > 0 && paidToPrev > 0) {
      const previousBills = medicineBillDb.getByPatientId(viewingPatient.id) as MedicineBill[];
      const prevBill = previousBills.find(b => (b.pendingAmount || 0) > 0 && (!savedMedicineBill || b.id !== savedMedicineBill.id));
      if (prevBill) {
        const newPrevPending = Math.max(0, (prevBill.pendingAmount || 0) - paidToPrev);
        const newPrevPaid = (prevBill.amountPaid || 0) + paidToPrev;
        const prevPaymentStatus = newPrevPending === 0 ? 'paid' : 'partial';
        medicineBillDb.update(prevBill.id, {
          pendingAmount: newPrevPending,
          amountPaid: newPrevPaid,
          paymentStatus: prevPaymentStatus
        });
      }
    }
    
    // Save amounts to memory for each medicine
    billItems.forEach(item => {
      if (item.amount > 0) {
        medicineAmountMemoryDb.upsert(item.medicine, item.potency, item.amount);
      }
    });
    
    // Update original bill data after save to reset change tracking
    const newOriginalData = JSON.stringify({
      items: billItems.map(item => ({
        prescriptionId: item.prescriptionId,
        medicine: item.medicine,
        potency: item.potency,
        quantity: item.quantity,
        amount: item.amount
      })),
      discount: billDiscount,
      tax: billTax,
      notes: billNotes,
      payment: billPayment,
      additionalPayment: additionalCurrentPayment,
      payPrevPending: payPrevPending
    });
    setOriginalBillData(newOriginalData);
    setBillHasChanges(false); // Reset change flag after save
    
    alert('Bill saved successfully!');
    loadQueue();
    
    // Refresh pending lists if in pending search tab
    if (activeTab === 'pendingSearch') {
      if (selectedPendingPatient) {
        loadPendingForPatient(selectedPendingPatient);
      } else if (showAllPending) {
        loadAllPending();
      }
    }
  };
  
  // View saved medicine bill
  const handleViewSavedBill = (item: BillingQueueItemWithDetails) => {
    const bill = medicineBillDb.getByBillingQueueId(item.id) as MedicineBill | undefined;
    if (bill) {
      setViewingMedicineBill(bill);
      setViewingBillingItem(item); // Store for edit functionality
      setViewingPatient(item.patient || null); // Store patient info
      setShowViewBillPopup(true);
    }
  };
  
  // Edit saved medicine bill
  const handleEditSavedBill = () => {
    if (!viewingMedicineBill || !viewingBillingItem) return;
    
    // Load the bill data into edit mode
    const billItemsData = viewingMedicineBill.items.map(billItem => ({
      id: generateId(),
      prescriptionId: billItem.prescriptionId,
      medicine: billItem.medicine,
      potency: billItem.potency,
      quantityDisplay: billItem.quantityDisplay || '',
      quantity: billItem.quantity,
      doseForm: undefined,
      dosePattern: billItem.dosePattern,
      frequency: billItem.frequency,
      duration: billItem.duration,
      isCombination: billItem.isCombination,
      combinationContent: billItem.combinationContent,
      amount: billItem.amount
    }));
    
    setBillItems(billItemsData);
    setBillDiscount(viewingMedicineBill.discountPercent);
    setBillTax(viewingMedicineBill.taxPercent);
    setBillNotes(viewingMedicineBill.notes || '');
    setSavedMedicineBill(viewingMedicineBill);
    
    // Load payment info
    const alreadyPaid = viewingMedicineBill.amountPaid || 0;
    const currentPending = viewingMedicineBill.pendingAmount || 0;
    setBillPayment(0);
    setAdditionalCurrentPayment(0);
    
    // Load previous pending
    const previousBills = medicineBillDb.getByPatientId(viewingBillingItem.patientId) as MedicineBill[];
    const prevPending = previousBills
      .filter(b => b.id !== viewingMedicineBill.id)
      .find(b => (b.pendingAmount || 0) > 0);
    setPrevPendingAmount(prevPending ? (prevPending.pendingAmount || 0) : 0);
    setPayPrevPending(0);
    
    // Store original bill data for change detection
    const originalData = JSON.stringify({
      items: billItemsData.map(item => ({
        prescriptionId: item.prescriptionId,
        medicine: item.medicine,
        potency: item.potency,
        quantity: item.quantity,
        amount: item.amount
      })),
      discount: viewingMedicineBill.discountPercent,
      tax: viewingMedicineBill.taxPercent,
      notes: viewingMedicineBill.notes || '',
      payment: 0,
      additionalPayment: 0,
      payPrevPending: 0
    });
    setOriginalBillData(originalData);
    setBillHasChanges(false); // No changes initially
    
    // Load prescriptions for viewing
    setViewingPrescriptions(viewingBillingItem.prescriptions || []);
    
    // Close view popup and open edit mode
    setShowViewBillPopup(false);
    setShowPrescriptionPopup(true);
    setIsBillMode(true);
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
  const [showReceiptConfirm, setShowReceiptConfirm] = useState(false);
  const [receiptItemToGenerate, setReceiptItemToGenerate] = useState<BillingQueueItemWithDetails | null>(null);
  
  const handleGenerateReceipt = (item: BillingQueueItemWithDetails) => {
    setReceiptItemToGenerate(item);
    setShowReceiptConfirm(true);
  };
  
  const confirmGenerateReceipt = () => {
    if (!receiptItemToGenerate) return;
    
    const item = receiptItemToGenerate;
    const receiptNumber = billingQueueDb.generateReceiptNumber();
    
    const receiptItems: BillingReceiptItem[] = [
      {
        description: item.feeType,
        quantity: 1,
        unitPrice: item.feeAmount,
        total: item.feeAmount
      }
    ];
    
    // Determine payment method and status based on exempt status
    let paymentMethod: 'cash' | 'card' | 'upi' | 'cheque' | 'insurance' | 'exempt' = 'cash';
    let paymentStatus: 'paid' | 'pending' | 'partial' | 'refunded' | 'exempt' = 'paid';
    
    if (item.paymentStatus === 'exempt' || item.feeAmount === 0) {
      paymentMethod = 'exempt';
      paymentStatus = 'exempt';
    } else {
      paymentMethod = (item.paymentMethod || 'cash') as typeof paymentMethod;
      paymentStatus = 'paid';
    }
    
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
      paymentMethod,
      paymentStatus
    };
    
    const createdReceipt = billingReceiptDb.create(receipt) as unknown as BillingReceipt;
    setCurrentReceipt(createdReceipt);
    
    // Update billing queue item
    if (paymentStatus === 'exempt') {
      billingQueueDb.update(item.id, {
        status: 'completed',
        paymentStatus: 'exempt',
        receiptNumber,
        paidAt: new Date(), // Add payment timestamp
        completedAt: new Date() // Add completion timestamp
      });
    } else {
      billingQueueDb.update(item.id, {
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod,
        receiptNumber,
        paidAt: new Date() // Add payment timestamp
      });
    }
    
    // Sync fee status back to appointment
    if (item.appointmentId) {
      appointmentDb.update(item.appointmentId, {
        feeStatus: paymentStatus === 'exempt' ? 'exempt' : 'paid',
        feeAmount: item.feeAmount,
        feeType: item.feeType
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fees-updated', { detail: { patientId: item.patientId, visitId: item.visitId } }));
    }
    
    setShowReceiptConfirm(false);
    setReceiptItemToGenerate(null);
    setShowReceiptPopup(true);
    loadQueue();
  };

  // Print receipt
  const handlePrintFeeReceipt = () => {
    if (!currentReceipt) return;
    
    const patient = patientDb.getById(currentReceipt.patientId) as PatientInfo;
    
    // Load print settings
    const printSettings = (() => {
      try {
        const raw = doctorSettingsDb.get("printSettings");
        if (raw) {
          return JSON.parse(raw as string);
        }
      } catch {}
      return {
        feeReceiptHeader: "",
        feeReceiptFooter: "",
        feeReceiptPrintEnabled: true
      };
    })();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${currentReceipt.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .header-text { white-space: pre-wrap; font-size: 12px; margin-bottom: 10px; }
          .receipt-no { font-size: 14px; font-weight: bold; }
          .patient-info { margin-bottom: 15px; }
          .patient-info div { margin: 5px 0; }
          .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
          .total div { display: flex; justify-content: space-between; margin: 5px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .footer-text { white-space: pre-wrap; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${printSettings.feeReceiptHeader ? `<div class="header-text">${printSettings.feeReceiptHeader}</div>` : '<h2 style="margin: 0;">HomeoPMS Clinic</h2>'}
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
          ${printSettings.feeReceiptFooter ? `<div class="footer-text">${printSettings.feeReceiptFooter}</div>` : '<p>Thank you for your visit!</p><p>Get well soon.</p>'}
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

  // Load specific receipt by query param
  useEffect(() => {
    const receiptId = searchParams.get('receiptId');
    if (receiptId) {
      const rec = billingReceiptDb.getById(receiptId);
      if (rec) {
        setCurrentReceipt(rec as unknown as BillingReceipt);
        setShowReceiptPopup(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Send Fee Receipt via WhatsApp
  const handleWhatsAppReceipt = () => {
    if (!currentReceipt) {
      alert('No receipt data available');
      return;
    }

    const patient = patientDb.getById(currentReceipt.patientId) as PatientInfo;
    const phone = patient?.mobileNumber?.replace(/[^0-9]/g, '');
    
    let message = `*Fee Receipt*\n\n`;
    message += `*Receipt No:* ${currentReceipt.receiptNumber}\n`;
    message += `*Patient:* ${patient?.firstName} ${patient?.lastName}\n`;
    message += `*Regd No:* ${patient?.registrationNumber}\n`;
    message += `*Date:* ${formatDate(currentReceipt.createdAt)}\n\n`;
    
    message += `*Items:*\n`;
    currentReceipt.items.forEach((item) => {
      message += `${item.description}: ${formatCurrency(item.total)}\n`;
    });
    
    message += `\n*Subtotal:* ${formatCurrency(currentReceipt.subtotal)}\n`;
    if (currentReceipt.discountAmount && currentReceipt.discountAmount > 0) {
      message += `*Discount (${currentReceipt.discountPercent}%):* -${formatCurrency(currentReceipt.discountAmount)}\n`;
    }
    message += `*Net Amount:* ${formatCurrency(currentReceipt.netAmount)}\n`;
    message += `*Payment:* ${currentReceipt.paymentMethod.toUpperCase()}\n`;
    message += `*Status:* ${currentReceipt.paymentStatus === 'exempt' ? 'EXEMPT' : 'PAID'}\n`;
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Send Prescription via WhatsApp
  const handleWhatsAppPrescription = () => {
    if (!viewingPatient || !viewingPrescriptions || viewingPrescriptions.length === 0) {
      alert('No prescription data available');
      return;
    }

    const phone = viewingPatient.mobileNumber?.replace(/[^0-9]/g, '');
    const visit = viewingBillingItem?.visit;
    
    let message = `*Prescription*\n\n`;
    message += `*Patient:* ${viewingPatient.firstName} ${viewingPatient.lastName}\n`;
    message += `*Regd No:* ${viewingPatient.registrationNumber}\n`;
    message += `*Date:* ${new Date().toLocaleDateString('en-IN')}\n\n`;
    
    if (visit?.chiefComplaint) {
      message += `*Chief Complaint:* ${visit.chiefComplaint}\n\n`;
    }
    
    message += `*Rx:*\n`;
    viewingPrescriptions.forEach((rx, index) => {
      message += `${index + 1}. ${rx.medicine}`;
      if (rx.potency) message += ` ${rx.potency}`;
      if (rx.dosePattern) message += ` - ${rx.dosePattern}`;
      if (rx.frequency) message += ` - ${rx.frequency}`;
      if (rx.duration) message += ` - ${rx.duration}`;
      message += `\n`;
    });
    
    if (visit?.advice) {
      message += `\n*Advice:* ${visit.advice}`;
    }
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Download as PDF (Print Prescription)
  const handleDownloadPDF = () => {
    if (!viewingPatient || !viewingPrescriptions || viewingPrescriptions.length === 0) {
      alert('No prescription data available');
      return;
    }

    const visit = viewingBillingItem?.visit;
    const doctorName = 'Dr. [Doctor Name]'; // You can fetch this from settings

    const prescriptionHTML = generatePrescriptionHTML(
      viewingPatient,
      viewingPrescriptions,
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

  // Print Fee Receipt
  const handlePrintReceipt = () => {
    if (!currentReceipt) {
      alert('No receipt data available');
      return;
    }
    
    handlePrintFeeReceipt();
  };

  // Print Prescription
  const handlePrintPrescription = () => {
    if (!viewingPatient || !viewingPrescriptions || viewingPrescriptions.length === 0) {
      alert('No prescription data available');
      return;
    }

    const visit = viewingBillingItem?.visit;
    const doctorName = 'Dr. [Doctor Name]'; // You can fetch this from settings

    const prescriptionHTML = generatePrescriptionHTML(
      viewingPatient,
      viewingPrescriptions,
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

  // Complete billing
  const handleComplete = (item: BillingQueueItemWithDetails) => {
    // Check if receipt exists - if not and fee is 0 or exempt, generate it first
    if (!item.receiptNumber && (item.feeAmount === 0 || item.paymentStatus === 'exempt')) {
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
        discountPercent: item.discountPercent || 0,
        discountAmount: item.discountAmount || 0,
        netAmount: item.netAmount,
        paymentMethod: 'exempt' as const,
        paymentStatus: 'exempt' as const
      };
      
      billingReceiptDb.create(receipt);
      
      // Update billing queue item with receipt number and payment timestamp
      billingQueueDb.update(item.id, {
        receiptNumber,
        paymentStatus: 'exempt',
        paidAt: new Date() // Add timestamp
      });
    }
    
    // Update billing queue with completion timestamp
    billingQueueDb.update(item.id, {
      status: 'completed',
      completedAt: new Date() // Add completion timestamp
    });
    
    // Update appointment status
    if (item.appointmentId) {
      appointmentDb.update(item.appointmentId, { status: 'completed' });
    }
    
    // Create fee history entry - but check for duplicates first (by visitId)
    const existingFeeHistory = db.getAll('feeHistory') as FeeHistoryEntry[];
    
    console.log('[Billing] Checking for existing fee history. visitId:', item.visitId, 'appointmentId:', item.appointmentId);
    console.log('[Billing] Total fee history entries for patient:', existingFeeHistory.filter(fh => fh.patientId === item.patientId).length);
    
    // Log all existing fee history entries for this patient
    existingFeeHistory.filter(fh => fh.patientId === item.patientId).forEach(fh => {
      console.log('[Billing] Existing fee history:', {
        id: fh.id,
        visitId: fh.visitId,
        appointmentId: fh.appointmentId,
        amount: fh.amount,
        feeType: fh.feeType
      });
    });
    
    const duplicateFeeHistory = existingFeeHistory.find((fh) => 
      fh.visitId === item.visitId // Match by visitId only - allows multiple visits same day
    );
    
    console.log('[Billing] Found existing fee history?', !!duplicateFeeHistory, duplicateFeeHistory?.id);
    
    if (!duplicateFeeHistory) {
      // Use correct fee type
      const feeTypeForHistory = item.feeAmount === 0 && item.feeType.toLowerCase().includes('follow') 
        ? 'free-follow-up' 
        : (item.paymentStatus === 'exempt' ? 'exempt' : (item.feeType === 'New Patient' ? 'first-visit' : 'follow-up'));
      
      const newFeeHistoryId = `fh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      feeHistoryDb.create({
        id: newFeeHistoryId,
        patientId: item.patientId,
        visitId: item.visitId,
        appointmentId: item.appointmentId,
        receiptId: item.receiptNumber || '',
        feeType: feeTypeForHistory,
        amount: item.netAmount,
        paymentMethod: (item.paymentMethod as any) || 'cash',
        paymentStatus: item.paymentStatus === 'exempt' ? 'exempt' : 'paid',
        paidDate: new Date()
      });
      console.log('[Billing] ✅ CREATED NEW fee history entry:', newFeeHistoryId, 'visitId:', item.visitId, 'appointmentId:', item.appointmentId, 'amount:', item.netAmount);
    } else {
      console.log('[Billing] ⏭️ SKIPPED duplicate fee history entry for visitId:', item.visitId, 'Existing entry:', duplicateFeeHistory.id);
    }
    
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
              onClick={() => setActiveTab('pendingSearch')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'pendingSearch'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Fee/Bill
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Fee/Bill History
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : activeTab === 'pendingSearch' ? (
            <Card className="p-6 space-y-4">
              {/* Search Type Toggle */}
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => {
                    setPendingSearchType('fees');
                    setSelectedPendingPatient(null);
                    setShowAllPending(false);
                    setPendingFees([]);
                    setPendingBills([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    pendingSearchType === 'fees'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Pending Fees
                </button>
                <button
                  onClick={() => {
                    setPendingSearchType('bills');
                    setSelectedPendingPatient(null);
                    setShowAllPending(false);
                    setPendingFees([]);
                    setPendingBills([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    pendingSearchType === 'bills'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Pending Bills
                </button>
              </div>

              {/* Search and Show All */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={pendingSearchQuery}
                    onChange={(e) => handlePendingSearch(e.target.value)}
                    onKeyDown={handlePendingSearchKeyDown}
                    placeholder="Search patient by name, mobile, registration number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Compact Dropdown */}
                  {pendingSearchQuery && pendingSearchResults.length > 0 && !showAllPending && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {pendingSearchResults.map((p, index) => (
                        <div
                          key={p.id}
                          className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            index === pendingSearchSelectedIndex ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => loadPendingForPatient(p)}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {p.firstName} {p.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {p.registrationNumber} • {p.mobileNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={loadAllPending} variant="primary">
                  Show All Pending
                </Button>
              </div>

              {/* Remove old search results table - now using compact dropdown */}

              {/* Pending Fees Display */}
              {pendingSearchType === 'fees' && (selectedPendingPatient || showAllPending) && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      {showAllPending ? 'All Pending Fees' : `Pending Fees for ${selectedPendingPatient?.firstName} ${selectedPendingPatient?.lastName}`}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedPendingPatient(null);
                      setShowAllPending(false);
                      setPendingFees([]);
                      setPendingSearchQuery('');
                      setPendingSearchResults([]);
                    }}>
                      Clear
                    </Button>
                  </div>

                  {pendingFees.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending fees found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingFees.map((item) => (
                        <Card key={item.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 font-semibold text-lg">
                                    {item.patient?.firstName?.charAt(0)}{item.patient?.lastName?.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    {item.patient?.firstName} {item.patient?.lastName}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {item.patient?.registrationNumber} • {item.patient?.mobileNumber}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Fee Type:</span>
                                  <span className="ml-2 font-medium">{item.feeType}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Amount:</span>
                                  <span className="ml-2 font-medium">{formatCurrency(item.netAmount)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Created:</span>
                                  <span className="ml-2">{formatDate(item.createdAt)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Status:</span>
                                  <Badge variant="warning" size="sm" className="ml-2">
                                    {item.paymentStatus}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setEditingFee({
                                    feeAmount: item.feeAmount,
                                    discountPercent: 0,
                                    discountAmount: item.discountAmount || 0,
                                    netAmount: item.netAmount,
                                    paymentMethod: 'cash',
                                    notes: ''
                                  });
                                  setShowFeePopup(true);
                                }}
                              >
                                Process Payment
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pending Bills Display */}
              {pendingSearchType === 'bills' && (selectedPendingPatient || showAllPending) && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      {showAllPending ? 'All Pending Bills' : `Pending Bills for ${selectedPendingPatient?.firstName} ${selectedPendingPatient?.lastName}`}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedPendingPatient(null);
                      setShowAllPending(false);
                      setPendingBills([]);
                      setPendingSearchQuery('');
                      setPendingSearchResults([]);
                    }}>
                      Clear
                    </Button>
                  </div>

                  {pendingBills.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending bills found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingBills.map((bill) => {
                        const patient = patientDb.getById(bill.patientId) as PatientInfo | undefined;
                        const pendingAmount = bill.grandTotal - (bill.amountPaid || 0);
                        
                        return (
                          <Card key={bill.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-green-600 font-semibold text-lg">
                                      {patient?.firstName?.charAt(0)}{patient?.lastName?.charAt(0)}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">
                                      {patient?.firstName} {patient?.lastName}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                      {patient?.registrationNumber} • {patient?.mobileNumber}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500">Bill ID:</span>
                                    <span className="ml-2 font-medium">{bill.id.substring(0, 12)}...</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <span className="ml-2 font-medium">{formatCurrency(bill.grandTotal)}</span>
                                  </div>
                                  {bill.paymentStatus === 'partial' && (
                                    <>
                                      <div>
                                        <span className="text-gray-500">Paid:</span>
                                        <span className="ml-2 text-green-600 font-medium">{formatCurrency(bill.amountPaid || 0)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Remaining:</span>
                                        <span className="ml-2 font-medium text-red-600">{formatCurrency(pendingAmount)}</span>
                                      </div>
                                    </>
                                  )}
                                  {bill.paymentStatus === 'pending' && (
                                    <div>
                                      <span className="text-gray-500">Amount Due:</span>
                                      <span className="ml-2 font-medium text-red-600">{formatCurrency(pendingAmount)}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-gray-500">Created:</span>
                                    <span className="ml-2">{formatDate(bill.createdAt)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Status:</span>
                                    <Badge 
                                      variant={bill.paymentStatus === 'partial' ? 'warning' : 'danger'} 
                                      size="sm" 
                                      className="ml-2"
                                    >
                                      {bill.paymentStatus === 'partial' ? 'Partial Payment' : 'Pending'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    // Set both viewingMedicineBill and create a billing item for edit functionality
                                    setViewingMedicineBill(bill);
                                    
                                    // Create a billing item from the bill data
                                    const billingItem: BillingQueueItemWithDetails = {
                                      id: bill.billingQueueId,
                                      visitId: bill.visitId,
                                      patientId: bill.patientId,
                                      appointmentId: '',
                                      prescriptionIds: bill.items.map(i => i.prescriptionId),
                                      status: 'pending',
                                      feeAmount: 0,
                                      feeType: 'Consultation',
                                      netAmount: 0,
                                      paymentStatus: bill.paymentStatus || 'pending',
                                      createdAt: bill.createdAt,
                                      updatedAt: bill.updatedAt,
                                      patient,
                                      visit: doctorVisitDb.getById(bill.visitId),
                                      prescriptions: bill.items.map(i => i.prescriptionId).map(id => 
                                        doctorPrescriptionDb.getById(id)
                                      ).filter(Boolean) as any[]
                                    };
                                    
                                    setViewingBillingItem(billingItem);
                                    setViewingPatient(patient || null);
                                    setShowViewBillPopup(true);
                                  }}
                                >
                                  View & Pay
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : activeTab === 'history' ? (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => handleHistorySearch(e.target.value)}
                  placeholder="Search patient by name, mobile, registration number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {historyQuery && historyResults.length > 0 && (
                <div className="border border-gray-200 rounded-md">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Patient</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Regd No</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Mobile</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {historyResults.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-2">{p.firstName} {p.lastName}</td>
                          <td className="px-4 py-2">{p.registrationNumber}</td>
                          <td className="px-4 py-2">{p.mobileNumber}</td>
                          <td className="px-4 py-2 text-right">
                            <Button variant="outline" size="sm" onClick={() => loadPatientHistory(p)}>
                              View History
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedHistoryPatient && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {selectedHistoryPatient.firstName} {selectedHistoryPatient.lastName} • {selectedHistoryPatient.registrationNumber} • {selectedHistoryPatient.mobileNumber}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedHistoryPatient(null);
                      setHistoryQuery('');
                      setHistoryResults([]);
                      setPatientReceipts([]);
                      setPatientMedicineBills([]);
                    }}>
                      Clear
                    </Button>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-semibold mb-2">Fees</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Receipt</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Amount</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Payment</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {patientReceipts.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-center text-gray-500" colSpan={7}>No receipts found</td>
                          </tr>
                        ) : patientReceipts.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-2">{formatDate(r.createdAt)}</td>
                            <td className="px-4 py-2">{r.receiptNumber}</td>
                            <td className="px-4 py-2 capitalize">{r.items[0]?.description || 'consultation'}</td>
                            <td className="px-4 py-2 font-medium">{formatCurrency(r.netAmount)}</td>
                            <td className="px-4 py-2 capitalize">{r.paymentMethod}</td>
                            <td className="px-4 py-2">
                              <Badge variant={
                                r.paymentStatus === 'exempt' && r.netAmount === 0 && r.items[0]?.description.toLowerCase().includes('follow')
                                  ? 'purple'
                                  : r.paymentStatus === 'exempt'
                                  ? 'purple'
                                  : r.paymentStatus === 'paid'
                                  ? 'success'
                                  : 'warning'
                              }>
                                {r.paymentStatus === 'exempt' && r.netAmount === 0 && r.items[0]?.description.toLowerCase().includes('follow')
                                  ? 'Free Follow Up'
                                  : r.paymentStatus === 'exempt'
                                  ? 'Exempt'
                                  : r.paymentStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleViewReceiptHistory(r)}>View</Button>
                                <Button variant="outline" size="sm" onClick={() => handlePrintReceiptDirect(r)}>Print</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-semibold mb-2">Medicine Bills</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Items</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Subtotal</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Discount</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Tax</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Grand Total</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Payment</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {patientMedicineBills.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-center text-gray-500" colSpan={9}>No medicine bills found</td>
                          </tr>
                        ) : patientMedicineBills.map((b) => (
                          <tr key={b.id}>
                            <td className="px-4 py-2">{formatDate(b.createdAt)}</td>
                            <td className="px-4 py-2">{b.items.length}</td>
                            <td className="px-4 py-2">{formatCurrency(b.subtotal)}</td>
                            <td className="px-4 py-2">{b.discountPercent ? `${b.discountPercent}%` : '-'}</td>
                            <td className="px-4 py-2">{b.taxPercent ? `${b.taxPercent}%` : '-'}</td>
                            <td className="px-4 py-2 font-medium">{formatCurrency(b.grandTotal)}</td>
                            <td className="px-4 py-2">
                              Paid: {formatCurrency(b.amountPaid || 0)}<br />
                              Pending: {formatCurrency(b.pendingAmount || 0)}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={(b.paymentStatus || 'pending') === 'paid' ? 'success' : (b.paymentStatus === 'partial' ? 'warning' : 'danger')}>
                                {b.paymentStatus || 'pending'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleViewMedicineBillHistory(b)}>View</Button>
                                <Button variant="outline" size="sm" onClick={() => handlePrintMedicineBillDirect(b)}>Print</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                (activeTab === 'pending' ? queueItems : completedItems).map((item) => {
                  // Calculate time spent in billing
                  const createdAt = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
                  const now = new Date();
                  const timeSpentMs = item.status === 'completed' 
                    ? (item.updatedAt ? (new Date(item.updatedAt).getTime() - createdAt.getTime()) : 0)
                    : (now.getTime() - createdAt.getTime());
                  const timeSpentMinutes = Math.floor(timeSpentMs / 60000);
                  const timeSpentHours = Math.floor(timeSpentMinutes / 60);
                  const remainingMinutes = timeSpentMinutes % 60;
                  
                  const timeSpentText = timeSpentHours > 0 
                    ? `${timeSpentHours}h ${remainingMinutes}m`
                    : `${timeSpentMinutes}m`;
                  
                  return (
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {item.patient?.firstName} {item.patient?.lastName}
                            </h3>
                            {/* Show tag icon based on source */}
                            {(() => {
                              const pharmacyItem = (pharmacyQueueDb.getAll() as PharmacyQueueItem[]).find(
                                (p) => p.visitId === item.visitId
                              );
                              if (pharmacyItem?.source === 'self-repeat') {
                                return (
                                  <span className="text-xl" title="Self Repeat by Patient">
                                    🔄
                                  </span>
                                );
                              } else if (pharmacyItem?.source === 'emergency') {
                                return (
                                  <span className="text-xl" title="Emergency">
                                    🚨
                                  </span>
                                );
                              } else if (pharmacyItem?.source === 'follow-up') {
                                return (
                                  <span className="text-xl" title="Follow Up">
                                    👤
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Regd: {item.patient?.registrationNumber}</span>
                            <span>Mobile: {item.patient?.mobileNumber}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                            <span title="Created at">📅 {formatDate(createdAt)}</span>
                            {item.status !== 'completed' && (
                              <span title="Time in billing" className="text-orange-600 font-medium">
                                ⏱️ {timeSpentText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fee Info */}
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-semibold text-lg flex items-center gap-2">
                            <span>
                              Fee: {formatCurrency(item.netAmount)}
                              {item.discountAmount && item.discountAmount > 0 && (
                                <span className="text-sm text-gray-500 line-through ml-2">
                                  {formatCurrency(item.feeAmount)}
                                </span>
                              )}
                            </span>
                            <Badge variant="default" size="sm">{item.feeType}</Badge>
                            {item.feeType === 'Self Repeat by P/T' ? (
                              <Badge variant="warning" size="sm">Self Repeat by P/T</Badge>
                            ) : item.paymentStatus === 'exempt' && item.feeAmount === 0 && item.feeType.toLowerCase().includes('follow') ? (
                              <Badge variant="purple" size="sm">Free Follow Up</Badge>
                            ) : item.paymentStatus === 'exempt' ? (
                              <Badge variant="purple" size="sm">Exempt</Badge>
                            ) : item.paymentStatus === 'paid' ? (
                              <Badge variant="success" size="sm">Paid</Badge>
                            ) : item.paymentStatus === 'partial' ? (
                              <Badge variant="warning" size="sm">Partial</Badge>
                            ) : (
                              <Badge variant="warning" size="sm">Pending</Badge>
                            )}
                            {(() => {
                              const medicineBill = medicineBillDb.getByBillingQueueId(item.id) as MedicineBill | undefined;
                              if (medicineBill) {
                                const isPaid = (medicineBill.paymentStatus || 'pending') === 'paid';
                                const isPartial = (medicineBill.paymentStatus || 'pending') === 'partial';
                                return (
                                  <>
                                    <span className="text-gray-400">|</span>
                                    <span className="text-sm text-gray-600">
                                      Bill: {formatCurrency(medicineBill.grandTotal)}
                                      <span className={`ml-1 ${isPaid ? 'text-green-600' : isPartial ? 'text-orange-600' : 'text-red-600'}`}>
                                        ({isPaid ? 'Paid' : isPartial ? 'Partial' : 'Pending'})
                                      </span>
                                    </span>
                                  </>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <Badge variant={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
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
                          Fee/Bill History
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
                  );
                })
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
              {viewingPrescriptions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No prescriptions found.</p>
              ) : isBillMode ? (
                /* Bill Creation Mode */
                <div className="space-y-4">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Medicine</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount (₹)</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {billItems.map((item, index) => (
                        <tr key={item.id || index}>
                          <td className="px-4 py-2">
                            <div className="font-medium">
                              {[item.medicine, item.potency, item.quantityDisplay, item.doseForm]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            {item.isCombination && (
                              <div className="text-xs text-gray-500">{item.combinationContent}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                handleBillItemQuantityChange(index, parseInt(val) || 1);
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.amount || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                handleBillItemAmountChange(index, parseFloat(val) || 0);
                              }}
                              onFocus={(e) => e.target.select()}
                              placeholder="0.00"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleDeleteBillItem(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Delete item"
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
                        {prevPendingAmount > 0 && (
                          <div className="space-y-2 border-t pt-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Previous Pending:</span>
                              <span className="font-medium">{formatCurrency(prevPendingAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Pay Previous Pending (₹):</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={payPrevPending}
                                onChange={(e) => setPayPrevPending(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                        {!savedMedicineBill ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Amount Paid (₹):</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={billPayment}
                                onChange={(e) => setBillPayment(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Pending:</span>
                              <span className="font-medium">
                                {formatCurrency(Math.max(0, getBillTotal() - billPayment))}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Already Paid:</span>
                              <span className="font-medium">{formatCurrency(savedMedicineBill.amountPaid || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Current Pending:</span>
                              <span className="font-medium">{formatCurrency(savedMedicineBill.pendingAmount || Math.max(0, getBillTotal() - (savedMedicineBill.amountPaid || 0)))}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Pay Pending (₹):</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={additionalCurrentPayment}
                                onChange={(e) => setAdditionalCurrentPayment(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Pending After Payment:</span>
                              <span className="font-medium">
                                {formatCurrency(Math.max(0, (savedMedicineBill.pendingAmount || Math.max(0, getBillTotal() - (savedMedicineBill.amountPaid || 0))) - additionalCurrentPayment))}
                              </span>
                            </div>
                          </>
                        )}
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
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Dose Form</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Dose</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {viewingPrescriptions.map((rx, index) => (
                      <tr key={rx.id || index}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{rx.medicine}</div>
                          {rx.isCombination && (
                            <div className="text-xs text-gray-500">{rx.combinationContent}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">{rx.potency || '-'}</td>
                        <td className="px-4 py-2">{rx.quantity || rx.bottles || '-'}</td>
                        <td className="px-4 py-2">{rx.doseForm || '-'}</td>
                        <td className="px-4 py-2">
                          {rx.dosePattern || '-'}
                          {rx.frequency && <span className="text-xs text-gray-500"> ({rx.frequency})</span>}
                        </td>
                        <td className="px-4 py-2">{rx.duration || '-'}</td>
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
                  <Button 
                    variant="primary" 
                    onClick={handleSaveBill}
                    disabled={!!(savedMedicineBill && !billHasChanges)}
                  >
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
                  <Button variant="outline" onClick={handleWhatsAppPrescription}>
                    WhatsApp
                  </Button>
                  <Button variant="outline" onClick={handlePrintPrescription}>
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
                          <Badge variant={
                            entry.paymentStatus === 'exempt' && entry.amount === 0 && entry.feeType === 'free-follow-up' 
                              ? 'purple' 
                              : entry.paymentStatus === 'exempt' 
                              ? 'purple' 
                              : entry.paymentStatus === 'paid' 
                              ? 'success' 
                              : 'warning'
                          }>
                            {entry.paymentStatus === 'exempt' && entry.amount === 0 && entry.feeType === 'free-follow-up' 
                              ? 'Free Follow Up' 
                              : entry.paymentStatus === 'exempt' 
                              ? 'Exempt' 
                              : entry.paymentStatus}
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
              <Badge variant={
                currentReceipt.paymentStatus === 'exempt' && currentReceipt.netAmount === 0 && currentReceipt.items[0]?.description.toLowerCase().includes('follow')
                  ? 'purple'
                  : currentReceipt.paymentStatus === 'exempt'
                  ? 'purple'
                  : 'success'
              }>
                {currentReceipt.paymentStatus === 'exempt' && currentReceipt.netAmount === 0 && currentReceipt.items[0]?.description.toLowerCase().includes('follow') 
                  ? 'Free Follow Up' 
                  : currentReceipt.paymentStatus === 'exempt' 
                  ? 'Exempt' 
                  : currentReceipt.paymentStatus.toUpperCase()}
              </Badge>
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
              <Button variant="primary" onClick={handleEditSavedBill}>
                Edit Bill
              </Button>
              <Button variant="outline" onClick={() => {
                // Print the saved bill with updated format
                handlePrintMedicineBillDirect(viewingMedicineBill);
              }}>
                Print
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Receipt Generation Confirmation Modal */}
      {showReceiptConfirm && receiptItemToGenerate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Receipt</h3>
              <p className="text-gray-600 mb-6">
                {receiptItemToGenerate.paymentStatus === 'exempt' || receiptItemToGenerate.feeAmount === 0
                  ? `Generate exempt receipt for ${receiptItemToGenerate.patient?.firstName} ${receiptItemToGenerate.patient?.lastName}?`
                  : `Generate receipt for ${formatCurrency(receiptItemToGenerate.netAmount)} payment from ${receiptItemToGenerate.patient?.firstName} ${receiptItemToGenerate.patient?.lastName}?`
                }
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowReceiptConfirm(false);
                    setReceiptItemToGenerate(null);
                  }}
                >
                  Go Back
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmGenerateReceipt}
                >
                  Generate Receipt
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
