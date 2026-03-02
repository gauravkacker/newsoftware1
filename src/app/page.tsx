// ============================================
// Main Dashboard Page
// Single-workspace interface based on Module 1
// Updated for Module 2: User Roles & Permissions
// ============================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth/auth-context';
import { db, seedModule2Data, seedInitialData, patientDb, appointmentDb } from '@/lib/db/database';
import { queueItemDb, queueDb } from '@/lib/db/database';
import { doctorPrescriptionDb, doctorVisitDb } from '@/lib/db/doctor-panel';
import type { Patient, Appointment, QueueItem, MateriaMedica } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, isAuthenticated } = useAuth();
  
  // Seed initial data on first load (client only to avoid hydration issues)
  useEffect(() => {
    const hasSeeded = localStorage.getItem('pms_seeded');
    const hasSeededModule2 = localStorage.getItem('pms_module2_seeded');
    
    if (!hasSeeded) {
      seedInitialData();
      localStorage.setItem('pms_seeded', 'true');
    }
    
    if (!hasSeededModule2) {
      seedModule2Data();
      localStorage.setItem('pms_module2_seeded', 'true');
    }
  }, []);
  
  // Load real data
  const [stats, setStats] = useState({
    todayPatients: 0,
    pendingAppointments: 0,
    queueCount: 0,
    prescriptions: 0,
  });
  
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [nextPatientId, setNextPatientId] = useState<string | null>(null);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  
  useEffect(() => {
    // Listen for next patient flagged event
    const handleNextPatientFlagged = (event: any) => {
      setNextPatientId(event.detail.patientId);
    };
    
    // Listen for patient called event
    const handlePatientCalled = (event: any) => {
      setCurrentPatientId(event.detail.patientId);
      setNextPatientId(null); // Clear next patient when someone is called
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('next-patient-flagged', handleNextPatientFlagged as EventListener);
      window.addEventListener('patient-called', handlePatientCalled as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('next-patient-flagged', handleNextPatientFlagged as EventListener);
        window.removeEventListener('patient-called', handlePatientCalled as EventListener);
      }
    };
  }, []);
  
  useEffect(() => {
    // Load real data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Get today's appointments
    const allAppointments = appointmentDb.getAll() as Appointment[];
    const todayAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= today && aptDate <= todayEnd;
    });
    
    // Get today's visits
    const allVisits = doctorVisitDb.getAll() as any[];
    const todayVisits = allVisits.filter((visit: any) => {
      const visitDate = new Date(visit.visitDate);
      return visitDate >= today && visitDate <= todayEnd;
    });
    
    // Get queue items
    const allQueueItems = queueItemDb.getActiveByDate(today);
    
    // Get all prescriptions
    const allPrescriptions = doctorPrescriptionDb.getAll() as any[];
    
    // Get recent patients
    const allPatients = patientDb.getAll() as Patient[];
    const sortedPatients = allPatients.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Get upcoming appointments
    const upcomingApts = allAppointments
      .filter((apt: any) => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate >= today && ['scheduled', 'confirmed'].includes(apt.status);
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
        const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);
    
    setStats({
      todayPatients: todayVisits.length,
      pendingAppointments: todayAppointments.filter((a: any) => ['scheduled', 'confirmed'].includes(a.status)).length,
      queueCount: allQueueItems.filter((q: any) => ['waiting', 'in-consultation'].includes(q.status)).length,
      prescriptions: allPrescriptions.length,
    });
    
    setRecentPatients(sortedPatients.slice(0, 5));
    setUpcomingAppointments(upcomingApts);
    setQueueItems(allQueueItems.slice(0, 5));
  }, []);

  // Get user display name
  const userDisplayName = user?.name || 'Dr. Smith';
  const userRole = user?.roleId || 'Doctor';

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <Header title="Dashboard" subtitle={`Welcome back, ${userDisplayName}`} />

        <main className="p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">Today&apos;s Patients</p>
                  <p className="text-3xl font-bold mt-1">{stats.todayPatients}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-indigo-100">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {stats.todayPatients > 0 ? `${stats.todayPatients} visits today` : 'No visits yet'}
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Pending Appointments</p>
                  <p className="text-3xl font-bold mt-1">{stats.pendingAppointments}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-emerald-100">
                <span>{upcomingAppointments.length > 0 ? `Next: ${(upcomingAppointments[0] as any).appointmentTime} - ${upcomingAppointments[0].patientName}` : 'No appointments'}</span>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Queue</p>
                  <p className="text-3xl font-bold mt-1">{stats.queueCount}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4 text-white hover:bg-white/20"
                onClick={() => router.push('/queue')}
              >
                View Queue →
              </Button>
            </Card>

            <Card className="bg-gradient-to-br from-rose-500 to-rose-600 text-white border-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-rose-100 text-sm">Prescriptions</p>
                  <p className="text-3xl font-bold mt-1">{stats.prescriptions}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-rose-100">
                <span>{stats.prescriptions} total prescriptions</span>
              </div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue Section */}
            <Card className="lg:col-span-1">
              <CardHeader
                title="Current Queue"
                subtitle="Patients waiting for consultation"
                action={
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/queue')}
                  >
                    View All
                  </Button>
                }
              />
              <div className="space-y-3">
                {queueItems.length > 0 ? (
                  queueItems.map((item, index) => {
                    const isNext = nextPatientId === item.patientId;
                    const isCurrent = currentPatientId === item.patientId;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                          isNext ? 'bg-yellow-50 border-2 border-yellow-400' : 
                          isCurrent ? 'bg-green-50 border-2 border-green-400' : 
                          'bg-gray-50'
                        }`}
                      >
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {(item as { tokenNumber?: number }).tokenNumber || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.patientName}
                            </p>
                            {isNext && (
                              <Badge variant="warning" size="sm">NEXT</Badge>
                            )}
                            {isCurrent && (
                              <Badge variant="success" size="sm">CURRENT</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Waiting since {new Date(item.checkInTime).toLocaleTimeString()}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No patients in queue</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => router.push('/queue')}>
                      Add to Queue
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Upcoming Appointments */}
            <Card className="lg:col-span-1">
              <CardHeader
                title="Upcoming Appointments"
                subtitle="Today's schedule"
                action={
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => router.push('/appointments/new')}
                  >
                    + New
                  </Button>
                }
              />
              <div className="space-y-3">
                {upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map((appointment) => {
                    const isNext = nextPatientId === appointment.patientId;
                    return (
                      <div
                        key={appointment.id}
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                          isNext ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {appointment.patientName}
                            </p>
                            {isNext && (
                              <Badge variant="warning" size="sm">NEXT</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date((appointment as { appointmentDate: Date }).appointmentDate).toLocaleDateString()} - {(appointment as { type: string }).type}
                          </p>
                        </div>
                        <StatusBadge status={appointment.status} />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No upcoming appointments</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="lg:col-span-1">
              <CardHeader
                title="Quick Actions"
                subtitle="Common tasks"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="secondary" 
                  className="flex-col py-4 h-auto"
                  onClick={() => router.push('/patients/new')}
                >
                  <svg className="w-6 h-6 mb-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>New Patient</span>
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-col py-4 h-auto"
                  onClick={() => router.push('/appointments')}
                >
                  <svg className="w-6 h-6 mb-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Schedule</span>
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-col py-4 h-auto"
                  onClick={() => router.push('/doctor-panel')}
                >
                  <svg className="w-6 h-6 mb-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Prescription</span>
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-col py-4 h-auto"
                  onClick={() => router.push('/billing')}
                >
                  <svg className="w-6 h-6 mb-2 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Billing</span>
                </Button>
              </div>
            </Card>
          </div>

          {/* Recent Patients */}
          <Card className="mt-6">
            <CardHeader
              title="Recent Patients"
              subtitle="Recently registered patients"
              action={
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => router.push('/patients')}
                >
                  View All
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date of Birth</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Medical History</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatients.map((patient) => (
                    <tr key={patient.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{patient.gender}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{patient.mobileNumber}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{patient.dateOfBirth}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {patient.medicalHistory?.slice(0, 2).map((history, idx) => (
                            <Badge key={idx} variant="default" size="sm">
                              {history}
                            </Badge>
                          ))}
                          {patient.medicalHistory && patient.medicalHistory.length > 2 && (
                            <Badge variant="default" size="sm">
                              +{patient.medicalHistory.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => router.push(`/patients/${patient.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
