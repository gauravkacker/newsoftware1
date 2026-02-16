"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { queueDb, queueItemDb, slotDb } from "@/lib/db/database";
import type { QueueItem, QueueConfig, Slot } from "@/types";

export default function DoctorQueuePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [queueConfig, setQueueConfig] = useState<QueueConfig | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPatient, setCurrentPatient] = useState<QueueItem | null>(null);
  const [nextPatient, setNextPatient] = useState<QueueItem | null>(null);

  const loadQueue = useCallback(() => {
    setIsLoading(true);
    const today = new Date();
    const activeSlots = slotDb.getActive() as Slot[];
    setSlots(activeSlots);

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

        // Set current and next patient
        const inConsultation = items.find((i) => i.status === "in-consultation");
        const waiting = items.filter((i) => i.status === "waiting");
        
        setCurrentPatient(inConsultation || null);
        setNextPatient(waiting[0] || null);
      }
    }
    setIsLoading(false);
  }, [selectedSlot]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadQueue();
  }, [loadQueue]);

  const getPatientName = (patientId: string): string => {
    if (typeof window === "undefined") return "Loading...";
    const patientDb = require("@/lib/db/database").patientDb;
    const patient = patientDb.getById(patientId);
    if (patient) {
      const p = patient as { firstName: string; lastName: string };
      return `${p.firstName} ${p.lastName}`;
    }
    return "Unknown";
  };

  const handleCallNext = () => {
    const waiting = queueItems.filter((i) => i.status === "waiting");
    if (waiting.length > 0) {
      // Complete current if exists
      if (currentPatient) {
        queueItemDb.complete(currentPatient.id);
        if (queueConfig) {
          queueDb.incrementCompleted(queueConfig.id);
        }
      }
      // Call next
      queueItemDb.call(waiting[0].id);
      loadQueue();
    }
  };

  const handleCallSpecific = (itemId: string) => {
    if (currentPatient) {
      queueItemDb.complete(currentPatient.id);
      if (queueConfig) {
        queueDb.incrementCompleted(queueConfig.id);
      }
    }
    queueItemDb.call(itemId);
    loadQueue();
  };

  const handleSkipCurrent = () => {
    if (currentPatient) {
      queueItemDb.skip(currentPatient.id);
      if (queueConfig) {
        queueDb.incrementSkipped(queueConfig.id);
      }
    }
    loadQueue();
  };

  const handleCompleteCurrent = () => {
    if (currentPatient) {
      queueItemDb.complete(currentPatient.id);
      if (queueConfig) {
        queueDb.incrementCompleted(queueConfig.id);
      }
    }
    loadQueue();
  };

  const getWaitTime = (checkInTime: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(checkInTime).getTime()) / 60000);
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "emergency":
        return "border-l-4 border-red-500 bg-red-50";
      case "vip":
        return "border-l-4 border-purple-500 bg-purple-50";
      case "doctor-priority":
        return "border-l-4 border-yellow-500 bg-yellow-50";
      default:
        return "border-l-4 border-gray-200";
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
              <h1 className="text-2xl font-semibold text-gray-900">Doctor View</h1>
              <p className="text-sm text-gray-500 mt-1">Queue control panel</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {slots.map((slot) => {
                  const s = slot as Slot;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  );
                })}
              </select>
              <Link href="/queue">
                <Button variant="secondary">Frontdesk View</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Queue Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-4">
              {queueConfig && (
                <Badge variant={queueConfig.status === "open" ? "success" : queueConfig.status === "paused" ? "warning" : "danger"} className="text-sm px-3 py-1">
                  Queue: {queueConfig.status.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>

          {/* Current Patient Panel */}
          <div className="grid grid-cols-2 gap-6">
            {/* Current Patient */}
            <Card className={`p-6 ${currentPatient ? "bg-yellow-50" : "bg-gray-50"}`}>
              <div className="text-sm text-gray-500 mb-2">NOW SERVING</div>
              {currentPatient ? (
                <div className={`p-4 rounded-lg ${getPriorityColor(currentPatient.priority)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-yellow-500 text-white flex items-center justify-center text-2xl font-bold">
                        {currentPatient.tokenNumber}
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {getPatientName(currentPatient.patientId)}
                        </div>
                        <div className="text-gray-500">
                          Waiting: {getWaitTime(currentPatient.checkInTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    {currentPatient.priority !== "normal" && (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        currentPatient.priority === "emergency" ? "bg-red-100 text-red-800" :
                        currentPatient.priority === "vip" ? "bg-purple-100 text-purple-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {currentPatient.priority.toUpperCase()}
                      </span>
                    )}
                    <Badge variant="warning">In Consultation</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleCompleteCurrent} className="flex-1">
                      Complete Consultation
                    </Button>
                    <Button variant="secondary" onClick={handleSkipCurrent} className="flex-1">
                      Skip
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">👋</div>
                  <div>No patient in consultation</div>
                  {nextPatient && (
                    <Button variant="primary" onClick={handleCallNext} className="mt-4">
                      Call Token #{nextPatient.tokenNumber}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Next Patient */}
            <Card className="p-6">
              <div className="text-sm text-gray-500 mb-2">NEXT UP</div>
              {nextPatient ? (
                <div className={`p-4 rounded-lg ${getPriorityColor(nextPatient.priority)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-2xl font-bold">
                        {nextPatient.tokenNumber}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">
                          {getPatientName(nextPatient.patientId)}
                        </div>
                        <div className="text-gray-500">
                          Waiting: {getWaitTime(nextPatient.checkInTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="primary" onClick={() => handleCallSpecific(nextPatient.id)} className="flex-1">
                      Call Now
                    </Button>
                    <Button variant="secondary" onClick={handleCallNext} className="flex-1">
                      Call Next
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📋</div>
                  <div>No patients waiting</div>
                </div>
              )}
            </Card>
          </div>

          {/* Waiting List */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Waiting List</h2>
            </div>
            {queueItems.filter((i) => i.status === "waiting").length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No patients waiting
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {queueItems
                  .filter((i) => i.status === "waiting")
                  .map((item, index) => {
                    const qItem = item as QueueItem;
                    return (
                      <div
                        key={qItem.id}
                        className={`p-4 flex items-center justify-between ${getPriorityColor(qItem.priority)}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">
                            {qItem.tokenNumber}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {getPatientName(qItem.patientId)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Position: {index + 1} • Waiting: {getWaitTime(qItem.checkInTime)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCallSpecific(qItem.id)}
                        >
                          Call
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-4">
            {queueConfig && queueConfig.status === "paused" && (
              <Button
                onClick={() => {
                  queueDb.resume(queueConfig.id);
                  loadQueue();
                }}
              >
                Resume Queue
              </Button>
            )}
            {queueConfig && queueConfig.status === "open" && (
              <Button
                variant="secondary"
                onClick={() => {
                  queueDb.pause(queueConfig.id);
                  loadQueue();
                }}
              >
                Pause Queue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
