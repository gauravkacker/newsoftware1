"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { db, patientDb } from "@/lib/db/database";
import type { Patient } from "@/types";

interface ImportRow {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
}

export default function ImportPatientsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].toLowerCase().split(",").map(h => h.trim());

      // Expected headers: regd no, name, mobile number
      const regNoIndex = headers.findIndex(h => 
        h.includes("reg") || h.includes("regd") || h.includes("registration")
      );
      const nameIndex = headers.findIndex(h => h.includes("name"));
      const mobileIndex = headers.findIndex(h => 
        h.includes("mobile") || h.includes("phone") || h.includes("contact")
      );

      if (nameIndex === -1) {
        setImportResults({
          success: 0,
          errors: ["CSV must have a 'Name' column"]
        });
        setIsImporting(false);
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV parsing with quotes
        const values: string[] = [];
        let currentValue = "";
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim());

        if (values.length < 2) continue;

        const nameParts = values[nameIndex]?.split(" ") || [];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const mobile = values[mobileIndex >= 0 ? mobileIndex : nameIndex]?.replace(/["']/g, "") || ""; // Use name if mobile not found
        const regNo = regNoIndex >= 0 ? values[regNoIndex]?.replace(/["']/g, "") : "";

        if (!firstName) {
          errors.push(`Row ${i + 1}: Missing required 'Name' field`);
          continue;
        }

        // Check for duplicate by registration number only (same family can have same mobile)
        const existingPatients = patientDb.getAll() as Patient[];
        const duplicateRegNumber = regNo ? existingPatients.some(
          (p: Patient) => p.registrationNumber.toLowerCase() === regNo.toLowerCase()
        ) : false;
        
        if (duplicateRegNumber && regNo) {
          errors.push(`Row ${i + 1}: Registration number '${regNo}' already exists`);
          continue;
        }

        try {
          // Use provided registration number or generate new one
          let registrationNumber = regNo;
          if (!registrationNumber) {
            // Get current settings and generate
            const settings = db.getRegNumberSettings(); 
            const currentPatients = patientDb.getAll() as Patient[];
            const maxReg = currentPatients.reduce((max: number, p: Patient) => {
              const num = parseInt(p.registrationNumber?.replace(/[^0-9]/g, "") || "0");
              return num > max ? num : max;
            }, 0);
            const nextNum = Math.max(maxReg + 1, settings.startingNumber);
            registrationNumber = `${settings.prefix}${nextNum.toString().padStart(settings.padding, "0")}`;
          }

          patientDb.create({
            registrationNumber,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            dateOfBirth: "",
            age: 0,
            gender: "other" as const,
            mobileNumber: mobile,
            email: "",
            address: {
              street: "",
              city: "",
              state: "",
              pincode: "",
              country: "India",
            },
            bloodGroup: "unknown" as const,
            occupation: "",
            maritalStatus: "single" as const,
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
            createdBy: "import",
          } as unknown as Parameters<typeof patientDb.create>[0]);

          successCount++;
        } catch (err) {
          errors.push(`Row ${i + 1}: Failed to create patient - ${err}`);
        }
      }

      setImportResults({
        success: successCount,
        errors
      });

    } catch (error) {
      setImportResults({
        success: 0,
        errors: [`Failed to read file: ${error}`]
      });
    }

    setIsImporting(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        handleFileUpload(file);
      } else {
        setImportResults({
          success: 0,
          errors: ["Please upload a CSV file"]
        });
      }
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
          <div className="flex items-center gap-4">
            <Link href="/patients" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import Patients</h1>
              <p className="text-sm text-gray-500">Bulk import patients from CSV file</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">CSV Format Instructions</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Create a CSV file with the following columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Registration Number</strong> (optional) - Will be auto-generated if not provided</li>
                <li><strong>Name</strong> (required) - Patient full name</li>
                <li><strong>Mobile Number</strong> (optional) - Patient contact number</li>
              </ul>
              <p className="mt-4">Example CSV:</p>
              <pre className="bg-gray-100 p-3 rounded text-xs mt-2 overflow-x-auto">
Registration Number,Name,Mobile Number
DK-1001,John Smith,9876543210
DK-1002,Sarah Johnson,9876543211
              </pre>
            </div>
          </Card>

          {/* Drop Zone */}
          <div 
            className={`p-12 text-center border-2 border-dashed rounded-lg transition-colors ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="text-gray-400">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop your CSV file here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click the button below to select a file
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Button 
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? "Processing..." : "Select CSV File"}
                </Button>
              </div>
            </div>
          </div>

          {/* Import Results */}
          {importResults && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {importResults.success} patients imported successfully
                    </p>
                    {importResults.errors.length > 0 && (
                      <p className="text-sm text-yellow-600">
                        {importResults.errors.length} errors/warnings
                      </p>
                    )}
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Errors/Warnings:</h3>
                    <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3">
                      {importResults.errors.map((error, index) => (
                        <p key={index} className="text-sm text-red-600 py-1">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Link href="/patients">
              <Button variant="secondary">Back to Patients</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
