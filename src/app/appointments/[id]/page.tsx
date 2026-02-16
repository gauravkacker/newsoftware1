"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { appointmentDb, patientDb, slotDb, feeHistoryDb } from "@/lib/db/database";
import type { Appointment, Patient, Slot, FeeType } from "@/types";

export default function AppointmentDetailPage() {
  const params = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    setIsLoading(true);
    const id = params.id as string;
    const apt = appointmentDb.getById(id) as Appointment | undefined;
    
    if (apt) {
      setAppointment(apt);
      const p = patientDb.getById(apt.patientId) as Patient | undefined;
      setPatient(p || null);
      
      if (apt.slotId) {
        const s = slotDb.getById(apt.slotId) as Slot | undefined;
        setSlot(s || null);
      }
    }
    setIsLoading(false);
  }, [params.id]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const getPatientName = (): string => {
    if (!patient) return "Unknown Patient";
    const p = patient as { firstName: string; lastName: string };
    return `${p.firstName} ${p.lastName}`;
  };

  const getPatientRegNo = (): string => {
    if (!patient) return "N/A";
    const p = patient as { registrationNumber: string };
    return p.registrationNumber;
  };

  const getPatientMobile = (): string => {
    if (!patient) return "N/A";
    const p = patient as { mobileNumber: string };
    return p.mobileNumber;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string): "success" | "warning" | "danger" | "default" | "info" => {
    switch (status) {
      case "scheduled": return "info";
      case "confirmed": return "success";
      case "checked-in": return "warning";
      case "in-progress": return "warning";
      case "completed": return "success";
      case "cancelled": return "danger";
      case "no-show": return "danger";
      default: return "default";
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "emergency": return "bg-red-100 text-red-800 border-red-300";
      case "vip": return "bg-purple-100 text-purple-800 border-purple-300";
      case "doctor-priority": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
          <div className="p-8">
            <Card className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Appointment Not Found</h2>
              <p className="text-gray-500 mb-4">The appointment you&apos;re looking for doesn&apos;t exist.</p>
              <Link href="/appointments">
                <Button variant="primary">Back to Appointments</Button>
              </Link>
            </Card>
          </div>
        </div>
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
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/appointments" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Appointment Details</h1>
              <p className="text-sm text-gray-500">View appointment information</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/queue`}>
                <Button variant="secondary">Queue View</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Token Number Display */}
          <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Token Number</p>
                <div className="text-5xl font-bold mt-1">#{appointment.tokenNumber}</div>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm">{formatDate(appointment.appointmentDate)}</p>
                <p className="text-2xl font-semibold">{appointment.appointmentTime}</p>
              </div>
            </div>
          </Card>

          {/* Patient Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Patient Name</p>
                <p className="font-medium text-gray-900">{getPatientName()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Registration Number</p>
                <p className="font-medium text-gray-900">{getPatientRegNo()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mobile Number</p>
                <p className="font-medium text-gray-900">{getPatientMobile()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Appointment Type</p>
                <p className="font-medium text-gray-900 capitalize">{appointment.type.replace("-", " ")}</p>
              </div>
            </div>
          </Card>

          {/* Appointment Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Appointment Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Slot</p>
                <p className="font-medium text-gray-900">{appointment.slotName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium text-gray-900">{appointment.duration} minutes</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Visit Mode</p>
                <p className="font-medium text-gray-900 capitalize">{appointment.visitMode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(appointment.priority)}`}>
                  {appointment.priority.replace("-", " ").toUpperCase()}
                </span>
              </div>
            </div>
            {appointment.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-gray-700 mt-1">{appointment.notes}</p>
              </div>
            )}
          </Card>

          {/* Fee Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fee Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Fee Type</p>
                <p className="font-medium text-gray-900">{appointment.feeType || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Fee</p>
                <p className="font-medium text-gray-900">₹{appointment.feeAmount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Advance Paid</p>
                <p className="font-medium text-green-600">₹{appointment.advancePaid || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance</p>
                <p className="font-medium text-gray-900">₹{(appointment.feeAmount || 0) - (appointment.advancePaid || 0)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={getStatusColor(appointment.status)} className="mt-1">
                {appointment.status.replace("-", " ").toUpperCase()}
              </Badge>
              {appointment.feeStatus === "exempt" && (
                <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  FEE EXEMPT
                </span>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            {["scheduled", "confirmed"].includes(appointment.status) && (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    appointmentDb.checkIn(appointment.id);
                    loadData();
                  }}
                >
                  Check In
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm("Cancel this appointment?")) {
                      appointmentDb.cancel(appointment.id, "Cancelled by staff");
                      loadData();
                    }
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
            <Link href={`/patients/${appointment.patientId}`}>
              <Button variant="secondary">View Patient Profile</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
