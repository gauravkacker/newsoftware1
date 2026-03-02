"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { doctorSettingsDb } from "@/lib/db/doctor-panel";

interface LabelElement {
  id: string;
  type: 'text' | 'field';
  content: string; // For text type, or field name for field type
  x: number; // Position in mm or inches
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  visible: boolean;
}

interface LabelSettings {
  // Label size
  width: number;
  height: number;
  unit: 'cm' | 'inch';
  
  // Border and padding
  border: boolean;
  padding: number;
  
  // Grid settings
  showGrid: boolean;
  gridSize: number; // in mm
  
  // Elements on label
  elements: LabelElement[];
  
  // Available fields
  showPatientName: boolean;
  showPatientMobile: boolean;
  showMedicineName: boolean;
  showPotency: boolean;
  showQuantity: boolean;
  showDoseForm: boolean;
  showDosePattern: boolean;
  showFrequency: boolean;
  showDuration: boolean;
  showInstructions: boolean;
  
  // Clinic info
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail: string;
}

const DEFAULT_ELEMENTS: LabelElement[] = [
  { id: '1', type: 'field', content: 'clinicName', x: 5, y: 5, fontSize: 12, fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', visible: true },
  { id: '2', type: 'field', content: 'medicineName', x: 5, y: 15, fontSize: 10, fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', visible: true },
  { id: '3', type: 'field', content: 'potency', x: 5, y: 22, fontSize: 9, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', visible: true },
  { id: '4', type: 'field', content: 'doseTiming', x: 5, y: 29, fontSize: 8, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'left', visible: true },
];

export default function LabelSettingsPage() {
  const [settings, setSettings] = useState<LabelSettings>(() => {
    try {
      const raw = doctorSettingsDb.get("labelSettings");
      if (raw) {
        return JSON.parse(raw as string);
      }
    } catch {}
    return {
      width: 2,
      height: 1,
      unit: 'inch',
      border: true,
      padding: 4,
      showGrid: false,
      gridSize: 5,
      elements: DEFAULT_ELEMENTS,
      showPatientName: true,
      showPatientMobile: true,
      showMedicineName: true,
      showPotency: true,
      showQuantity: true,
      showDoseForm: true,
      showDosePattern: true,
      showFrequency: true,
      showDuration: true,
      showInstructions: false,
      clinicName: "My Clinic",
      clinicAddress: "123 Main St",
      clinicPhone: "+1234567890",
      clinicEmail: "clinic@example.com",
    };
  });

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingElement, setDraggingElement] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleSave = () => {
    setIsSaving(true);
    doctorSettingsDb.set("labelSettings", JSON.stringify(settings), "doctor");
    setTimeout(() => {
      setIsSaving(false);
      alert("Label settings saved successfully.");
    }, 400);
  };

  const updateSetting = <K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    setSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, ...updates } : el
      )
    }));
  };

  const addElement = (type: 'text' | 'field', content: string) => {
    const newElement: LabelElement = {
      id: Date.now().toString(),
      type,
      content,
      x: 5,
      y: 5,
      fontSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      visible: true,
    };
    setSettings(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElement(newElement.id);
  };

  const deleteElement = (id: string) => {
    setSettings(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id)
    }));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  // Convert units
  const convertToMM = (value: number, unit: 'cm' | 'inch'): number => {
    if (unit === 'cm') return value * 10;
    return value * 25.4;
  };

  const getLabelDimensions = () => {
    const widthMM = convertToMM(settings.width, settings.unit);
    const heightMM = convertToMM(settings.height, settings.unit);
    return { widthMM, heightMM };
  };

  const getFieldLabel = (fieldName: string): string => {
    const labels: Record<string, string> = {
      clinicName: 'Clinic Name',
      clinicAddress: 'Clinic Address',
      clinicPhone: 'Clinic Phone',
      clinicEmail: 'Clinic Email',
      patientName: 'Patient Name',
      patientMobile: 'Patient Mobile',
      patientRegNo: 'Patient Reg No',
      serialNumber: 'Serial Number',
      medicineName: 'Medicine Name',
      potency: 'Potency',
      quantity: 'Quantity',
      doseForm: 'Dose Form',
      dosePattern: 'Dose Pattern',
      doseTiming: 'Dose Timing (Natural Language)',
      frequency: 'Frequency',
      duration: 'Duration',
      instructions: 'Instructions',
    };
    return labels[fieldName] || fieldName;
  };

  // Format dose timing like prescription (with short forms)
  const formatDoseTiming = (pattern: string, doseForm: string, duration: string): string => {
    const doses = pattern.split('-').map(d => parseInt(d) || 0);
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

  const getFieldValue = (fieldName: string): string => {
    const sampleData: Record<string, string> = {
      clinicName: settings.clinicName,
      clinicAddress: settings.clinicAddress,
      clinicPhone: settings.clinicPhone,
      clinicEmail: settings.clinicEmail,
      patientName: 'John Doe',
      patientMobile: '+1234567890',
      patientRegNo: 'REG12345',
      serialNumber: 'Sr No: 1',
      medicineName: 'Rhus tox',
      potency: '200',
      quantity: '2dr Pills',
      doseForm: 'Pills',
      dosePattern: '1-0-1',
      doseTiming: formatDoseTiming('1-0-1', 'pills', '7 days'),
      frequency: '2 times daily',
      duration: '7 days',
      instructions: 'Take after meals',
    };
    return sampleData[fieldName] || '';
  };

  const selectedEl = settings.elements.find(el => el.id === selectedElement);

  // Handle keyboard events globally when an element is selected
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!selectedElement) return;
      
      const element = settings.elements.find(el => el.id === selectedElement);
      if (!element) return;

      // Check if arrow key was pressed
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      
      let newX = element.x;
      let newY = element.y;
      const step = e.shiftKey ? 0.1 : 1; // Fine adjustment with Shift key

      switch (e.key) {
        case 'ArrowLeft':
          newX = Math.max(0, element.x - step);
          break;
        case 'ArrowRight':
          newX = element.x + step;
          break;
        case 'ArrowUp':
          newY = Math.max(0, element.y - step);
          break;
        case 'ArrowDown':
          newY = element.y + step;
          break;
      }

      updateElement(selectedElement, { 
        x: parseFloat(newX.toFixed(2)), 
        y: parseFloat(newY.toFixed(2)) 
      });
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedElement, settings.elements]);

  // Handle mouse drag for elements
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    const element = settings.elements.find(el => el.id === elementId);
    if (!element) return;

    setDraggingElement(elementId);
    setSelectedElement(elementId);
    
    // Calculate offset from element position to mouse position
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingElement) return;

    const labelElement = document.getElementById('label-preview');
    if (!labelElement) return;

    const labelRect = labelElement.getBoundingClientRect();
    
    // Calculate new position relative to label
    const mouseX = e.clientX - labelRect.left - dragOffset.x;
    const mouseY = e.clientY - labelRect.top - dragOffset.y;
    
    // Convert pixels to mm (assuming 96 DPI)
    const pixelsPerMM = 96 / 25.4;
    const newX = Math.max(0, mouseX / pixelsPerMM);
    const newY = Math.max(0, mouseY / pixelsPerMM);
    
    // Update element position
    updateElement(draggingElement, { x: parseFloat(newX.toFixed(2)), y: parseFloat(newY.toFixed(2)) });
  };

  const handleMouseUp = () => {
    setDraggingElement(null);
  };

  // Handle keyboard arrow keys for precise positioning
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedElement) return;
    
    const element = settings.elements.find(el => el.id === selectedElement);
    if (!element) return;

    // Check if arrow key was pressed
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      return;
    }

    e.preventDefault();
    
    let newX = element.x;
    let newY = element.y;
    const step = e.shiftKey ? 0.1 : 1; // Fine adjustment with Shift key

    switch (e.key) {
      case 'ArrowLeft':
        newX = Math.max(0, element.x - step);
        break;
      case 'ArrowRight':
        newX = element.x + step;
        break;
      case 'ArrowUp':
        newY = Math.max(0, element.y - step);
        break;
      case 'ArrowDown':
        newY = element.y + step;
        break;
    }

    updateElement(selectedElement, { 
      x: parseFloat(newX.toFixed(2)), 
      y: parseFloat(newY.toFixed(2)) 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Label Editor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Design custom medicine labels with full control over layout and styling
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Panel - Label Size & Settings */}
            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Label Size</h3>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSetting('unit', 'cm')}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                        settings.unit === 'cm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Centimeters
                    </button>
                    <button
                      onClick={() => updateSetting('unit', 'inch')}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                        settings.unit === 'inch'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Inches
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Width ({settings.unit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.width}
                      onChange={(e) => updateSetting('width', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height ({settings.unit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.height}
                      onChange={(e) => updateSetting('height', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Padding (mm)
                    </label>
                    <input
                      type="number"
                      value={settings.padding}
                      onChange={(e) => updateSetting('padding', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.border}
                      onChange={(e) => updateSetting('border', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Show border</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showGrid}
                      onChange={(e) => updateSetting('showGrid', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Show grid lines</span>
                  </label>

                  {settings.showGrid && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grid Size (mm)
                      </label>
                      <input
                        type="number"
                        value={settings.gridSize}
                        onChange={(e) => updateSetting('gridSize', parseInt(e.target.value) || 5)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Clinic Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clinic Name
                    </label>
                    <input
                      type="text"
                      value={settings.clinicName}
                      onChange={(e) => updateSetting('clinicName', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={settings.clinicAddress}
                      onChange={(e) => updateSetting('clinicAddress', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={settings.clinicPhone}
                      onChange={(e) => updateSetting('clinicPhone', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="text"
                      value={settings.clinicEmail}
                      onChange={(e) => updateSetting('clinicEmail', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Add Elements</h3>
                
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-3">Click to add field to label:</p>
                  
                  <div className="space-y-1">
                    <button
                      onClick={() => addElement('field', 'clinicName')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Clinic Name
                    </button>
                    <button
                      onClick={() => addElement('field', 'clinicAddress')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Clinic Address
                    </button>
                    <button
                      onClick={() => addElement('field', 'clinicPhone')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Clinic Phone
                    </button>
                    <button
                      onClick={() => addElement('field', 'patientName')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Patient Name
                    </button>
                    <button
                      onClick={() => addElement('field', 'patientMobile')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Patient Mobile
                    </button>
                    <button
                      onClick={() => addElement('field', 'patientRegNo')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Patient Reg No
                    </button>
                    <button
                      onClick={() => addElement('field', 'serialNumber')}
                      className="w-full text-left px-3 py-2 text-sm bg-yellow-50 hover:bg-yellow-100 rounded border border-yellow-300"
                    >
                      + Serial Number
                    </button>
                    <button
                      onClick={() => addElement('field', 'medicineName')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Medicine Name
                    </button>
                    <button
                      onClick={() => addElement('field', 'potency')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Potency
                    </button>
                    <button
                      onClick={() => addElement('field', 'quantity')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Quantity
                    </button>
                    <button
                      onClick={() => addElement('field', 'doseForm')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Dose Form
                    </button>
                    <button
                      onClick={() => addElement('field', 'dosePattern')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Dose Pattern
                    </button>
                    <button
                      onClick={() => addElement('field', 'doseTiming')}
                      className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded border border-blue-300"
                    >
                      + Dose Timing (Natural)
                    </button>
                    <button
                      onClick={() => addElement('field', 'duration')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Duration
                    </button>
                    <button
                      onClick={() => addElement('field', 'instructions')}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      + Instructions
                    </button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Middle Panel - Preview */}
            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Label Preview</h3>
                
                <div className="bg-gray-100 p-8 rounded flex items-center justify-center min-h-[400px]">
                  <div
                    id="label-preview"
                    tabIndex={0}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onKeyDown={handleKeyDown}
                    style={{
                      width: `${getLabelDimensions().widthMM}mm`,
                      height: `${getLabelDimensions().heightMM}mm`,
                      border: settings.border ? '1px solid #000' : 'none',
                      padding: `${settings.padding}mm`,
                      backgroundColor: 'white',
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      cursor: draggingElement ? 'grabbing' : 'default',
                      outline: 'none',
                      backgroundImage: settings.showGrid 
                        ? `repeating-linear-gradient(0deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${settings.gridSize}mm),
                           repeating-linear-gradient(90deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${settings.gridSize}mm)`
                        : 'none',
                      backgroundSize: settings.showGrid ? `${settings.gridSize}mm ${settings.gridSize}mm` : 'auto',
                    }}
                  >
                    {settings.elements.filter(el => el.visible).map((element) => (
                      <div
                        key={element.id}
                        onMouseDown={(e) => handleMouseDown(e, element.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElement(element.id);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${element.x}mm`,
                          top: `${element.y}mm`,
                          fontSize: `${element.fontSize}px`,
                          fontFamily: element.fontFamily,
                          fontWeight: element.fontWeight,
                          fontStyle: element.fontStyle,
                          textDecoration: element.textDecoration,
                          textAlign: element.textAlign as any,
                          cursor: draggingElement === element.id ? 'grabbing' : 'grab',
                          border: selectedElement === element.id ? '1px dashed blue' : 'none',
                          padding: '2px',
                          userSelect: 'none',
                          backgroundColor: selectedElement === element.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          maxWidth: `calc(${getLabelDimensions().widthMM}mm - ${element.x}mm - ${settings.padding}mm)`,
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {element.type === 'text' 
                          ? element.content 
                          : getFieldValue(element.content)
                        }
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-3 text-center">
                  Click and drag elements • Use arrow keys for precise positioning (Shift + Arrow for 0.1mm steps)
                </p>
              </Card>
            </div>

            {/* Right Panel - Element Editor */}
            <div className="space-y-6">
              {selectedEl ? (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Edit Element</h3>
                    <button
                      onClick={() => deleteElement(selectedEl.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field
                      </label>
                      <input
                        type="text"
                        value={getFieldLabel(selectedEl.content)}
                        disabled
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          X Position (mm)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedEl.x}
                          onChange={(e) => updateElement(selectedEl.id, { x: parseFloat(e.target.value) || 0 })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Y Position (mm)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedEl.y}
                          onChange={(e) => updateElement(selectedEl.id, { y: parseFloat(e.target.value) || 0 })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Font Size (px)
                      </label>
                      <input
                        type="number"
                        value={selectedEl.fontSize}
                        onChange={(e) => updateElement(selectedEl.id, { fontSize: parseInt(e.target.value) || 10 })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Font Family
                      </label>
                      <select
                        value={selectedEl.fontFamily}
                        onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Text Style
                      </label>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateElement(selectedEl.id, { 
                            fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' 
                          })}
                          className={`flex-1 px-3 py-2 rounded text-sm font-bold ${
                            selectedEl.fontWeight === 'bold'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          B
                        </button>
                        
                        <button
                          onClick={() => updateElement(selectedEl.id, { 
                            fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' 
                          })}
                          className={`flex-1 px-3 py-2 rounded text-sm italic ${
                            selectedEl.fontStyle === 'italic'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          I
                        </button>
                        
                        <button
                          onClick={() => updateElement(selectedEl.id, { 
                            textDecoration: selectedEl.textDecoration === 'underline' ? 'none' : 'underline' 
                          })}
                          className={`flex-1 px-3 py-2 rounded text-sm underline ${
                            selectedEl.textDecoration === 'underline'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          U
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Text Alignment
                      </label>
                      
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          onClick={() => updateElement(selectedEl.id, { textAlign: 'left' })}
                          className={`px-3 py-2 rounded text-sm ${
                            selectedEl.textAlign === 'left'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title="Align Left"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => updateElement(selectedEl.id, { textAlign: 'center' })}
                          className={`px-3 py-2 rounded text-sm ${
                            selectedEl.textAlign === 'center'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title="Align Center"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-2 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => updateElement(selectedEl.id, { textAlign: 'right' })}
                          className={`px-3 py-2 rounded text-sm ${
                            selectedEl.textAlign === 'right'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title="Align Right"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm4 4a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1zm-4 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm4 4a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => updateElement(selectedEl.id, { textAlign: 'justify' })}
                          className={`px-3 py-2 rounded text-sm ${
                            selectedEl.textAlign === 'justify'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title="Justify"
                        >
                          <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEl.visible}
                        onChange={(e) => updateElement(selectedEl.id, { visible: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Visible</span>
                    </label>
                  </div>
                </Card>
              ) : (
                <Card className="p-4">
                  <p className="text-sm text-gray-500 text-center py-8">
                    Select an element from the preview to edit its properties
                  </p>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Elements List</h3>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {settings.elements.map((element) => (
                    <div
                      key={element.id}
                      onClick={() => setSelectedElement(element.id)}
                      className={`p-3 rounded border cursor-pointer ${
                        selectedElement === element.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {getFieldLabel(element.content)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Position: ({element.x}mm, {element.y}mm) • Size: {element.fontSize}px
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!element.visible && (
                            <span className="text-xs text-gray-400">Hidden</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Save Button - Sticky */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4 -mx-6 px-6 shadow-lg">
            <div className="flex justify-end gap-3">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Label Settings"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
