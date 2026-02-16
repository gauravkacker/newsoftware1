"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { appointmentDb, patientDb, slotDb } from "@/lib/db/database";
import type { Appointment, Slot } from "@/types";

export default function AppointmentsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split("T")[0]);
  const [slotFilter, setSlotFilter] = useState<string>("all");

  const loadAppointments = useCallback(() => {
    setIsLoading(true);
    
    // Load slots for filter
    const allSlots = slotDb.getActive() as Slot[];
    setSlots(allSlots);
    
    const allAppointments = appointmentDb.getAll() as Appointment[];
    
    // Filter by date if selected
    let filtered = dateFilter
      ? allAppointments.filter((a: Appointment) => {
          const aptDate = new Date(a.appointmentDate).toISOString().split("T")[0];
          return aptDate === dateFilter;
        })
      : allAppointments;
    
    // Filter by slot if selected
    if (slotFilter !== "all") {
      filtered = filtered.filter((a: Appointment) => a.slotId === slotFilter);
    }
    
    const sortedAppointments = filtered.sort((a, b) => {
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });
    
    setAppointments(sortedAppointments);
    setIsLoading(false);
  }, [dateFilter, slotFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadAppointments();
  }, [loadAppointments]);

  const getPatientName = (patientId: string): string => {
    const patient = patientDb.getById(patientId);
    if (patient) {
      const p = patient as { firstName: string; lastName: string };
      return `${p.firstName} ${p.lastName}`;
    }
    return "Unknown Patient";
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string): "success" | "warning" | "danger" | "default" | "info" => {
    switch (status) {
      case "scheduled":
        return "info";
      case "confirmed":
        return "success";
      case "checked-in":
        return "warning";
      case "in-progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      case "no-show":
        return "danger";
      default:
        return "default";
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "follow-up":
        return "bg-green-100 text-green-800";
      case "consultation":
        return "bg-purple-100 text-purple-800";
      case "emergency":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "emergency":
        return "bg-red-100 text-red-800 border-red-300";
      case "vip":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "doctor-priority":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter !== "all" && apt.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleCheckIn = (appointmentId: string) => {
    appointmentDb.checkIn(appointmentId);
    loadAppointments();
  };

  const handleCancel = (appointmentId: string) => {
    if (confirm("Cancel this appointment?")) {
      appointmentDb.cancel(appointmentId, "Cancelled by staff");
      loadAppointments();
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
              <h1 className="text-2xl font-semibold text-gray-900">Appointments</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage patient appointments and queue
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/queue">
                <Button variant="secondary">Queue View</Button>
              </Link>
              <Link href="/appointments/new">
                <Button variant="primary">Book Appointment</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slot</label>
                <select
                  value={slotFilter}
                  onChange={(e) => setSlotFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Slots</option>
                  {slots.map((slot) => {
                    const s = slot as Slot;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <Button
                  variant={filter === "all" ? "primary" : "secondary"}
                  onClick={() => {
                    setFilter("all");
                    setDateFilter("");
                  }}
                >
                  All
                </Button>
                <Button
                  variant={filter === "upcoming" ? "primary" : "secondary"}
                  onClick={() => {
                    setFilter("upcoming");
                    setDateFilter(new Date().toISOString().split("T")[0]);
                  }}
                >
                  Today
                </Button>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked In</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No Show</option>
              </select>
            </div>
          </div>

          {/* Appointments List */}
          {filteredAppointments.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-500 mb-4">
                {dateFilter ? "No appointments for this date" : "Get started by booking an appointment"}
              </p>
              <Link href="/appointments/new">
                <Button variant="primary">Book Appointment</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center bg-blue-50 rounded-lg p-3 min-w-[80px] border-2 border-blue-200">
                        <div className="text-xs text-blue-600 font-medium">Token</div>
                        <div className="text-3xl font-bold text-blue-700">
                          {appointment.tokenNumber || "-"}
                        </div>
                      </div>
                      <div className="text-center bg-gray-100 rounded-lg p-3 min-w-[80px]">
                        <div className="text-sm text-gray-500">
                          {formatDate(appointment.appointmentDate).split(",")[0]}
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {new Date(appointment.appointmentDate).getDate()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(appointment.appointmentDate).split(",")[1]}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {getPatientName(appointment.patientId)}
                          </h3>
                          {appointment.priority !== "normal" && (
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getPriorityColor(appointment.priority)}`}>
                              {appointment.priority.replace("-", " ").toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {appointment.appointmentTime} • {appointment.duration} min
                          {appointment.slotName && ` • ${appointment.slotName}`}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(appointment.type)}`}>
                            {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)}
                          </span>
                          <Badge variant={getStatusColor(appointment.status)}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </Badge>
                          {appointment.visitMode === "tele" && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Teleconsultation
                            </span>
                          )}
                          {/* Fee Status Badge */}
                          {appointment.feeStatus === "pending" && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Fee Pending
                            </span>
                          )}
                          {appointment.feeStatus === "paid" && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Fee Paid
                            </span>
                          )}
                          {appointment.feeStatus === "exempt" && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Fee Exempt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {["scheduled", "confirmed", "checked-in"].includes(appointment.status) && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleCheckIn(appointment.id)}
                          >
                            Check In
                          </Button>
                          <Link href={`/doctor-panel?patientId=${appointment.patientId}`}>
                            <Button variant="primary" size="sm">
                              Case Taking
                            </Button>
                          </Link>
                        </>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancel(appointment.id)}
                      >
                        Cancel
                      </Button>
                      <Link href={`/appointments/${appointment.id}`}>
                        <Button variant="secondary" size="sm">View</Button>
                      </Link>
                    </div>
                  </div>
                  {appointment.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600">{appointment.notes}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
