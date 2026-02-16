"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { patientDb, patientTagDb } from "@/lib/db/database";
import type { PatientTag, Patient } from "@/types";

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

export default function NewPatientPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicatePatients, setDuplicatePatients] = useState<Array<{
    id: string;
    registrationNumber: string;
    fullName: string;
    mobileNumber: string;
  }>>([]);

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

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = () => {
    const allTags = patientTagDb.getAll() as PatientTag[];
    setTags(allTags);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    // Auto-fill gender based on salutation
    if (name === "salutation") {
      const genderMap: Record<string, "male" | "female" | "other"> = {
        "Mr": "male",
        "Mrs": "female",
        "Ms": "female",
        "Shri": "male",
        "Master": "male",
        "Baby": "other",
        "Smt": "female",
        "Kumari": "female",
      };
      const mappedGender = genderMap[value];
      if (mappedGender) {
        setFormData((prev) => ({ ...prev, gender: mappedGender }));
      }
    }

    // Check for duplicates when name or mobile changes
    if (name === "firstName" || name === "lastName" || name === "mobileNumber") {
      checkForDuplicates();
    }
  };

  const checkForDuplicates = () => {
    const firstName = formData.firstName.trim().toLowerCase();
    const lastName = formData.lastName.trim().toLowerCase();
    const mobile = formData.mobileNumber.trim();
    
    // Need at least first name and mobile to check for duplicates
    if (!firstName || !mobile) {
      setShowDuplicateWarning(false);
      setDuplicatePatients([]);
      return;
    }

    const allPatients = patientDb.getAll() as Patient[];
    const duplicates: Array<{
      id: string;
      registrationNumber: string;
      fullName: string;
      mobileNumber: string;
    }> = [];
    
    allPatients.forEach((patient) => {
      const pFirstName = (patient.firstName || '').trim().toLowerCase();
      const pLastName = (patient.lastName || '').trim().toLowerCase();
      const pMobile = (patient.mobileNumber || '').trim();
      
      // Check 1: Exact match on firstName + lastName + mobile (all 3 must match)
      const exactNameMatch = firstName === pFirstName && lastName === pLastName;
      const mobileMatch = mobile === pMobile;
      
      if (exactNameMatch && mobileMatch) {
        // Exact duplicate - same name and same mobile
        duplicates.push({
          id: patient.id,
          registrationNumber: patient.registrationNumber,
          fullName: patient.fullName,
          mobileNumber: patient.mobileNumber,
        });
      }
      
      // Check 2: Show all patients with same mobile number (for reference)
      if (mobileMatch && pMobile) {
        // Add to duplicates if not already added
        if (!duplicates.find(d => d.id === patient.id)) {
          duplicates.push({
            id: patient.id,
            registrationNumber: patient.registrationNumber,
            fullName: patient.fullName,
            mobileNumber: patient.mobileNumber,
          });
        }
      }
    });
    
    if (duplicates.length > 0) {
      setDuplicatePatients(duplicates);
      setShowDuplicateWarning(true);
    } else {
      setShowDuplicateWarning(false);
      setDuplicatePatients([]);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter((id) => id !== tagId)
        : [...prev.selectedTags, tagId],
    }));
  };

  const handleRegisterAndBookAppointment = async (
    e: React.FormEvent,
    bookAppointment: boolean
  ) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate: either DOB or Age must be provided
      if (!formData.dateOfBirth && !formData.age) {
        alert("Please provide either Date of Birth or Age");
        setLoading(false);
        return;
      }

      // Calculate age from DOB if provided, otherwise use the age field
      let age = formData.age ? parseInt(formData.age) : 0;
      if (formData.dateOfBirth) {
        age = Math.floor(
          (new Date().getTime() - new Date(formData.dateOfBirth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        );
      }

      // Create patient object (registration number is auto-generated in patientDb.create)
      const patient = {
        photoUrl: formData.photoUrl || undefined,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        dateOfBirth: formData.dateOfBirth || undefined,
        age: age || undefined,
        gender: formData.gender,
        mobileNumber: formData.mobileNumber.trim(),
        alternateMobile: formData.alternateMobile.trim() || undefined,
        email: formData.email.trim() || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        occupation: formData.occupation.trim() || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        religion: formData.religion.trim() || undefined,
        referredBy: formData.referredBy.trim() || undefined,
        address: formData.addressStreet
          ? {
              street: formData.addressStreet.trim(),
              city: formData.addressCity.trim(),
              state: formData.addressState.trim(),
              pincode: formData.addressPincode.trim(),
              country: formData.addressCountry,
            }
          : undefined,
        tags: formData.selectedTags,
        feeExempt: formData.feeExempt,
        feeExemptionReason: formData.feeExempt ? formData.feeExemptionReason : undefined,
        privacySettings: {
          hideMentalSymptoms: false,
          hideDiagnosis: false,
          hidePrognosis: false,
          hideFees: false,
          hideCaseNotes: false,
        },
        medicalHistory: formData.medicalHistory
          ? formData.medicalHistory.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        allergies: formData.allergies
          ? formData.allergies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        createdBy: "current-user",
      };

      const newPatient = patientDb.create(patient) as Patient;

      if (bookAppointment) {
        // Navigate to appointments page with patient data pre-filled
        const params = new URLSearchParams({
          patientId: newPatient.id,
          patientName: newPatient.fullName,
          patientPhone: newPatient.mobileNumber,
        });
        router.push(`/appointments/new?${params.toString()}`);
      } else {
        router.push(`/patients/${newPatient.id}`);
      }
    } catch (error) {
      console.error("Error creating patient:", error);
      alert("Failed to create patient. Please try again.");
    } finally {
      setLoading(false);
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
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">New Patient</h1>
              <p className="text-sm text-gray-500 mt-1">
                Register a new patient in the system
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => handleRegisterAndBookAppointment(e, false)} className="p-6 max-w-4xl mx-auto">
          {/* Duplicate Warning */}
          {showDuplicateWarning && (
            <Card className="mb-6 p-4 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-800">
                    Possible Duplicate Patient Found
                  </h3>
                  <div className="mt-2 space-y-2">
                    {duplicatePatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="text-sm text-amber-700 flex items-center justify-between"
                      >
                        <span>
                          {patient.fullName} ({patient.registrationNumber}) - {patient.mobileNumber}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/patients/${patient.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-amber-600">
                    This patient may already exist. Please verify before creating a new record.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-6">
            {/* Profile Photo */}
            <Card className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h2>
              <div className="flex justify-center">
                <PhotoUpload
                  currentPhotoUrl={formData.photoUrl}
                  onPhotoUploaded={(url) => setFormData((prev) => ({ ...prev, photoUrl: url }))}
                  patientName={`${formData.firstName} ${formData.lastName}`.trim() || "Patient"}
                />
              </div>
            </Card>

            {/* Registration Number (Auto-generated) */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div>
                <span className="text-sm font-medium text-blue-700">Registration Number</span>
                <p className="text-xs text-blue-500 mt-0.5">Auto-generated on save</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-blue-800 font-mono">Pending...</span>
              </div>
            </div>

            {/* Basic Information */}
            <Card className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name with Salutation */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="flex">
                    <select
                      name="salutation"
                      value={formData.salutation}
                      onChange={handleInputChange}
                      className="px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-700"
                      style={{ minWidth: '80px' }}
                    >
                      <option value="">Select</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Shri">Shri</option>
                      <option value="Master">Master</option>
                      <option value="Baby">Baby</option>
                      <option value="Smt">Smt</option>
                      <option value="Kumari">Kumari</option>
                    </select>
                    <div className="w-px bg-gray-300 mx-0"></div>
                    <Input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className="rounded-none border-l-0"
                      style={{ flex: 1 }}
                      required
                    />
                    <div className="w-px bg-gray-300 mx-0"></div>
                    <Input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className="rounded-r-lg border-l-0"
                      style={{ flex: 1 }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="Enter age in years"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    disabled={!!formData.age}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alternate Mobile
                  </label>
                  <Input
                    type="tel"
                    name="alternateMobile"
                    value={formData.alternateMobile}
                    onChange={handleInputChange}
                    placeholder="+91-XXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@example.com"
                  />
                </div>
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
                    <option value="">Select blood group</option>
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
              </div>
            </Card>

            {/* Address - Collapsible */}
            <CollapsibleSection
              title="Address"
              isOpen={addressExpanded}
              onToggle={() => setAddressExpanded(!addressExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <Input
                    name="addressStreet"
                    value={formData.addressStreet}
                    onChange={handleInputChange}
                    placeholder="House/Flat number, Street name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <Input
                    name="addressCity"
                    value={formData.addressCity}
                    onChange={handleInputChange}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <Input
                    name="addressState"
                    value={formData.addressState}
                    onChange={handleInputChange}
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIN Code
                  </label>
                  <Input
                    name="addressPincode"
                    value={formData.addressPincode}
                    onChange={handleInputChange}
                    placeholder="PIN Code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <Input
                    name="addressCountry"
                    value={formData.addressCountry}
                    onChange={handleInputChange}
                    placeholder="Country"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Additional Information - Collapsible */}
            <CollapsibleSection
              title="Additional Information"
              isOpen={additionalExpanded}
              onToggle={() => setAdditionalExpanded(!additionalExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Occupation
                  </label>
                  <Input
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInputChange}
                    placeholder="e.g., Engineer, Teacher"
                  />
                </div>
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
                    <option value="">Select status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Religion
                  </label>
                  <Input
                    name="religion"
                    value={formData.religion}
                    onChange={handleInputChange}
                    placeholder="e.g., Hindu, Muslim, Christian"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referred By
                  </label>
                  <Input
                    name="referredBy"
                    value={formData.referredBy}
                    onChange={handleInputChange}
                    placeholder="e.g., Dr. Smith, Friend"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Medical Information - Collapsible */}
            <CollapsibleSection
              title="Medical Information"
              isOpen={medicalExpanded}
              onToggle={() => setMedicalExpanded(!medicalExpanded)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical History
                  </label>
                  <textarea
                    name="medicalHistory"
                    value={formData.medicalHistory}
                    onChange={(e) => handleInputChange(e as React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>)}
                    placeholder="Previous illnesses, surgeries, chronic conditions (comma-separated)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] resize-y"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allergies
                  </label>
                  <textarea
                    name="allergies"
                    value={formData.allergies}
                    onChange={(e) => handleInputChange(e as React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>)}
                    placeholder="Known allergies to medicines, foods, or other substances (comma-separated)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] resize-y"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Patient Tags */}
            {tags.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Patient Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        formData.selectedTags.includes(tag.id)
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Fee Exemption */}
            <Card className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Fee Settings</h2>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="feeExempt"
                  id="feeExempt"
                  checked={formData.feeExempt}
                  onChange={(e) => handleInputChange(e as React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="feeExempt" className="text-sm font-medium text-gray-700">
                  Exempt from consultation fees
                </label>
              </div>
              {formData.feeExempt && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fee Exemption Reason
                  </label>
                  <Input
                    name="feeExemptionReason"
                    value={formData.feeExemptionReason}
                    onChange={handleInputChange}
                    placeholder="Reason for fee exemption"
                  />
                </div>
              )}
            </Card>

            {/* Submit Button */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 -mx-6 -mb-6 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => handleRegisterAndBookAppointment(e as React.FormEvent, true)}
                loading={loading}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Register & Book Appointment
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
              >
                Register Patient
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
