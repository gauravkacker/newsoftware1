// ============================================
// Local Database Infrastructure
// Offline-first data layer based on Module 1
// Includes Module 2: User Roles, Permissions & Login System
// Includes Module 3: Patient Master Database & Profile System
// ============================================

import type { DatabaseConfig, RegNumberSettings } from '@/types';

// Database configuration
const dbConfig: DatabaseConfig = {
  type: 'sqlite',
  name: 'pms_database',
  version: 4,
};

// Database schema version - increment to reset data after schema changes
// NOTE: Set to empty string to preserve data between sessions
const SCHEMA_VERSION = '1.0';

// LocalStorage-persisted database for offline-first functionality
class LocalDatabase {
  private static instance: LocalDatabase;
  private store: Map<string, unknown[]>;
  private isInitialized: boolean = false;

  private constructor() {
    this.store = new Map();
    this.loadFromLocalStorage();
    // Initialize stores if not loaded from localStorage
    if (!this.isInitialized) {
      this.initializeStores();
    }
  }

  public static getInstance(): LocalDatabase {
    // Always return existing instance to preserve data
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const savedData = localStorage.getItem('pms_database');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Check schema version
        const savedVersion = localStorage.getItem('pms_schema_version');
        if (savedVersion === SCHEMA_VERSION) {
          Object.keys(parsed).forEach(key => {
            this.store.set(key, parsed[key]);
          });
          this.isInitialized = true;
        }
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data: Record<string, unknown[]> = {};
      this.store.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem('pms_database', JSON.stringify(data));
      localStorage.setItem('pms_schema_version', SCHEMA_VERSION);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  private initializeStores(): void {
    // Clinical Domain
    this.store.set('patients', []);
    this.store.set('visits', []);
    this.store.set('investigations', []);
    this.store.set('voiceNotes', []);
    this.store.set('patientTags', []);
    this.store.set('feeExemptions', []);
    this.store.set('prescriptionHistory', []);
    this.store.set('feeHistory', []);
    this.store.set('cases', []);
    this.store.set('symptoms', []);
    this.store.set('diagnoses', []);

    // Operational Domain
    this.store.set('appointments', []);
    this.store.set('queue', []);
    this.store.set('pharmacy', []);
    this.store.set('staffActions', []);

    // Financial Domain
    this.store.set('fees', []);
    this.store.set('receipts', []);
    this.store.set('refunds', []);

    // Knowledge Domain
    this.store.set('materiaMedica', []);
    this.store.set('repertory', []);
    this.store.set('doctorNotes', []);

    // Module 2: User Roles & Permissions
    this.store.set('users', []);
    this.store.set('roles', []);
    this.store.set('permissions', []);
    this.store.set('sessions', []);
    this.store.set('activityLogs', []);
    this.store.set('staffMessages', []);
    this.store.set('roleTemplates', []);

    // System
    this.store.set('settings', []);
    this.store.set('auditLog', []);
    
    // Smart Parsing
    this.store.set('smartParsingRules', []);
    this.store.set('smartParsingTemplates', []);
    
    // Doctor Panel
    this.store.set('prescriptions', []);
    this.store.set('combinations', []);
    this.store.set('medicineUsageMemory', []);
    
    // Seed default smart parsing rules
    this.seedDefaultSmartParsingRules();
  }
  
  private seedDefaultSmartParsingRules(): void {
    const defaultRules = [
      // Quantity rules
      { id: 'rule-qty-1', name: 'Drachm', type: 'quantity', pattern: '\\b(\\d+)\\s*dr\\b', replacement: '$1 dr', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-qty-2', name: 'Ounce', type: 'quantity', pattern: '\\b(\\d+)\\s*oz\\b', replacement: '$1 oz', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-qty-3', name: 'Milliliter', type: 'quantity', pattern: '\\b(\\d+)\\s*ml\\b', replacement: '$1 ml', isRegex: true, priority: 10, isActive: true },
      
      // Dose Form rules
      { id: 'rule-form-1', name: 'Pills', type: 'doseForm', pattern: '\\b(pills?)\\b', replacement: 'pills', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-form-2', name: 'Tablet', type: 'doseForm', pattern: '\\b(tablets?|tabs?)\\b', replacement: 'tablets', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-form-3', name: 'Liquid', type: 'doseForm', pattern: '\\b(liq|liquid|solution)\\b', replacement: 'liquid', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-form-4', name: 'Drops', type: 'doseForm', pattern: '\\b(drops?)\\b', replacement: 'drops', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-form-5', name: 'Powder', type: 'doseForm', pattern: '\\b(powders?)\\b', replacement: 'powder', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-form-6', name: 'Ointment', type: 'doseForm', pattern: '\\b(ointment|cream|balm)\\b', replacement: 'ointment', isRegex: true, priority: 10, isActive: true },
      
      // Dose Pattern rules
      { id: 'rule-pattern-1', name: 'OD', type: 'dosePattern', pattern: 'OD', replacement: '1-0-0', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-2', name: 'BD', type: 'dosePattern', pattern: 'BD', replacement: '1-1-0', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-3', name: 'TDS', type: 'dosePattern', pattern: 'TDS', replacement: '1-1-1', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-4', name: 'QID', type: 'dosePattern', pattern: 'QID', replacement: '1-1-1-1', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-5', name: 'SOS', type: 'dosePattern', pattern: 'SOS', replacement: 'SOS', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-6', name: 'HS', type: 'dosePattern', pattern: 'HS', replacement: '0-0-1', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-7', name: 'TID', type: 'dosePattern', pattern: 'TID', replacement: '1-1-1', isRegex: false, priority: 10, isActive: true },
      { id: 'rule-pattern-8', name: '3 times', type: 'dosePattern', pattern: '3 times', replacement: '1-1-1', isRegex: false, priority: 5, isActive: true },
      { id: 'rule-pattern-9', name: '2 times', type: 'dosePattern', pattern: '2 times', replacement: '1-1-0', isRegex: false, priority: 5, isActive: true },
      
      // Duration rules
      { id: 'rule-dur-1', name: 'Days', type: 'duration', pattern: '(\\d+)\\s*days?', replacement: '$1 days', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-dur-2', name: 'Weeks', type: 'duration', pattern: '(\\d+)\\s*weeks?', replacement: '$1 weeks', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-dur-3', name: 'Months', type: 'duration', pattern: '(\\d+)\\s*months?', replacement: '$1 months', isRegex: true, priority: 10, isActive: true },
      { id: 'rule-dur-4', name: 'For X days', type: 'duration', pattern: 'for\\s*(\\d+)\\s*days?', replacement: '$1 days', isRegex: true, priority: 15, isActive: true },
    ];
    
    this.store.set('smartParsingRules', defaultRules);
    
    // Seed default combination medicines
    this.seedDefaultCombinations();
  }
  
  private seedDefaultCombinations(): void {
    const defaultCombinations = [
      { id: 'combo-1', name: 'Bioplasgen No. 1', content: 'Calcarea fluorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum phosphoricum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-2', name: 'Bioplasgen No. 2', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-3', name: 'Bioplasgen No. 3', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-4', name: 'Bioplasgen No. 4', content: 'Calcarea fluorica 3x, Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-5', name: 'Bioplasgen No. 5', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-6', name: 'Bioplasgen No. 6', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x', showComposition: true },
      { id: 'combo-7', name: 'Bioplasgen No. 7', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-8', name: 'Bioplasgen No. 8', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-9', name: 'Bioplasgen No. 9', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-10', name: 'Bioplasgen No. 10', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-11', name: 'Bioplasgen No. 11', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-12', name: 'Bioplasgen No. 12', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
      { id: 'combo-13', name: 'Five Phos', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum phosphoricum 3x', showComposition: true },
      { id: 'combo-14', name: 'Five Phos with Ferrum', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum phosphoricum 3x, Ferrum metallicum 3x', showComposition: true },
      { id: 'combo-15', name: 'BC-1', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-16', name: 'BC-2', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x', showComposition: true },
      { id: 'combo-17', name: 'BC-3', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-18', name: 'BC-4', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x', showComposition: true },
      { id: 'combo-19', name: 'BC-5', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x', showComposition: true },
      { id: 'combo-20', name: 'BC-6', content: 'Calcarea phosphorica 3x, Ferrum phosphoricum 3x, Kali muriaticum 3x, Kali phosphoricum 3x, Magnesia phosphorica 3x, Natrum muriaticum 3x, Natrum sulphuricum 3x, Silicea 3x', showComposition: true },
    ];
    
    this.store.set('combinations', defaultCombinations);
  }

  // Generic CRUD operations
  public getAll<T>(collection: string): T[] {
    return (this.store.get(collection) as T[]) || [];
  }

  public getById<T>(collection: string, id: string): T | undefined {
    const items = this.getAll<T>(collection);
    return items.find((item: unknown) => {
      if (item && typeof item === 'object' && 'id' in item) {
        return (item as { id: string }).id === id;
      }
      return false;
    });
  }

  public create<T extends Record<string, unknown>>(collection: string, item: T): T & { id: string; createdAt: Date; updatedAt: Date } {
    const items = this.getAll<T>(collection);
    // Preserve existing ID if present, otherwise generate new one
    const existingId = item.id;
    const newItem = {
      ...item,
      id: existingId || this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as T & { id: string; createdAt: Date; updatedAt: Date };
    items.push(newItem);
    this.store.set(collection, items);
    this.saveToLocalStorage();
    return newItem;
  }

  public update<T extends { id: string }>(collection: string, id: string, updates: Record<string, unknown>): T | undefined {
    const items = this.getAll<T>(collection);
    const index = items.findIndex((item: unknown) => {
      if (item && typeof item === 'object' && 'id' in item) {
        return (item as { id: string }).id === id;
      }
      return false;
    });

    if (index !== -1) {
      const existing = items[index];
      const updated = {
        ...existing,
        ...updates,
        id: existing.id,
        updatedAt: new Date(),
      } as T;
      items[index] = updated;
      this.store.set(collection, items);
      this.saveToLocalStorage();
      return updated;
    }
    return undefined;
  }

  public delete(collection: string, id: string): boolean {
    const items = this.getAll(collection);
    const index = items.findIndex((item: unknown) => {
      if (item && typeof item === 'object' && 'id' in item) {
        return (item as { id: string }).id === id;
      }
      return false;
    });

    if (index !== -1) {
      items.splice(index, 1);
      this.store.set(collection, items);
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  public search<T>(collection: string, query: string, fields: string[]): T[] {
    const items = this.getAll<T>(collection);
    const lowerQuery = query.toLowerCase();

    return items.filter((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;

      return fields.some((field) => {
        const value = (item as Record<string, unknown>)[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery);
        }
        return false;
      });
    });
  }

  public count(collection: string): number {
    return this.getAll(collection).length;
  }

  // Module 3: Registration Number Generation
  // Formula: nextRegNumber = max(settings.startingNumber, highest existing number + 1)
  public getRegNumberSettings(): RegNumberSettings {
    // Get settings from localStorage via settingsDb
    let settings = {
      prefix: '',
      startingNumber: 1001,
      padding: 4,
      separator: '-',
    };
    
    // Try to load settings from database if available
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('pms_database');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          const settingsData = parsed['settings'];
          if (settingsData && Array.isArray(settingsData)) {
            const regSettings = settingsData.find((s: { id: string }) => s.id === 'registration');
            if (regSettings) {
              settings = {
                prefix: regSettings.prefix !== undefined ? regSettings.prefix : '',
                startingNumber: regSettings.startingNumber || 1001,
                padding: regSettings.padding || 4,
                separator: regSettings.separator || '-',
              };
            }
          }
        }
      } catch (e) {
        // Use default settings
      }
    }
    
    return settings;
  }

  private extractRegNumberParts(regNumber: string): { prefix: string; number: number } | null {
    // Try to extract the numeric part from a registration number
    // Examples: "DK-1001" -> { prefix: "DK-", number: 1001 }
    // Examples: "1928" -> { prefix: "", number: 1928 }
    const match = regNumber.match(/^(.*?)(\d+)$/);
    if (match) {
      return {
        prefix: match[1],
        number: parseInt(match[2], 10),
      };
    }
    return null;
  }

  public generateRegNumber(): string {
    const settings = this.getRegNumberSettings();
    
    // Get all existing patients and find the highest registration number
    const patients = this.getAll('patients');
    let highestNumber = 0;
    
    patients.forEach((patient: unknown) => {
      const p = patient as { registrationNumber: string };
      const parts = this.extractRegNumberParts(p.registrationNumber);
      if (parts && parts.number > highestNumber) {
        highestNumber = parts.number;
      }
    });
    
    // Calculate next number: max of startingNumber and highest existing + 1
    const nextNumber = Math.max(settings.startingNumber, highestNumber + 1);
    const paddedNumber = nextNumber.toString().padStart(settings.padding, '0');
    return `${settings.prefix}${paddedNumber}`;
  }

  // Module 3: Duplicate Detection
  public findDuplicates(collection: string, query: string, mobile?: string): string[] {
    const items = this.getAll(collection);
    const duplicates: string[] = [];
    const lowerQuery = query.toLowerCase();

    items.forEach((item: unknown) => {
      if (typeof item !== 'object' || item === null) return;
      const p = item as Record<string, unknown>;
      
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const firstName = (p.firstName as string)?.toLowerCase() || '';
      const lastName = (p.lastName as string)?.toLowerCase() || '';
      
      const nameMatch = fullName.includes(lowerQuery) || 
                        firstName.includes(lowerQuery) || 
                        lastName.includes(lowerQuery);
      
      const mobileMatch = mobile ? p.mobileNumber === mobile : false;
      
      if (nameMatch || mobileMatch) {
        duplicates.push(p.id as string);
      }
    });

    return duplicates;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const db = LocalDatabase.getInstance();

// Seed initial data for testing (Module 3)
export function seedInitialData(): void {
  // Seed default patient tags
  const defaultTags = [
    { id: 'tag-diabetic', name: 'Diabetic', color: '#ef4444', description: 'Diabetic patient', isSystem: true },
    { id: 'tag-hypertensive', name: 'Hypertensive', color: '#f97316', description: 'Hypertensive patient', isSystem: true },
    { id: 'tag-chronic', name: 'Chronic', color: '#eab308', description: 'Chronic case', isSystem: true },
    { id: 'tag-vip', name: 'VIP', color: '#8b5cf6', description: 'VIP patient', isSystem: true },
    { id: 'tag-exempt', name: 'Fee Exempt', color: '#10b981', description: 'Exempt from fees', isSystem: true },
    { id: 'tag-difficult', name: 'Difficult', color: '#ec4899', description: 'Difficult patient', isSystem: true },
  ];
  defaultTags.forEach((tag) => {
    db.create('patientTags', tag);
  });

  // Seed sample patients
  const patients = [
    {
      registrationNumber: db.generateRegNumber(),
      firstName: 'John',
      lastName: 'Smith',
      fullName: 'John Smith',
      dateOfBirth: '1985-03-15',
      age: 39,
      gender: 'male' as const,
      mobileNumber: '+91-9876543210',
      email: 'john.smith@email.com',
      address: {
        street: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      },
      bloodGroup: 'O+' as const,
      occupation: 'Engineer',
      maritalStatus: 'married' as const,
      tags: ['tag-diabetic'],
      feeExempt: false,
      privacySettings: {
        hideMentalSymptoms: false,
        hideDiagnosis: false,
        hidePrognosis: false,
        hideFees: false,
        hideCaseNotes: false,
      },
      medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
      allergies: ['Penicillin'],
      createdBy: 'system',
    },
    {
      registrationNumber: db.generateRegNumber(),
      firstName: 'Sarah',
      lastName: 'Johnson',
      fullName: 'Sarah Johnson',
      dateOfBirth: '1990-07-22',
      age: 34,
      gender: 'female' as const,
      mobileNumber: '+91-9876543211',
      email: 'sarah.j@email.com',
      address: {
        street: '456 Oak Avenue',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India',
      },
      bloodGroup: 'A+' as const,
      occupation: 'Teacher',
      maritalStatus: 'single' as const,
      tags: [],
      feeExempt: false,
      privacySettings: {
        hideMentalSymptoms: false,
        hideDiagnosis: false,
        hidePrognosis: false,
        hideFees: false,
        hideCaseNotes: false,
      },
      medicalHistory: [],
      allergies: [],
      createdBy: 'system',
    },
    {
      registrationNumber: db.generateRegNumber(),
      firstName: 'Rajesh',
      lastName: 'Kumar',
      fullName: 'Rajesh Kumar',
      dateOfBirth: '1975-05-10',
      age: 49,
      gender: 'male' as const,
      mobileNumber: '+91-9876543212',
      email: 'rajesh.k@email.com',
      address: {
        street: '789 Park Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      },
      bloodGroup: 'B+' as const,
      occupation: 'Business',
      maritalStatus: 'married' as const,
      tags: ['tag-chronic', 'tag-vip'],
      feeExempt: true,
      feeExemptionReason: 'Long-term patient, special consideration',
      privacySettings: {
        hideMentalSymptoms: false,
        hideDiagnosis: false,
        hidePrognosis: false,
        hideFees: false,
        hideCaseNotes: false,
      },
      medicalHistory: ['Arthritis', 'Chronic Back Pain'],
      allergies: ['Sulpha'],
      createdBy: 'system',
    },
  ];

  patients.forEach((patient) => {
    db.create('patients', patient);
  });

  // Seed sample visits
  const patientsList = db.getAll('patients');
  if (patientsList.length > 0) {
    const patient1 = patientsList[0] as { id: string; registrationNumber: string };
    db.create('visits', {
      patientId: patient1.id,
      registrationNumber: patient1.registrationNumber,
      visitNumber: 1,
      visitDate: new Date('2024-01-15'),
      visitTime: '10:30',
      doctorId: 'user-doctor',
      doctorName: 'Dr. Homeopathic',
      mode: 'in-person' as const,
      status: 'completed' as const,
      chiefComplaint: 'Joint pain and stiffness',
      diagnosis: 'Arthritic condition',
      isSelfRepeat: false,
      createdBy: 'system',
    });
    
    db.create('visits', {
      patientId: patient1.id,
      registrationNumber: patient1.registrationNumber,
      visitNumber: 2,
      visitDate: new Date('2024-02-01'),
      visitTime: '11:00',
      doctorId: 'user-doctor',
      doctorName: 'Dr. Homeopathic',
      mode: 'video' as const,
      status: 'completed' as const,
      chiefComplaint: 'Follow-up for joint pain',
      diagnosis: 'Improving',
      isSelfRepeat: false,
      createdBy: 'system',
    });
  }

  // Seed fee history
  if (patientsList.length > 0) {
    const patient1 = patientsList[0] as { id: string };
    db.create('feeHistory', {
      patientId: patient1.id,
      visitId: 'visit-1',
      receiptId: 'rcpt-001',
      feeType: 'first-visit' as const,
      amount: 500,
      paymentMethod: 'cash' as const,
      paymentStatus: 'paid' as const,
      paidDate: new Date('2024-01-15'),
    });
    
    db.create('feeHistory', {
      patientId: patient1.id,
      visitId: 'visit-2',
      receiptId: 'rcpt-002',
      feeType: 'follow-up' as const,
      amount: 300,
      paymentMethod: 'upi' as const,
      paymentStatus: 'paid' as const,
      paidDate: new Date('2024-02-01'),
      daysSinceLastFee: 17,
    });
  }

  // Seed sample materia medica
  const materiaMedica = [
    {
      name: 'Arnica Montana',
      scientificName: 'Arnica montana',
      family: 'Asteraceae',
      description: 'First remedy for trauma, bruises, and muscular soreness.',
      symptoms: ['Soreness', 'Bruising', 'Trauma', 'Muscle pain', 'Overexertion'],
      modalities: {
        worse: ['Touch', 'Movement', 'Heat'],
        better: ['Rest', 'Lying down'],
      },
      relationships: ['Rhus toxicodendron', 'Bryonia'],
      source: 'Classical Materia Medica',
    },
    {
      name: 'Nux Vomica',
      scientificName: 'Strychnos nux-vomica',
      family: 'Loganiaceae',
      description: 'Remedy for impatient, irritable, and chilly patients.',
      symptoms: ['Irritability', 'Digestive disturbances', 'Headache', 'Sensitivity to noise', 'Overeating'],
      modalities: {
        worse: ['Noise', 'Odors', 'Touch', 'Morning'],
        better: ['Evening', 'Rest', 'Warm applications'],
      },
      relationships: ['Ignatia', 'Lycopodium'],
      source: 'Classical Materia Medica',
    },
  ];

  materiaMedica.forEach((mm) => {
    db.create('materiaMedica', mm);
  });

  // Seed fee structure
  const fees = [
    { name: 'New Patient Consultation', type: 'consultation' as const, amount: 500 },
    { name: 'Follow-up Consultation', type: 'consultation' as const, amount: 300 },
    { name: 'Medicine - Arnica 30', type: 'medicine' as const, amount: 50 },
    { name: 'Medicine - Nux Vomica 30', type: 'medicine' as const, amount: 50 },
  ];

  fees.forEach((fee) => {
    db.create('fees', fee);
  });

  // Seed default slots (Module 4)
  const defaultSlots = [
    {
      name: 'Morning',
      startTime: '11:00',
      endTime: '13:30',
      duration: 10,
      maxTokens: 15,
      tokenReset: true,
      isActive: true,
      displayOrder: 0,
    },
    {
      name: 'Evening',
      startTime: '18:00',
      endTime: '20:30',
      duration: 10,
      maxTokens: 15,
      tokenReset: true,
      isActive: true,
      displayOrder: 1,
    },
  ];

  defaultSlots.forEach((slot) => {
    db.create('slots', slot);
  });
}

// ============================================
// Module 3: Patient Database Operations
// ============================================

export const patientDb = {
  getAll: () => db.getAll('patients'),
  getById: (id: string) => db.getById('patients', id),
  getByMobile: (mobile: string) => {
    const patients = db.getAll('patients');
    return patients.filter((p: unknown) => {
      const patient = p as { mobileNumber: string };
      return patient.mobileNumber === mobile;
    });
  },
  getByRegNumber: (regNumber: string) => {
    const patients = db.getAll('patients');
    return patients.find((p: unknown) => {
      const patient = p as { registrationNumber: string };
      return patient.registrationNumber === regNumber;
    });
  },
  generateRegNumber: () => db.generateRegNumber(),
  create: (patient: Parameters<typeof db.create>[1]) => {
    // Use existing registration number if provided, otherwise generate new one
    const regNumber = patient.registrationNumber || db.generateRegNumber();
    return db.create('patients', { ...patient, registrationNumber: regNumber });
  },
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('patients', id, updates),
  delete: (id: string) => db.delete('patients', id),
  search: (query: string) => {
    const lowerQuery = query.toLowerCase();
    const patients = db.getAll('patients');
    return patients.filter((p: unknown) => {
      const patient = p as {
        registrationNumber: string;
        firstName: string;
        lastName: string;
        fullName: string;
        mobileNumber: string;
      };
      return (
        patient.registrationNumber.toLowerCase().includes(lowerQuery) ||
        patient.fullName.toLowerCase().includes(lowerQuery) ||
        patient.firstName.toLowerCase().includes(lowerQuery) ||
        patient.lastName.toLowerCase().includes(lowerQuery) ||
        patient.mobileNumber.includes(query)
      );
    });
  },
  findDuplicates: (name: string, mobile?: string) => db.findDuplicates('patients', name, mobile),
  deleteByRegNumber: (regNumber: string) => {
    const patients = db.getAll('patients');
    const patient = patients.find((p: unknown) => {
      const pt = p as { registrationNumber: string };
      return pt.registrationNumber === regNumber;
    });
    if (patient) {
      db.delete('patients', (patient as { id: string }).id);
      return true;
    }
    return false;
  },
  deleteAll: () => {
    const patients = db.getAll('patients');
    patients.forEach((p: unknown) => {
      const patient = p as { id: string };
      db.delete('patients', patient.id);
    });
  },
};

// Visit operations
export const visitDb = {
  getAll: () => db.getAll('visits'),
  getById: (id: string) => db.getById('visits', id),
  getByPatient: (patientId: string) => {
    const visits = db.getAll('visits');
    return visits.filter((v: unknown) => {
      const visit = v as { patientId: string };
      return visit.patientId === patientId;
    }).sort((a, b) => {
      const visitA = a as { visitDate: Date };
      const visitB = b as { visitDate: Date };
      return new Date(visitB.visitDate).getTime() - new Date(visitA.visitDate).getTime();
    });
  },
  create: (visit: Parameters<typeof db.create>[1]) => db.create('visits', visit),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('visits', id, updates),
  delete: (id: string) => db.delete('visits', id),
};

// Investigation operations
export const investigationDb = {
  getAll: () => db.getAll('investigations'),
  getById: (id: string) => db.getById('investigations', id),
  getByPatient: (patientId: string) => {
    const investigations = db.getAll('investigations');
    return investigations.filter((i: unknown) => {
      const inv = i as { patientId: string };
      return inv.patientId === patientId;
    });
  },
  create: (inv: Parameters<typeof db.create>[1]) => db.create('investigations', inv),
  delete: (id: string) => db.delete('investigations', id),
};

// Voice Note operations
export const voiceNoteDb = {
  getAll: () => db.getAll('voiceNotes'),
  getById: (id: string) => db.getById('voiceNotes', id),
  getByPatient: (patientId: string) => {
    const notes = db.getAll('voiceNotes');
    return notes.filter((n: unknown) => {
      const note = n as { patientId: string };
      return note.patientId === patientId;
    });
  },
  create: (note: Parameters<typeof db.create>[1]) => db.create('voiceNotes', note),
  delete: (id: string) => db.delete('voiceNotes', id),
};

// Patient Tag operations
export const patientTagDb = {
  getAll: () => db.getAll('patientTags'),
  getById: (id: string) => db.getById('patientTags', id),
  create: (tag: Parameters<typeof db.create>[1]) => db.create('patientTags', tag),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('patientTags', id, updates),
  delete: (id: string) => db.delete('patientTags', id),
};

// Fee Exemption operations
export const feeExemptionDb = {
  getAll: () => db.getAll('feeExemptions'),
  getByPatient: (patientId: string) => {
    const exemptions = db.getAll('feeExemptions');
    return exemptions.find((e: unknown) => {
      const exemption = e as { patientId: string; isActive: boolean };
      return exemption.patientId === patientId && exemption.isActive;
    });
  },
  create: (exemption: Parameters<typeof db.create>[1]) => db.create('feeExemptions', exemption),
  deactivate: (id: string) => db.update('feeExemptions', id, { isActive: false }),
};

// Fee History operations
export const feeHistoryDb = {
  getAll: () => db.getAll('feeHistory'),
  getByPatient: (patientId: string) => {
    const history = db.getAll('feeHistory');
    return history.filter((h: unknown) => {
      const entry = h as { patientId: string };
      return entry.patientId === patientId;
    }).sort((a, b) => {
      const entryA = a as { paidDate: Date };
      const entryB = b as { paidDate: Date };
      return new Date(entryB.paidDate).getTime() - new Date(entryA.paidDate).getTime();
    });
  },
  getLastByPatient: (patientId: string) => {
    const history = db.getAll('feeHistory');
    const patientHistory = history.filter((h: unknown) => {
      const entry = h as { patientId: string };
      return entry.patientId === patientId;
    }) as Array<{ paidDate: Date; amount: number }>;
    
    if (patientHistory.length === 0) return null;
    
    return patientHistory.sort((a, b) => 
      new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
    )[0];
  },
  create: (entry: Parameters<typeof db.create>[1]) => db.create('feeHistory', entry),
};

// Prescription History operations
export const prescriptionHistoryDb = {
  getAll: () => db.getAll('prescriptionHistory'),
  getByPatient: (patientId: string) => {
    const history = db.getAll('prescriptionHistory');
    return history.filter((h: unknown) => {
      const entry = h as { patientId: string };
      return entry.patientId === patientId;
    });
  },
  create: (entry: Parameters<typeof db.create>[1]) => db.create('prescriptionHistory', entry),
};

export const materiaMedicaDb = {
  getAll: () => db.getAll('materiaMedica'),
  getById: (id: string) => db.getById('materiaMedica', id),
  create: (item: Parameters<typeof db.create>[1]) => db.create('materiaMedica', item),
  search: (query: string) => db.search('materiaMedica', query, ['name', 'symptoms', 'description']),
};

export const feesDb = {
  getAll: () => db.getAll('fees'),
  getById: (id: string) => db.getById('fees', id),
  create: (fee: Parameters<typeof db.create>[1]) => db.create('fees', fee),
};

// ============================================
// Module 2: User Roles & Permissions Database Operations
// ============================================

const defaultPermissions = [
  { id: 'p1', category: 'clinical' as const, name: 'View Case', key: 'view_case', description: 'View patient case details', enabled: true },
  { id: 'p2', category: 'clinical' as const, name: 'Edit Case', key: 'edit_case', description: 'Edit patient case details', enabled: true },
  { id: 'p3', category: 'clinical' as const, name: 'Create Prescription', key: 'create_prescription', description: 'Create new prescription', enabled: true },
  { id: 'p4', category: 'clinical' as const, name: 'Edit Prescription', key: 'edit_prescription', description: 'Edit existing prescription', enabled: true },
  { id: 'p5', category: 'clinical' as const, name: 'Delete Prescription', key: 'delete_prescription', description: 'Delete prescription', enabled: true },
  
  { id: 'p6', category: 'operational' as const, name: 'Book Appointment', key: 'book_appointment', description: 'Book new appointment', enabled: true },
  { id: 'p7', category: 'operational' as const, name: 'Cancel Appointment', key: 'cancel_appointment', description: 'Cancel appointment', enabled: true },
  { id: 'p8', category: 'operational' as const, name: 'Reschedule', key: 'reschedule', description: 'Reschedule appointment', enabled: true },
  { id: 'p9', category: 'operational' as const, name: 'Generate Token', key: 'generate_token', description: 'Generate queue token', enabled: true },
  
  { id: 'p10', category: 'financial' as const, name: 'View Fees', key: 'view_fees', description: 'View fee structure', enabled: true },
  { id: 'p11', category: 'financial' as const, name: 'Edit Fees', key: 'edit_fees', description: 'Edit fee structure', enabled: true },
  { id: 'p12', category: 'financial' as const, name: 'Refund', key: 'refund', description: 'Process refunds', enabled: true },
  { id: 'p13', category: 'financial' as const, name: 'Override Fee Rules', key: 'override_fees', description: 'Override fee rules', enabled: true },
  
  { id: 'p14', category: 'pharmacy' as const, name: 'View Prescriptions', key: 'view_prescriptions', description: 'View prescriptions', enabled: true },
  { id: 'p15', category: 'pharmacy' as const, name: 'Edit Labels', key: 'edit_labels', description: 'Edit prescription labels', enabled: true },
  { id: 'p16', category: 'pharmacy' as const, name: 'Mark Prepared', key: 'mark_prepared', description: 'Mark medicine as prepared', enabled: true },
  { id: 'p17', category: 'pharmacy' as const, name: 'Stop Preparation', key: 'stop_preparation', description: 'Stop medicine preparation', enabled: true },
  
  { id: 'p18', category: 'system' as const, name: 'Settings', key: 'settings', description: 'Access system settings', enabled: true },
  { id: 'p19', category: 'system' as const, name: 'Backup', key: 'backup', description: 'Create backups', enabled: true },
  { id: 'p20', category: 'system' as const, name: 'Restore', key: 'restore', description: 'Restore from backup', enabled: true },
  { id: 'p21', category: 'system' as const, name: 'Licensing', key: 'licensing', description: 'Manage licensing', enabled: true },
];

const defaultRoles = [
  {
    id: 'role-doctor',
    name: 'Doctor',
    description: 'Full control over everything',
    isSystem: true,
    permissions: {
      view_case: true, edit_case: true, create_prescription: true, edit_prescription: true, delete_prescription: true,
      book_appointment: true, cancel_appointment: true, reschedule: true, generate_token: true,
      view_fees: true, edit_fees: true, refund: true, override_fees: true,
      view_prescriptions: true, edit_labels: true, mark_prepared: true, stop_preparation: true,
      settings: true, backup: true, restore: true, licensing: true,
    },
  },
  {
    id: 'role-frontdesk',
    name: 'Frontdesk',
    description: 'Appointments, fees, patient info',
    isSystem: true,
    permissions: {
      view_case: true, edit_case: false, create_prescription: false, edit_prescription: false, delete_prescription: false,
      book_appointment: true, cancel_appointment: true, reschedule: true, generate_token: true,
      view_fees: true, edit_fees: false, refund: false, override_fees: false,
      view_prescriptions: false, edit_labels: false, mark_prepared: false, stop_preparation: false,
      settings: false, backup: false, restore: false, licensing: false,
    },
  },
  {
    id: 'role-pharmacy',
    name: 'Pharmacy',
    description: 'Only prescriptions and labels',
    isSystem: true,
    permissions: {
      view_case: false, edit_case: false, create_prescription: false, edit_prescription: false, delete_prescription: false,
      book_appointment: false, cancel_appointment: false, reschedule: false, generate_token: false,
      view_fees: false, edit_fees: false, refund: false, override_fees: false,
      view_prescriptions: true, edit_labels: true, mark_prepared: true, stop_preparation: true,
      settings: false, backup: false, restore: false, licensing: false,
    },
  },
  {
    id: 'role-assistant',
    name: 'Assistant',
    description: 'Case entry, voice notes, uploads',
    isSystem: true,
    permissions: {
      view_case: true, edit_case: true, create_prescription: false, edit_prescription: false, delete_prescription: false,
      book_appointment: false, cancel_appointment: false, reschedule: false, generate_token: false,
      view_fees: false, edit_fees: false, refund: false, override_fees: false,
      view_prescriptions: false, edit_labels: false, mark_prepared: false, stop_preparation: false,
      settings: false, backup: false, restore: false, licensing: false,
    },
  },
];

const defaultUsers = [
  { id: 'user-doctor', username: 'doctor', identifierType: 'username' as const, identifier: 'doctor', password: 'doctor123', roleId: 'role-doctor', isActive: true, isDoctor: true, name: 'Dr. Homeopathic' },
  { id: 'user-frontdesk', username: 'frontdesk', identifierType: 'username' as const, identifier: 'frontdesk', password: 'front123', roleId: 'role-frontdesk', isActive: true, isDoctor: false, name: 'Front Desk Staff' },
  { id: 'user-pharmacy', username: 'pharmacy', identifierType: 'username' as const, identifier: 'pharmacy', password: 'pharm123', roleId: 'role-pharmacy', isActive: true, isDoctor: false, name: 'Pharmacy Staff' },
  { id: 'user-assistant', username: 'assistant', identifierType: 'username' as const, identifier: 'assistant', password: 'assist123', roleId: 'role-assistant', isActive: true, isDoctor: false, name: 'Clinic Assistant' },
];

export function seedModule2Data(): void {
  defaultPermissions.forEach((perm) => {
    db.create('permissions', perm);
  });

  defaultRoles.forEach((role) => {
    db.create('roles', role);
  });

  defaultUsers.forEach((user) => {
    db.create('users', user);
  });

  const roleTemplates = [
    { name: 'Busy Day Mode', description: 'Maximum efficiency settings', roleIds: ['role-doctor', 'role-frontdesk'] },
    { name: 'Solo Clinic Mode', description: 'Single person operation', roleIds: ['role-doctor'] },
    { name: 'Training Mode', description: 'Assistant has more access', roleIds: ['role-doctor', 'role-assistant'] },
  ];
  roleTemplates.forEach((template) => {
    db.create('roleTemplates', template);
  });
}

export const userDb = {
  getAll: () => db.getAll('users'),
  getById: (id: string) => db.getById('users', id),
  getByIdentifier: (identifier: string) => {
    const users = db.getAll('users');
    return users.find((u: unknown) => {
      const user = u as { identifier: string };
      return user.identifier === identifier;
    });
  },
  create: (user: Parameters<typeof db.create>[1]) => db.create('users', user),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('users', id, updates),
  delete: (id: string) => db.delete('users', id),
};

export const roleDb = {
  getAll: () => db.getAll('roles'),
  getById: (id: string) => db.getById('roles', id),
  create: (role: Parameters<typeof db.create>[1]) => db.create('roles', role),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('roles', id, updates),
  delete: (id: string) => db.delete('roles', id),
};

export const permissionDb = {
  getAll: () => db.getAll('permissions'),
  getByCategory: (category: string) => {
    const perms = db.getAll('permissions');
    return perms.filter((p: unknown) => {
      const perm = p as { category: string };
      return perm.category === category;
    });
  },
};

export const activityLogDb = {
  getAll: () => db.getAll('activityLogs'),
  getByUser: (userId: string) => {
    const logs = db.getAll('activityLogs');
    return logs.filter((l: unknown) => {
      const log = l as { userId: string };
      return log.userId === userId;
    });
  },
  getByPatient: (patientId: string) => {
    const logs = db.getAll('activityLogs');
    return logs.filter((l: unknown) => {
      const log = l as { patientId?: string };
      return log.patientId === patientId;
    });
  },
  create: (log: Parameters<typeof db.create>[1]) => db.create('activityLogs', log),
};

export const staffMessageDb = {
  getAll: () => db.getAll('staffMessages'),
  getByUser: (userId: string) => {
    const messages = db.getAll('staffMessages');
    return messages.filter((m: unknown) => {
      const msg = m as { recipientId: string };
      return msg.recipientId === userId;
    });
  },
  getUnread: (userId: string) => {
    const messages = db.getAll('staffMessages');
    return messages.filter((m: unknown) => {
      const msg = m as { recipientId: string; readAt?: Date };
      return msg.recipientId === userId && !msg.readAt;
    });
  },
  create: (message: Parameters<typeof db.create>[1]) => db.create('staffMessages', message),
  markRead: (id: string) => db.update('staffMessages', id, { readAt: new Date() }),
};

export const sessionDb = {
  getAll: () => db.getAll('sessions'),
  getActive: () => {
    const sessions = db.getAll('sessions');
    return sessions.filter((s: unknown) => {
      const session = s as { isActive: boolean };
      return session.isActive;
    });
  },
  create: (session: Parameters<typeof db.create>[1]) => db.create('sessions', session),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('sessions', id, updates),
  deactivate: (id: string) => db.update('sessions', id, { isActive: false }),
};

export const roleTemplateDb = {
  getAll: () => db.getAll('roleTemplates'),
  getById: (id: string) => db.getById('roleTemplates', id),
  create: (template: Parameters<typeof db.create>[1]) => db.create('roleTemplates', template),
  apply: (templateId: string) => {
    const template = db.getById('roleTemplates', templateId);
    return template;
  },
};

// Settings operations
export const settingsDb = {
  getAll: () => db.getAll('settings'),
  getById: (id: string) => db.getById('settings', id),
  create: (setting: Parameters<typeof db.create>[1]) => db.create('settings', setting),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('settings', id, updates),
  upsert: (id: string, data: Parameters<typeof db.create>[1]) => {
    const existing = db.getById('settings', id);
    if (existing) {
      db.update('settings', id, data);
    } else {
      db.create('settings', { ...data, id });
    }
  },
};

// ============================================
// Module 4: Appointment Scheduler Operations (Updated)
// ============================================

export const appointmentDb = {
  getAll: () => db.getAll('appointments'),
  getById: (id: string) => db.getById('appointments', id),
  getByPatient: (patientId: string) => {
    const appointments = db.getAll('appointments');
    return appointments.filter((a: unknown) => {
      const apt = a as { patientId: string };
      return apt.patientId === patientId;
    }).sort((a, b) => {
      const aptA = a as { appointmentDate: Date; appointmentTime: string };
      const aptB = b as { appointmentDate: Date; appointmentTime: string };
      const dateA = new Date(`${aptA.appointmentDate}T${aptA.appointmentTime}`);
      const dateB = new Date(`${aptB.appointmentDate}T${aptB.appointmentTime}`);
      return dateB.getTime() - dateA.getTime();
    });
  },
  getByDate: (date: Date) => {
    const appointments = db.getAll('appointments');
    const targetDate = date.toISOString().split('T')[0];
    return appointments.filter((a: unknown) => {
      const apt = a as { appointmentDate: Date };
      return new Date(apt.appointmentDate).toISOString().split('T')[0] === targetDate;
    }).sort((a, b) => {
      const aptA = a as { appointmentTime: string };
      const aptB = b as { appointmentTime: string };
      return aptA.appointmentTime.localeCompare(aptB.appointmentTime);
    });
  },
  getBySlot: (date: Date, slotId: string) => {
    const appointments = db.getAll('appointments');
    const targetDate = date.toISOString().split('T')[0];
    return appointments.filter((a: unknown) => {
      const apt = a as { appointmentDate: Date; slotId: string };
      return new Date(apt.appointmentDate).toISOString().split('T')[0] === targetDate && apt.slotId === slotId;
    }).sort((a, b) => {
      const aptA = a as { tokenNumber: number };
      const aptB = b as { tokenNumber: number };
      return (aptA.tokenNumber || 0) - (aptB.tokenNumber || 0);
    });
  },
  getUpcoming: () => {
    const appointments = db.getAll('appointments');
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter((a: unknown) => {
      const apt = a as { appointmentDate: Date; appointmentTime: string; status: string };
      const aptDateTime = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
      const now = new Date();
      return aptDateTime >= now && ['scheduled', 'confirmed'].includes(apt.status) && new Date(apt.appointmentDate).toISOString().split('T')[0] >= today;
    }).sort((a, b) => {
      const aptA = a as { appointmentDate: Date; appointmentTime: string };
      const aptB = b as { appointmentDate: Date; appointmentTime: string };
      const dateA = new Date(`${aptA.appointmentDate}T${aptA.appointmentTime}`);
      const dateB = new Date(`${aptB.appointmentDate}T${aptB.appointmentTime}`);
      return dateA.getTime() - dateB.getTime();
    });
  },
  create: (appointment: Parameters<typeof db.create>[1]) => db.create('appointments', appointment),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('appointments', id, updates),
  delete: (id: string) => db.delete('appointments', id),
  cancel: (id: string, reason?: string) => db.update('appointments', id, { 
    status: 'cancelled', 
    cancelledAt: new Date(),
    cancellationReason: reason 
  }),
  checkIn: (id: string) => {
    db.update('appointments', id, {
      status: 'checked-in',
      checkedInAt: new Date()
    });
    // Also create queue item when checking in
    const appointment = db.getById('appointments', id);
    if (appointment) {
      const apt = appointment as {
        patientId: string;
        patientName: string;
        slotId: string;
        slotName: string;
        tokenNumber: number;
        priority: string;
      };
      // Get or create queue config
      const today = new Date();
      let queueConfig = db.getAll('queueConfigs').find((q: unknown) => {
        const que = q as { date: Date; slotId: string };
        return new Date(que.date).toISOString().split('T')[0] === today.toISOString().split('T')[0] &&
               que.slotId === apt.slotId;
      });
      
      if (!queueConfig) {
        queueConfig = db.create('queueConfigs', {
          date: today,
          slotId: apt.slotId,
          slotName: apt.slotName,
          status: 'open',
          currentToken: 0,
          totalPatients: 0,
          completedPatients: 0,
          skippedPatients: 0,
        });
      }
      
      const qConfig = queueConfig as { id: string };
      
      // Create queue item
      db.create('queueItems', {
        queueConfigId: qConfig.id,
        appointmentId: id,
        patientId: apt.patientId,
        patientName: apt.patientName,
        slotId: apt.slotId,
        slotName: apt.slotName,
        tokenNumber: apt.tokenNumber || 1,
        priority: apt.priority || 'normal',
        status: 'waiting',
        checkInTime: new Date(),
      });
      
      // Update queue config
      const queues = db.getAll('queueConfigs');
      const queueIndex = queues.findIndex((q: unknown) => (q as { id: string }).id === qConfig.id);
      if (queueIndex !== -1) {
        const que = queues[queueIndex] as { totalPatients: number };
        db.update('queueConfigs', qConfig.id, { totalPatients: que.totalPatients + 1 });
      }
    }
  },
  startConsultation: (id: string) => db.update('appointments', id, { 
    status: 'in-progress',
    consultationStartedAt: new Date() 
  }),
  complete: (id: string) => db.update('appointments', id, { 
    status: 'completed',
    consultationEndedAt: new Date() 
  }),
  markNoShow: (id: string) => db.update('appointments', id, { status: 'no-show' }),
  assignToken: (id: string, tokenNumber: number, slotId: string, slotName: string) => db.update('appointments', id, {
    tokenNumber,
    slotId,
    slotName,
    tokenAssignedAt: new Date()
  }),
};

// ============================================
// Module 4: Slot Operations
// ============================================

export const slotDb = {
  getAll: () => db.getAll('slots'),
  getById: (id: string) => db.getById('slots', id),
  getActive: () => {
    const slots = db.getAll('slots');
    return slots.filter((s: unknown) => {
      const slot = s as { isActive: boolean };
      return slot.isActive;
    }).sort((a, b) => {
      const slotA = a as { displayOrder: number };
      const slotB = b as { displayOrder: number };
      return (slotA.displayOrder || 0) - (slotB.displayOrder || 0);
    });
  },
  create: (slot: Parameters<typeof db.create>[1]) => db.create('slots', slot),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('slots', id, updates),
  delete: (id: string) => db.delete('slots', id),
  toggleActive: (id: string) => {
    const slot = db.getById('slots', id);
    if (slot) {
      const s = slot as { isActive: boolean };
      db.update('slots', id, { isActive: !s.isActive });
    }
  },
};

// ============================================
// Module 4: Queue Configuration Operations
// ============================================

export const queueDb = {
  getAll: () => db.getAll('queueConfigs'),
  getById: (id: string) => db.getById('queueConfigs', id),
  getByDateAndSlot: (date: Date, slotId: string) => {
    const queues = db.getAll('queueConfigs');
    const targetDate = date.toISOString().split('T')[0];
    return queues.find((q: unknown) => {
      const queue = q as { date: Date; slotId: string };
      return new Date(queue.date).toISOString().split('T')[0] === targetDate && queue.slotId === slotId;
    });
  },
  getOrCreate: (date: Date, slotId: string, slotName: string) => {
    const existing = queueDb.getByDateAndSlot(date, slotId);
    if (existing) return existing;
    
    // Create new queue config
    return db.create('queueConfigs', {
      date,
      slotId,
      slotName,
      status: 'open',
      currentToken: 0,
      totalPatients: 0,
      completedPatients: 0,
      skippedPatients: 0,
    });
  },
  create: (queue: Parameters<typeof db.create>[1]) => db.create('queueConfigs', queue),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('queueConfigs', id, updates),
  delete: (id: string) => db.delete('queueConfigs', id),
  open: (id: string) => db.update('queueConfigs', id, { 
    status: 'open',
    openedAt: new Date()
  }),
  close: (id: string) => db.update('queueConfigs', id, { 
    status: 'closed',
    closedAt: new Date()
  }),
  pause: (id: string) => db.update('queueConfigs', id, { 
    status: 'paused',
    pausedAt: new Date()
  }),
  resume: (id: string) => db.update('queueConfigs', id, { 
    status: 'open',
    resumedAt: new Date()
  }),
  incrementToken: (id: string) => {
    const queue = db.getById('queueConfigs', id);
    if (queue) {
      const q = queue as { currentToken: number };
      db.update('queueConfigs', id, { currentToken: q.currentToken + 1 });
    }
  },
  incrementCompleted: (id: string) => {
    const queue = db.getById('queueConfigs', id);
    if (queue) {
      const q = queue as { completedPatients: number };
      db.update('queueConfigs', id, { completedPatients: q.completedPatients + 1 });
    }
  },
  incrementSkipped: (id: string) => {
    const queue = db.getById('queueConfigs', id);
    if (queue) {
      const q = queue as { skippedPatients: number };
      db.update('queueConfigs', id, { skippedPatients: q.skippedPatients + 1 });
    }
  },
};

// ============================================
// Module 4: Queue Item Operations
// ============================================

export const queueItemDb = {
  getAll: () => db.getAll('queueItems'),
  getById: (id: string) => db.getById('queueItems', id),
  getByQueueConfig: (queueConfigId: string) => {
    const items = db.getAll('queueItems');
    return items.filter((i: unknown) => {
      const item = i as { queueConfigId: string };
      return item.queueConfigId === queueConfigId;
    }).sort((a, b) => {
      const itemA = a as { priority: string; tokenNumber: number };
      const itemB = b as { priority: string; tokenNumber: number };
      // Priority patients first
      const priorityOrder = { 'emergency': 0, 'vip': 1, 'doctor-priority': 2, 'normal': 3 };
      const orderA = priorityOrder[itemA.priority as keyof typeof priorityOrder] || 3;
      const orderB = priorityOrder[itemB.priority as keyof typeof priorityOrder] || 3;
      if (orderA !== orderB) return orderA - orderB;
      return (itemA.tokenNumber || 0) - (itemB.tokenNumber || 0);
    });
  },
  getActiveByDate: (date: Date) => {
    const items = db.getAll('queueItems');
    const targetDate = date.toISOString().split('T')[0];
    return items.filter((i: unknown) => {
      const item = i as { checkInTime: Date; status: string };
      return new Date(item.checkInTime).toISOString().split('T')[0] === targetDate && 
             ['waiting', 'in-consultation'].includes(item.status);
    });
  },
  create: (item: Parameters<typeof db.create>[1]) => db.create('queueItems', item),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('queueItems', id, updates),
  delete: (id: string) => db.delete('queueItems', id),
  call: (id: string) => db.update('queueItems', id, { status: 'in-consultation', consultationStartTime: new Date() }),
  complete: (id: string) => db.update('queueItems', id, { 
    status: 'completed', 
    consultationEndTime: new Date() 
  }),
  skip: (id: string) => db.update('queueItems', id, { status: 'skipped' }),
  noShow: (id: string) => db.update('queueItems', id, { status: 'no-show' }),
  changePriority: (id: string, priority: string) => db.update('queueItems', id, { priority }),
};

// ============================================
// Module 4: Queue Event Operations (Audit Trail)
// ============================================

export const queueEventDb = {
  getAll: () => db.getAll('queueEvents'),
  getByQueue: (queueId: string) => {
    const events = db.getAll('queueEvents');
    return events.filter((e: unknown) => {
      const event = e as { queueId: string };
      return event.queueId === queueId;
    }).sort((a, b) => {
      const eventA = a as { timestamp: Date };
      const eventB = b as { timestamp: Date };
      return new Date(eventB.timestamp).getTime() - new Date(eventA.timestamp).getTime();
    });
  },
  create: (event: Parameters<typeof db.create>[1]) => db.create('queueEvents', event),
};

// ============================================
// Module 4: Token Settings Operations
// ============================================

export const tokenSettingsDb = {
  get: () => {
    const settings = db.getAll('tokenSettings');
    return settings.length > 0 ? settings[0] : null;
  },
  save: (settings: Parameters<typeof db.create>[1]) => {
    const existing = tokenSettingsDb.get();
    if (existing) {
      const s = existing as { id: string };
      db.update('tokenSettings', s.id, settings);
    } else {
      db.create('tokenSettings', settings);
    }
  },
};

// ============================================
// Module 4: Fee Type Operations
// ============================================

export const feeDb = {
  getAll: () => db.getAll('feeTypes'),
  getById: (id: string) => db.getById('feeTypes', id),
  getActive: () => {
    const fees = db.getAll('feeTypes');
    return fees.filter((f: unknown) => {
      const fee = f as { isActive: boolean };
      return fee.isActive;
    }).sort((a, b) => {
      const feeA = a as { displayOrder: number };
      const feeB = b as { displayOrder: number };
      return (feeA.displayOrder || 0) - (feeB.displayOrder || 0);
    });
  },
  create: (fee: Parameters<typeof db.create>[1]) => db.create('feeTypes', fee),
  update: (id: string, updates: Parameters<typeof db.update>[2]) => db.update('feeTypes', id, updates),
  delete: (id: string) => db.delete('feeTypes', id),
  toggleActive: (id: string) => {
    const fee = db.getById('feeTypes', id);
    if (fee) {
      const f = fee as { isActive: boolean };
      db.update('feeTypes', id, { isActive: !f.isActive });
    }
  },
};

// Seed default fee types if none exist
function ensureDefaultFeeTypes(): void {
  const fees = db.getAll('feeTypes');
  if (fees.length === 0) {
    const defaultFees = [
      { name: 'New Patient', amount: 300, description: 'First visit consultation fee', isActive: true, displayOrder: 0 },
      { name: 'Follow Up', amount: 150, description: 'Subsequent visit consultation fee', isActive: true, displayOrder: 1 },
      { name: 'Free Follow Up', amount: 0, description: 'Complimentary follow-up visit', isActive: true, displayOrder: 2 },
    ];
    defaultFees.forEach((fee) => {
      db.create('feeTypes', fee);
    });
  }
}

export function ensureModule2DataSeeded(): void {
  const roles = db.getAll('roles');
  if (roles.length === 0) {
    seedModule2Data();
  }
}

// Call ensureDefaultFeeTypes when module loads
ensureDefaultFeeTypes();
