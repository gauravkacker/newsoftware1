"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { patientDb, visitDb, patientTagDb, feeHistoryDb, investigationDb, voiceNoteDb } from "@/lib/db/database";
import type { Patient, PatientTag, Visit, Investigation, FeeHistoryEntry } from "@/types";

// Format date helper
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Calculate age from DOB
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

type TabType = "overview" | "visits" | "prescriptions" | "fees" | "investigations";

export default function PatientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryEntry[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load patient data function
  const loadPatientData = () => {
    setIsLoading(true);
    const patientData = patientDb.getById(patientId) as Patient | undefined;
    setPatient(patientData || null);

    if (patientData) {
      const allTags = patientTagDb.getAll() as PatientTag[];
      setTags(allTags);

      const patientVisits = visitDb.getByPatient(patientId) as Visit[];
      setVisits(patientVisits);

      const patientFeeHistory = feeHistoryDb.getByPatient(patientId) as FeeHistoryEntry[];
      setFeeHistory(patientFeeHistory);

      const patientInvestigations = investigationDb.getByPatient(patientId) as Investigation[];
      setInvestigations(patientInvestigations);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPatientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Get tag by ID
  const getTagById = (tagId: string): PatientTag | undefined => {
    return tags.find((t) => t.id === tagId);
  };

  // Delete patient handler
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this patient? This action cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      patientDb.delete(patientId);
      router.push("/patients");
    } catch (error) {
      console.error("Error deleting patient:", error);
      alert("Failed to delete patient. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = (photoUrl: string) => {
    if (patient) {
      const updatedPatient = { ...patient, photoUrl, updatedAt: new Date() };
      patientDb.update(patientId, updatedPatient);
      setPatient(updatedPatient);
    }
  };

  // Get tag name by ID
  const getTagName = (tagId: string): string => {
    const tag = getTagById(tagId);
    return tag?.name || tagId;
  };

  // Calculate age - prefer patient.age, fallback to dateOfBirth
  const displayAge = (): string => {
    if (patient && patient.age && patient.age > 0) {
      return `${patient.age} yrs`;
    }
    if (patient && patient.dateOfBirth) {
      const age = calculateAge(patient.dateOfBirth);
      return age > 0 ? `${age} yrs` : 'Age not specified';
    }
    return 'Age not specified';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!patient) {
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
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <Header title={patient?.fullName || "Patient"} subtitle={`Registration: ${patient?.registrationNumber || ''}`} />
        
        <main className="p-6">
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
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {/* Avatar with Photo Upload */}
                  <div className="relative">
                    <PhotoUpload
                      currentPhotoUrl={patient?.photoUrl}
                      onPhotoUploaded={handlePhotoUpload}
                      patientName={patient?.fullName || "Patient"}
                    />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{patient?.fullName}</h1>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span>{patient?.registrationNumber}</span>
                      <span>•</span>
                      <span>{displayAge()}</span>
                      <span>•</span>
                      <span className="capitalize">{patient?.gender}</span>
                      {patient?.feeExempt && (
                        <>
                          <span>•</span>
                          <Badge variant="success" size="sm">Fee Exempt</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => router.push(`/patients/${patientId}/edit`)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={handleDelete} loading={deleting}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => router.push(`/patients/${patientId}/visits/new`)}>
                  New Visit
                </Button>
              </div>
            </div>

            {/* Tags */}
            {patient?.tags && patient.tags.length > 0 && (
              <div className="mt-4 flex gap-2">
                {patient.tags.map((tagId) => {
                  const tag = getTagById(tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      style={{ backgroundColor: tag.color + '20', color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Tabs */}
            <div className="mt-4 flex gap-1 border-b border-gray-200 -mb-px">
              {[
                { id: "overview", label: "Overview" },
                { id: "visits", label: "Visits" },
                { id: "prescriptions", label: "Prescriptions" },
                { id: "fees", label: "Fees" },
                { id: "investigations", label: "Investigations" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab.id
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="mt-6">
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Contact Information */}
                <Card className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm text-gray-500">Mobile</dt>
                      <dd className="text-gray-900">{patient.mobileNumber}</dd>
                    </div>
                    {patient.alternateMobile && (
                      <div>
                        <dt className="text-sm text-gray-500">Alternate Mobile</dt>
                        <dd className="text-gray-900">{patient.alternateMobile}</dd>
                      </div>
                    )}
                    {patient.email && (
                      <div>
                        <dt className="text-sm text-gray-500">Email</dt>
                        <dd className="text-gray-900">{patient.email}</dd>
                      </div>
                    )}
                    {patient.address && (
                      <div>
                        <dt className="text-sm text-gray-500">Address</dt>
                        <dd className="text-gray-900">
                          {patient.address.street}<br />
                          {patient.address.city}, {patient.address.state} {patient.address.pincode}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>

                {/* Personal Information */}
                <Card className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm text-gray-500">Age</dt>
                      <dd className="text-gray-900">{displayAge()}</dd>
                    </div>
                    {patient.bloodGroup && (
                      <div>
                        <dt className="text-sm text-gray-500">Blood Group</dt>
                        <dd className="text-gray-900">{patient.bloodGroup}</dd>
                      </div>
                    )}
                    {patient.occupation && (
                      <div>
                        <dt className="text-sm text-gray-500">Occupation</dt>
                        <dd className="text-gray-900">{patient.occupation}</dd>
                      </div>
                    )}
                    {patient.maritalStatus && (
                      <div>
                        <dt className="text-sm text-gray-500">Marital Status</dt>
                        <dd className="text-gray-900 capitalize">{patient.maritalStatus}</dd>
                      </div>
                    )}
                    {patient.referredBy && (
                      <div>
                        <dt className="text-sm text-gray-500">Referred By</dt>
                        <dd className="text-gray-900">{patient.referredBy}</dd>
                      </div>
                    )}
                  </dl>
                </Card>

                {/* Medical Information */}
                <Card className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Medical Information</h2>
                  <dl className="space-y-3">
                    {patient.medicalHistory && patient.medicalHistory.length > 0 && (
                      <div>
                        <dt className="text-sm text-gray-500">Medical History</dt>
                        <dd className="flex flex-wrap gap-1 mt-1">
                          {patient.medicalHistory.map((item, i) => (
                            <Badge key={i} variant="default">{item}</Badge>
                          ))}
                        </dd>
                      </div>
                    )}
                    {patient.allergies && patient.allergies.length > 0 && (
                      <div>
                        <dt className="text-sm text-gray-500">Allergies</dt>
                        <dd className="flex flex-wrap gap-1 mt-1">
                          {patient.allergies.map((item, i) => (
                            <Badge key={i} variant="danger">{item}</Badge>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>

                {/* Visit Summary */}
                <Card className="p-6 lg:col-span-2">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Visit Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">{visits.length}</div>
                      <div className="text-sm text-gray-500">Total Visits</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {visits.filter((v) => v.mode === "video").length}
                      </div>
                      <div className="text-sm text-gray-500">Video Consults</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {visits.filter((v) => v.isSelfRepeat).length}
                      </div>
                      <div className="text-sm text-gray-500">Self-Repeats</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {visits.length > 0 ? formatDate(visits[0].visitDate) : "N/A"}
                      </div>
                      <div className="text-sm text-gray-500">Last Visit</div>
                    </div>
                  </div>
                </Card>

                {/* Fee Summary */}
                <Card className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Fee Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Paid</span>
                      <span className="font-medium">
                        ₹{feeHistory.reduce((sum, f) => sum + (f.paymentStatus === 'paid' ? f.amount : 0), 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Payment</span>
                      <span className="font-medium">
                        {feeHistory.length > 0 ? formatDate(feeHistory[0].paidDate) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <Badge variant={patient.feeExempt ? "success" : "default"}>
                        {patient.feeExempt ? "Exempt" : "Regular"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "visits" && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mode
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Complaint
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {visits.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No visits recorded yet
                          </td>
                        </tr>
                      ) : (
                        visits.map((visit) => (
                          <tr key={visit.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatDate(visit.visitDate)}</div>
                              <div className="text-sm text-gray-500">{visit.visitTime}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{visit.doctorName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant="default">
                                {visit.mode === "video" ? "📹 Video" : visit.mode === "self-repeat" ? "🔄 Self-Repeat" : "🏥 In-Person"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 truncate max-w-xs">
                                {visit.chiefComplaint || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={visit.status === "completed" ? "success" : visit.status === "cancelled" ? "danger" : "default"}
                              >
                                {visit.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "prescriptions" && (
              <Card className="p-6 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Prescriptions Yet</h3>
                <p className="text-gray-500">
                  Prescriptions will appear here after the first visit.
                </p>
              </Card>
            )}

            {activeTab === "fees" && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {feeHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No fee history recorded yet
                          </td>
                        </tr>
                      ) : (
                        feeHistory.map((fee) => (
                          <tr key={fee.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(fee.paidDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                              {fee.feeType.replace("-", " ")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₹{fee.amount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                              {fee.paymentMethod}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={fee.paymentStatus === "paid" ? "success" : fee.paymentStatus === "pending" ? "warning" : "danger"}
                              >
                                {fee.paymentStatus}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "investigations" && (
              <Card className="p-6 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Investigations Yet</h3>
                <p className="text-gray-500 mb-4">
                  Lab reports and investigations can be uploaded here.
                </p>
                <Button variant="ghost">
                  Upload Investigation
                </Button>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
