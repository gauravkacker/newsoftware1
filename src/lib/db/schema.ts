// ============================================
// Doctor Panel Types
// Using LocalDatabase API
// ============================================

// Patient type for Doctor Panel
export interface DoctorPatient {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  registrationNumber: string;
  age?: number;
  sex?: string;
  medicalHistory?: string[];
}

// Visit type for Doctor Panel
export interface DoctorVisit {
  id: string;
  patientId: string;
  visitDate: Date;
  visitNumber: number;
  tokenNumber?: number;
  chiefComplaint?: string;
  caseText?: string;
  diagnosis?: string;
  advice?: string;
  testsRequired?: string;
  nextVisit?: Date;
  prognosis?: string;
  remarksToFrontdesk?: string;
  bp?: string;
  pulse?: string;
  tempF?: string;
  weightKg?: string;
  status: string;
  isSelfRepeat?: boolean; // Flag for patient-initiated prescription repeats
  selfRepeatDate?: Date; // Date when patient requested repeat
  createdAt: Date;
  updatedAt: Date;
}

// Prescription type for Doctor Panel
export interface DoctorPrescription {
  id: string;
  visitId: string;
  patientId: string;
  medicine: string;
  potency?: string;
  quantity: string;
  doseForm?: string;
  dosePattern?: string;
  frequency?: string;
  duration?: string;
  durationDays?: number;
  bottles?: number;
  instructions?: string;
  rowOrder: number;
  isCombination?: boolean;
  combinationName?: string;
  combinationContent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Combination Medicine type
export interface CombinationMedicine {
  id: string;
  name: string;
  content: string;
  showComposition?: boolean;
}

// Fee type for Doctor Panel
export interface DoctorFee {
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
}

// Pharmacy Queue type
export interface PharmacyQueueItem {
  id: string;
  visitId: string;
  patientId: string;
  appointmentId?: string;
  prescriptionIds: string[];
  preparedPrescriptionIds?: string[];
  priority: boolean;
  courier?: boolean;
  status: string;
  stopReason?: string;
  preparedBy?: string;
  preparedAt?: Date;
  deliveredAt?: Date;
  source?: string; // 'self-repeat' for patient-initiated repeats
  createdAt: Date;
  updatedAt: Date;
}

// Medicine Usage Memory
export interface MedicineUsageMemory {
  id: string;
  medicine: string;
  potency?: string;
  quantity?: string;
  doseForm?: string;
  dosePattern?: string;
  frequency?: string;
  duration?: string;
  useCount: number;
  lastUsedAt: Date;
  createdAt: Date;
}

// Settings type
export interface DoctorSetting {
  id: string;
  key: string;
  value: string;
  category: string;
}

// Smart Parsing Rule type
export interface SmartParsingRule {
  id: string;
  name: string;
  type: 'quantity' | 'doseForm' | 'dosePattern' | 'duration';
  pattern: string;      // Regex or text pattern to match
  replacement: string;  // Value to use when matched
  isRegex: boolean;     // Whether pattern is regex
  priority: number;     // Higher priority rules are checked first
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Smart Parsing Template
export interface SmartParsingTemplate {
  id: string;
  name: string;
  description: string;
  rules: SmartParsingRule[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Billing Queue Item
export interface BillingQueueItem {
  id: string;
  visitId: string;
  patientId: string;
  appointmentId?: string;
  prescriptionIds: string[];
  status: 'pending' | 'paid' | 'completed';
  feeAmount: number;
  feeType: string;
  discountPercent?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'cheque' | 'insurance' | 'exempt';
  paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded' | 'exempt';
  receiptNumber?: string;
  receiptGeneratedAt?: Date;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Billing Receipt
export interface BillingReceipt {
  id: string;
  receiptNumber: string;
  billingQueueId: string;
  patientId: string;
  visitId: string;
  items: BillingReceiptItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'cheque' | 'insurance' | 'exempt';
  paymentStatus: 'paid' | 'pending' | 'partial' | 'refunded' | 'exempt';
  printedAt?: Date;
  whatsappSentAt?: Date;
  createdAt: Date;
}

// Billing Receipt Item
export interface BillingReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Medicine Bill (for prescription-based billing)
export interface MedicineBill {
  id: string;
  billingQueueId: string;
  patientId: string;
  visitId: string;
  items: MedicineBillItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid?: number;
  pendingAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'pending';
  notes?: string;
  status: 'draft' | 'saved' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}

// Medicine Bill Item
export interface MedicineBillItem {
  prescriptionId: string;
  medicine: string;
  potency?: string;
  quantityDisplay?: string; // Original quantity string like "2dr"
  quantity: number; // Number of bottles for billing
  doseForm?: string; // Dose form like Pills, Drops, etc.
  dosePattern?: string;
  frequency?: string;
  duration?: string;
  isCombination?: boolean;
  combinationContent?: string;
  amount: number;
}

// Medicine Amount Memory (for remembering last entered amounts)
export interface MedicineAmountMemory {
  id: string;
  medicine: string;
  potency?: string;
  amount: number;
  lastUsedAt: Date;
}

// Type exports
export type InsertPatient = Omit<DoctorPatient, 'id'>;
export type SelectPatient = DoctorPatient;
export type InsertVisit = Omit<DoctorVisit, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectVisit = DoctorVisit;
export type InsertPrescription = Omit<DoctorPrescription, 'id'>;
export type SelectPrescription = DoctorPrescription;
export type InsertCombination = Omit<CombinationMedicine, 'id'>;
export type SelectCombination = CombinationMedicine;
export type InsertFee = Omit<DoctorFee, 'id'>;
export type SelectFee = DoctorFee;
export type InsertPharmacyQueue = Omit<PharmacyQueueItem, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectPharmacyQueue = PharmacyQueueItem;
export type InsertMedicineMemory = Omit<MedicineUsageMemory, 'id' | 'createdAt'>;
export type SelectMedicineMemory = MedicineUsageMemory;
export type InsertSetting = Omit<DoctorSetting, 'id'>;
export type SelectSetting = DoctorSetting;
export type InsertSmartParsingRule = Omit<SmartParsingRule, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectSmartParsingRule = SmartParsingRule;
export type InsertSmartParsingTemplate = Omit<SmartParsingTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectSmartParsingTemplate = SmartParsingTemplate;
export type InsertBillingQueue = Omit<BillingQueueItem, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectBillingQueue = BillingQueueItem;
export type InsertBillingReceipt = Omit<BillingReceipt, 'id' | 'createdAt'>;
export type SelectBillingReceipt = BillingReceipt;
export type InsertMedicineBill = Omit<MedicineBill, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectMedicineBill = MedicineBill;
export type InsertMedicineAmountMemory = Omit<MedicineAmountMemory, 'id' | 'lastUsedAt'>;
export type SelectMedicineAmountMemory = MedicineAmountMemory;

// ============================================
// Materia Medica Types
// ============================================

// Book type
export interface MateriaMedicaBook {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  edition?: string;
  year?: number;
  language: string;
  category: 'materia-medica' | 'repertory' | 'philosophy' | 'other';
  tags: string[];
  filePath: string; // Relative path: materia-medica/books/{bookId}.pdf
  fileName: string;
  fileSize: number; // In bytes
  totalPages: number;
  uploadedBy: string;
  uploadedAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  indexStatus: 'pending' | 'indexing' | 'indexed' | 'failed';
  indexError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Book Page type
export interface MateriaMedicaBookPage {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string; // Extracted text content
  wordCount: number;
  hasImages: boolean;
  extractedAt: Date;
}

// Search Index type
export interface MateriaMedicaSearchIndex {
  id: string;
  bookId: string;
  pageNumber: number;
  word: string; // Normalized lowercase word
  positions: number[]; // Character positions in page text
  frequency: number; // Occurrences on this page
  createdAt: Date;
}

// Bookmark type
export interface MateriaMedicaBookmark {
  id: string;
  bookId: string;
  userId: string;
  pageNumber: number;
  note?: string;
  color?: string; // Highlight color
  createdAt: Date;
  updatedAt: Date;
}

// Reading History type
export interface MateriaMedicaReadingHistory {
  id: string;
  bookId: string;
  userId: string;
  lastPageRead: number;
  totalTimeSpent: number; // In seconds
  sessionCount: number;
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// AI Search Cache type
export interface MateriaMedicaAISearchCache {
  id: string;
  query: string; // Original query
  queryHash: string; // Hash for quick lookup
  results: string[]; // Cached result IDs (JSON stringified)
  hitCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

// Type exports for Materia Medica
export type InsertMateriaMedicaBook = Omit<MateriaMedicaBook, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectMateriaMedicaBook = MateriaMedicaBook;
export type InsertMateriaMedicaBookPage = Omit<MateriaMedicaBookPage, 'id' | 'extractedAt'>;
export type SelectMateriaMedicaBookPage = MateriaMedicaBookPage;
export type InsertMateriaMedicaSearchIndex = Omit<MateriaMedicaSearchIndex, 'id' | 'createdAt'>;
export type SelectMateriaMedicaSearchIndex = MateriaMedicaSearchIndex;
export type InsertMateriaMedicaBookmark = Omit<MateriaMedicaBookmark, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectMateriaMedicaBookmark = MateriaMedicaBookmark;
export type InsertMateriaMedicaReadingHistory = Omit<MateriaMedicaReadingHistory, 'id' | 'createdAt' | 'updatedAt'>;
export type SelectMateriaMedicaReadingHistory = MateriaMedicaReadingHistory;
export type InsertMateriaMedicaAISearchCache = Omit<MateriaMedicaAISearchCache, 'id' | 'createdAt'>;
export type SelectMateriaMedicaAISearchCache = MateriaMedicaAISearchCache;
