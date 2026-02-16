"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { patientDb, appointmentDb } from '@/lib/db/database';
import { feeHistoryDb } from '@/lib/db/database';
import { doctorVisitDb, doctorPrescriptionDb, pharmacyQueueDb } from '@/lib/db/doctor-panel';
import { db } from '@/lib/db/database';
import type { Patient, Appointment, FeeHistoryEntry } from '@/types';
import type { DoctorVisit } from '@/lib/db/schema';

// Local types for Doctor Panel (simpler for UI state)
interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  registrationNumber: string;
  age?: number;
  gender?: string;
}

interface Visit {
  id: string;
  patientId: string;
  visitDate: Date;
  visitNumber: number;
  chiefComplaint?: string;
  caseText?: string;
  diagnosis?: string;
  advice?: string;
  testsRequired?: string;
  nextVisit?: Date;
  prognosis?: string;
  remarksToFrontdesk?: string;
  status: string;
}

interface Prescription {
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
  isCombination?: boolean;
  combinationName?: string;
  combinationContent?: string;
}

interface PrescriptionRow {
  id: string;
  medicine: string;
  potency: string;
  quantity: string;
  doseForm: string;
  dose: string;
  frequency: string;
  pattern: string;
  duration: string;
  bottles: string;
}

interface SmartParsingRule {
  id: string;
  name: string;
  type: 'quantity' | 'doseForm' | 'dosePattern' | 'duration';
  pattern: string;
  replacement: string;
  isRegex: boolean;
  priority: number;
  isActive: boolean;
}

interface ParsedPrescription {
  medicineName: string;
  potency: string;
  quantity: string;
  doseForm: string;
  dosePerIntake: string;
  frequency: string;
  pattern: string;
  duration: string;
  prescriptionText: string;
}

// Smart Parsing Function
function parsePrescriptionText(input: string): ParsedPrescription | null {
  if (!input.trim()) return null;

  const text = input.trim().toLowerCase();
  const originalText = input.trim();

  // Common frequency patterns and their conversions
  const frequencyMap: Record<string, { pattern: string; frequency: string }> = {
    od: { pattern: "1-0-0", frequency: "OD" },
    bd: { pattern: "1-0-1", frequency: "BD" },
    tds: { pattern: "1-1-1", frequency: "TDS" },
    tid: { pattern: "1-1-1", frequency: "TDS" },
    qid: { pattern: "1-1-1-1", frequency: "QID" },
    hs: { pattern: "0-0-1", frequency: "HS" },
    sos: { pattern: "SOS", frequency: "SOS" },
    weekly: { pattern: "Weekly", frequency: "Weekly" },
    monthly: { pattern: "Monthly", frequency: "Monthly" },
  };

  // Extract duration (e.g., "7 days", "2 weeks", "1 month", "4 weeks")
  const durationMatch = text.match(/(\d+)\s*(days?|weeks?|months?)/i);
  const duration = durationMatch ? `${durationMatch[1]} ${durationMatch[2]}` : "";

  // Extract quantity - support fractions like "1/2oz", "1/2dr"
  // The fraction may be attached to the unit like "1/2oz" or have space "1/2 oz"
  let quantity = "";
  // Match fraction with unit attached (e.g., "1/2oz") or with space (e.g., "1/2 oz")
  const fractionQuantityMatch = text.match(/(\d+)\/(\d+)\s*(dr|oz|ml)/i);
  if (fractionQuantityMatch) {
    quantity = `${fractionQuantityMatch[1]}/${fractionQuantityMatch[2]}${fractionQuantityMatch[3]}`;
  } else {
    // Match whole number quantities - but not if preceded by / (to avoid matching "2" in "1/2oz")
    const wholeQuantityMatch = text.match(/(?<!\/)(\d+)\s*(dr|oz|ml)\b/i);
    if (wholeQuantityMatch) {
      quantity = `${wholeQuantityMatch[1]}${wholeQuantityMatch[2]}`;
    }
  }

  // Extract dose form (pills, drops, tablets, etc.) - may or may not have a number
  // First try with number (e.g., "4 pills")
  let doseForm = "";
  let dosePerIntake = "";
  const doseFormWithNumberMatch = text.match(/(\d+)\s*(pills?|drops?|tablets?|capsules?|powder|ointment|cream)\b/i);
  if (doseFormWithNumberMatch) {
    doseForm = doseFormWithNumberMatch[2].toLowerCase();
    dosePerIntake = doseFormWithNumberMatch[1];
  } else {
    // Try without number (e.g., "liquid")
    const doseFormNoNumberMatch = text.match(/\b(pills?|drops?|tablets?|capsules?|liquid|powder|ointment|cream)\b/i);
    if (doseFormNoNumberMatch) {
      doseForm = doseFormNoNumberMatch[1].toLowerCase();
      dosePerIntake = "";
    }
  }

  // Extract pattern - check for custom patterns like "6-6-6", "1-1-1", "1-0-1" first
  let frequency = "";
  let pattern = "";
  
  // Check for custom numeric pattern (e.g., "6-6-6", "1-1-1", "1-0-0")
  const customPatternMatch = text.match(/\b(\d+)-(\d+)-(\d+)\b/);
  if (customPatternMatch) {
    pattern = `${customPatternMatch[1]}-${customPatternMatch[2]}-${customPatternMatch[3]}`;
    // Derive frequency from pattern - count non-zero doses for times per day
    const doses = [customPatternMatch[1], customPatternMatch[2], customPatternMatch[3]].map(Number);
    const nonZeroDoses = doses.filter(d => d > 0).length;
    if (nonZeroDoses === 1) {
      frequency = "OD";
    } else if (nonZeroDoses === 2) {
      frequency = "BD";
    } else if (nonZeroDoses === 3) {
      frequency = "TDS";
    } else if (nonZeroDoses === 4) {
      frequency = "QID";
    }
  } else {
    // Check for predefined frequency keywords
    for (const [key, value] of Object.entries(frequencyMap)) {
      if (text.includes(key)) {
        frequency = value.frequency;
        pattern = value.pattern;
        break;
      }
    }
  }

  // Extract potency - match numbers followed by potency suffix (c, ch, m, x)
  // Common potencies: 6C, 30C, 200C, 1M, 10M, 30X, 200CH, etc.
  // The pattern needs to match "1m", "1M", "200c", "200C", "30ch", etc.
  const potencyMatch = text.match(/\b(\d+)\s*(c|ch|m|x)\b/i);
  let potency = potencyMatch ? `${potencyMatch[1]}${potencyMatch[2].toUpperCase()}` : "";

  // Extract medicine name - collect words until we hit a potency, quantity, or other marker
  // We need to identify the medicine name BEFORE potency/quantity/pattern
  let medicineName = "";
  const words = originalText.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lowerWord = word.toLowerCase();
    
    // Check if this word is a potency (number + c/ch/m/x suffix)
    // Match patterns like "1M", "200C", "30CH", "10M"
    if (/^\d+[cchmx]$/i.test(word)) {
      break; // Stop at potency
    }
    
    // Check if this word is a fraction (like "1/2oz" or "1/2")
    if (/^\d+\/\d+/.test(word)) {
      break; // Stop at fraction quantity
    }
    
    // Check if this word is a standalone number that could be potency
    // Only break if followed by a potency suffix in next word or if it's a typical potency number
    if (/^\d+$/.test(word)) {
      // Check if next word is a potency suffix
      const nextWord = words[i + 1]?.toLowerCase();
      if (nextWord && /^[cchmx]$/.test(nextWord)) {
        break; // This number is a potency
      }
      // Check if it's a typical potency value (6, 12, 30, 200, 1000, etc.)
      const numVal = parseInt(word);
      if ([1, 3, 6, 12, 30, 60, 100, 200, 1000, 10000].includes(numVal) && !potency) {
        break; // Likely a potency
      }
    }
    
    // Check for dose forms
    if (["dr", "oz", "ml", "pills", "drops", "tablets", "capsules", "liquid", "powder", "ointment", "cream"].includes(lowerWord)) {
      break;
    }
    
    // Check for frequency keywords
    if (Object.keys(frequencyMap).includes(lowerWord)) {
      break;
    }
    
    // Check for duration keywords
    if (["for", "days", "weeks", "months"].includes(lowerWord)) {
      break;
    }
    
    // Check for pattern
    if (/^\d+-\d+-\d+$/.test(word)) {
      break;
    }
    
    // This word is part of the medicine name
    medicineName = medicineName ? `${medicineName} ${word}` : word;
  }

  // Capitalize medicine name properly (e.g., "Ars alb" -> "Ars Alb")
  medicineName = medicineName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Generate prescription text
  let prescriptionText = "";
  if (medicineName && potency) {
    prescriptionText = `${medicineName} ${potency}`;
  } else if (medicineName) {
    prescriptionText = medicineName;
  }

  if (dosePerIntake && doseForm && pattern) {
    const doses = pattern.split("-");
    if (doses.length === 3 && !pattern.includes("SOS") && !pattern.includes("Weekly") && !pattern.includes("Monthly")) {
      const morning = doses[0] !== "0" ? `${dosePerIntake} ${doseForm} morning` : "";
      const afternoon = doses[1] !== "0" ? `${dosePerIntake} ${doseForm} afternoon` : "";
      const evening = doses[2] !== "0" ? `${dosePerIntake} ${doseForm} night` : "";
      const parts = [morning, afternoon, evening].filter(Boolean);
      if (parts.length > 0) {
        prescriptionText += `\n${parts.join(" – ")}`;
      }
    } else if (pattern === "SOS") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} SOS`;
    } else if (pattern === "Weekly") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} Weekly`;
    } else if (pattern === "Monthly") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} Monthly`;
    }
  }

  if (duration) {
    prescriptionText += `\nfor ${duration}`;
  }

  return {
    medicineName,
    potency,
    quantity,
    doseForm,
    dosePerIntake,
    frequency,
    pattern,
    duration,
    prescriptionText,
  };
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Create empty prescription row
function createEmptyRow(): PrescriptionRow {
  return {
    id: generateId(),
    medicine: "",
    potency: "",
    quantity: "",
    doseForm: "",
    dose: "",
    frequency: "",
    pattern: "",
    duration: "",
    bottles: "",
  };
}

// Create row from parsed prescription
function createRowFromParsed(parsed: ParsedPrescription): PrescriptionRow {
  return {
    id: generateId(),
    medicine: parsed.medicineName,
    potency: parsed.potency,
    quantity: parsed.quantity,
    doseForm: parsed.doseForm,
    dose: parsed.dosePerIntake,
    frequency: parsed.frequency,
    pattern: parsed.pattern,
    duration: parsed.duration,
    bottles: "",
  };
}

// Main Component
export default function DoctorPanelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientRecord[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentVisit, setCurrentVisit] = useState<Visit | null>(null);
  const [pastVisits, setPastVisits] = useState<Visit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [caseText, setCaseText] = useState('');
  const [isSystemAssist, setIsSystemAssist] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showMateriaMedica, setShowMateriaMedica] = useState(false);
  const [materiaMedicaQuery, setMateriaMedicaQuery] = useState('');
  const [showPharmacyQueue, setShowPharmacyQueue] = useState(false);
  
  // Additional fields
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [testsRequired, setTestsRequired] = useState('');
  const [nextVisit, setNextVisit] = useState('');
  const [nextVisitDays, setNextVisitDays] = useState('');
  const [prognosis, setPrognosis] = useState('');
  const [remarksToFrontdesk, setRemarksToFrontdesk] = useState('');
  
  // Additional notes form state
  const [showAdditionalNotes, setShowAdditionalNotes] = useState(false);
  
  // Field order for additional notes (persisted to localStorage)
  const [additionalNotesFieldOrder, setAdditionalNotesFieldOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('doctor_panel_field_order');
        return saved ? JSON.parse(saved) : ['diagnosis', 'testsRequired', 'advice', 'prognosis', 'remarksToFrontdesk'];
      } catch {
        return ['diagnosis', 'testsRequired', 'advice', 'prognosis', 'remarksToFrontdesk'];
      }
    }
    return ['diagnosis', 'testsRequired', 'advice', 'prognosis', 'remarksToFrontdesk'];
  });
  
  // Fee editing
  const [feeAmount, setFeeAmount] = useState('');
  const [feeType, setFeeType] = useState('consultation');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [showFeeForm, setShowFeeForm] = useState(false);
  
  // Last fee paid info
  const [lastFeeInfo, setLastFeeInfo] = useState<{
    date: string;
    amount: number;
    daysAgo: number;
    feeType: string;
    status?: 'paid' | 'pending';
  } | null>(null);
  
  // Current appointment fee (from appointment booking)
  const [currentAppointmentFee, setCurrentAppointmentFee] = useState<{
    feeAmount: number;
    feeType: string;
    feeTypeId: string;
    feeStatus: string;
    feeId?: string;
  } | null>(null);
  
  // Combination medicines - now uses inline editing instead of modal
  const [editingCombinationIndex, setEditingCombinationIndex] = useState<number | null>(null);
  const [combinationName, setCombinationName] = useState('');
  const [combinationContent, setCombinationContent] = useState('');
  
  // Medicine autocomplete
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
  const [medicineSuggestions, setMedicineSuggestions] = useState<{name: string; content?: string}[]>([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [focusedMedicineIndex, setFocusedMedicineIndex] = useState<number | null>(null);
  
  // Database combinations for autocomplete
  const [dbCombinations, setDbCombinations] = useState<{name: string; content: string}[]>([]);
  
  // Smart parsing rules
  const [smartParsingRules, setSmartParsingRules] = useState<SmartParsingRule[]>([]);
  
  // Smart parsing input field
  const [smartParseInput, setSmartParseInput] = useState('');
  const smartParseInputRef = useRef<HTMLInputElement>(null);
  
  // AI Parsing settings
  const [aiParsingEnabled, setAiParsingEnabled] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  
  // Prescription settings (from settings page)
  const [prescriptionSettings, setPrescriptionSettings] = useState<{
    potency: string[];
    quantity: string[];
    doseForm: string[];
    pattern: string[];
    frequency: string[];
    duration: string[];
  }>({
    potency: ['3x', '6c', '6x', '30c', '30x', '200c', '200x', '1M', '10M', '50M', 'CM', 'Q', '1x'],
    quantity: ['1/2dr', '1dr', '2dr', '1/2oz', '1oz', '2oz', '50ml', '100ml'],
    doseForm: ['Pills', 'Tabs', 'Drops', 'Liq', 'Powder', 'Sachet', 'Ointment', 'Cream', 'Serum', 'Oil'],
    pattern: ['1-1-1', '4-4-4', '6-6-6', '15-15-15', '20-20-20', '2-2-2'],
    frequency: ['Daily', 'Weekly', 'Twice Weekly', 'Thrice Weekly'],
    duration: ['Day', 'Week', 'Month'],
  });
  
  // Common homeopathic medicines for autocomplete
  const commonMedicines = [
    'Aconitum napellus', 'Arsenicum album', 'Belladonna', 'Bryonia alba', 'Calcarea carbonica',
    'Chamomilla', 'China officinalis', 'Coffea cruda', 'Dulcamara', 'Ferrum phosphoricum',
    'Gelsemium', 'Hepar sulphuris', 'Ignatia amara', 'Ipecacuanha', 'Kali bichromicum',
    'Lachesis', 'Lycopodium', 'Mercurius solubilis', 'Natrum muriaticum', 'Nux vomica',
    'Phosphorus', 'Pulsatilla', 'Rhus toxicodendron', 'Sepia', 'Silicea',
    'Sulphur', 'Thuja occidentalis', 'Arnica montana', 'Hypericum', 'Ruta graveolens',
    'Aesculus hippocastanum', 'Aloe socotrina', 'Antimonium crudum', 'Apis mellifica', 'Argentum nitricum',
    'Aurum metallicum', 'Baryta carbonica', 'Berberis vulgaris', 'Borax', 'Cactus grandiflorus',
    'Calcarea phosphorica', 'Cantharis', 'Carbo vegetabilis', 'Causticum', 'Cimicifuga',
    'Coccus cacti', 'Colocynthis', 'Conium maculatum', 'Cornus circinata', 'Crotalus horribilis',
    'Cuprum metallicum', 'Digitalis', 'Drosera', 'Echinacea', 'Eupatorium perforliatum',
    'Euphrasia', 'Graphites', 'Hamamelis', 'Hydrastis', 'Hypericum perfoliatum',
    'Kali carbonicum', 'Kali phosphoricum', 'Kreosotum', 'Lac caninum', 'Lobelia',
    'Magnesia phosphorica', 'Medorrhinum', 'Murex purpureus', 'Nitricum acidum', 'Oleander',
    'Oxalic acid', 'Petroleum', 'Phosphoricum acidum', 'Phytolacca', 'Platina',
    'Podophyllum', 'Psorinum', 'Pyrogenium', 'Ranunculus bulbosus', 'Raphanus',
    'Rumex crispus', 'Sabadilla', 'Sambucus nigra', 'Sanicula', 'Sarsaparilla',
    'Secale cornutum', 'Selenium', 'Spongia', 'Stannum metallicum', 'Staphysagria',
    'Stramonium', 'Sulphuricum acidum', 'Tabacum', 'Tarantula', 'Tellurium',
    'Theridion', 'Thlaspi', 'Tuberculinum', 'Veratrum album', 'Verbascum',
    'Viola odorata', 'Vipera', 'Zincum metallicum', 'Zingiber'
  ];
  
  // System memory for medicine patterns
  const MEDICINE_MEMORY_KEY = 'homeo_prescription_memory';
  const CUSTOM_MEDICINES_KEY = 'homeo_custom_medicines';
  const COMBINATION_NAMES_KEY = 'homeo_combination_names';
  
  interface MedicineMemory {
    medicine: string;
    potency?: string;
    quantity: string;
    doseForm: string;
    dosePattern: string;
    frequency: string;
    duration: string;
    usageCount: number;
    lastUsed: Date;
  }
  
  // Get saved custom medicines (entered by user)
  const getCustomMedicines = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(CUSTOM_MEDICINES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };
  
  // Save a custom medicine entered by user
  const saveCustomMedicine = (medicine: string) => {
    if (typeof window === 'undefined' || !medicine.trim()) return;
    const customMeds = getCustomMedicines();
    const lowerMed = medicine.toLowerCase().trim();
    if (!customMeds.some(m => m.toLowerCase() === lowerMed)) {
      customMeds.push(medicine.trim());
      localStorage.setItem(CUSTOM_MEDICINES_KEY, JSON.stringify(customMeds));
    }
  };
  
  // Get saved combination names for autocomplete
  const getCombinationNames = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(COMBINATION_NAMES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };
  
  // Save a combination name for autocomplete
  const saveCombinationName = (name: string) => {
    if (typeof window === 'undefined' || !name.trim()) return;
    const comboNames = getCombinationNames();
    const lowerName = name.toLowerCase().trim();
    if (!comboNames.some(n => n.toLowerCase() === lowerName)) {
      comboNames.push(name.trim());
      localStorage.setItem(COMBINATION_NAMES_KEY, JSON.stringify(comboNames));
    }
  };
  
  // Get all medicines for autocomplete (common + custom + combinations from both localStorage and database)
  const getAllMedicinesForAutocomplete = (query: string): {name: string; content?: string}[] => {
    const customMeds = getCustomMedicines();
    const comboNames = getCombinationNames();
    
    // Build combination list with content from database
    const dbComboMap = new Map(dbCombinations.map(c => [c.name, c.content]));
    const allComboNames = [...new Set([...dbComboMap.keys(), ...comboNames])];
    
    const filteredCustom = customMeds.filter(m => 
      m.toLowerCase().includes(query.toLowerCase())
    ).map(m => ({ name: m }));
    
    const filteredCombos = allComboNames.filter(c => 
      c.toLowerCase().includes(query.toLowerCase())
    ).map(c => ({ name: c, content: dbComboMap.get(c) || '' }));
    
    const filteredCommon = commonMedicines.filter(m => 
      m.toLowerCase().includes(query.toLowerCase())
    ).map(m => ({ name: m }));
    
    // Combine, prioritize custom medicines and combinations
    return [...filteredCustom, ...filteredCombos, ...filteredCommon].slice(0, 10);
  };
  
  const getMedicineMemory = (): Record<string, MedicineMemory> => {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(MEDICINE_MEMORY_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  };
  
  const saveMedicineToMemory = (medicine: string, potency: string, pattern: Prescription) => {
    if (typeof window === 'undefined' || !medicine.trim()) return;
    
    // Save medicine to custom list
    saveCustomMedicine(medicine);
    
    const memory = getMedicineMemory();
    const key = `${medicine.toLowerCase()}_${potency || ''}`;
    
    memory[key] = {
      medicine: medicine,
      potency: potency || '',
      quantity: pattern.quantity || '1dr',
      doseForm: pattern.doseForm || 'pills',
      dosePattern: pattern.dosePattern || '1-1-1',
      frequency: pattern.frequency || 'Daily',
      duration: pattern.duration || '7 days',
      usageCount: (memory[key]?.usageCount || 0) + 1,
      lastUsed: new Date()
    };
    
    localStorage.setItem(MEDICINE_MEMORY_KEY, JSON.stringify(memory));
  };
  
  const getMedicinePattern = (medicine: string, potency: string): Prescription | null => {
    const memory = getMedicineMemory();
    const key = `${medicine.toLowerCase()}_${potency || ''}`;
    return memory[key] || null;
  };
  
  // Load saved pattern when medicine/potency changes
  const loadSavedPattern = (index: number, medicine: string, potency: string) => {
    if (!medicine.trim()) return;
    
    const pattern = getMedicinePattern(medicine, potency);
    if (pattern) {
      setPrescriptions(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          quantity: pattern.quantity,
          doseForm: pattern.doseForm,
          dosePattern: pattern.dosePattern,
          frequency: pattern.frequency,
          duration: pattern.duration,
        };
        return updated;
      });
    }
  };
  
  // Modal states
  const [showEndConsultationModal, setShowEndConsultationModal] = useState(false);
  const [showSameDayReopenModal, setShowSameDayReopenModal] = useState(false);
  const [showPrescriptionPreview, setShowPrescriptionPreview] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);
  const [isConsultationEnded, setIsConsultationEnded] = useState(false);
  const [pharmacySent, setPharmacySent] = useState(false);
  
  // Past visits popup state
  const [showPastVisitsPopup, setShowPastVisitsPopup] = useState(false);
  const [pastVisitPrescriptions, setPastVisitPrescriptions] = useState<Record<string, Prescription[]>>({});
  
  // Refs
  const caseTextRef = useRef<HTMLTextAreaElement>(null);
  const medicineInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search for patients
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      const allPatients = patientDb.getAll() as Patient[];
      const filtered = allPatients.filter((p) =>
        p.firstName.toLowerCase().includes(query.toLowerCase()) ||
        p.lastName.toLowerCase().includes(query.toLowerCase()) ||
        p.fullName.toLowerCase().includes(query.toLowerCase()) ||
        p.registrationNumber.toLowerCase().includes(query.toLowerCase()) ||
        p.mobileNumber.includes(query)
      ).map((p): PatientRecord => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        mobile: p.mobileNumber,
        registrationNumber: p.registrationNumber,
        age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : undefined,
        gender: p.gender,
      }));
      setSearchResults(filtered);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Select a patient from search results
  const handleSelectPatient = (selectedPatient: PatientRecord) => {
    loadPatientData(selectedPatient.id);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    
    // Update URL with patient ID
    router.push(`/doctor-panel?patientId=${selectedPatient.id}`);
  };

  // Load patient data from database
  const loadPatientData = useCallback(async (id: string) => {
    const patientData = patientDb.getById(id) as Patient | undefined;
    
    if (!patientData) return;
    
    const patientRecord: PatientRecord = {
      id: patientData.id,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      mobile: patientData.mobileNumber,
      registrationNumber: patientData.registrationNumber,
      age: patientData.dateOfBirth ? new Date().getFullYear() - new Date(patientData.dateOfBirth).getFullYear() : undefined,
      gender: patientData.gender,
    };
    setPatient(patientRecord);

    // Check for today's appointment with fees
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    const appointments = appointmentDb.getByPatient(patientData.id) as Appointment[];
    const todayAppointment = appointments.find((apt: Appointment) => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= today && aptDate <= todayEnd && 
             (apt.status === 'checked-in' || apt.status === 'in-progress');
    });
    
    if (todayAppointment) {
      // Use appointment fees
      const apt = todayAppointment as Appointment & { feeTypeId?: string; feeId?: string };
      setCurrentAppointmentFee({
        feeAmount: (todayAppointment.feeAmount as number) || 0,
        feeType: (todayAppointment.feeType as string) || 'consultation',
        feeTypeId: apt.feeTypeId || '',
        feeStatus: (todayAppointment.feeStatus as string) || 'pending',
        feeId: apt.feeId || '',
      });
      setFeeAmount(String((todayAppointment.feeAmount as number) || ''));
      setFeeType((todayAppointment.feeType as string) || 'consultation');
      setPaymentStatus((todayAppointment.feeStatus as string) || 'pending');
    }

    // Get last fee paid info
    const lastFee = feeHistoryDb.getLastByPatient(patientData.id) as FeeHistoryEntry | null;
    if (lastFee) {
      const paidDate = new Date(lastFee.paidDate);
      const diffTime = Math.abs(today.getTime() - paidDate.getTime());
      const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const isSameDay = 
        paidDate.getDate() === today.getDate() &&
        paidDate.getMonth() === today.getMonth() &&
        paidDate.getFullYear() === today.getFullYear();
      
      setLastFeeInfo({
        date: paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        amount: lastFee.amount,
        daysAgo: isSameDay ? 0 : daysAgo,
        feeType: lastFee.feeType,
        status: 'paid',
      });
    } else if (todayAppointment && todayAppointment.feeStatus === 'pending') {
      // If no paid fee history but current appointment has pending/due fee, show that as last fee info
      const aptDate = new Date(todayAppointment.appointmentDate);
      setLastFeeInfo({
        date: aptDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        amount: (todayAppointment.feeAmount as number) || 0,
        daysAgo: 0,
        feeType: (todayAppointment.feeType as string) || 'consultation',
        status: 'pending',
      });
    } else {
      setLastFeeInfo(null);
    }

    // Load actual past visits from database first to calculate visit number
    const savedVisits = doctorVisitDb.getByPatient(id) as DoctorVisit[];
    
    // Sort by date (oldest first) to assign correct visit numbers
    const sortedVisits = [...savedVisits]
      .filter(v => v.status === 'locked' || v.status === 'completed')
      .sort((a, b) => {
        const dateA = a.visitDate instanceof Date ? a.visitDate.getTime() : new Date(a.visitDate).getTime();
        const dateB = b.visitDate instanceof Date ? b.visitDate.getTime() : new Date(b.visitDate).getTime();
        return dateA - dateB; // Oldest first
      });
    
    // Assign visit numbers based on chronological order
    const formattedVisits: Visit[] = sortedVisits.map((v, index) => ({
      id: v.id,
      patientId: v.patientId,
      visitDate: v.visitDate,
      visitNumber: index + 1, // Assign visit number based on order
      chiefComplaint: v.chiefComplaint,
      caseText: v.caseText,
      diagnosis: v.diagnosis,
      advice: v.advice,
      testsRequired: v.testsRequired,
      nextVisit: v.nextVisit,
      prognosis: v.prognosis,
      remarksToFrontdesk: v.remarksToFrontdesk,
      status: v.status,
    }));
    
    // Sort for display (newest first)
    const displayVisits = [...formattedVisits].sort((a, b) => 
      new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    );
    setPastVisits(displayVisits);
    
    // Calculate next visit number based on past visits count
    const nextVisitNumber = formattedVisits.length + 1;
    
    // Check for active visit
    const mockActiveVisit: Visit = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId: id,
      visitDate: new Date(),
      visitNumber: nextVisitNumber,
      status: 'active',
    };
    setCurrentVisit(mockActiveVisit);
  }, [setPatient, setCurrentVisit, setPastVisits, setFeeAmount, setFeeType, setPaymentStatus, setLastFeeInfo]);

  // Load patient from URL on mount
  useEffect(() => {
    if (patientIdFromUrl) {
      loadPatientData(patientIdFromUrl);
    }
  }, [patientIdFromUrl, loadPatientData]);

  // Load smart parsing rules
  useEffect(() => {
    const loadSmartParsingRules = async () => {
      try {
        const response = await fetch('/api/smart-parsing');
        const data = await response.json();
        if (data.success && data.data) {
          // Filter only active rules and sort by priority
          const activeRules = data.data
            .filter((rule: SmartParsingRule) => rule.isActive)
            .sort((a: SmartParsingRule, b: SmartParsingRule) => b.priority - a.priority);
          setSmartParsingRules(activeRules);
        }
      } catch (error) {
        console.error('Failed to load smart parsing rules:', error);
      }
    };
    loadSmartParsingRules();
    
    // Load AI parsing settings
    try {
      const savedSettings = localStorage.getItem('aiParsingSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setAiParsingEnabled(settings.enabled || false);
        setAiApiKey(settings.apiKey || '');
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
    
    // Load prescription settings
    try {
      const savedPrescriptionSettings = localStorage.getItem('prescription_settings');
      if (savedPrescriptionSettings) {
        const settings = JSON.parse(savedPrescriptionSettings);
        setPrescriptionSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load prescription settings:', error);
    }
    
    // Load combinations from database
    const loadCombinations = async () => {
      try {
        const response = await fetch('/api/doctor-panel/combinations');
        const data = await response.json();
        if (Array.isArray(data)) {
          setDbCombinations(data.map((c: { name: string; content: string }) => ({ name: c.name, content: c.content })));
        }
      } catch (error) {
        console.error('Failed to load combinations:', error);
      }
    };
    loadCombinations();
  }, []);

  // ===== CASE TAKING =====
  
  const handleCaseTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCaseText(text);
    
    // Check for vague symptoms if system assist is on
    if (isSystemAssist) {
      analyzeCaseText(text);
    }
  };

  const addCaseLine = (line: string) => {
    setCaseText(prev => prev + (prev ? '\n' : '') + line);
    setTimeout(() => {
      if (caseTextRef.current) {
        caseTextRef.current.focus();
      }
    }, 0);
  };

  const analyzeCaseText = (text: string) => {
    // Simple vague symptom detection
    const vagueTerms = ['pain', '不舒服', 'problem', 'issue'];
    // This would integrate with AI/system assist in real implementation
  };

  // ===== PRESCRIPTION TABLE =====

  const addEmptyPrescriptionRow = () => {
    setPrescriptions(prev => [...prev, {
      medicine: '',
      potency: '',
      quantity: '1dr',
      doseForm: 'pills',
      dosePattern: '1-1-1',
      frequency: 'Daily',
      duration: '7 days',
      bottles: 1,
    }]);
  };

  const updatePrescriptionRow = (index: number, field: string, value: string | number) => {
    setPrescriptions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index));
  };

  const movePrescriptionRow = (index: number, direction: 'up' | 'down') => {
    setPrescriptions(prev => {
      const updated = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex >= 0 && newIndex < updated.length) {
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      }
      return updated;
    });
  };

  const parseSmartEntry = (text: string, existingRules: SmartParsingRule[] = []): Prescription => {
    // Smart parsing for one-line entry using database rules
    // Example: "Arnica 200 2dr 4 pills TDS/3 times a day for 7 days"
    
    const parts = text.split(' ');
    
    let rx: Prescription = {
      medicine: '',
      potency: '',
      quantity: '1dr',
      doseForm: 'pills',
      dosePattern: '1-1-1',
      frequency: 'Daily',
      duration: '7 days',
      bottles: 1,
    };

    // Parse medicine and potency (assume first 1-2 parts)
    if (parts.length > 0) {
      rx.medicine = parts[0];
      // Check if second part is potency (number or 200/1M etc)
      if (parts.length > 1 && /^\d+$/.test(parts[1])) {
        rx.potency = parts[1];
      }
    }

    // If we have database rules, use them
    if (existingRules.length > 0) {
      // Apply rules by type in order: quantity, doseForm, dosePattern, duration
      const quantityRules = existingRules.filter(r => r.type === 'quantity');
      const doseFormRules = existingRules.filter(r => r.type === 'doseForm');
      const dosePatternRules = existingRules.filter(r => r.type === 'dosePattern');
      const durationRules = existingRules.filter(r => r.type === 'duration');
      
      // Apply quantity rules
      for (const rule of quantityRules) {
        try {
          const regex = rule.isRegex ? new RegExp(rule.pattern, 'i') : null;
          if (regex && regex.test(text)) {
            const match = text.match(regex);
            if (match) {
              rx.quantity = rule.replacement.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)] || '');
            }
            break;
          } else if (!rule.isRegex && text.toLowerCase().includes(rule.pattern.toLowerCase())) {
            rx.quantity = rule.replacement;
            break;
          }
        } catch (e) {
          // Skip invalid regex
        }
      }
      
      // Apply dose form rules
      for (const rule of doseFormRules) {
        try {
          const regex = rule.isRegex ? new RegExp(rule.pattern, 'i') : null;
          if (regex && regex.test(text)) {
            const match = text.match(regex);
            if (match) {
              rx.doseForm = rule.replacement.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)] || '');
            }
            break;
          } else if (!rule.isRegex && text.toLowerCase().includes(rule.pattern.toLowerCase())) {
            rx.doseForm = rule.replacement;
            break;
          }
        } catch (e) {
          // Skip invalid regex
        }
      }
      
      // Apply dose pattern rules - handle special case for TDS with quantities
      // Example: "4 pills TDS" should result in "4-4-4"
      const tdsMatch = text.match(/(\d+)\s*pills?\s*TDS/i);
      if (tdsMatch) {
        const quantity = tdsMatch[1];
        rx.dosePattern = `${quantity}-${quantity}-${quantity}`;
      } else {
        for (const rule of dosePatternRules) {
          try {
            const regex = rule.isRegex ? new RegExp(rule.pattern, 'i') : null;
            if (regex && regex.test(text)) {
              const match = text.match(regex);
              if (match) {
                rx.dosePattern = rule.replacement.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)] || '');
              }
              break;
            } else if (!rule.isRegex && text.toLowerCase().includes(rule.pattern.toLowerCase())) {
              rx.dosePattern = rule.replacement;
              break;
            }
          } catch (e) {
            // Skip invalid regex
          }
        }
      }
      
      // Apply duration rules
      for (const rule of durationRules) {
        try {
          const regex = rule.isRegex ? new RegExp(rule.pattern, 'i') : null;
          if (regex && regex.test(text)) {
            const match = text.match(regex);
            if (match) {
              const replacement = rule.replacement.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)] || '');
              rx.duration = replacement;
              // Calculate duration in days
              if (replacement.toLowerCase().includes('week')) {
                rx.durationDays = parseInt(replacement) * 7;
              } else if (replacement.toLowerCase().includes('month')) {
                rx.durationDays = parseInt(replacement) * 30;
              } else {
                rx.durationDays = parseInt(replacement);
              }
            }
            break;
          } else if (!rule.isRegex && text.toLowerCase().includes(rule.pattern.toLowerCase())) {
            rx.duration = rule.replacement;
            break;
          }
        } catch (e) {
          // Skip invalid regex
        }
      }
    } else {
      // Fallback to basic parsing if no rules loaded
      // Parse quantity
      const quantityMatch = text.match(/(\d+)\s*(dr|oz|bottle|pills?)/i);
      if (quantityMatch) {
        rx.quantity = quantityMatch[0];
        rx.doseForm = quantityMatch[2].toLowerCase().includes('dr') ? 'drops' : 'pills';
      }

      // Parse dose pattern (4-4-4, 1-0-1, etc)
      const patternMatch = text.match(/(\d-\d-\d)/);
      if (patternMatch) {
        rx.dosePattern = patternMatch[1];
      }

      // Parse frequency with TDS special handling
      const tdsMatch = text.match(/(\d+)\s*pills?\s*TDS/i);
      if (tdsMatch) {
        rx.frequency = 'Daily';
        rx.dosePattern = `${tdsMatch[1]}-${tdsMatch[1]}-${tdsMatch[1]}`;
      } else if (/tds|3\s*times/i.test(text)) {
        rx.frequency = 'Daily';
        rx.dosePattern = '1-1-1';
      } else if (/bid|2\s*times/i.test(text)) {
        rx.frequency = 'Daily';
        rx.dosePattern = '1-0-1';
      } else if (/hs|night/i.test(text)) {
        rx.frequency = 'Daily';
        rx.dosePattern = '0-0-1';
      }

      // Parse duration
      const durationMatch = text.match(/(\d+)\s*(day|week|month)/i);
      if (durationMatch) {
        rx.duration = `${durationMatch[1]} ${durationMatch[2]}s`;
        rx.durationDays = parseInt(durationMatch[1]) * (durationMatch[2].toLowerCase().startsWith('w') ? 7 : durationMatch[2].toLowerCase().startsWith('m') ? 30 : 1);
      }
    }

    return rx;
  };

  // ===== MEDICINE AUTOCOMPLETE =====
  
  const handleMedicineSearchChange = (index: number, value: string) => {
    setMedicineSearchQuery(value);
    updatePrescriptionRow(index, 'medicine', value);
    setFocusedMedicineIndex(index);
    
    if (value.trim().length > 0) {
      // Use all medicines (common + custom + combinations) for autocomplete
      const suggestions = getAllMedicinesForAutocomplete(value);
      setMedicineSuggestions(suggestions);
      setShowMedicineSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } else {
      // Show all medicines when field is empty (including database combinations with content)
      const dbComboMap = new Map(dbCombinations.map(c => [c.name, c.content]));
      const allComboNames = [...new Set([...dbComboMap.keys(), ...getCombinationNames()])];
      const allMeds: {name: string; content?: string}[] = [
        ...getCustomMedicines().map(m => ({ name: m })),
        ...allComboNames.map(c => ({ name: c, content: dbComboMap.get(c) || '' })),
        ...commonMedicines.slice(0, 5).map(m => ({ name: m }))
      ].slice(0, 10);
      setMedicineSuggestions(allMeds);
      setShowMedicineSuggestions(true);
      setSelectedSuggestionIndex(-1);
    }
  };
  
  const handleMedicineKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    totalRows: number
  ) => {
    // Handle Enter key - always prevent default to avoid form submission
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If suggestions are shown and one is selected, select it
      if (showMedicineSuggestions && selectedSuggestionIndex >= 0 && medicineSuggestions[selectedSuggestionIndex]) {
        selectMedicine(index, medicineSuggestions[selectedSuggestionIndex]);
        return; // Don't add new row, just select and autofill
      } else if (showMedicineSuggestions && medicineSuggestions.length > 0) {
        // If suggestions are shown but none selected, select the first one
        selectMedicine(index, medicineSuggestions[0]);
        return; // Don't add new row, just select and autofill
      }
      
      // No suggestions visible - try to load saved pattern for the entered medicine
      const rx = prescriptions[index];
      if (rx.medicine.trim()) {
        // First try to load saved pattern from memory
        const savedPattern = getMedicinePattern(rx.medicine, rx.potency || '');
        if (savedPattern) {
          // Apply saved pattern
          setPrescriptions(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              quantity: savedPattern.quantity,
              doseForm: savedPattern.doseForm,
              dosePattern: savedPattern.dosePattern,
              frequency: savedPattern.frequency,
              duration: savedPattern.duration,
            };
            return updated;
          });
        } else {
          // No saved pattern - try smart parsing
          const parsed = parseSmartEntry(rx.medicine, smartParsingRules);
          if (parsed.medicine) {
            setPrescriptions(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...parsed };
              return updated;
            });
          }
        }
        // Save to custom medicines list
        saveCustomMedicine(rx.medicine);
      }
      
      // Hide suggestions
      setShowMedicineSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setFocusedMedicineIndex(null);
      return; // Don't add new row on Enter - user can click "Add Medicine" button
    }
    
    // Handle other keys when suggestions are shown
    if (showMedicineSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < medicineSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Tab':
          if (selectedSuggestionIndex >= 0 && medicineSuggestions[selectedSuggestionIndex]) {
            e.preventDefault();
            selectMedicine(index, medicineSuggestions[selectedSuggestionIndex]);
          }
          break;
        case 'Escape':
          setShowMedicineSuggestions(false);
          setSelectedSuggestionIndex(-1);
          setFocusedMedicineIndex(null);
          break;
      }
    }
  };
  
  const selectMedicine = (index: number, suggestion: {name: string; content?: string}) => {
    const medicine = suggestion.name;
    const isCombination = !!suggestion.content;
    
    setPrescriptions(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        medicine: medicine,
        isCombination: isCombination,
        combinationName: isCombination ? medicine : undefined,
        combinationContent: suggestion.content || undefined,
      };
      return updated;
    });
    
    setShowMedicineSuggestions(false);
    setMedicineSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setMedicineSearchQuery('');
    setFocusedMedicineIndex(null);
    
    // Try to load saved pattern for this medicine
    const savedPattern = getMedicinePattern(medicine, '');
    if (savedPattern) {
      setPrescriptions(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          quantity: savedPattern.quantity,
          doseForm: savedPattern.doseForm,
          dosePattern: savedPattern.dosePattern,
          frequency: savedPattern.frequency,
          duration: savedPattern.duration,
        };
        return updated;
      });
    } else {
      // No saved pattern - try smart parsing on the medicine name
      const parsed = parseSmartEntry(medicine, smartParsingRules);
      if (parsed.medicine) {
        setPrescriptions(prev => {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            medicine: medicine, // Keep original medicine name
            quantity: parsed.quantity,
            doseForm: parsed.doseForm,
            dosePattern: parsed.dosePattern,
            frequency: parsed.frequency,
            duration: parsed.duration,
          };
          return updated;
        });
      }
    }
  };
  
  const handlePotencyKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    totalRows: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rx = prescriptions[index];
      if (rx.medicine.trim() && rx.potency) {
        saveMedicineToMemory(rx.medicine, rx.potency, rx);
        loadSavedPattern(index, rx.medicine, rx.potency);
      }
      // Add new row if on last row
      if (index === totalRows - 1) {
        addEmptyPrescriptionRow();
      }
    }
  };

  const handleOpenCombination = (index: number) => {
    // Toggle inline editing for combination
    if (editingCombinationIndex === index) {
      // Close if already open
      setEditingCombinationIndex(null);
      setCombinationName('');
      setCombinationContent('');
    } else {
      // Open for editing
      setEditingCombinationIndex(index);
      setCombinationName(prescriptions[index].combinationName || prescriptions[index].medicine || '');
      setCombinationContent(prescriptions[index].combinationContent || '');
    }
  };

  const saveCombination = () => {
    if (editingCombinationIndex !== null) {
      setPrescriptions(prev => {
        const updated = [...prev];
        updated[editingCombinationIndex] = {
          ...updated[editingCombinationIndex],
          isCombination: true,
          combinationName,
          combinationContent,
          medicine: combinationName,
        };
        return updated;
      });
      // Save combination name to memory for autocomplete
      if (combinationName.trim()) {
        saveCombinationName(combinationName);
      }
    }
    setEditingCombinationIndex(null);
    setCombinationName('');
    setCombinationContent('');
  };

  const cancelCombination = () => {
    setEditingCombinationIndex(null);
    setCombinationName('');
    setCombinationContent('');
  };
  
  // ===== SMART PARSING =====
  
  const handleSmartParse = (index: number) => {
    const rx = prescriptions[index];
    if (rx.medicine.trim()) {
      const parsed = parseSmartEntry(rx.medicine, smartParsingRules);
      setPrescriptions(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...parsed };
        return updated;
      });
    }
  };
  
  // Handle smart parsing input field - parse and add new row on Enter
  const handleSmartParseInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && smartParseInput.trim()) {
      e.preventDefault();
      
      // If AI parsing is enabled and API key is available, use AI
      if (aiParsingEnabled && aiApiKey) {
        setIsAiParsing(true);
        try {
          const response = await fetch('/api/parse-prescription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: smartParseInput,
              useAI: true,
              apiKey: aiApiKey,
            }),
          });
          
          const data = await response.json();
          
          if (data.success && data.data) {
            const parsed = data.data;
            const newPrescription: Prescription = {
              medicine: parsed.medicineName || smartParseInput.trim(),
              potency: parsed.potency || '',
              quantity: parsed.quantity || '1dr',
              doseForm: parsed.doseForm || 'pills',
              dosePattern: parsed.pattern || '1-1-1',
              frequency: parsed.frequency || 'Daily',
              duration: parsed.duration || '7 days',
              durationDays: parsed.duration ? parseInt(parsed.duration) * (parsed.duration.includes('week') ? 7 : parsed.duration.includes('month') ? 30 : 1) : 7,
              bottles: 1,
            };
            
            setPrescriptions(prev => [...prev, newPrescription]);
            
            if (newPrescription.medicine) {
              saveCustomMedicine(newPrescription.medicine);
              if (newPrescription.potency) {
                saveMedicineToMemory(newPrescription.medicine, newPrescription.potency, newPrescription);
              }
            }
            
            setSmartParseInput('');
            setTimeout(() => {
              smartParseInputRef.current?.focus();
            }, 0);
            return;
          }
        } catch (error) {
          console.error('AI parsing failed, falling back to regex:', error);
        } finally {
          setIsAiParsing(false);
        }
      }
      
      // Fallback to regex parsing
      const parsed = parseSmartEntry(smartParseInput, smartParsingRules);
      
      // Add new prescription row with parsed values
      const newPrescription: Prescription = {
        medicine: parsed.medicine || smartParseInput.trim(),
        potency: parsed.potency || '',
        quantity: parsed.quantity || '1dr',
        doseForm: parsed.doseForm || 'pills',
        dosePattern: parsed.dosePattern || '1-1-1',
        frequency: parsed.frequency || 'Daily',
        duration: parsed.duration || '7 days',
        durationDays: parsed.durationDays || 7,
        bottles: parsed.bottles || 1,
      };
      
      setPrescriptions(prev => [...prev, newPrescription]);
      
      // Save medicine to memory and custom list
      if (newPrescription.medicine) {
        saveCustomMedicine(newPrescription.medicine);
        if (newPrescription.potency) {
          saveMedicineToMemory(newPrescription.medicine, newPrescription.potency, newPrescription);
        }
      }
      
      // Clear input and keep focus
      setSmartParseInput('');
      setTimeout(() => {
        smartParseInputRef.current?.focus();
      }, 0);
    }
  };

  // ===== SAVE FEE =====
  
  const handleSaveFee = () => {
    if (!patient) return;
    
    const feeAmountNum = parseFloat(feeAmount) || 0;
    const discountPercentNum = parseFloat(discountPercent) || 0;
    
    // Find today's appointment for this patient
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    const appointments = appointmentDb.getByPatient(patient.id) as Appointment[];
    const todayAppointment = appointments.find((apt: Appointment) => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= today && aptDate <= todayEnd && 
             (apt.status === 'checked-in' || apt.status === 'in-progress');
    });
    
    // Update or create fee record
    let feeRecordId = currentAppointmentFee?.feeId;
    
    if (feeRecordId) {
      // Update existing fee record
      db.update('fees', feeRecordId, {
        amount: feeAmountNum,
        feeType: feeType,
        paymentStatus: paymentStatus,
        discountPercent: discountPercentNum,
        discountReason: discountReason,
        updatedAt: new Date(),
      });
    } else {
      // Create new fee record
      const newFee = db.create('fees', {
        patientId: patient.id,
        amount: feeAmountNum,
        feeType: feeType,
        paymentStatus: paymentStatus,
        discountPercent: discountPercentNum,
        discountReason: discountReason,
        paymentMethod: '',
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      feeRecordId = newFee.id;
    }
    
    // Update the appointment with new fee information
    if (todayAppointment) {
      appointmentDb.update(todayAppointment.id, {
        feeStatus: paymentStatus,
        feeAmount: feeAmountNum,
        feeType: feeType,
        feeId: feeRecordId,
      });
    }
    
    // Update the visible fee info immediately
    setCurrentAppointmentFee(prev => prev ? {
      ...prev,
      feeId: feeRecordId,
      feeAmount: feeAmountNum,
      feeType: feeType,
      feeStatus: paymentStatus,
    } : null);
    
    // Update last fee info based on payment status
    if (paymentStatus === 'paid') {
      setLastFeeInfo({
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        amount: feeAmountNum,
        daysAgo: 0,
        feeType: feeType,
        status: 'paid',
      });
      
      // Add to fee history when paid
      const existingFeeHistory = db.getAll('feeHistory') as FeeHistoryEntry[];
      const todayFeeHistory = existingFeeHistory.find((fh) => 
        fh.patientId === patient.id && 
        fh.visitId === todayAppointment?.id
      );
      
      if (!todayFeeHistory) {
        feeHistoryDb.create({
          id: `fh-${Date.now()}`,
          patientId: patient.id,
          visitId: todayAppointment?.id,
          receiptId: `RCP-${Date.now()}`,
          feeType: feeType as 'first-visit' | 'follow-up' | 'exempt' | 'consultation' | 'medicine',
          amount: feeAmountNum,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          paidDate: new Date(),
          daysSinceLastFee: lastFeeInfo ? lastFeeInfo.daysAgo : undefined,
        });
      }
    } else if (paymentStatus === 'pending') {
      setLastFeeInfo({
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        amount: feeAmountNum,
        daysAgo: 0,
        feeType: feeType,
        status: 'pending',
      });
    } else if (paymentStatus === 'exempt') {
      // For exempt status, clear the last fee info or keep it as is
      setLastFeeInfo(prev => prev ? { ...prev, status: undefined } : null);
    }
    
    // Collapse the form after saving
    setShowFeeForm(false);
    
    // Show success feedback (could add a toast notification here)
    console.log('Fee saved successfully');
  };

  // ===== NEXT VISIT CALCULATIONS =====
  
  // Calculate next visit date from days
  const handleNextVisitDaysChange = (days: string) => {
    setNextVisitDays(days);
    const daysNum = parseInt(days);
    if (!isNaN(daysNum) && daysNum > 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + daysNum);
      setNextVisit(nextDate.toISOString().split('T')[0]);
    }
  };
  
  // Calculate days from next visit date
  const handleNextVisitDateChange = (date: string) => {
    setNextVisit(date);
    if (date) {
      const nextDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setNextVisitDays(String(diffDays));
      } else {
        setNextVisitDays('');
      }
    }
  };
  
  // Save field order to localStorage
  const saveFieldOrder = (newOrder: string[]) => {
    setAdditionalNotesFieldOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doctor_panel_field_order', JSON.stringify(newOrder));
    }
  };
  
  // Move field up in order
  const moveFieldUp = (field: string) => {
    const currentIndex = additionalNotesFieldOrder.indexOf(field);
    if (currentIndex > 0) {
      const newOrder = [...additionalNotesFieldOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      saveFieldOrder(newOrder);
    }
  };
  
  // Move field down in order
  const moveFieldDown = (field: string) => {
    const currentIndex = additionalNotesFieldOrder.indexOf(field);
    if (currentIndex < additionalNotesFieldOrder.length - 1) {
      const newOrder = [...additionalNotesFieldOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      saveFieldOrder(newOrder);
    }
  };

  // ===== END CONSULTATION =====

  const handleEndConsultation = async () => {
    if (!currentVisit || !patient) return;

    // Save visit data with locked status
    const visitData = {
      patientId: patient.id,
      visitDate: new Date(),
      visitNumber: currentVisit.visitNumber,
      chiefComplaint: caseText.split('\n')[0] || '',
      caseText,
      diagnosis,
      advice,
      testsRequired,
      nextVisit: nextVisit ? new Date(nextVisit) : undefined,
      prognosis,
      remarksToFrontdesk,
      status: 'locked' as const, // Lock the visit
    };

    // Create visit record
    const savedVisit = doctorVisitDb.create(visitData);
    setSavedVisitId(savedVisit.id);

    // Save prescriptions
    const prescriptionIds: string[] = [];
    prescriptions.forEach((rx, index) => {
      if (rx.medicine.trim()) {
        const savedRx = doctorPrescriptionDb.create({
          visitId: savedVisit.id,
          patientId: patient.id,
          medicine: rx.medicine,
          potency: rx.potency,
          quantity: rx.quantity,
          doseForm: rx.doseForm,
          dosePattern: rx.dosePattern,
          frequency: rx.frequency,
          duration: rx.duration,
          durationDays: rx.durationDays,
          bottles: rx.bottles,
          instructions: rx.instructions,
          rowOrder: index,
          isCombination: rx.isCombination,
          combinationName: rx.combinationName,
          combinationContent: rx.combinationContent,
        });
        prescriptionIds.push(savedRx.id);
      }
    });

    // Save/update fee record
    const feeAmountNum = parseFloat(feeAmount) || 0;
    const discountPercentNum = parseFloat(discountPercent) || 0;
    const finalAmount = feeAmountNum - (feeAmountNum * discountPercentNum / 100);
    
    if (currentAppointmentFee?.feeId) {
      // Update existing fee record
      db.update('fees', currentAppointmentFee.feeId, {
        amount: feeAmountNum,
        feeType: feeType,
        paymentStatus: paymentStatus,
        discountPercent: discountPercentNum,
        discountReason: discountReason,
        notes: remarksToFrontdesk,
        updatedAt: new Date(),
      });
    } else {
      // Create new fee record
      db.create('fees', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId: patient.id,
        visitId: savedVisit.id,
        amount: feeAmountNum,
        feeType: feeType,
        paymentStatus: paymentStatus,
        discountPercent: discountPercentNum,
        discountReason: discountReason,
        paymentMethod: '',
        notes: remarksToFrontdesk,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // If fee is paid, add to fee history
    if (paymentStatus === 'paid') {
      feeHistoryDb.create({
        id: `fh-${Date.now()}`,
        patientId: patient.id,
        visitId: savedVisit.id,
        receiptId: `RCP-${Date.now()}`,
        feeType: feeType as 'first-visit' | 'follow-up' | 'exempt' | 'consultation' | 'medicine',
        amount: finalAmount,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidDate: new Date(),
        daysSinceLastFee: lastFeeInfo ? lastFeeInfo.daysAgo : undefined,
      });
    }

    // Update appointment fee status if exists
    if (currentAppointmentFee?.feeId) {
      const appointments = appointmentDb.getAll() as Appointment[];
      const todayAppt = appointments.find((apt: Appointment) => 
        apt.feeId === currentAppointmentFee.feeId
      );
      if (todayAppt) {
        appointmentDb.update(todayAppt.id, {
          feeStatus: paymentStatus,
          feeAmount: feeAmountNum,
          feeType: feeType,
        });
      }
    }

    // Mark consultation as ended and show preview popup
    setIsConsultationEnded(true);
    setShowPrescriptionPreview(true);
  };

  // Send prescription to pharmacy queue
  const handleSendToPharmacy = () => {
    if (!savedVisitId || !patient) return;
    
    // Add to pharmacy queue
    pharmacyQueueDb.create({
      visitId: savedVisitId,
      patientId: patient.id,
      prescriptionIds: [],
      priority: false,
      status: 'pending',
    });
    
    setPharmacySent(true);
  };

  // Reset panel for next patient
  const handleResetPanel = () => {
    setPatient(null);
    setCurrentVisit(null);
    setPrescriptions([]);
    setCaseText('');
    setDiagnosis('');
    setAdvice('');
    setTestsRequired('');
    setNextVisit('');
    setNextVisitDays('');
    setPrognosis('');
    setRemarksToFrontdesk('');
    setFeeAmount('');
    setFeeType('consultation');
    setPaymentStatus('pending');
    setDiscountPercent('');
    setDiscountReason('');
    setShowPrescriptionPreview(false);
    setIsConsultationEnded(false);
    setPharmacySent(false);
    setSavedVisitId(null);
    router.push('/queue/doctor');
  };

  // Handle WhatsApp share
  const handleWhatsAppShare = () => {
    if (!patient) return;
    
    const prescriptionText = prescriptions
      .filter(rx => rx.medicine.trim())
      .map((rx, i) => `${i + 1}. ${rx.medicine} ${rx.potency || ''} - ${rx.dosePattern} for ${rx.duration}`)
      .join('\n');
    
    const message = `*Prescription from Dr. Homeopathic Clinic*

Patient: ${patient.firstName} ${patient.lastName}
Date: ${new Date().toLocaleDateString()}

*Medicines:*
${prescriptionText || 'No medicines prescribed'}

${advice ? `*Advice:* ${advice}` : ''}
${nextVisit ? `*Next Visit:* ${new Date(nextVisit).toLocaleDateString()}` : ''}

Thank you for visiting!`;
    
    const whatsappUrl = `https://wa.me/${patient.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle Email share
  const handleEmailShare = () => {
    if (!patient) return;
    
    const prescriptionText = prescriptions
      .filter(rx => rx.medicine.trim())
      .map((rx, i) => `${i + 1}. ${rx.medicine} ${rx.potency || ''} - ${rx.dosePattern} for ${rx.duration}`)
      .join('\n');
    
    const subject = encodeURIComponent(`Your Prescription - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`Dear ${patient.firstName} ${patient.lastName},

Please find your prescription below:

Medicines:
${prescriptionText || 'No medicines prescribed'}

${advice ? `Advice: ${advice}` : ''}
${nextVisit ? `Next Visit: ${new Date(nextVisit).toLocaleDateString()}` : ''}

Thank you for visiting Dr. Homeopathic Clinic!

Best regards,
Dr. Homeopathic Clinic`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  // ===== MATERIA MEDICA SEARCH =====

  const searchMateriaMedica = async (query: string) => {
    setMateriaMedicaQuery(query);
    // TODO: Implement materia medica search
    // This would search against a materia medica database
  };

  // ===== PAST HISTORY =====

  const repeatPastVisit = (visit: Visit) => {
    if (visit.caseText) setCaseText(visit.caseText);
    if (visit.diagnosis) setDiagnosis(visit.diagnosis);
    if (visit.advice) setAdvice(visit.advice);
    setShowPastVisitsPopup(false);
  };
  
  // Copy prescription from past visit to current prescription
  const copyPrescriptionFromPastVisit = (visitId: string) => {
    const visitPrescriptions = pastVisitPrescriptions[visitId] || [];
    if (visitPrescriptions.length > 0) {
      // Add copied prescriptions below existing ones
      setPrescriptions(prev => [...prev, ...visitPrescriptions.map(rx => ({ ...rx }))]);
    }
    // Close the popup after copying
    setShowPastVisitsPopup(false);
  };
  
  // Load prescriptions for past visits
  const loadPastVisitPrescriptions = (visitId: string) => {
    if (!pastVisitPrescriptions[visitId]) {
      const rxList = doctorPrescriptionDb.getByVisit(visitId) as Array<{
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
        isCombination?: boolean;
        combinationName?: string;
        combinationContent?: string;
      }>;
      if (rxList && rxList.length > 0) {
        setPastVisitPrescriptions(prev => ({
          ...prev,
          [visitId]: rxList.map(rx => ({
            medicine: rx.medicine,
            potency: rx.potency,
            quantity: rx.quantity,
            doseForm: rx.doseForm,
            dosePattern: rx.dosePattern,
            frequency: rx.frequency,
            duration: rx.duration,
            durationDays: rx.durationDays,
            bottles: rx.bottles,
            instructions: rx.instructions,
            isCombination: rx.isCombination,
            combinationName: rx.combinationName,
            combinationContent: rx.combinationContent,
          }))
        }));
      }
    }
  };
  
  // Open past visits popup
  const openPastVisitsPopup = () => {
    setShowPastVisitsPopup(true);
    // Load prescriptions for all past visits
    pastVisits.forEach(visit => {
      loadPastVisitPrescriptions(visit.id);
    });
  };
  
  // Share past visit via WhatsApp (opens PDF for sharing)
  const sharePastVisitWhatsApp = (visit: Visit) => {
    if (!patient) return;
    
    // Open the PDF in a new window for sharing
    const pdfContent = generatePastVisitPDFContent(visit);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      
      // Show instructions for sharing via WhatsApp
      const instructionDiv = printWindow.document.createElement('div');
      instructionDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; background: #25D366; color: white; padding: 15px; text-align: center; z-index: 1000;">
          <p style="margin: 0; font-weight: bold;">To share via WhatsApp:</p>
          <p style="margin: 5px 0 0 0;">1. Save this page as PDF (Ctrl+S or Cmd+S → Save as PDF)</p>
          <p style="margin: 5px 0 0 0;">2. Open WhatsApp and attach the PDF file</p>
        </div>
      `;
      printWindow.document.body.insertBefore(instructionDiv, printWindow.document.body.firstChild);
      
      // Trigger print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };
  
  // Share past visit via Email
  const sharePastVisitEmail = (visit: Visit) => {
    if (!patient) return;
    
    const visitRx = pastVisitPrescriptions[visit.id] || [];
    const prescriptionText = visitRx
      .filter(rx => rx.medicine.trim())
      .map((rx, i) => `${i + 1}. ${rx.medicine} ${rx.potency || ''} - ${rx.dosePattern} for ${rx.duration}`)
      .join('\n');
    
    const subject = encodeURIComponent(`Your Prescription - ${new Date(visit.visitDate).toLocaleDateString()}`);
    const body = encodeURIComponent(`Dear ${patient.firstName} ${patient.lastName},

Please find your prescription below:

Medicines:
${prescriptionText || 'No medicines prescribed'}

${visit.advice ? `Advice: ${visit.advice}` : ''}

Thank you for visiting Dr. Homeopathic Clinic!

Best regards,
Dr. Homeopathic Clinic`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };
  
  // Generate PDF content for past visit
  const generatePastVisitPDFContent = (visit: Visit) => {
    const visitRx = pastVisitPrescriptions[visit.id] || [];
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${new Date(visit.visitDate).toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
          .patient-info { margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Dr. Homeopathic Clinic</h1>
        <div class="patient-info">
          <p><strong>Patient:</strong> ${patient?.firstName} ${patient?.lastName}</p>
          <p><strong>Date:</strong> ${new Date(visit.visitDate).toLocaleDateString()}</p>
          <p><strong>Visit #:</strong> ${visit.visitNumber}</p>
        </div>
        ${visit.caseText ? `<div class="section"><div class="section-title">Case Notes</div><p>${visit.caseText}</p></div>` : ''}
        ${visitRx.length > 0 ? `
          <div class="section">
            <div class="section-title">Prescription</div>
            <table>
              <thead>
                <tr><th>Medicine</th><th>Potency</th><th>Dose Form</th><th>Pattern</th><th>Frequency</th><th>Duration</th></tr>
              </thead>
              <tbody>
                ${visitRx.map(rx => `<tr><td>${rx.isCombination ? rx.combinationName + ' (Combo)' : rx.medicine}</td><td>${rx.potency || '-'}</td><td>${rx.doseForm || '-'}</td><td>${rx.dosePattern || '-'}</td><td>${rx.frequency || '-'}</td><td>${rx.duration || '-'}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        ${visit.advice ? `<div class="section"><div class="section-title">Advice</div><p>${visit.advice}</p></div>` : ''}
        ${visit.nextVisit ? `<div class="section"><p><strong>Next Visit:</strong> ${new Date(visit.nextVisit).toLocaleDateString()}</p></div>` : ''}
      </body>
      </html>
    `;
  };

  // Download past visit as PDF
  const downloadPastVisitPDF = (visit: Visit) => {
    const pdfContent = generatePastVisitPDFContent(visit);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      // Trigger print dialog which allows saving as PDF
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Print past visit
  const printPastVisit = (visit: Visit) => {
    const pdfContent = generatePastVisitPDFContent(visit);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // ===== RENDER =====

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Datalists for autocomplete using prescription settings */}
      <datalist id="potency-list">
        {prescriptionSettings.potency.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="quantity-list">
        {prescriptionSettings.quantity.map((q) => (
          <option key={q} value={q} />
        ))}
      </datalist>
      <datalist id="pattern-list">
        {prescriptionSettings.pattern.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="frequency-list">
        {prescriptionSettings.frequency.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <datalist id="duration-list">
        {prescriptionSettings.duration.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      
      <Sidebar />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* No Patient Selected - Show Search */}
        {!patient && (
          <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
            <div className="text-center max-w-md w-full px-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Select Patient</h2>
                <p className="text-gray-600 mb-6">Search for a patient to begin case taking</p>
                
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name, reg number, or mobile..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pl-10"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  
                  {/* Search Results Dropdown */}
                  {showSearchResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                      {searchResults.length > 0 ? (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPatient(p)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{p.firstName} {p.lastName}</div>
                            <div className="text-sm text-gray-500">
                              Reg: {p.registrationNumber} • {p.mobile} • {p.age}yrs • {p.gender}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 text-sm">No patients found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Patient Selected - Show Doctor Panel */}
        {patient && (
          <>
            {/* Header with Patient Context */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <h1 className="text-xl font-bold text-gray-800">Doctor Panel</h1>
                  
                  {/* Patient Info Card */}
                  <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-blue-600">
                        Reg: {patient.registrationNumber} | {patient.age}yrs | {patient.gender}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="text-sm font-medium">{patient.mobile}</p>
                    </div>
                    <button
                      onClick={() => {
                        setPatient(null);
                        router.push('/doctor-panel');
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Visit Stats */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">Visits: {pastVisits.length + 1}</span>
                    {pastVisits[0] && (
                      <span className="text-gray-500">
                        Last: {new Date(pastVisits[0].visitDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowPharmacyQueue(!showPharmacyQueue)}
                    className="px-4 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                  >
                    Pharmacy Queue ({3})
                  </button>
                  <button
                    onClick={openPastVisitsPopup}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Past Visits ({pastVisits.length})
                  </button>
                  <button
                    onClick={() => setShowMateriaMedica(!showMateriaMedica)}
                    className="px-4 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                  >
                    Materia Medica
                  </button>
                </div>
              </div>
            </header>

            <main className="flex gap-6 p-6">
              {/* Left Column - Case Taking */}
              <div className="flex-1 space-y-6">
                {/* Case Taking Section */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Case Taking</h2>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsSystemAssist(!isSystemAssist)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          isSystemAssist 
                            ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        System Assist {isSystemAssist ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <textarea
                      ref={caseTextRef}
                      value={caseText}
                      onChange={handleCaseTextChange}
                      placeholder="Type case symptoms here...&#10;Press Enter for new symptom&#10;&#10;Example:&#10;Pain in knee joints&#10;Worse in cold weather&#10;Better by motion"
                      className="w-full h-64 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    
                    {isSystemAssist && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 font-medium mb-2">💡 Suggestions</p>
                        <ul className="text-sm text-amber-600 space-y-1">
                          <li>• Consider asking about timing (morning/evening)</li>
                          <li>• Explore aggravating/ameliorating factors</li>
                          <li>• Ask about appetite, thirst, sleep</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                {/* Prescription Table */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Prescription</h2>
                    <div className="flex items-center gap-2">
                      {pastVisits.length > 0 && (
                        <button
                          onClick={openPastVisitsPopup}
                          className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center gap-1"
                          title="Load prescription from past visit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Load Rx
                        </button>
                      )}
                      <button
                        onClick={addEmptyPrescriptionRow}
                        className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                      >
                        + Add Medicine
                      </button>
                    </div>
                  </div>
                  
                  {/* Smart Parsing Input */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          ref={smartParseInputRef}
                          type="text"
                          value={smartParseInput}
                          onChange={(e) => setSmartParseInput(e.target.value)}
                          onKeyDown={handleSmartParseInputKeyDown}
                          placeholder={aiParsingEnabled && aiApiKey ? "AI Smart Parse: Type prescription and press Enter" : "Smart Parse: Type \"Arnica 200 2dr 4 pills TDS for 7 days\" and press Enter"}
                          className="w-full px-4 py-2.5 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-amber-50 text-sm"
                          disabled={isAiParsing}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-amber-600">
                          {isAiParsing ? (
                            <span className="flex items-center gap-1">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>AI Parsing...</span>
                            </span>
                          ) : (
                            <>
                              {aiParsingEnabled && aiApiKey && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs mr-1">AI</span>
                              )}
                              <span className="font-medium">Press Enter</span>
                              <kbd className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-700 font-mono">↵</kbd>
                            </>
                          )}
                        </div>
                      </div>
                      {/* AI Toggle Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const newEnabled = !aiParsingEnabled;
                          setAiParsingEnabled(newEnabled);
                          // Save to localStorage
                          const savedSettings = localStorage.getItem('aiParsingSettings');
                          const settings = savedSettings ? JSON.parse(savedSettings) : {};
                          settings.enabled = newEnabled;
                          localStorage.setItem('aiParsingSettings', JSON.stringify(settings));
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          aiParsingEnabled && aiApiKey ? "bg-green-600" : "bg-gray-300"
                        }`}
                        title={aiApiKey ? (aiParsingEnabled ? "AI Parsing ON - Click to disable" : "AI Parsing OFF - Click to enable") : "Set up AI API key in Settings first"}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                            aiParsingEnabled && aiApiKey ? "translate-x-7" : "translate-x-1"
                          }`}
                        />
                        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${
                          aiParsingEnabled && aiApiKey ? "text-white" : "text-gray-500"
                        }`}>
                          AI
                        </span>
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {aiParsingEnabled && aiApiKey 
                        ? "AI-powered parsing enabled. Try: \"Ars alb 1M 1/2oz liquid 6-6-6 4 weeks\""
                        : aiApiKey 
                          ? "AI parsing disabled. Toggle ON to use AI, or use format: Medicine Potency Quantity DoseForm Pattern Duration"
                          : "Format: Medicine Potency Quantity DoseForm Pattern Duration (e.g., \"Belladonna 200 1dr pills 1-1-1 7 days\") - Add API key in Settings for AI parsing"
                      }
                    </p>
                  </div>
                  
                  <div className="p-6">
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
                          <th className="pb-3 font-medium w-16">Bottles</th>
                          <th className="pb-3 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptions.map((rx, index) => (
                          <tr key={index} className="border-b border-gray-50">
                            <td className="py-2 relative">
                              <div className="relative flex items-center gap-1">
                                {/* + button for combination */}
                                <button
                                  onClick={() => handleOpenCombination(index)}
                                  className={`shrink-0 w-7 h-7 flex items-center justify-center rounded text-sm font-bold ${
                                    rx.isCombination 
                                      ? 'bg-purple-500 text-white' 
                                      : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600'
                                  }`}
                                  title="Add Combination"
                                >
                                  +
                                </button>
                                <div className="flex-1 relative">
                                  <input
                                    type="text"
                                    value={rx.medicine}
                                    onChange={(e) => handleMedicineSearchChange(index, e.target.value)}
                                    onKeyDown={(e) => handleMedicineKeyDown(e, index, prescriptions.length)}
                                    onFocus={() => {
                                      setFocusedMedicineIndex(index);
                                      // Show suggestions when field is focused
                                      if (rx.medicine.trim().length > 0) {
                                        const suggestions = getAllMedicinesForAutocomplete(rx.medicine);
                                        setMedicineSuggestions(suggestions);
                                      } else {
                                        // Show all medicines when field is empty (including database combinations with content)
                                        const dbComboMap = new Map(dbCombinations.map(c => [c.name, c.content]));
                                        const allComboNames = [...new Set([...dbComboMap.keys(), ...getCombinationNames()])];
                                        const allMeds: {name: string; content?: string}[] = [
                                          ...getCustomMedicines().map(m => ({ name: m })),
                                          ...allComboNames.map(c => ({ name: c, content: dbComboMap.get(c) || '' })),
                                          ...commonMedicines.slice(0, 5).map(m => ({ name: m }))
                                        ].slice(0, 10);
                                        setMedicineSuggestions(allMeds);
                                      }
                                      setShowMedicineSuggestions(true);
                                      setSelectedSuggestionIndex(-1);
                                    }}
                                    onBlur={() => {
                                      // Delay hiding to allow click on suggestion
                                      setTimeout(() => {
                                        setShowMedicineSuggestions(false);
                                        setFocusedMedicineIndex(null);
                                      }, 200);
                                    }}
                                    placeholder="Medicine name"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                      rx.isCombination ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                                    }`}
                                    autoComplete="off"
                                  />
                                  {/* Autocomplete Dropdown - only show for focused input */}
                                  {showMedicineSuggestions && focusedMedicineIndex === index && medicineSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-[100]">
                                      {medicineSuggestions.map((suggestion, i) => (
                                        <button
                                          key={i}
                                          onClick={() => selectMedicine(index, suggestion)}
                                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                                            i === selectedSuggestionIndex ? 'bg-blue-50 text-blue-700' : ''
                                          }`}
                                        >
                                          <div className="font-medium">{suggestion.name}</div>
                                          {suggestion.content && (
                                            <div className="text-xs text-gray-500 mt-0.5">{suggestion.content}</div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {/* Combination details shown below in same field */}
                                  {rx.isCombination && rx.combinationContent && (
                                    <div className="mt-1 pt-1 border-t border-purple-200 text-xs text-gray-500">
                                      {rx.combinationContent}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Inline combination editor */}
                              {editingCombinationIndex === index && (
                                <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
                                  <input
                                    type="text"
                                    value={combinationName}
                                    onChange={(e) => setCombinationName(e.target.value)}
                                    placeholder="Combination Name (e.g., Bioplasgen No. 10)"
                                    className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500"
                                  />
                                  <textarea
                                    value={combinationContent}
                                    onChange={(e) => setCombinationContent(e.target.value)}
                                    placeholder="List the medicines and potencies..."
                                    className="w-full px-2 py-1 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 resize-none"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={saveCombination}
                                      className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelCombination}
                                      className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                list="potency-list"
                                value={rx.potency || ''}
                                onChange={(e) => updatePrescriptionRow(index, 'potency', e.target.value)}
                                onKeyDown={(e) => handlePotencyKeyDown(e, index, prescriptions.length)}
                                placeholder="200"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                list="quantity-list"
                                value={rx.quantity}
                                onChange={(e) => updatePrescriptionRow(index, 'quantity', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <select
                                value={rx.doseForm || 'Pills'}
                                onChange={(e) => updatePrescriptionRow(index, 'doseForm', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              >
                                {prescriptionSettings.doseForm.map((form) => (
                                  <option key={form} value={form.toLowerCase()}>{form}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                list="pattern-list"
                                value={rx.dosePattern}
                                onChange={(e) => updatePrescriptionRow(index, 'dosePattern', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                list="frequency-list"
                                value={rx.frequency}
                                onChange={(e) => updatePrescriptionRow(index, 'frequency', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                list="duration-list"
                                value={rx.duration || ''}
                                onChange={(e) => updatePrescriptionRow(index, 'duration', e.target.value)}
                                placeholder="7 days"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                value={rx.bottles || 1}
                                onChange={(e) => updatePrescriptionRow(index, 'bottles', parseInt(e.target.value))}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => movePrescriptionRow(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => movePrescriptionRow(index, 'down')}
                                  disabled={index === prescriptions.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => removePrescriptionRow(index)}
                                  className="p-1 text-red-400 hover:text-red-600"
                                >
                                  ×
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {prescriptions.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No prescriptions added yet. Click &quot;+ Add Medicine&quot; to start.
                      </div>
                    )}
                  </div>
                </section>

                {/* Next Visit Section - Outside Additional Notes */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">Next Visit</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Next Visit Date</label>
                        <input
                          type="date"
                          value={nextVisit}
                          onChange={(e) => handleNextVisitDateChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Or in (days)</label>
                        <input
                          type="number"
                          value={nextVisitDays}
                          onChange={(e) => handleNextVisitDaysChange(e.target.value)}
                          placeholder="e.g., 7"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {nextVisit && (
                      <div className="mt-3 text-sm text-gray-500">
                        Next appointment: {new Date(nextVisit).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </section>

                {/* Additional Notes - Collapsible */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalNotes(!showAdditionalNotes)}
                    className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100"
                  >
                    <h2 className="text-lg font-semibold text-gray-800">Additional Notes</h2>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform ${showAdditionalNotes ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showAdditionalNotes && (
                    <div className="p-6 space-y-4">
                      {/* Render fields in saved order */}
                      {additionalNotesFieldOrder.map((field, index) => {
                        const fieldComponents: Record<string, React.ReactNode> = {
                          diagnosis: (
                            <div key="diagnosis" className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                                <input
                                  type="text"
                                  value={diagnosis}
                                  onChange={(e) => setDiagnosis(e.target.value)}
                                  placeholder="Enter diagnosis"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1 pt-6">
                                <button
                                  type="button"
                                  onClick={() => moveFieldUp('diagnosis')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFieldDown('diagnosis')}
                                  disabled={index === additionalNotesFieldOrder.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          ),
                          testsRequired: (
                            <div key="testsRequired" className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tests Required</label>
                                <input
                                  type="text"
                                  value={testsRequired}
                                  onChange={(e) => setTestsRequired(e.target.value)}
                                  placeholder="Enter tests if any"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1 pt-6">
                                <button
                                  type="button"
                                  onClick={() => moveFieldUp('testsRequired')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFieldDown('testsRequired')}
                                  disabled={index === additionalNotesFieldOrder.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          ),
                          advice: (
                            <div key="advice" className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Advice</label>
                                <textarea
                                  value={advice}
                                  onChange={(e) => setAdvice(e.target.value)}
                                  placeholder="Enter advice for the patient"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={2}
                                />
                              </div>
                              <div className="flex flex-col gap-1 pt-6">
                                <button
                                  type="button"
                                  onClick={() => moveFieldUp('advice')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFieldDown('advice')}
                                  disabled={index === additionalNotesFieldOrder.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          ),
                          prognosis: (
                            <div key="prognosis" className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prognosis</label>
                                <select
                                  value={prognosis}
                                  onChange={(e) => setPrognosis(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select prognosis</option>
                                  <option value="excellent">Excellent</option>
                                  <option value="good">Good</option>
                                  <option value="fair">Fair</option>
                                  <option value="guarded">Guarded</option>
                                  <option value="poor">Poor</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1 pt-6">
                                <button
                                  type="button"
                                  onClick={() => moveFieldUp('prognosis')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFieldDown('prognosis')}
                                  disabled={index === additionalNotesFieldOrder.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          ),
                          remarksToFrontdesk: (
                            <div key="remarksToFrontdesk" className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks to Frontdesk</label>
                                <textarea
                                  value={remarksToFrontdesk}
                                  onChange={(e) => setRemarksToFrontdesk(e.target.value)}
                                  placeholder="Any remarks for frontdesk (e.g., fee discussion, urgent follow-up)"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                  rows={2}
                                />
                              </div>
                              <div className="flex flex-col gap-1 pt-6">
                                <button
                                  type="button"
                                  onClick={() => moveFieldUp('remarksToFrontdesk')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFieldDown('remarksToFrontdesk')}
                                  disabled={index === additionalNotesFieldOrder.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          ),
                        };
                        return fieldComponents[field];
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column - Fee & Actions */}
              <div className="w-80 space-y-6">
                {/* Fee Section */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">Fee Details</h2>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    {/* Last Fee Paid Info - Always show if there's fee history */}
                    {lastFeeInfo && (
                      <div className={`rounded-lg p-3 mb-4 ${
                        lastFeeInfo.status === 'pending' ? 'bg-amber-50' : 'bg-blue-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <svg className={`w-4 h-4 ${
                            lastFeeInfo.status === 'pending' ? 'text-amber-600' : 'text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {lastFeeInfo.status === 'pending' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                          <span className={`text-sm font-medium ${
                            lastFeeInfo.status === 'pending' ? 'text-amber-800' : 'text-blue-800'
                          }`}>
                            {lastFeeInfo.status === 'pending' ? 'Last Fee (Due)' : 'Last Fee Paid'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className={
                            lastFeeInfo.status === 'pending' ? 'text-amber-700' : 'text-blue-700'
                          }>₹{lastFeeInfo.amount} ({lastFeeInfo.feeType})</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            lastFeeInfo.status === 'pending' 
                              ? 'bg-amber-200 text-amber-800' 
                              : 'bg-blue-200 text-blue-800'
                          }`}>
                            {lastFeeInfo.status === 'pending' ? 'Due' : 
                             lastFeeInfo.daysAgo === 0 ? 'Today' : 
                             lastFeeInfo.daysAgo === 1 ? 'Yesterday' : 
                             `${lastFeeInfo.daysAgo} days ago`}
                          </span>
                        </div>
                        <div className={`text-xs mt-1 ${
                          lastFeeInfo.status === 'pending' ? 'text-amber-500' : 'text-blue-500'
                        }`}>{lastFeeInfo.date}</div>
                      </div>
                    )}
                    
                    {/* Current Appointment Fee - Show for both paid and due status */}
                    {currentAppointmentFee && (
                      <div className={`rounded-lg p-3 mb-4 ${
                        currentAppointmentFee.feeStatus === 'paid' ? 'bg-green-50' : 
                        currentAppointmentFee.feeStatus === 'exempt' ? 'bg-purple-50' :
                        'bg-amber-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <svg className={`w-4 h-4 ${
                            currentAppointmentFee.feeStatus === 'paid' ? 'text-green-600' : 
                            currentAppointmentFee.feeStatus === 'exempt' ? 'text-purple-600' :
                            'text-amber-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {currentAppointmentFee.feeStatus === 'paid' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                          <span className={`text-sm font-medium ${
                            currentAppointmentFee.feeStatus === 'paid' ? 'text-green-800' : 
                            currentAppointmentFee.feeStatus === 'exempt' ? 'text-purple-800' :
                            'text-amber-800'
                          }`}>Appointment Fee</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className={
                            currentAppointmentFee.feeStatus === 'paid' ? 'text-green-700' : 
                            currentAppointmentFee.feeStatus === 'exempt' ? 'text-purple-700' :
                            'text-amber-700'
                          }>₹{currentAppointmentFee.feeAmount} ({currentAppointmentFee.feeType})</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            currentAppointmentFee.feeStatus === 'paid' ? 'bg-green-200 text-green-800' : 
                            currentAppointmentFee.feeStatus === 'exempt' ? 'bg-purple-200 text-purple-800' :
                            'bg-amber-200 text-amber-800'
                          }`}>
                            {currentAppointmentFee.feeStatus === 'pending' ? 'Due' : 
                             currentAppointmentFee.feeStatus.charAt(0).toUpperCase() + currentAppointmentFee.feeStatus.slice(1)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Collapsible Fee Form */}
                    {currentAppointmentFee && (
                      <div className="border border-gray-200 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setShowFeeForm(!showFeeForm)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Fee Details
                          </span>
                          <svg 
                            className={`w-4 h-4 transition-transform ${showFeeForm ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showFeeForm && (
                          <div className="p-3 border-t border-gray-200 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount (₹)</label>
                              <input
                                type="number"
                                value={feeAmount}
                                onChange={(e) => setFeeAmount(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                              <select
                                value={feeType}
                                onChange={(e) => setFeeType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="consultation">Consultation</option>
                                <option value="followup">Follow-up</option>
                                <option value="new">New Patient</option>
                                <option value="emergency">Emergency</option>
                                <option value="special">Special Consultation</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                              <select
                                value={paymentStatus}
                                onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="exempt">Exempt</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                              <input
                                type="number"
                                value={discountPercent}
                                onChange={(e) => setDiscountPercent(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Reason</label>
                              <textarea
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                placeholder="Reason for discount"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={2}
                              />
                            </div>
                            
                            {/* Save Fee Button */}
                            <div className="pt-2">
                              <Button
                                onClick={handleSaveFee}
                                variant="primary"
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                Save Fee Changes
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Show fee form directly if no appointment fee */}
                    {!currentAppointmentFee && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount (₹)</label>
                          <input
                            type="number"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                          <select
                            value={feeType}
                            onChange={(e) => setFeeType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="consultation">Consultation</option>
                            <option value="followup">Follow-up</option>
                            <option value="new">New Patient</option>
                            <option value="emergency">Emergency</option>
                            <option value="special">Special Consultation</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                          <select
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="exempt">Exempt</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                          <input
                            type="number"
                            value={discountPercent}
                            onChange={(e) => setDiscountPercent(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Discount Reason</label>
                          <textarea
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            placeholder="Reason for discount"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={2}
                          />
                        </div>
                        
                        {/* Save Fee Button for no appointment fee case */}
                        <div className="pt-2">
                          <Button
                            onClick={handleSaveFee}
                            variant="primary"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            Save Fee
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Action Buttons */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 space-y-3">
                    <Button
                      onClick={() => setShowPrescriptionPreview(true)}
                      variant="secondary"
                      className="w-full"
                    >
                      Preview Prescription
                    </Button>
                    
                    <Button
                      onClick={handleEndConsultation}
                      variant="primary"
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      End Consultation
                    </Button>
                  </div>
                </section>

                {/* Past Visits - Moved to popup */}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Past Visits Popup Modal */}
      {showPastVisitsPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Past Visits</h2>
              <button
                onClick={() => setShowPastVisitsPopup(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {pastVisits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No past visits found
                </div>
              ) : (
                // Sort past visits by date (newest first)
                [...pastVisits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()).map((visit) => {
                  const visitRx = pastVisitPrescriptions[visit.id] || [];
                  return (
                    <div key={visit.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Visit Header */}
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {new Date(visit.visitDate).toLocaleDateString('en-IN', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </p>
                          <p className="text-sm text-gray-500">Visit #{visit.visitNumber}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => copyPrescriptionFromPastVisit(visit.id)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                            title="Copy prescription to current"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Rx
                          </button>
                          <button
                            onClick={() => downloadPastVisitPDF(visit)}
                            className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center gap-1"
                            title="Download as PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </button>
                          <button
                            onClick={() => printPastVisit(visit)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                            title="Print"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                          </button>
                          <button
                            onClick={() => sharePastVisitWhatsApp(visit)}
                            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1"
                            title="Share via WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </button>
                          <button
                            onClick={() => sharePastVisitEmail(visit)}
                            className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1"
                            title="Share via Email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </button>
                        </div>
                      </div>
                      
                      {/* Visit Content */}
                      <div className="p-4 space-y-4">
                        {/* Case Taking */}
                        {visit.caseText && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Case Notes</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                              {visit.caseText}
                            </p>
                          </div>
                        )}
                        
                        {/* Prescription */}
                        {visitRx.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Prescription</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Medicine</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-16">Potency</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Dose Form</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Pattern</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Frequency</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">Duration</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visitRx.map((rx, idx) => (
                                    <tr key={idx} className="border-t border-gray-100">
                                      <td className="px-3 py-2">
                                        {rx.isCombination ? (
                                          <div>
                                            <span className="text-purple-600 font-medium">{rx.combinationName || rx.medicine}</span>
                                            {rx.combinationContent && (
                                              <div className="text-xs text-gray-500 mt-1">{rx.combinationContent}</div>
                                            )}
                                          </div>
                                        ) : (
                                          rx.medicine
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600">{rx.potency || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{rx.doseForm || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{rx.dosePattern || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{rx.frequency || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{rx.duration || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        
                        {/* Additional Notes Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          {visit.diagnosis && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Diagnosis</h4>
                              <p className="text-sm text-gray-600">{visit.diagnosis}</p>
                            </div>
                          )}
                          {visit.prognosis && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Prognosis</h4>
                              <p className="text-sm text-gray-600 capitalize">{visit.prognosis}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Advice */}
                        {visit.advice && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Advice</h4>
                            <p className="text-sm text-gray-600">{visit.advice}</p>
                          </div>
                        )}
                        
                        {/* Next Visit */}
                        {visit.nextVisit && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Next Visit:</span>{' '}
                            {new Date(visit.nextVisit).toLocaleDateString('en-IN', { 
                              weekday: 'short', 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </div>
                        )}
                        
                        {/* Tests Required */}
                        {visit.testsRequired && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Tests Required</h4>
                            <p className="text-sm text-gray-600">{visit.testsRequired}</p>
                          </div>
                        )}
                        
                        {/* Remarks */}
                        {visit.remarksToFrontdesk && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Remarks</h4>
                            <p className="text-sm text-gray-600">{visit.remarksToFrontdesk}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Combination Medicine Modal - Removed, now using inline editor */}

      {/* End Consultation Modal - No longer needed, replaced by preview popup */}

      {/* Prescription Preview Modal */}
      {showPrescriptionPreview && patient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Prescription Header */}
              <div className="border-b-2 border-gray-800 pb-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Dr. Homeopathic Clinic</h2>
                <p className="text-gray-500">M.D. (Homeopathy)</p>
                <p className="text-gray-500">Reg. No.: HM-12345</p>
              </div>
              
              {/* Patient Info */}
              <div className="flex justify-between mb-6">
                <div>
                  <p className="font-bold">{patient.firstName} {patient.lastName}</p>
                  <p className="text-sm text-gray-500">Reg: {patient.registrationNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-sm text-gray-500">IP No.: {savedVisitId?.slice(0, 8).toUpperCase() || currentVisit?.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              
              {/* Vital Signs Placeholder */}
              <div className="border border-gray-300 p-2 mb-6 text-sm">
                <div className="grid grid-cols-4 gap-4">
                  <div>BP: _____/_____</div>
                  <div>Pulse: _____</div>
                  <div>Temp: _____°F</div>
                  <div>Weight: _____kg</div>
                </div>
              </div>
              
              {/* Case Summary */}
              <div className="mb-6">
                <p className="font-bold border-b border-gray-300 mb-2">Clinical Notes</p>
                <p className="whitespace-pre-wrap">{caseText || 'No case notes recorded.'}</p>
              </div>
              
              {/* Prescription */}
              <div className="mb-6">
                <p className="font-bold border-b border-gray-300 mb-2">Rx</p>
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="py-1">Medicine</th>
                      <th className="py-1">Potency</th>
                      <th className="py-1">Dose</th>
                      <th className="py-1">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx, index) => (
                      <tr key={index}>
                        <td className="py-1">
                          {rx.isCombination ? (
                            <span className="font-medium">{rx.combinationName}</span>
                          ) : (
                            rx.medicine
                          )}
                        </td>
                        <td className="py-1">{rx.potency || '-'}</td>
                        <td className="py-1">{rx.quantity} {rx.dosePattern}</td>
                        <td className="py-1">{rx.duration}</td>
                      </tr>
                    ))}
                    {prescriptions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500">
                          No prescriptions added
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Advice */}
              {advice && (
                <div className="mb-6">
                  <p className="font-bold border-b border-gray-300 mb-2">Advice</p>
                  <p>{advice}</p>
                </div>
              )}
              
              {/* Next Visit */}
              {nextVisit && (
                <div className="mb-6">
                  <p className="font-medium">Next Visit: {new Date(nextVisit).toLocaleDateString()}</p>
                </div>
              )}
              
              {/* Footer */}
              <div className="border-t-2 border-gray-800 pt-4 mt-8">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Consultation Fee: ₹{feeAmount}</p>
                    {discountPercent && (
                      <p className="text-sm text-gray-500">Discount: {discountPercent}%</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Dr. Signature</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              {isConsultationEnded && (
                <div className="mb-3 p-2 bg-green-50 text-green-700 text-sm text-center rounded-lg flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Consultation saved and visit locked
                  {pharmacySent && ' • Sent to pharmacy'}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 justify-center">
                {/* Print Button */}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Print Prescription"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                
                {/* WhatsApp Button */}
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  title="Share via WhatsApp"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
                
                {/* Email Button */}
                <button
                  onClick={handleEmailShare}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  title="Share via Email"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </button>
                
                {/* Send to Pharmacy Button - Only show if consultation ended and not yet sent */}
                {isConsultationEnded && !pharmacySent && (
                  <button
                    onClick={handleSendToPharmacy}
                    className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    title="Send to Pharmacy Queue"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Send to Pharmacy
                  </button>
                )}
                
                {/* Pharmacy Sent Indicator */}
                {pharmacySent && (
                  <span className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-200 text-purple-800 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    In Pharmacy Queue
                  </span>
                )}
                
                {/* Close Button */}
                <button
                  onClick={isConsultationEnded ? handleResetPanel : () => setShowPrescriptionPreview(false)}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  title={isConsultationEnded ? "Close and Start New Consultation" : "Close Preview"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {isConsultationEnded ? 'Close & Next Patient' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
