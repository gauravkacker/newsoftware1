"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { patientDb, patientTagDb, visitDb, feeHistoryDb } from "@/lib/db/database";
import type { Patient, PatientTag } from "@/types";

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

export default function PatientsPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all'>('selected');

  const loadData = () => {
    setIsLoading(true);
    const allPatients = patientDb.getAll() as Patient[];
    const allTags = patientTagDb.getAll() as PatientTag[];
    setPatients(allPatients);
    setTags(allTags);
    setIsLoading(false);
  };

  // Load patients on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadData();
  }, []);

  // Filter patients based on search
  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    return (
      patient.registrationNumber.toLowerCase().includes(query) ||
      patient.firstName.toLowerCase().includes(query) ||
      patient.lastName.toLowerCase().includes(query) ||
      patient.fullName.toLowerCase().includes(query) ||
      patient.mobileNumber.includes(query)
    );
  });

  // Get tag by ID
  const getTagById = (tagId: string): PatientTag | undefined => {
    return tags.find((t) => t.id === tagId);
  };

  // Get last visit info
  const getLastVisitInfo = (patientId: string): { date: Date | null; mode: string } => {
    const visits = visitDb.getByPatient(patientId) as Array<{ visitDate: Date; mode: string }>;
    if (visits.length === 0) return { date: null, mode: "" };
    return { date: visits[0].visitDate, mode: visits[0].mode };
  };

  // Get last fee info
  const getLastFeeInfo = (patientId: string): { amount: number; date: Date | null; daysAgo: number } => {
    const lastFee = feeHistoryDb.getLastByPatient(patientId);
    if (!lastFee) return { amount: 0, date: null, daysAgo: 0 };
    
    const lastFeeTyped = lastFee as { amount: number; paidDate: Date };
    const daysAgo = Math.floor(
      (new Date().getTime() - new Date(lastFeeTyped.paidDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      amount: lastFeeTyped.amount,
      date: lastFeeTyped.paidDate,
      daysAgo,
    };
  };

  // Handle patient click
  const handlePatientClick = (patientId: string) => {
    router.push(`/patients/${patientId}`);
  };

  // Handle add new patient
  const handleAddPatient = () => {
    router.push("/patients/new");
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectedIds((prev) => (prev.size > 0 ? new Set() : new Set()));
  };

  // Toggle single patient selection
  const togglePatientSelection = (patientId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  // Select/deselect all visible patients
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((p) => p.id)));
    }
  };

  // Delete selected patients
  const handleDeleteSelected = () => {
    setDeleteType('selected');
    setShowDeleteConfirm(true);
  };

  // Delete all patients
  const handleDeleteAll = () => {
    setDeleteType('all');
    setShowDeleteConfirm(true);
  };

  // Confirm deletion
  const confirmDelete = () => {
    if (deleteType === 'all') {
      // Delete all patients and their visits
      const allPatients = patientDb.getAll() as Patient[];
      allPatients.forEach((patient) => {
        patientDb.delete(patient.id);
      });
      setPatients([]);
    } else {
      // Delete selected patients
      selectedIds.forEach((id) => {
        patientDb.delete(id);
      });
      setPatients((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    }
    setShowDeleteConfirm(false);
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
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage patient records, history, and visits
              </p>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 ? (
                <>
                  <Button onClick={toggleSelectionMode} variant="secondary">
                    Cancel ({selectedIds.size})
                  </Button>
                  <Button onClick={handleDeleteSelected} variant="danger">
                    Delete Selected
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleDeleteAll} variant="secondary">
                    Delete All
                  </Button>
                  <Button onClick={handleAddPatient} variant="primary">
                    + Add Patient
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by Reg No, Name, or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <Button onClick={toggleSelectAll} variant="ghost" size="sm">
                  {selectedIds.size === filteredPatients.length ? 'Deselect All' : 'Select All'}
                </Button>
              ) : (
                <Button onClick={toggleSelectionMode} variant="ghost" size="sm">
                  Select Patients
                </Button>
              )}
              <span className="ml-2">
                {filteredPatients.length} patient{filteredPatients.length !== 1 ? "s" : ""} found
              </span>
            </div>
          </div>
        </div>

        {/* Patient List */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPatients.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? "Try adjusting your search criteria"
                  : "Get started by adding your first patient"}
              </p>
              {!searchQuery && (
                <Button onClick={handleAddPatient} variant="primary">
                  + Add First Patient
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPatients.map((patient) => {
                const lastVisit = getLastVisitInfo(patient.id);
                const lastFee = getLastFeeInfo(patient.id);
                
                return (
                  <Card
                    key={patient.id}
                    className={`p-4 hover:shadow-md transition-shadow ${
                      selectedIds.has(patient.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(patient.id)}
                          onChange={() => togglePatientSelection(patient.id)}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Avatar */}
                      <div
                        className="flex-shrink-0 cursor-pointer"
                        onClick={(e) => {
                          if (selectedIds.size > 0) {
                            e.stopPropagation();
                            togglePatientSelection(patient.id);
                          } else {
                            handlePatientClick(patient.id);
                          }
                        }}
                      >
                        {patient.photoUrl ? (
                          <img
                            src={patient.photoUrl}
                            alt={patient.fullName}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-lg">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {patient.fullName}
                          </h3>
                          {patient.feeExempt && (
                            <Badge variant="success" size="sm">
                              Fee Exempt
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                            </svg>
                            {patient.registrationNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {patient.age ? `${patient.age} yrs` : patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} yrs` : 'Age NS'} / {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O'}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {patient.mobileNumber}
                          </span>
                        </div>
                      </div>

                      {/* Visit & Fee Info */}
                      <div className="flex-shrink-0 text-right">
                        {lastVisit.date && (
                          <div className="text-sm">
                            <span className="text-gray-500">Last visit: </span>
                            <span className="text-gray-900">{formatDate(lastVisit.date)}</span>
                            <Badge variant="default" size="sm" className="ml-1">
                              {lastVisit.mode === 'video' ? '📹' : lastVisit.mode === 'self-repeat' ? '🔄' : '🏥'}
                            </Badge>
                          </div>
                        )}
                        {lastFee.date && (
                          <div className="text-sm mt-1">
                            <span className="text-gray-500">Last fee: </span>
                            <span className="text-gray-900">₹{lastFee.amount}</span>
                            {lastFee.daysAgo > 0 && (
                              <span className="text-gray-400"> ({lastFee.daysAgo}d ago)</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {patient.tags.length > 0 && (
                        <div className="flex-shrink-0 flex gap-1 flex-wrap max-w-32">
                          {patient.tags.slice(0, 3).map((tagId) => {
                            const tag = getTagById(tagId);
                            if (!tag) return null;
                            return (
                              <Badge
                                key={tagId}
                                className=""
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                size="sm"
                              >
                                {tag.name}
                              </Badge>
                            );
                          })}
                          {patient.tags.length > 3 && (
                            <Badge variant="default" size="sm">
                              +{patient.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {deleteType === 'all' ? 'Delete All Patients?' : 'Delete Selected Patients?'}
            </h3>
            <p className="text-gray-600 mb-6">
              {deleteType === 'all'
                ? 'This will permanently delete all patients and their data. This action cannot be undone.'
                : `This will permanently delete ${selectedIds.size} patient(s) and their data. This action cannot be undone.`}
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowDeleteConfirm(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={confirmDelete} variant="danger">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
