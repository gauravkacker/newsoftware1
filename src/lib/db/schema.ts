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
  status: string;
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
  prescriptionIds: string[];
  priority: boolean;
  status: string;
  stopReason?: string;
  preparedBy?: string;
  deliveredAt?: Date;
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
