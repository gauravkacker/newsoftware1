"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { settingsDb } from "@/lib/db/database";

export default function RegistrationSettingsPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    prefix: "DK-",
    startingNumber: "1001",
    padding: "4",
    separator: "-",
    tokenMode: "session",
  });

  // Load settings
  useEffect(() => {
    const loadSettings = () => {
      setIsLoading(true);
      const settings = settingsDb.getById("registration") as { prefix?: string; startingNumber?: number; padding?: number; separator?: string; tokenMode?: string } | undefined;
      if (settings) {
        setFormData({
          prefix: settings.prefix !== undefined ? settings.prefix : "",
          startingNumber: String(settings.startingNumber || 1001),
          padding: String(settings.padding || 4),
          separator: settings.separator || "-",
          tokenMode: settings.tokenMode || "session",
        });
      } else {
        // Initialize with empty prefix by default
        setFormData({
          prefix: "",
          startingNumber: "1001",
          padding: "4",
          separator: "-",
          tokenMode: "session",
        });
      }
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  // Calculate preview
  const getPreview = () => {
    const num = parseInt(formData.startingNumber) || 1001;
    const paddedNum = num.toString().padStart(parseInt(formData.padding) || 4, "0");
    return `${formData.prefix}${paddedNum}`;
  };

  // Get next number preview
  const getNextPreview = () => {
    const num = (parseInt(formData.startingNumber) || 1001) + 1;
    const paddedNum = num.toString().padStart(parseInt(formData.padding) || 4, "0");
    return `${formData.prefix}${paddedNum}`;
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {
        id: "registration",
        prefix: formData.prefix,
        startingNumber: parseInt(formData.startingNumber) || 1001,
        padding: parseInt(formData.padding) || 4,
        separator: formData.separator,
        tokenMode: formData.tokenMode,
        updatedAt: new Date(),
      };
      settingsDb.upsert("registration", settings);
      alert("Registration number settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Registration Number Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Configure how patient registration numbers are generated
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
            >
              Save Settings
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-w-2xl">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Card */}
              <Card className="p-6 bg-blue-50 border-blue-200">
                <h2 className="text-lg font-medium text-blue-900 mb-4">Preview</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Current Number</p>
                    <p className="text-2xl font-mono font-bold text-blue-600">{getPreview()}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Next Number</p>
                    <p className="text-2xl font-mono font-bold text-green-600">{getNextPreview()}</p>
                  </div>
                </div>
              </Card>

              {/* Settings Form */}
              <Card className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Configuration</h2>
                <div className="space-y-4">
                  <Input
                    label="Prefix"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    placeholder="e.g., DK-, HCL-, HOME-"
                    required
                    helperText="Text that appears before the number"
                  />

                  <Input
                    label="Starting Number"
                    type="number"
                    value={formData.startingNumber}
                    onChange={(e) => setFormData({ ...formData, startingNumber: e.target.value })}
                    placeholder="1001"
                    required
                    helperText="The next patient will get this number"
                  />

                  <Input
                    label="Padding"
                    type="number"
                    value={formData.padding}
                    onChange={(e) => setFormData({ ...formData, padding: e.target.value })}
                    placeholder="4"
                    required
                    min="1"
                    max="10"
                    helperText="Minimum digits (e.g., 4 = 0001, 5 = 00001)"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Separator
                    </label>
                    <select
                      value={formData.separator}
                      onChange={(e) => setFormData({ ...formData, separator: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="-">Dash (-)</option>
                      <option value="/">Slash (/)</option>
                      <option value=".">Period (.)</option>
                      <option value="">None</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      Character between prefix and number
                    </p>
                  </div>
                </div>
              </Card>

              {/* Examples */}
              <Card className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Examples</h2>
                <div className="space-y-2">
                  {[
                    { name: "If prefix is 'DK-' and padding is 4", example: "DK-0001, DK-0002, DK-0100, DK-1000" },
                    { name: "If prefix is 'HCL/' and padding is 5", example: "HCL/01001, HCL/01002, HCL/10000" },
                    { name: "If prefix is '' and separator is '-'", example: "0001, 0002, 0100, 1000" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-700">{item.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{item.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Token Mode Settings */}
              <Card className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">Token Number Mode</h2>
                <p className="text-sm text-gray-500 mb-4">Choose how token numbers are assigned for appointments</p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="tokenMode"
                      value="session"
                      checked={formData.tokenMode === "session"}
                      onChange={(e) => setFormData({ ...formData, tokenMode: e.target.value })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900">New Session (Reset Daily)</p>
                      <p className="text-sm text-gray-500">Token numbers start from 1 each day/session</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="tokenMode"
                      value="continuous"
                      checked={formData.tokenMode === "continuous"}
                      onChange={(e) => setFormData({ ...formData, tokenMode: e.target.value })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Continuous</p>
                      <p className="text-sm text-gray-500">Token numbers continue from where they left off</p>
                    </div>
                  </label>
                </div>
              </Card>

              {/* Important Notice */}
              <Card className="p-4 bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-amber-800">Important</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Changing the starting number affects only future patients. 
                      Existing patients keep their original registration numbers.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
