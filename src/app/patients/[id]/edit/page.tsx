"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { patientDb, patientTagDb } from "@/lib/db/database";
import type { Patient, PatientTag } from "@/types";

// Collapsible Section Component
function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-6">{children}</div>}
    </Card>
  );
}

export default function EditPatientPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);

  // Collapsible section states
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [additionalExpanded, setAdditionalExpanded] = useState(false);
  const [medicalExpanded, setMedicalExpanded] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    photoUrl: "",
    salutation: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    age: "",
    gender: "" as "" | "male" | "female" | "other",
    mobileNumber: "",
    alternateMobile: "",
    email: "",
    bloodGroup: "" as "" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown",
    occupation: "",
    maritalStatus: "" as "" | "single" | "married" | "divorced" | "widowed",
    religion: "",
    referredBy: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressPincode: "",
    addressCountry: "India",
    medicalHistory: "",
    allergies: "",
    feeExempt: false,
    feeExemptionReason: "",
    selectedTags: [] as string[],
  });

  // Load patient data
  useEffect(() => {
    const loadPatient = () => {
      const patient = patientDb.getById(patientId) as Patient | undefined;
      if (patient) {
        setFormData({
          photoUrl: patient.photoUrl || "",
          salutation: patient.salutation || "",
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          age: patient.age ? String(patient.age) : "",
          gender: patient.gender,
          mobileNumber: patient.mobileNumber,
          alternateMobile: patient.alternateMobile || "",
          email: patient.email || "",
          bloodGroup: patient.bloodGroup || "",
          occupation: patient.occupation || "",
          maritalStatus: patient.maritalStatus || "",
          religion: patient.religion || "",
          referredBy: patient.referredBy || "",
          addressStreet: patient.address?.street || "",
          addressCity: patient.address?.city || "",
          addressState: patient.address?.state || "",
          addressPincode: patient.address?.pincode || "",
          addressCountry: patient.address?.country || "India",
          medicalHistory: patient.medicalHistory?.join(", ") || "",
          allergies: patient.allergies?.join(", ") || "",
          feeExempt: patient.feeExempt,
          feeExemptionReason: patient.feeExemptionReason || "",
          selectedTags: patient.tags || [],
        });
      }
      setIsLoadingPatient(false);
    };

    const loadTags = () => {
      const allTags = patientTagDb.getAll() as PatientTag[];
      setTags(allTags);
    };

    loadPatient();
    loadTags();
  }, [patientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter((id) => id !== tagId)
        : [...prev.selectedTags, tagId],
    }));
  };

  const calculateAgeFromDob = (dob: string): number => {
    if (!dob) return 0;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const age = formData.age ? parseInt(formData.age) : calculateAgeFromDob(formData.dateOfBirth);

      const patientUpdates = {
        photoUrl: formData.photoUrl || undefined,
        salutation: formData.salutation,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        dateOfBirth: formData.dateOfBirth,
        age,
        gender: formData.gender,
        mobileNumber: formData.mobileNumber,
        alternateMobile: formData.alternateMobile,
        email: formData.email,
        bloodGroup: formData.bloodGroup,
        occupation: formData.occupation,
        maritalStatus: formData.maritalStatus,
        religion: formData.religion,
        referredBy: formData.referredBy,
        address: {
          street: formData.addressStreet,
          city: formData.addressCity,
          state: formData.addressState,
          pincode: formData.addressPincode,
          country: formData.addressCountry,
        },
        medicalHistory: formData.medicalHistory
          ? formData.medicalHistory.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        allergies: formData.allergies
          ? formData.allergies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        feeExempt: formData.feeExempt,
        feeExemptionReason: formData.feeExemptionReason,
        tags: formData.selectedTags,
      };

      // Update patient
      patientDb.update(patientId, patientUpdates);

      // Note: Patient history tracking can be added later

      router.push(`/patients/${patientId}`);
    } catch (error) {
      console.error("Error updating patient:", error);
      alert("Failed to update patient. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!formData.firstName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-medium text-gray-900 mb-2">Patient Not Found</h2>
          <p className="text-gray-500 mb-4">The patient record you&apos;re looking for doesn&apos;t exist.</p>
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
              <h1 className="text-2xl font-semibold text-gray-900">Edit Patient</h1>
              <p className="text-sm text-gray-500">Update patient information</p>
            </div>
          </div>
        </div>

        <main className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Photo */}
            <CollapsibleSection
              title="Profile Photo"
              isOpen={true}
              onToggle={() => {}}
            >
              <div className="flex justify-center py-4">
                <PhotoUpload
                  currentPhotoUrl={formData.photoUrl}
                  onPhotoUploaded={(url) => setFormData((prev) => ({ ...prev, photoUrl: url }))}
                  patientName={`${formData.firstName} ${formData.lastName}`.trim() || "Patient"}
                />
              </div>
            </CollapsibleSection>

            {/* Basic Information */}
            <CollapsibleSection
              title="Basic Information"
              isOpen={true}
              onToggle={() => {}}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salutation
                  </label>
                  <select
                    name="salutation"
                    value={formData.salutation}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Master">Master</option>
                    <option value="Baby">Baby</option>
                  </select>
                </div>

                <Input
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter first name"
                />

                <Input
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter last name"
                />

                <Input
                  label="Mobile Number"
                  name="mobileNumber"
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="+91-XXXXX XXXXX"
                />

                <Input
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                />

                <Input
                  label="Age"
                  name="age"
                  type="number"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="Years"
                  min="0"
                  max="150"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <Input
                  label="Alternate Mobile"
                  name="alternateMobile"
                  type="tel"
                  value={formData.alternateMobile}
                  onChange={handleInputChange}
                  placeholder="+91-XXXXX XXXXX"
                />
              </div>
            </CollapsibleSection>

            {/* Address Information */}
            <CollapsibleSection
              title="Address Information"
              isOpen={addressExpanded}
              onToggle={() => setAddressExpanded(!addressExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Street Address"
                    name="addressStreet"
                    value={formData.addressStreet}
                    onChange={handleInputChange}
                    placeholder="Street address"
                  />
                </div>

                <Input
                  label="City"
                  name="addressCity"
                  value={formData.addressCity}
                  onChange={handleInputChange}
                  placeholder="City"
                />

                <Input
                  label="State"
                  name="addressState"
                  value={formData.addressState}
                  onChange={handleInputChange}
                  placeholder="State"
                />

                <Input
                  label="Pincode"
                  name="addressPincode"
                  value={formData.addressPincode}
                  onChange={handleInputChange}
                  placeholder="Pincode"
                />

                <Input
                  label="Country"
                  name="addressCountry"
                  value={formData.addressCountry}
                  onChange={handleInputChange}
                  placeholder="Country"
                />
              </div>
            </CollapsibleSection>

            {/* Additional Information */}
            <CollapsibleSection
              title="Additional Information"
              isOpen={additionalExpanded}
              onToggle={() => setAdditionalExpanded(!additionalExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="email@example.com"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <Input
                  label="Occupation"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  placeholder="Occupation"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marital Status
                  </label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>

                <Input
                  label="Religion"
                  name="religion"
                  value={formData.religion}
                  onChange={handleInputChange}
                  placeholder="Religion"
                />

                <Input
                  label="Referred By"
                  name="referredBy"
                  value={formData.referredBy}
                  onChange={handleInputChange}
                  placeholder="Referred by"
                />
              </div>

              {/* Patient Tags */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        formData.selectedTags.includes(tag.id)
                          ? "text-white"
                          : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                      }`}
                      style={{
                        backgroundColor: formData.selectedTags.includes(tag.id)
                          ? tag.color
                          : undefined,
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {/* Medical Information */}
            <CollapsibleSection
              title="Medical Information"
              isOpen={medicalExpanded}
              onToggle={() => setMedicalExpanded(!medicalExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical History
                  </label>
                  <textarea
                    name="medicalHistory"
                    value={formData.medicalHistory}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter medical history (comma-separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allergies
                  </label>
                  <textarea
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter allergies (comma-separated)"
                  />
                </div>
              </div>

              {/* Fee Exemption */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="feeExempt"
                    name="feeExempt"
                    checked={formData.feeExempt}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="feeExempt" className="text-sm font-medium text-gray-700">
                    Fee Exempt - This patient is exempt from fees
                  </label>
                </div>
                {formData.feeExempt && (
                  <div className="mt-3">
                    <Input
                      label="Exemption Reason"
                      name="feeExemptionReason"
                      value={formData.feeExemptionReason}
                      onChange={handleInputChange}
                      placeholder="Reason for fee exemption"
                    />
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
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
                Save Changes
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
