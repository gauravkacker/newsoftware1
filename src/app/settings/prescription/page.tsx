"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PrescriptionSettings {
  potency: string[];
  quantity: string[];
  doseForm: string[];
  pattern: string[];
  frequency: string[];
  duration: string[];
}

const defaultSettings: PrescriptionSettings = {
  potency: ['3x', '6c', '6x', '30c', '30x', '200c', '200x', '1M', '10M', '50M', 'CM', 'Q', '1x'],
  quantity: ['1/2dr', '1dr', '2dr', '1/2oz', '1oz', '2oz', '50ml', '100ml'],
  doseForm: ['Pills', 'Tabs', 'Drops', 'Liq', 'Powder', 'Sachet', 'Ointment', 'Cream', 'Serum', 'Oil'],
  pattern: ['1-1-1', '4-4-4', '6-6-6', '15-15-15', '20-20-20', '2-2-2'],
  frequency: ['Daily', 'Weekly', 'Twice Weekly', 'Thrice Weekly'],
  duration: ['Day', 'Week', 'Month'],
};

const STORAGE_KEY = 'prescription_settings';

export default function PrescriptionSettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState<PrescriptionSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [newItems, setNewItems] = useState<Record<string, string>>({
    potency: '',
    quantity: '',
    doseForm: '',
    pattern: '',
    frequency: '',
    duration: '',
  });

  const saveSettings = (newSettings: PrescriptionSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  const addItem = (field: keyof PrescriptionSettings) => {
    const newItem = newItems[field].trim();
    if (newItem && !settings[field].includes(newItem)) {
      const newSettings = {
        ...settings,
        [field]: [...settings[field], newItem],
      };
      saveSettings(newSettings);
      setNewItems({ ...newItems, [field]: '' });
    }
  };

  const removeItem = (field: keyof PrescriptionSettings, item: string) => {
    const newSettings = {
      ...settings,
      [field]: settings[field].filter(i => i !== item),
    };
    saveSettings(newSettings);
  };

  const resetToDefault = () => {
    saveSettings(defaultSettings);
  };

  const fieldLabels: Record<keyof PrescriptionSettings, { label: string; placeholder: string }> = {
    potency: { label: 'Potency', placeholder: 'e.g., 200c, 1M' },
    quantity: { label: 'Quantity', placeholder: 'e.g., 1dr, 50ml' },
    doseForm: { label: 'Dose Form', placeholder: 'e.g., Pills, Drops' },
    pattern: { label: 'Pattern', placeholder: 'e.g., 1-1-1, 4-4-4' },
    frequency: { label: 'Frequency', placeholder: 'e.g., Daily, Weekly' },
    duration: { label: 'Duration Units', placeholder: 'e.g., Day, Week' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Prescription Settings</h1>
              <p className="text-sm text-gray-500">
                Configure default values for prescription fields
              </p>
            </div>
            <Button onClick={resetToDefault} variant="secondary">
              Reset to Default
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {(Object.keys(fieldLabels) as Array<keyof PrescriptionSettings>).map((field) => (
            <Card key={field} className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {fieldLabels[field].label}
              </h2>
              
              {/* Existing items */}
              <div className="flex flex-wrap gap-2 mb-4">
                {settings[field].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <span>{item}</span>
                    <button
                      onClick={() => removeItem(field, item)}
                      className="ml-1 text-blue-400 hover:text-blue-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new item */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItems[field]}
                  onChange={(e) => setNewItems({ ...newItems, [field]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addItem(field);
                    }
                  }}
                  placeholder={fieldLabels[field].placeholder}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <Button onClick={() => addItem(field)} variant="primary">
                  Add
                </Button>
              </div>
            </Card>
          ))}

          {/* Info Card */}
          <Card className="p-6 bg-amber-50 border-amber-200">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-amber-800">How it works</h3>
                <p className="text-sm text-amber-700 mt-1">
                  When typing in the medicine field, the system will automatically recognize these values and fill the appropriate fields.
                  For example, typing &quot;Led Pal 200 2dr pills 4-4-4 for 7 days&quot; will auto-fill:
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
                  <li>Medicine: Led Pal</li>
                  <li>Potency: 200</li>
                  <li>Quantity: 2dr</li>
                  <li>Dose Form: pills</li>
                  <li>Pattern: 4-4-4</li>
                  <li>Duration: 7 days</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
