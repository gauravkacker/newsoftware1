"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { doctorSettingsDb } from "@/lib/db/doctor-panel";

interface PrintSettings {
  tokenNote: string;
  tokenPrintEnabled: boolean;
  prescriptionHeader: string;
  prescriptionFooter: string;
  prescriptionPrintEnabled: boolean;
  feeReceiptHeader: string;
  feeReceiptFooter: string;
  feeReceiptPrintEnabled: boolean;
  billHeader: string;
  billFooter: string;
  billPrintEnabled: boolean;
  // Label printing settings
  labelPrintEnabled: boolean;
  labelWidth: string;
  labelHeight: string;
  labelClinicName: string;
  labelClinicDetails: string;
  labelShowMedicineName: boolean;
  labelShowPotency: boolean;
  labelShowQuantity: boolean;
  labelShowDoseForm: boolean;
  labelShowDosePattern: boolean;
  labelShowFrequency: boolean;
  labelShowDuration: boolean;
  labelShowInstructions: boolean;
  labelFontSize: string;
  labelPadding: string;
  labelBorder: boolean;
  // Prescription page layout settings
  prescriptionMarginLeft: string;
  prescriptionMarginRight: string;
  prescriptionHeaderHeight: string;
  prescriptionFooterHeight: string;
  prescriptionPageHeight: string;
  prescriptionFontFamily: string;
  prescriptionFontSize: string;
  prescriptionContentFontFamily: string;
  prescriptionContentFontSize: string;
  prescriptionContentFontBold: boolean;
  prescriptionContentFontItalic: boolean;
  prescriptionContentFontUnderline: boolean;
  prescriptionPatientDetailsFontFamily: string;
  prescriptionPatientDetailsFontSize: string;
  prescriptionPatientDetailsFontBold: boolean;
  prescriptionPatientDetailsFontItalic: boolean;
  prescriptionHeaderImage: string;
  prescriptionFooterImage: string;
  prescriptionDoctorSignature: string;
  prescriptionDoctorSeal: string;
  // Patient details toggles
  prescriptionShowName: boolean;
  prescriptionShowDate: boolean;
  prescriptionShowRegNo: boolean;
  prescriptionShowMobile: boolean;
  prescriptionShowDoctorName: boolean;
  prescriptionShowAddress: boolean;
  prescriptionShowAge: boolean;
  prescriptionShowSex: boolean;
  prescriptionShowChiefComplaint: boolean;
  // Prescription medicine display format
  prescriptionMedicineFormat: string; // Template for medicine display
  prescriptionShowMedicineName: boolean;
  prescriptionShowPotency: boolean;
  prescriptionShowPattern: boolean;
  prescriptionShowDoseForm: boolean;
  prescriptionShowFrequency: boolean;
  prescriptionShowDuration: boolean;
  prescriptionShowNextVisit: boolean;
  prescriptionSignaturePosition: 'left' | 'right';
  prescriptionLanguage: 'english' | 'hindi';
}

export default function PrintSettingsPage() {
  const [settings, setSettings] = useState<PrintSettings>(() => {
    try {
      const raw = doctorSettingsDb.get("printSettings");
      if (raw) {
        return JSON.parse(raw as string);
      }
    } catch {}
    return {
      tokenNote: "",
      tokenPrintEnabled: true,
      prescriptionHeader: "",
      prescriptionFooter: "",
      prescriptionPrintEnabled: true,
      feeReceiptHeader: "",
      feeReceiptFooter: "",
      feeReceiptPrintEnabled: true,
      billHeader: "",
      billFooter: "",
      billPrintEnabled: true,
      // Label printing defaults
      labelPrintEnabled: true,
      labelWidth: "2in",
      labelHeight: "1in",
      labelClinicName: "",
      labelClinicDetails: "",
      labelShowMedicineName: true,
      labelShowPotency: true,
      labelShowQuantity: true,
      labelShowDoseForm: true,
      labelShowDosePattern: true,
      labelShowFrequency: true,
      labelShowDuration: true,
      labelShowInstructions: false,
      labelFontSize: "8px",
      labelPadding: "4px",
      labelBorder: true,
      // Prescription page layout defaults
      prescriptionMarginLeft: "20mm",
      prescriptionMarginRight: "20mm",
      prescriptionHeaderHeight: "80mm",
      prescriptionFooterHeight: "30mm",
      prescriptionPageHeight: "297mm",
      prescriptionFontFamily: "Arial",
      prescriptionFontSize: "12pt",
      prescriptionContentFontFamily: "Arial",
      prescriptionContentFontSize: "11pt",
      prescriptionContentFontBold: false,
      prescriptionContentFontItalic: false,
      prescriptionContentFontUnderline: false,
      prescriptionPatientDetailsFontFamily: "Arial",
      prescriptionPatientDetailsFontSize: "10pt",
      prescriptionPatientDetailsFontBold: true,
      prescriptionPatientDetailsFontItalic: false,
      prescriptionHeaderImage: "",
      prescriptionFooterImage: "",
      prescriptionDoctorSignature: "",
      prescriptionDoctorSeal: "",
      // Patient details defaults
      prescriptionShowName: true,
      prescriptionShowDate: true,
      prescriptionShowRegNo: true,
      prescriptionShowMobile: true,
      prescriptionShowDoctorName: true,
      prescriptionShowAddress: true,
      prescriptionShowAge: true,
      prescriptionShowSex: true,
      prescriptionShowChiefComplaint: true,
      // Prescription medicine display format defaults
      prescriptionMedicineFormat: "natural", // natural or compact
      prescriptionShowMedicineName: true,
      prescriptionShowPotency: true,
      prescriptionShowPattern: true,
      prescriptionShowDoseForm: true,
      prescriptionShowFrequency: true,
      prescriptionShowDuration: true,
      prescriptionShowNextVisit: true,
      prescriptionSignaturePosition: 'right',
      prescriptionLanguage: 'english',
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"token" | "prescription" | "receipt" | "bill" | "label">("token");

  const handleSave = () => {
    setIsSaving(true);
    doctorSettingsDb.set("printSettings", JSON.stringify(settings), "doctor");
    setTimeout(() => {
      setIsSaving(false);
      alert("Print settings saved successfully.");
    }, 400);
  };

  const updateSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Handle image upload
  const handleImageUpload = (key: keyof PrintSettings, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateSetting(key, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Hindi translations
  const hindiTranslations: Record<string, string> = {
    'morning': 'सुबह',
    'afternoon': 'दोपहर',
    'evening': 'शाम',
    'night': 'रात',
    'for': 'के लिए',
    'days': 'दिन',
    'pills': 'गोलियां',
    'drops': 'बूंदें',
    'tablets': 'गोलियां',
    'capsules': 'कैप्सूल',
    'Dose & Timing:': 'खुराक और समय:',
  };

  // Translate text to Hindi
  const translateToHindi = (text: string, language: 'english' | 'hindi'): string => {
    if (language === 'english') return text;
    
    let translated = text;
    Object.entries(hindiTranslations).forEach(([english, hindi]) => {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      translated = translated.replace(regex, hindi);
    });
    
    return translated;
  };

  // Format medicine for prescription display
  const formatMedicineDisplay = (medicine: {
    name: string;
    potency: string;
    pattern: string;
    doseForm: string;
    frequency: string;
    duration: string;
    quantity?: string;
  }) => {
    const { name, potency, pattern, doseForm, frequency, duration, quantity } = medicine;
    
    const line1Parts: string[] = [];
    const line2Parts: string[] = [];

    // Line 1: Medicine Name Potency (Quantity)
    if (settings.prescriptionShowMedicineName) {
      line1Parts.push(name);
    }

    if (settings.prescriptionShowPotency && potency) {
      line1Parts.push(potency);
    }

    // Add quantity in brackets if available
    if (quantity) {
      line1Parts.push(`(${quantity})`);
    }

    // Line 2: Dose & Timing: natural language description
    if (settings.prescriptionShowPattern && pattern) {
      const doses = pattern.split('-').map(d => parseInt(d) || 0);
      const [morning, afternoon, evening] = doses;
      const doseFormLower = doseForm.toLowerCase();

      const timeParts: string[] = [];
      if (morning > 0) {
        timeParts.push(`${morning} ${doseFormLower} morning`);
      }
      if (afternoon > 0) {
        timeParts.push(`${afternoon} ${doseFormLower} afternoon`);
      }
      if (evening > 0) {
        const timeLabel = afternoon > 0 ? 'night' : 'evening';
        timeParts.push(`${evening} ${doseFormLower} ${timeLabel}`);
      }

      if (timeParts.length > 0) {
        let doseTimingText = timeParts.join(' - ');
        
        // Add duration
        if (settings.prescriptionShowDuration && duration) {
          doseTimingText += ` for ${duration}`;
        }

        // Translate if Hindi is selected
        const language = settings.prescriptionLanguage || 'english';
        doseTimingText = translateToHindi(doseTimingText, language);
        
        // Add "Dose & Timing:" label (translated if Hindi)
        const label = translateToHindi('Dose & Timing:', language);
        line2Parts.push(`${label} ${doseTimingText}`);
      }
    }

    // Combine lines
    const line1 = line1Parts.join(' ');
    const line2 = line2Parts.join(' ');

    return { line1, line2 };
  };
 
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Print Settings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure print settings for tokens, prescriptions, receipts, and bills
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("token")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "token"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Token Printing
            </button>
            <button
              onClick={() => setActiveTab("prescription")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "prescription"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Prescription Printing
            </button>
            <button
              onClick={() => setActiveTab("receipt")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "receipt"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Fee Receipt Printing
            </button>
            <button
              onClick={() => setActiveTab("bill")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "bill"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Bill Printing
            </button>
            <button
              onClick={() => setActiveTab("label")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "label"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Label Printing
            </button>
          </div>

          {/* Token Printing Settings */}
          {activeTab === "token" && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Token Print Settings</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.tokenPrintEnabled}
                      onChange={(e) => updateSetting("tokenPrintEnabled", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable token printing</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Footer Note
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    This note appears at the bottom of the appointment token printout (thermal).
                  </p>
                  <textarea
                    value={settings.tokenNote}
                    onChange={(e) => updateSetting("tokenNote", e.target.value)}
                    placeholder="Enter a short note for patients..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Preview</h2>
                <div className="border rounded p-4 w-[280px] bg-white shadow-sm">
                  <div className="text-center font-semibold mb-2 text-sm">Appointment Token</div>
                  <div className="flex items-start justify-between text-xs text-gray-700 mb-1">
                    <div className="font-semibold">Patient Name</div>
                    <div>Reg: REG12345</div>
                  </div>
                  <div className="flex items-start justify-between text-xs text-gray-700 mb-2">
                    <div>Mob: 9876543210</div>
                    <div>Morning</div>
                  </div>
                  <div className="text-center text-4xl font-bold my-3">12</div>
                  <div className="text-center text-sm mb-2">Appointment time - 10:30 AM</div>
                  {settings.tokenNote && (
                    <div className="border-t border-dashed pt-2 text-[11px] text-gray-700 whitespace-pre-wrap">
                      {settings.tokenNote}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Prescription Printing Settings */}
          {activeTab === "prescription" && (
            <div className="flex gap-6">
              {/* Left side - Settings */}
              <div className="flex-1 space-y-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Prescription Print Settings</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.prescriptionPrintEnabled}
                        onChange={(e) => updateSetting("prescriptionPrintEnabled", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Enable prescription printing</span>
                    </label>
                  </div>

                  {/* Page Layout Settings */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Page Layout Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Left Margin
                        </label>
                        <input
                          type="text"
                          value={settings.prescriptionMarginLeft}
                          onChange={(e) => updateSetting("prescriptionMarginLeft", e.target.value)}
                          placeholder="20mm"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Right Margin
                        </label>
                        <input
                          type="text"
                          value={settings.prescriptionMarginRight}
                          onChange={(e) => updateSetting("prescriptionMarginRight", e.target.value)}
                          placeholder="20mm"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Header Height
                        </label>
                        <input
                          type="text"
                          value={settings.prescriptionHeaderHeight}
                          onChange={(e) => updateSetting("prescriptionHeaderHeight", e.target.value)}
                          placeholder="80mm"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Footer Height
                        </label>
                        <input
                          type="text"
                          value={settings.prescriptionFooterHeight}
                          onChange={(e) => updateSetting("prescriptionFooterHeight", e.target.value)}
                          placeholder="30mm"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Page Height
                        </label>
                        <input
                          type="text"
                          value={settings.prescriptionPageHeight}
                          onChange={(e) => updateSetting("prescriptionPageHeight", e.target.value)}
                          placeholder="297mm (A4)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Font Settings */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Font Settings</h3>
                    
                    {/* Patient Details Font */}
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3">Patient Details Font</h4>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Font Family
                          </label>
                          <select
                            value={settings.prescriptionPatientDetailsFontFamily}
                            onChange={(e) => updateSetting("prescriptionPatientDetailsFontFamily", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Calibri">Calibri</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Font Size
                          </label>
                          <input
                            type="text"
                            value={settings.prescriptionPatientDetailsFontSize}
                            onChange={(e) => updateSetting("prescriptionPatientDetailsFontSize", e.target.value)}
                            placeholder="10pt"
                            list="fontSizes"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.prescriptionPatientDetailsFontBold}
                            onChange={(e) => updateSetting("prescriptionPatientDetailsFontBold", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 font-bold">Bold</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.prescriptionPatientDetailsFontItalic}
                            onChange={(e) => updateSetting("prescriptionPatientDetailsFontItalic", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 italic">Italic</span>
                        </label>
                      </div>
                    </div>

                    {/* Prescription Content Font */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-900 mb-3">Prescription Content Font</h4>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Font Family
                          </label>
                          <select
                            value={settings.prescriptionContentFontFamily}
                            onChange={(e) => updateSetting("prescriptionContentFontFamily", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Calibri">Calibri</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Font Size
                          </label>
                          <input
                            type="text"
                            value={settings.prescriptionContentFontSize}
                            onChange={(e) => updateSetting("prescriptionContentFontSize", e.target.value)}
                            placeholder="11pt"
                            list="fontSizes"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <datalist id="fontSizes">
                            <option value="9pt" />
                            <option value="10pt" />
                            <option value="11pt" />
                            <option value="12pt" />
                            <option value="13pt" />
                            <option value="14pt" />
                            <option value="16pt" />
                          </datalist>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.prescriptionContentFontBold}
                            onChange={(e) => updateSetting("prescriptionContentFontBold", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 font-bold">Bold</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.prescriptionContentFontItalic}
                            onChange={(e) => updateSetting("prescriptionContentFontItalic", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 italic">Italic</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.prescriptionContentFontUnderline}
                            onChange={(e) => updateSetting("prescriptionContentFontUnderline", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 underline">Underline</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Image Uploads */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Images</h3>
                    <div className="space-y-4">
                      {/* Header Image */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Header Image
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload("prescriptionHeaderImage", file);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {settings.prescriptionHeaderImage && (
                          <div className="mt-2 relative">
                            <img
                              src={settings.prescriptionHeaderImage}
                              alt="Header"
                              className="max-h-32 border border-gray-300 rounded"
                            />
                            <button
                              onClick={() => updateSetting("prescriptionHeaderImage", "")}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Footer Image */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Footer Image
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload("prescriptionFooterImage", file);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {settings.prescriptionFooterImage && (
                          <div className="mt-2 relative">
                            <img
                              src={settings.prescriptionFooterImage}
                              alt="Footer"
                              className="max-h-32 border border-gray-300 rounded"
                            />
                            <button
                              onClick={() => updateSetting("prescriptionFooterImage", "")}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Doctor Signature */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Doctor Signature
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload("prescriptionDoctorSignature", file);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {settings.prescriptionDoctorSignature && (
                          <div className="mt-2 relative">
                            <img
                              src={settings.prescriptionDoctorSignature}
                              alt="Signature"
                              className="max-h-24 border border-gray-300 rounded bg-white"
                            />
                            <button
                              onClick={() => updateSetting("prescriptionDoctorSignature", "")}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Doctor Seal */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Doctor Seal
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload("prescriptionDoctorSeal", file);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {settings.prescriptionDoctorSeal && (
                          <div className="mt-2 relative">
                            <img
                              src={settings.prescriptionDoctorSeal}
                              alt="Seal"
                              className="max-h-24 border border-gray-300 rounded bg-white"
                            />
                            <button
                              onClick={() => updateSetting("prescriptionDoctorSeal", "")}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Patient Details */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Patient Details to Include</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowName}
                          onChange={(e) => updateSetting("prescriptionShowName", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Patient Name</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowDate}
                          onChange={(e) => updateSetting("prescriptionShowDate", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowRegNo}
                          onChange={(e) => updateSetting("prescriptionShowRegNo", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Registration Number</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowMobile}
                          onChange={(e) => updateSetting("prescriptionShowMobile", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Mobile Number</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowAge}
                          onChange={(e) => updateSetting("prescriptionShowAge", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Age</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowSex}
                          onChange={(e) => updateSetting("prescriptionShowSex", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Sex</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowDoctorName}
                          onChange={(e) => updateSetting("prescriptionShowDoctorName", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Doctor Name</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowAddress}
                          onChange={(e) => updateSetting("prescriptionShowAddress", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Address</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowChiefComplaint}
                          onChange={(e) => updateSetting("prescriptionShowChiefComplaint", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Chief Complaint</span>
                      </label>
                    </div>
                  </div>

                  {/* Medicine Display Format */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Medicine Display Format</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Configure how medicines will be displayed in prescription printouts
                    </p>
                    
                    {/* Format Examples */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Format Examples:</h4>
                      <div className="space-y-2 text-sm text-blue-800">
                        <div>
                          <strong>TDS (3 times a day):</strong> Pattern 4-4-4, Pills<br />
                          <span className="text-xs">→ Rhus tox 200 - 4 pills morning, 4 pills afternoon, 4 pills night for 7 days</span>
                        </div>
                        <div>
                          <strong>BD (2 times a day):</strong> Pattern 6-0-6, Drops<br />
                          <span className="text-xs">→ Rhus tox 200 - 6 drops morning, 6 drops night for 7 days</span>
                        </div>
                        <div>
                          <strong>OD (Once a day):</strong> Pattern 5-0-0, Pills<br />
                          <span className="text-xs">→ Rhus tox 200 - 5 pills morning for 7 days</span>
                        </div>
                      </div>
                    </div>

                    {/* Field Mapping */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Field Mapping:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><strong>Dose Form:</strong> Pills, Drops, Tablets, etc.</div>
                        <div><strong>Pattern:</strong> 4-4-4, 6-0-6, 5-0-0, etc.</div>
                        <div><strong>Frequency:</strong> TDS, BD, OD, QID, SOS</div>
                        <div><strong>Duration:</strong> 7 days, 15 days, 1 month, etc.</div>
                      </div>
                    </div>

                    {/* Toggle Options */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowMedicineName}
                          onChange={(e) => updateSetting("prescriptionShowMedicineName", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Medicine Name</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowPotency}
                          onChange={(e) => updateSetting("prescriptionShowPotency", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Potency</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowPattern}
                          onChange={(e) => updateSetting("prescriptionShowPattern", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Dose Pattern (Natural Language)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowDoseForm}
                          onChange={(e) => updateSetting("prescriptionShowDoseForm", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Dose Form (Pills/Drops)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowFrequency}
                          onChange={(e) => updateSetting("prescriptionShowFrequency", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Frequency (TDS/BD/OD)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowDuration}
                          onChange={(e) => updateSetting("prescriptionShowDuration", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Duration</span>
                      </label>
                    </div>
                  </div>

                  {/* Additional Settings */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Additional Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={settings.prescriptionShowNextVisit}
                          onChange={(e) => updateSetting("prescriptionShowNextVisit", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Show Next Visit Date</span>
                      </label>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Signature & Seal Position
                        </label>
                        <select
                          value={settings.prescriptionSignaturePosition}
                          onChange={(e) => updateSetting("prescriptionSignaturePosition", e.target.value as 'left' | 'right')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Prescription Language
                        </label>
                        <p className="text-sm text-gray-500 mb-2">
                          Select language for dose timing and next visit text. Medicine names and potency will remain in English.
                        </p>
                        <select
                          value={settings.prescriptionLanguage || 'english'}
                          onChange={(e) => updateSetting("prescriptionLanguage", e.target.value as 'english' | 'hindi')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="english">English</option>
                          <option value="hindi">Hindi (हिंदी)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right side - Preview */}
              <div className="w-[400px]">
                <Card className="p-4 sticky top-4">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Prescription Preview</h3>
                  <div
                    style={{
                      width: '100%',
                      height: '600px',
                      border: '1px solid #ddd',
                      backgroundColor: '#fff',
                      fontFamily: settings.prescriptionFontFamily,
                      fontSize: settings.prescriptionFontSize,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        height: settings.prescriptionHeaderHeight,
                        borderBottom: '1px solid #ddd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      {settings.prescriptionHeaderImage ? (
                        <img
                          src={settings.prescriptionHeaderImage}
                          alt="Header"
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div className="text-gray-400 text-sm">Header Image</div>
                      )}
                    </div>

                    {/* Patient Details */}
                    <div
                      style={{
                        backgroundColor: '#e5e7eb',
                        padding: '8px 12px',
                        marginLeft: settings.prescriptionMarginLeft,
                        marginRight: settings.prescriptionMarginRight,
                        fontFamily: settings.prescriptionPatientDetailsFontFamily,
                        fontSize: settings.prescriptionPatientDetailsFontSize,
                        fontWeight: settings.prescriptionPatientDetailsFontBold ? 'bold' : 'normal',
                        fontStyle: settings.prescriptionPatientDetailsFontItalic ? 'italic' : 'normal',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {settings.prescriptionShowName && (
                          <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Name: John Doe</div>
                        )}
                        {settings.prescriptionShowDate && (
                          <div style={{ fontSize: '0.9em' }}>Date: {new Date().toLocaleDateString('en-IN')}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {settings.prescriptionShowRegNo && (
                          <div style={{ fontSize: '0.85em' }}>Regd No: REG12345</div>
                        )}
                        {settings.prescriptionShowMobile && (
                          <div style={{ fontSize: '0.85em' }}>Mobile No: 9876543210</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          {settings.prescriptionShowDoctorName && (
                            <div style={{ fontSize: '0.85em' }}>Dr. [Doctor Name]</div>
                          )}
                          {settings.prescriptionShowAddress && (
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Address Line 1, City</div>
                          )}
                        </div>
                        <div>
                          {settings.prescriptionShowAge && (
                            <span style={{ fontSize: '0.85em', marginRight: '8px' }}>Age: 35</span>
                          )}
                          {settings.prescriptionShowSex && (
                            <span style={{ fontSize: '0.85em' }}>Sex: M</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div
                      style={{
                        padding: '12px',
                        marginLeft: settings.prescriptionMarginLeft,
                        marginRight: settings.prescriptionMarginRight,
                        minHeight: '200px',
                        fontFamily: settings.prescriptionContentFontFamily,
                        fontSize: settings.prescriptionContentFontSize,
                        fontWeight: settings.prescriptionContentFontBold ? 'bold' : 'normal',
                        fontStyle: settings.prescriptionContentFontItalic ? 'italic' : 'normal',
                        textDecoration: settings.prescriptionContentFontUnderline ? 'underline' : 'none',
                      }}
                    >
                      <div style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                        <strong>Chief Complaint:</strong> Sample complaint text
                      </div>
                      <div style={{ fontSize: '0.9em', marginBottom: '12px' }}>
                        <strong>Rx:</strong>
                      </div>
                      <div style={{ fontSize: '0.85em', lineHeight: '1.8' }}>
                        {/* Example 1: TDS with 4-4-4 pattern */}
                        {(() => {
                          const med1 = formatMedicineDisplay({
                            name: 'Rhus tox',
                            potency: '200',
                            pattern: '4-4-4',
                            doseForm: 'Pills',
                            frequency: 'TDS',
                            duration: '7 days',
                            quantity: '2dr'
                          });
                          return (
                            <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                              1. {med1.line1}<br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{med1.line2}
                            </div>
                          );
                        })()}
                        
                        {/* Example 2: BD with 6-0-6 pattern */}
                        {(() => {
                          const med2 = formatMedicineDisplay({
                            name: 'Arnica',
                            potency: '30',
                            pattern: '6-0-6',
                            doseForm: 'Drops',
                            frequency: 'BD',
                            duration: '15 days',
                            quantity: '1dr'
                          });
                          return (
                            <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                              2. {med2.line1}<br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{med2.line2}
                            </div>
                          );
                        })()}
                        
                        {/* Example 3: OD with 5-0-0 pattern */}
                        {(() => {
                          const med3 = formatMedicineDisplay({
                            name: 'Sulphur',
                            potency: '1M',
                            pattern: '5-0-0',
                            doseForm: 'Pills',
                            frequency: 'OD',
                            duration: '30 days',
                            quantity: '3dr'
                          });
                          return (
                            <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                              3. {med3.line1}<br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{med3.line2}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Footer */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: settings.prescriptionFooterHeight,
                        borderTop: '1px solid #ddd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      {settings.prescriptionFooterImage ? (
                        <img
                          src={settings.prescriptionFooterImage}
                          alt="Footer"
                          style={{ maxHeight: '100%', maxWidth: '60%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div className="text-gray-400 text-xs">Footer Image</div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        {settings.prescriptionDoctorSignature && (
                          <img
                            src={settings.prescriptionDoctorSignature}
                            alt="Signature"
                            style={{ maxHeight: '40px', maxWidth: '80px', objectFit: 'contain' }}
                          />
                        )}
                        {settings.prescriptionDoctorSeal && (
                          <img
                            src={settings.prescriptionDoctorSeal}
                            alt="Seal"
                            style={{ maxHeight: '40px', maxWidth: '40px', objectFit: 'contain' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Fee Receipt Printing Settings */}
          {activeTab === "receipt" && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Fee Receipt Print Settings</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.feeReceiptPrintEnabled}
                      onChange={(e) => updateSetting("feeReceiptPrintEnabled", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable fee receipt printing</span>
                  </label>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Header
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Text to appear at the top of fee receipt printouts (e.g., clinic name, address).
                    </p>
                    <textarea
                      value={settings.feeReceiptHeader}
                      onChange={(e) => updateSetting("feeReceiptHeader", e.target.value)}
                      placeholder="[Clinic Name]\n[Address]\nGSTIN: [Number]"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Footer
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Text to appear at the bottom of fee receipt printouts (e.g., thank you message, terms).
                    </p>
                    <textarea
                      value={settings.feeReceiptFooter}
                      onChange={(e) => updateSetting("feeReceiptFooter", e.target.value)}
                      placeholder="Thank you for your visit!\nThis is a computer-generated receipt."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Bill Printing Settings */}
          {activeTab === "bill" && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Prescription Bill Print Settings</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.billPrintEnabled}
                      onChange={(e) => updateSetting("billPrintEnabled", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable bill printing</span>
                  </label>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bill Header
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Text to appear at the top of prescription bill printouts (e.g., pharmacy name, license).
                    </p>
                    <textarea
                      value={settings.billHeader}
                      onChange={(e) => updateSetting("billHeader", e.target.value)}
                      placeholder="[Pharmacy Name]\n[Address]\nLicense No: [Number]\nGSTIN: [Number]"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bill Footer
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Text to appear at the bottom of prescription bill printouts (e.g., terms, return policy).
                    </p>
                    <textarea
                      value={settings.billFooter}
                      onChange={(e) => updateSetting("billFooter", e.target.value)}
                      placeholder="Terms & Conditions\nNo returns on medicines\nThank you for your purchase!"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Label Printing Settings */}
          {activeTab === "label" && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Medicine Label Print Settings</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.labelPrintEnabled}
                      onChange={(e) => updateSetting("labelPrintEnabled", e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable label printing</span>
                  </label>
                </div>

                {/* Label Size */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Label Size</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Width
                      </label>
                      <select
                        value={settings.labelWidth}
                        onChange={(e) => updateSetting("labelWidth", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1.5in">1.5 inches</option>
                        <option value="2in">2 inches</option>
                        <option value="2.5in">2.5 inches</option>
                        <option value="3in">3 inches</option>
                        <option value="4in">4 inches</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Height
                      </label>
                      <select
                        value={settings.labelHeight}
                        onChange={(e) => updateSetting("labelHeight", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="0.5in">0.5 inches</option>
                        <option value="0.75in">0.75 inches</option>
                        <option value="1in">1 inch</option>
                        <option value="1.25in">1.25 inches</option>
                        <option value="1.5in">1.5 inches</option>
                        <option value="2in">2 inches</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Clinic Information */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Clinic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Clinic Name
                      </label>
                      <input
                        type="text"
                        value={settings.labelClinicName}
                        onChange={(e) => updateSetting("labelClinicName", e.target.value)}
                        placeholder="Dr. [Name] Clinic"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Clinic Details (Address/Phone)
                      </label>
                      <textarea
                        value={settings.labelClinicDetails}
                        onChange={(e) => updateSetting("labelClinicDetails", e.target.value)}
                        placeholder="Address Line 1, City\nPhone: [Number]"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Label Content */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Label Content</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Select which information to display on medicine labels
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowMedicineName}
                        onChange={(e) => updateSetting("labelShowMedicineName", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Medicine Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowPotency}
                        onChange={(e) => updateSetting("labelShowPotency", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Potency</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowQuantity}
                        onChange={(e) => updateSetting("labelShowQuantity", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Quantity (1dr, 2dr, etc.)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowDoseForm}
                        onChange={(e) => updateSetting("labelShowDoseForm", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Dose Form (Pills, Liquid, etc.)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowDosePattern}
                        onChange={(e) => updateSetting("labelShowDosePattern", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Dose Pattern</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowFrequency}
                        onChange={(e) => updateSetting("labelShowFrequency", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Frequency</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowDuration}
                        onChange={(e) => updateSetting("labelShowDuration", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Duration</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={settings.labelShowInstructions}
                        onChange={(e) => updateSetting("labelShowInstructions", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Instructions</span>
                    </label>
                  </div>
                </div>

                {/* Formatting Options */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Formatting Options</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Font Size
                      </label>
                      <select
                        value={settings.labelFontSize}
                        onChange={(e) => updateSetting("labelFontSize", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="6px">6px (Very Small)</option>
                        <option value="7px">7px (Small)</option>
                        <option value="8px">8px (Normal)</option>
                        <option value="9px">9px (Medium)</option>
                        <option value="10px">10px (Large)</option>
                        <option value="11px">11px (Very Large)</option>
                        <option value="12px">12px (Extra Large)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Padding
                      </label>
                      <select
                        value={settings.labelPadding}
                        onChange={(e) => updateSetting("labelPadding", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="2px">2px (Minimal)</option>
                        <option value="4px">4px (Normal)</option>
                        <option value="6px">6px (Comfortable)</option>
                        <option value="8px">8px (Spacious)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Border
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-300 rounded-lg">
                        <input
                          type="checkbox"
                          checked={settings.labelBorder}
                          onChange={(e) => updateSetting("labelBorder", e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Show border</span>
                      </label>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Label Preview */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Label Preview</h2>
                <div className="flex justify-center">
                  <div
                    style={{
                      width: settings.labelWidth,
                      height: settings.labelHeight,
                      border: settings.labelBorder ? '1px solid #000' : 'none',
                      padding: settings.labelPadding,
                      fontSize: settings.labelFontSize,
                      lineHeight: '1.2',
                      fontFamily: 'Arial, sans-serif',
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {settings.labelClinicName && (
                      <div style={{ fontWeight: 'bold', fontSize: `calc(${settings.labelFontSize} + 1px)`, marginBottom: '2px' }}>
                        {settings.labelClinicName}
                      </div>
                    )}
                    {settings.labelClinicDetails && (
                      <div style={{ fontSize: `calc(${settings.labelFontSize} - 1px)`, color: '#666', marginBottom: '3px' }}>
                        {settings.labelClinicDetails.split('\n')[0]}
                      </div>
                    )}
                    {settings.labelShowMedicineName && (
                      <div style={{ fontWeight: 'bold', fontSize: `calc(${settings.labelFontSize} + 1px)`, marginTop: '2px' }}>
                        Rhus tox
                        {settings.labelShowPotency && <span style={{ fontWeight: 'normal' }}> 200</span>}
                      </div>
                    )}
                    <div style={{ marginTop: '2px' }}>
                      {settings.labelShowQuantity && <span>Qty: 2dr</span>}
                      {settings.labelShowDoseForm && <span> | Pills</span>}
                    </div>
                    <div>
                      {settings.labelShowDosePattern && <span>1-1-1</span>}
                      {settings.labelShowFrequency && <span> | TDS</span>}
                    </div>
                    {settings.labelShowDuration && (
                      <div>Duration: 7 days</div>
                    )}
                    {settings.labelShowInstructions && (
                      <div style={{ fontSize: `calc(${settings.labelFontSize} - 1px)`, marginTop: '2px', color: '#555' }}>
                        Take after meals
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
