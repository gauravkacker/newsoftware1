"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { appointmentDb, patientDb, slotDb } from "@/lib/db/database";
import { doctorSettingsDb } from "@/lib/db/doctor-panel";
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
    
    // Filter out appointments for deleted patients
    const validAppointments = allAppointments.filter((apt) => {
      const patient = patientDb.getById(apt.patientId);
      return patient !== undefined && patient !== null;
    });
    
    // Filter by date if selected
    let filtered = dateFilter
      ? validAppointments.filter((a: Appointment) => {
          const aptDate = new Date(a.appointmentDate).toISOString().split("T")[0];
          return aptDate === dateFilter;
        })
      : validAppointments;
    
    // Filter by slot if selected
    if (slotFilter !== "all") {
      filtered = filtered.filter((a: Appointment) => a.slotId === slotFilter);
    }
    
    const sortedAppointments = filtered.sort((a, b) => {
      // Sort by date first (newest first), then by time
      const dateCompare = new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime();
      if (dateCompare !== 0) return dateCompare;
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
      case "sent-to-pharmacy":
        return "info";
      case "medicines-prepared":
        return "success";
      case "billed":
        return "info";
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

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "in-progress":
        return "Case Taking";
      case "sent-to-pharmacy":
        return "Sent to Pharmacy";
      case "medicines-prepared":
        return "Medicines Prepared";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
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
    if (statusFilter === "all" && apt.status === "cancelled") {
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
 
  const formatTime12h = (time: string): string => {
    if (!time) return "";
    const [h, m] = time.split(":").map((v) => parseInt(v, 10));
    const hour = ((h % 12) || 12).toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour}:${`${m}`.padStart(2, "0")} ${ampm}`;
  };
  
  const handlePrintToken = (appointment: Appointment) => {
    const patient = patientDb.getById(appointment.patientId) as any;
    
    // Load print settings from the unified printSettings key
    let tokenNote = "";
    try {
      const raw = doctorSettingsDb.get("printSettings");
      if (raw) {
        const parsed = JSON.parse(raw as string);
        tokenNote = parsed.tokenNote || "";
      }
    } catch {}
    
    const token = (appointment.tokenNumber as any) || "-";
    const name = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown";
    const reg = patient ? patient.registrationNumber : "";
    const mobile = patient ? patient.mobileNumber : "";
    const session = appointment.slotName || (appointment.slotId ? ((slotDb.getById(appointment.slotId) as any)?.name || "") : "");
    const time = appointment.appointmentTime ? formatTime12h(appointment.appointmentTime) : "";
    
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Token</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .ticket { width: 280px; padding: 12px; }
            .header { text-align: center; margin-bottom: 8px; }
            .row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 12px; margin-bottom: 4px; }
            .left { text-align: left; }
            .right { text-align: right; }
            .label { font-weight: 600; }
            .patient { font-size: 12px; line-height: 1.4; margin-bottom: 8px; }
            .token { text-align: center; font-size: 48px; font-weight: bold; margin: 8px 0; }
            .time { text-align: center; font-size: 14px; margin-bottom: 8px; }
            .footer { border-top: 1px dashed #999; padding-top: 6px; font-size: 11px; text-align: center; white-space: pre-wrap; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 300);">
          <div class="ticket">
            <div class="header"><strong>Appointment Token</strong></div>
            <div class="row">
              <div class="left"><span class="label">${name}</span></div>
              ${reg ? `<div class="right">Reg: ${reg}</div>` : `<div></div>`}
            </div>
            <div class="row">
              ${mobile ? `<div class="left">Mob: ${mobile}</div>` : `<div></div>`}
              ${session ? `<div class="right">${session}</div>` : `<div></div>`}
            </div>
            <div class="token">${token}</div>
            ${time ? `<div class="time">Appointment time - ${time}</div>` : ``}
            ${tokenNote ? `<div class="footer">${tokenNote}</div>` : ``}
          </div>
        </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=320,height=480");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
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
                <option value="medicines-prepared">Medicines Prepared</option>
                <option value="billed">Billed</option>
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
            <div className="space-y-2">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="p-2">
                  <div className="flex items-center gap-3">
                    {/* Token Number - Compact */}
                    <div className="text-center bg-blue-50 rounded px-2 py-1 min-w-[50px] border border-blue-200">
                      <div className="text-[10px] text-blue-600 font-medium leading-tight">Token</div>
                      <div className="text-xl font-bold text-blue-700 leading-tight">{appointment.tokenNumber || "-"}</div>
                    </div>
                    
                    {/* Date - Compact */}
                    <div className="text-center bg-gray-100 rounded px-2 py-1 min-w-[60px]">
                      <div className="text-[10px] text-gray-500 leading-tight">
                        {formatDate(appointment.appointmentDate).split(",")[0]}
                      </div>
                      <div className="text-lg font-bold text-gray-900 leading-tight">
                        {new Date(appointment.appointmentDate).getDate()}
                      </div>
                    </div>
                    
                    {/* Patient Info - Using full width efficiently */}
                    <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                      {/* Column 1: Patient Name & Priority (3 cols) */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm text-gray-900 truncate">
                            {getPatientName(appointment.patientId)}
                          </h3>
                          {appointment.priority !== "normal" && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${getPriorityColor(appointment.priority)}`}>
                              {appointment.priority === "vip" ? "VIP" : appointment.priority === "emergency" ? "EMERGENCY" : "DR PRIORITY"}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Column 2: Contact Info (3 cols) */}
                      <div className="col-span-3 text-xs text-gray-600">
                        {(() => {
                          const patient = patientDb.getById(appointment.patientId) as any;
                          return patient ? (
                            <div className="space-y-0.5">
                              <div>Regd No: {patient.registrationNumber}</div>
                              <div>Mob No: {patient.mobileNumber}</div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      
                      {/* Column 3: Appointment Details (2 cols) */}
                      <div className="col-span-2 text-xs text-gray-600">
                        <div className="space-y-0.5">
                          <div>{appointment.appointmentTime}</div>
                          <div>{appointment.duration} min</div>
                          {appointment.slotName && <div>{appointment.slotName}</div>}
                        </div>
                      </div>
                      
                      {/* Column 4: Badges (4 cols) */}
                      <div className="col-span-4 flex flex-wrap gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${getTypeColor(appointment.type)}`}>
                          {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)}
                        </span>
                        <Badge variant={getStatusColor(appointment.status)} size="sm" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                          {getStatusLabel(appointment.status)}
                        </Badge>
                        {appointment.visitMode === "tele" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                            Teleconsultation
                          </span>
                        )}
                        {/* Fee Status Badge */}
                        {((appointment as any).isFreeFollowUp) ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                            Free Follow Up
                          </span>
                        ) : (
                          <>
                            {appointment.feeStatus === "pending" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                Fee Pending
                              </span>
                            )}
                            {appointment.feeStatus === "paid" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 whitespace-nowrap">
                                Fee Paid
                              </span>
                            )}
                            {appointment.feeStatus === "exempt" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 whitespace-nowrap">
                                Fee Exempt
                              </span>
                            )}
                          </>
                        )}
                        {appointment.notes && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 truncate max-w-[200px]" title={appointment.notes}>
                            Note: {appointment.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions - Compact but visible */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {["scheduled", "confirmed", "checked-in"].includes(appointment.status) && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleCheckIn(appointment.id)}
                            className="text-xs px-2 py-1 whitespace-nowrap"
                          >
                            Check In
                          </Button>
                          <Link href={`/doctor-panel?patientId=${appointment.patientId}`}>
                            <Button variant="primary" size="sm" className="text-xs px-2 py-1 whitespace-nowrap">
                              Case Taking
                            </Button>
                          </Link>
                        </>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancel(appointment.id)}
                        className="text-xs px-2 py-1 whitespace-nowrap"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePrintToken(appointment)}
                        title="Print Token"
                        className="px-2 py-1 text-xs whitespace-nowrap flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Token
                      </Button>
                      <Link href={`/appointments/${appointment.id}`}>
                        <Button variant="secondary" size="sm" className="text-xs px-2 py-1 whitespace-nowrap">View</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
