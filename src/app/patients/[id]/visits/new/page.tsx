"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { patientDb, visitDb, feeHistoryDb } from "@/lib/db/database";
import type { Patient, Visit } from "@/types";

export default function NewVisitPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    visitDate: new Date().toISOString().split("T")[0],
    visitTime: new Date().toTimeString().slice(0, 5),
    mode: "" as "in-person" | "video" | "self-repeat",
    chiefComplaint: "",
    diagnosis: "",
    notes: "",
    isSelfRepeat: false,
  });

  useEffect(() => {
    const patientData = patientDb.getById(patientId) as Patient | undefined;
    setPatient(patientData || null);
  }, [patientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.mode) {
      alert("Please select a visit mode");
      return;
    }

    setLoading(true);

    try {
      // Get existing visits to calculate visit number
      const existingVisits = visitDb.getByPatient(patientId) as Visit[];
      const visitNumber = existingVisits.length + 1;

      // Create visit
      const visit = visitDb.create({
        patientId,
        registrationNumber: patient?.registrationNumber || "",
        visitNumber,
        visitDate: new Date(formData.visitDate),
        visitTime: formData.visitTime,
        doctorId: "user-doctor", // Would come from auth context
        doctorName: "Dr. Homeopathic", // Would come from auth context
        mode: formData.mode,
        status: "completed" as const,
        chiefComplaint: formData.chiefComplaint,
        diagnosis: formData.diagnosis,
        notes: formData.notes,
        isSelfRepeat: formData.isSelfRepeat,
      });

      // Create fee entry if not self-repeat
      if (!formData.isSelfRepeat) {
        const feeType = visitNumber === 1 ? "first-visit" : "follow-up";
        feeHistoryDb.create({
          patientId,
          visitId: visit.id,
          receiptId: `rcpt-${Date.now()}`,
          feeType,
          amount: feeType === "first-visit" ? 500 : 300,
          paymentMethod: "cash" as const,
          paymentStatus: "paid" as const,
          paidDate: new Date(),
        });
      }

      router.push(`/patients/${patientId}`);
    } catch (error) {
      console.error("Error creating visit:", error);
      alert("Failed to create visit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-medium text-gray-900 mb-2">Patient Not Found</h2>
          <p className="text-gray-500 mb-4">The patient record doesn&apos;t exist.</p>
          <Button onClick={() => router.push("/patients")} variant="primary">
            Back to Patients
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <div className="bg-white border-b border-gray-200 px-6 py-4">
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
              <h1 className="text-2xl font-semibold text-gray-900">New Visit</h1>
              <p className="text-sm text-gray-500">
                Patient: {patient.fullName} ({patient.registrationNumber})
              </p>
            </div>
          </div>
        </div>

        <main className="p-6">
          <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Visit Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Visit Date"
                  name="visitDate"
                  type="date"
                  value={formData.visitDate}
                  onChange={handleInputChange}
                  required
                />

                <Input
                  label="Visit Time"
                  name="visitTime"
                  type="time"
                  value={formData.visitTime}
                  onChange={handleInputChange}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visit Mode *
                  </label>
                  <select
                    name="mode"
                    value={formData.mode}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select mode</option>
                    <option value="in-person">🏥 In-Person</option>
                    <option value="video">📹 Video Consultation</option>
                    <option value="self-repeat">🔄 Self-Repeat (Medicines Only)</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chief Complaint
                </label>
                <textarea
                  name="chiefComplaint"
                  value={formData.chiefComplaint}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Patient's main complaint or reason for visit"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis
                </label>
                <textarea
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Diagnosis or clinical findings"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes"
                />
              </div>

              {/* Self-Repeat Option */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isSelfRepeat"
                    name="isSelfRepeat"
                    checked={formData.isSelfRepeat}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isSelfRepeat" className="text-sm font-medium text-gray-700">
                    Self-Repeat Visit - Patient is only coming for repeat medicines, no consultation needed
                  </label>
                </div>
                {formData.isSelfRepeat && (
                  <p className="mt-2 text-sm text-blue-600">
                    💡 No consultation fee will be charged for self-repeat visits.
                  </p>
                )}
              </div>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/patients/${patientId}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
              >
                Create Visit
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
