"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { queueDb, queueItemDb, appointmentDb, slotDb, patientDb } from "@/lib/db/database";
import type { QueueItem, QueueConfig, Slot, Appointment } from "@/types";

export default function QueuePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [queueConfig, setQueueConfig] = useState<QueueConfig | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [checkedInAppointments, setCheckedInAppointments] = useState<Appointment[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate] = useState(new Date().toISOString().split("T")[0]);

  const loadQueue = useCallback(() => {
    setIsLoading(true);
    const today = new Date();
    const activeSlots = slotDb.getActive() as Slot[];
    setSlots(activeSlots);

    // Auto-select first active slot or default
    if (!selectedSlot && activeSlots.length > 0) {
      setSelectedSlot(activeSlots[0].id);
      return; // Will trigger useEffect with new selectedSlot
    }

    if (selectedSlot) {
      const slot = slotDb.getById(selectedSlot) as Slot | undefined;
      if (slot) {
        const config = queueDb.getOrCreate(today, selectedSlot, slot.name) as QueueConfig;
        setQueueConfig(config);

        const items = queueItemDb.getByQueueConfig(config.id) as QueueItem[];
        setQueueItems(items);

        // Get all appointments for today and this slot
        const allAppointments = appointmentDb.getAll() as Appointment[];
        const todayDate = today.toISOString().split("T")[0];
        
        const todaySlotAppointments = allAppointments.filter((apt: Appointment) => {
          const aptDate = new Date(apt.appointmentDate).toISOString().split("T")[0];
          return aptDate === todayDate && apt.slotId === selectedSlot;
        });

        // Separate checked-in and scheduled
        const checked = todaySlotAppointments.filter((apt: Appointment) => 
          ["checked-in", "in-consultation"].includes(apt.status)
        );
        const scheduled = todaySlotAppointments.filter((apt: Appointment) => 
          ["scheduled", "confirmed"].includes(apt.status)
        );

        setCheckedInAppointments(checked);
        setScheduledAppointments(scheduled);
      }
    }
    setIsLoading(false);
  }, [selectedSlot]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadQueue();
  }, [loadQueue]);

  const getPatientName = (patientId: string): string => {
    const patient = patientDb.getById(patientId);
    if (patient) {
      const p = patient as { firstName: string; lastName: string };
      return `${p.firstName} ${p.lastName}`;
    }
    return "Unknown";
  };

  const getPatientRegNumber = (patientId: string): string => {
    const patient = patientDb.getById(patientId);
    if (patient) {
      const p = patient as { registrationNumber: string };
      return p.registrationNumber || "";
    }
    return "";
  };

  const handleCheckInFromQueue = (appointmentId: string) => {
    appointmentDb.checkIn(appointmentId);
    loadQueue();
  };

  const handleOpenQueue = () => {
    if (queueConfig) {
      queueDb.open(queueConfig.id);
      loadQueue();
    }
  };

  const handleCloseQueue = () => {
    if (queueConfig) {
      queueDb.close(queueConfig.id);
      loadQueue();
    }
  };

  const handlePauseQueue = () => {
    if (queueConfig) {
      queueDb.pause(queueConfig.id);
      loadQueue();
    }
  };

  const handleResumeQueue = () => {
    if (queueConfig) {
      queueDb.resume(queueConfig.id);
      loadQueue();
    }
  };

  const handleCallPatient = (itemId: string) => {
    queueItemDb.call(itemId);
    loadQueue();
  };

  const handleCompleteConsultation = (itemId: string) => {
    queueItemDb.complete(itemId);
    if (queueConfig) {
      queueDb.incrementCompleted(queueConfig.id);
    }
    loadQueue();
  };

  const handleSkipPatient = (itemId: string) => {
    queueItemDb.skip(itemId);
    if (queueConfig) {
      queueDb.incrementSkipped(queueConfig.id);
    }
    loadQueue();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return <Badge variant="success">Waiting</Badge>;
      case "in-consultation":
        return <Badge variant="warning">In Consultation</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "skipped":
        return <Badge variant="danger">Skipped</Badge>;
      case "no-show":
        return <Badge variant="danger">No Show</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "emergency":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">EMERGENCY</span>;
      case "vip":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">VIP</span>;
      case "doctor-priority":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">PRIORITY</span>;
      default:
        return null;
    }
  };

  const waitingCount = queueItems.filter((i) => i.status === "waiting").length;
  const inConsultationCount = queueItems.filter((i) => i.status === "in-consultation").length;
  const completedCount = queueItems.filter((i) => i.status === "completed").length;

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
              <h1 className="text-2xl font-semibold text-gray-900">Queue Management</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(currentDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/appointments">
                <Button variant="secondary">Appointments</Button>
              </Link>
              <Link href="/queue/doctor">
                <Button variant="secondary">Doctor View</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Slot Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-4 items-center">
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {slots.map((slot) => {
                  const s = slot as Slot;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  );
                })}
              </select>

              {/* Queue Controls */}
              {queueConfig && (
                <div className="flex gap-2">
                  {queueConfig.status === "closed" && (
                    <Button onClick={handleOpenQueue}>Open Queue</Button>
                  )}
                  {queueConfig.status === "open" && (
                    <>
                      <Button variant="danger" onClick={handleCloseQueue}>Close Queue</Button>
                      <Button variant="secondary" onClick={handlePauseQueue}>Pause</Button>
                    </>
                  )}
                  {queueConfig.status === "paused" && (
                    <Button onClick={handleResumeQueue}>Resume</Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scheduled Appointments for Check-in */}
          {scheduledAppointments.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-blue-50">
                <h2 className="text-lg font-semibold text-gray-900">Scheduled Appointments - Check In</h2>
                <p className="text-sm text-gray-600">Click check-in to add patient to queue</p>
              </div>
              <div className="divide-y divide-gray-200">
                {scheduledAppointments.map((apt) => {
                  const appointment = apt as Appointment;
                  return (
                    <div key={appointment.id} className="p-4 flex items-center justify-between hover:bg-blue-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold bg-blue-100 text-blue-700">
                          {appointment.tokenNumber || "-"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {getPatientName(appointment.patientId)}
                            </span>
                            <span className="text-sm text-gray-500">
                              ({getPatientRegNumber(appointment.patientId)})
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.appointmentTime} • {appointment.type}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/patients/${appointment.patientId}`}>
                          <Button variant="secondary" size="sm">View</Button>
                        </Link>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCheckInFromQueue(appointment.id)}
                        >
                          Check In
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Queue Status</div>
              <div className="text-2xl font-bold capitalize">
                {queueConfig?.status || "N/A"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Waiting</div>
              <div className="text-2xl font-bold text-green-600">{waitingCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">In Consultation</div>
              <div className="text-2xl font-bold text-yellow-600">{inConsultationCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-gray-600">{completedCount}</div>
            </Card>
          </div>

          {/* Queue List */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Current Queue</h2>
            </div>
            {queueItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No patients in queue
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {queueItems.map((item, index) => {
                  const qItem = item as QueueItem;
                  return (
                    <div
                      key={qItem.id}
                      className={`p-4 flex items-center justify-between ${
                        qItem.status === "in-consultation" ? "bg-yellow-50" : ""
                      } ${["emergency", "vip"].includes(qItem.priority) ? "bg-red-50" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          qItem.status === "in-consultation"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}>
                          {qItem.tokenNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {getPatientName(qItem.patientId)}
                            </span>
                            {getPriorityBadge(qItem.priority)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {qItem.slotName} • Check-in: {new Date(qItem.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(qItem.status)}
                        {qItem.status === "waiting" && (
                          <Button
                            size="sm"
                            onClick={() => handleCallPatient(qItem.id)}
                          >
                            Call
                          </Button>
                        )}
                        {qItem.status === "in-consultation" && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleCompleteConsultation(qItem.id)}
                          >
                            Complete
                          </Button>
                        )}
                        {qItem.status !== "completed" && qItem.status !== "skipped" && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSkipPatient(qItem.id)}
                            >
                              Skip
                            </Button>
                            <Link href={`/patients/${qItem.patientId}`}>
                              <Button variant="secondary" size="sm">View</Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-4">
            <Link href="/appointments/new">
              <Button variant="primary">Walk-in Patient</Button>
            </Link>
            <Link href="/appointments/new?type=emergency">
              <Button variant="danger">Emergency Case</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
