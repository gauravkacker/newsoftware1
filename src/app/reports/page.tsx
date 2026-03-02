 "use client";
 
 import { useMemo, useState } from "react";
 import Link from "next/link";
 import { Sidebar } from "@/components/layout/Sidebar";
 import { Card } from "@/components/ui/Card";
 import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/auth-context";
import { appointmentDb, patientDb, billingReceiptDb, billingQueueDb, medicineBillDb } from "@/lib/db/database";
import { doctorPrescriptionDb, doctorVisitDb, pharmacyQueueDb } from "@/lib/db/doctor-panel";
 
 type TabKey =
   | "appointments"
   | "patients"
   | "fees"
   | "prescriptions"
   | "followups"
   | "pharmacy"
  | "upcoming"
   | "system";
 
 interface Row {
   id: string;
   cols: string[];
   patientId?: string;
   receiptNumber?: string;
   prescriptionVisitId?: string;
  visitId?: string;
  billId?: string;
 }
 
 const allTabs: { key: TabKey; label: string }[] = [
   { key: "appointments", label: "Appointment Reports" },
   { key: "patients", label: "Patient Reports" },
   { key: "fees", label: "Fee & Financial Reports" },
   { key: "prescriptions", label: "Prescription Reports" },
   { key: "followups", label: "Follow-up & Outcome Reports" },
   { key: "pharmacy", label: "Pharmacy Reports" },
  { key: "upcoming", label: "Upcoming Appointments" },
   { key: "system", label: "System Usage Reports" },
 ];
 
 function formatDate(d: Date): string {
   return new Date(d).toLocaleDateString("en-IN", {
     day: "2-digit",
     month: "short",
     year: "numeric",
   });
 }
 
 function to12h(t: string): string {
   if (!t) return "";
   const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
   const h = ((hh % 12) || 12).toString().padStart(2, "0");
   const ampm = hh >= 12 ? "PM" : "AM";
   return `${h}:${`${mm}`.padStart(2, "0")} ${ampm}`;
 }
 
 function downloadCSV(filename: string, rows: Row[], headers: string[]): void {
   const csvContent = [headers.join(","), ...rows.map((r) => r.cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
 }
 
 function printHTML(title: string, headers: string[], rows: Row[]): void {
   const table = `
     <table style="width:100%; border-collapse:collapse; font-family:Arial, sans-serif;">
       <thead>
         <tr>
           ${headers.map((h) => `<th style="border-bottom:1px solid #ccc; text-align:left; padding:6px;">${h}</th>`).join("")}
         </tr>
       </thead>
       <tbody>
         ${rows
           .map(
             (r) =>
               `<tr>${r.cols
                 .map((c) => `<td style="border-bottom:1px solid #eee; padding:6px;">${c}</td>`)
                 .join("")}</tr>`
           )
           .join("")}
       </tbody>
     </table>
   `;
   const html = `
     <!doctype html>
     <html>
       <head>
         <meta charset="utf-8" />
         <title>${title}</title>
         <style>body{padding:20px;}</style>
       </head>
       <body onload="window.print(); setTimeout(() => window.close(), 300);">
         <h2 style="margin:0 0 10px 0; font-family:Arial,sans-serif;">${title}</h2>
         ${table}
       </body>
     </html>
   `;
   const w = window.open("", "_blank");
   if (w) {
     w.document.write(html);
     w.document.close();
   }
 }
 
 function whatsappShare(headers: string[], rows: Row[]): void {
   const lines = [
     "*Report*",
     headers.join(" | "),
     ...rows.map((r) => r.cols.join(" | ")),
   ];
   const text = encodeURIComponent(lines.join("\n"));
   window.open(`https://wa.me/?text=${text}`, "_blank");
 }
 
 export default function ReportsPage() {
   const { role } = useAuth();
   const [activeTab, setActiveTab] = useState<TabKey>("appointments");
  const today = new Date().toISOString().split("T")[0];
  const [applyKey, setApplyKey] = useState<number>(0);
  const [phType, setPhType] = useState<"pending" | "completed" | "couriered">("pending");
  const [phStart, setPhStart] = useState<string>(today);
  const [phEnd, setPhEnd] = useState<string>(today);
  const [feeType, setFeeType] = useState<"daily" | "range" | "outstanding" | "refunds" | "bills">("daily");
  const [feeDate, setFeeDate] = useState<string>(today);
  const [feeStart, setFeeStart] = useState<string>(today);
  const [feeEnd, setFeeEnd] = useState<string>(today);
  const [feePayMethod, setFeePayMethod] = useState<"all" | "cash" | "card" | "upi" | "cheque" | "insurance" | "exempt">("all");
  const [aptStart, setAptStart] = useState<string>(today);
  const [aptEnd, setAptEnd] = useState<string>(today);
  const [ptStart, setPtStart] = useState<string>(today);
  const [ptEnd, setPtEnd] = useState<string>(today);
  const [rxStart, setRxStart] = useState<string>(today);
  const [rxEnd, setRxEnd] = useState<string>(today);
  const [fuStart, setFuStart] = useState<string>(today);
  const [fuEnd, setFuEnd] = useState<string>(today);
  const [upStart, setUpStart] = useState<string>(today);
  const [upEnd, setUpEnd] = useState<string>(today);
  const [billStatus, setBillStatus] = useState<"all" | "paid" | "pending" | "partial">("all");
 
   const visibleTabs = useMemo(() => {
     const name = role?.name || "";
     if (name === "Doctor") return allTabs;
     if (name === "Frontdesk") return allTabs.filter((t) => ["appointments", "fees"].includes(t.key));
     if (name === "Pharmacy") return allTabs.filter((t) => ["prescriptions", "pharmacy"].includes(t.key));
     return allTabs.filter((t) => t.key === "system");
   }, [role?.name]);
 
  const data = useMemo((): { headers: string[]; rows: Row[] } => {
     if (activeTab === "appointments") {
      const start = new Date(aptStart);
      const end = new Date(aptEnd);
      end.setHours(23, 59, 59, 999);
      const appts = (appointmentDb.getAll() as Array<{
         id: string;
         patientId: string;
         appointmentDate: Date;
         appointmentTime: string;
         slotName?: string;
         tokenNumber?: number;
         status: string;
      }>).filter((a) => {
        const d = new Date(a.appointmentDate);
        // Filter out appointments for deleted patients
        const patient = patientDb.getById(a.patientId);
        return d >= start && d <= end && patient !== undefined && patient !== null;
      });
      const rows: Row[] = appts.map((a) => {
         const p = patientDb.getById(a.patientId) as any;
         const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
         const reg = p?.registrationNumber || "";
         return {
           id: a.id,
           cols: [
             formatDate(a.appointmentDate),
             to12h(a.appointmentTime),
             a.slotName || "",
             `${a.tokenNumber || "-"}`,
             name,
             reg,
             a.status,
           ],
           patientId: a.patientId,
         };
       });
       return {
         headers: ["Date", "Time", "Session", "Token", "Patient", "Regd No", "Status"],
         rows,
       };
     }
    if (activeTab === "patients") {
      const start = new Date(ptStart);
      const end = new Date(ptEnd);
      end.setHours(23, 59, 59, 999);
      const pts = patientDb.getAll() as Array<any>;
      const rows: Row[] = pts
        .map((p) => {
          const visits = doctorVisitDb.getByPatient(p.id) as Array<any>;
          const lastVisitDate = visits.length > 0 ? new Date(visits[0].visitDate) : null;
          return {
            id: p.id,
            cols: [p.fullName || `${p.firstName} ${p.lastName}`, p.registrationNumber || "", p.mobileNumber || ""],
            patientId: p.id,
            _lastVisit: lastVisitDate,
          } as any;
        })
        .filter((row) => {
          if (!row._lastVisit) return false;
          const d = row._lastVisit as Date;
          return d >= start && d <= end;
        })
        .map((row) => {
          const { _lastVisit, ...rest } = row;
          return rest as Row;
        });
       return { headers: ["Patient", "Regd No", "Mobile"], rows };
     }
    if (activeTab === "fees") {
      if (feeType === "daily") {
        let receipts = (billingReceiptDb.getAll() as Array<any>).filter((r) => {
          const d = new Date(r.createdAt).toISOString().split("T")[0];
          // Filter out receipts for deleted patients
          const patient = patientDb.getById(r.patientId);
          return d === feeDate && patient !== undefined && patient !== null;
        });
        if (feePayMethod !== "all") {
          receipts = receipts.filter((r) => (r.paymentMethod || "").toLowerCase() === feePayMethod);
        }
        const rows: Row[] = receipts.map((r) => {
          const p = patientDb.getById(r.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          const amount = typeof r.netAmount === "number" ? r.netAmount.toFixed(2) : `${r.netAmount}`;
          return { id: r.id, cols: [formatDate(r.createdAt), r.receiptNumber, name, amount, (r.paymentMethod || "").toUpperCase()], patientId: r.patientId, receiptNumber: r.id };
        });
        return { headers: ["Date", "Receipt No", "Patient", "Amount", "Payment"], rows };
      }
      if (feeType === "range") {
        const start = new Date(feeStart);
        const end = new Date(feeEnd);
        end.setHours(23, 59, 59, 999);
        let receipts = (billingReceiptDb.getAll() as Array<any>).filter((r) => {
          const d = new Date(r.createdAt);
          // Filter out receipts for deleted patients
          const patient = patientDb.getById(r.patientId);
          return d >= start && d <= end && patient !== undefined && patient !== null;
        });
        if (feePayMethod !== "all") {
          receipts = receipts.filter((r) => (r.paymentMethod || "").toLowerCase() === feePayMethod);
        }
        const rows: Row[] = receipts.map((r) => {
          const p = patientDb.getById(r.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          const amount = typeof r.netAmount === "number" ? r.netAmount.toFixed(2) : `${r.netAmount}`;
          return { id: r.id, cols: [formatDate(r.createdAt), r.receiptNumber, name, amount, (r.paymentMethod || "").toUpperCase()], patientId: r.patientId, receiptNumber: r.id };
        });
        return { headers: ["Date", "Receipt No", "Patient", "Amount", "Payment"], rows };
      }
      if (feeType === "outstanding") {
        const allItems = billingQueueDb.getAll() as Array<any>;
        const receipts = billingReceiptDb.getAll() as Array<any>;
        const paidVisitIds = new Set<string>(receipts.map((r) => r.visitId).filter(Boolean));
        const paidQueueIds = new Set<string>(receipts.map((r) => r.billingQueueId).filter(Boolean));
        const items = allItems.filter((i) => {
          const status = (i.paymentStatus || "").toLowerCase();
          const notPaid = status === "pending" || status === "partial";
          const notCovered = !paidVisitIds.has(i.visitId) && !paidQueueIds.has(i.id);
          const positiveDue = (i.netAmount || 0) > 0;
          // Filter out items for deleted patients
          const patient = patientDb.getById(i.patientId);
          return notPaid && notCovered && positiveDue && patient !== undefined && patient !== null;
        });
        const rows: Row[] = items.map((i) => {
          const p = patientDb.getById(i.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          const reg = p?.registrationNumber || "";
          const amountDue = typeof i.netAmount === "number" ? i.netAmount.toFixed(2) : `${i.netAmount}`;
          const daysPending = Math.floor((new Date(today).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          const visits = doctorVisitDb.getByPatient(i.patientId) as Array<any>;
          const lastVisit = visits.length > 0 ? formatDate(visits[0].visitDate) : "";
          return { id: i.id, cols: [name, reg, amountDue, `${daysPending}`, lastVisit], patientId: i.patientId };
        });
        return { headers: ["Patient", "Regd No", "Amount Due", "Days Pending", "Last Visit"], rows };
      }
      if (feeType === "refunds") {
        const start = new Date(feeStart);
        const end = new Date(feeEnd);
        end.setHours(23, 59, 59, 999);
        const receipts = (billingReceiptDb.getAll() as Array<any>).filter((r) => {
          const d = new Date(r.createdAt);
          // Filter out receipts for deleted patients
          const patient = patientDb.getById(r.patientId);
          return d >= start && d <= end && (r.paymentStatus || "").toLowerCase() === "refunded" && patient !== undefined && patient !== null;
        });
        const rows: Row[] = receipts.map((r) => {
          const p = patientDb.getById(r.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          const amount = typeof r.netAmount === "number" ? r.netAmount.toFixed(2) : `${r.netAmount}`;
          return { id: r.id, cols: [formatDate(r.createdAt), name, amount, "-", "-"], patientId: r.patientId };
        });
        return { headers: ["Date", "Patient", "Amount", "Reason", "Processed By"], rows };
      }
      if (feeType === "bills") {
        const start = new Date(feeStart);
        const end = new Date(feeEnd);
        end.setHours(23, 59, 59, 999);
        let bills = (medicineBillDb.getAll() as Array<any>).filter((b) => {
          const d = new Date(b.createdAt);
          // Filter out bills for deleted patients
          const patient = patientDb.getById(b.patientId);
          return d >= start && d <= end && patient !== undefined && patient !== null;
        });
        if (billStatus !== "all") {
          bills = bills.filter((b) => (b.paymentStatus || "pending").toLowerCase() === billStatus);
        }
        const rows: Row[] = bills.map((b) => {
          const p = patientDb.getById(b.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          const total = typeof b.grandTotal === "number" ? b.grandTotal.toFixed(2) : `${b.grandTotal || 0}`;
          return { id: b.id, cols: [formatDate(b.createdAt), name, total, (b.paymentStatus || "").toUpperCase()], patientId: b.patientId, visitId: b.visitId, billId: b.id };
        });
        return { headers: ["Date", "Patient", "Total", "Payment"], rows };
      }
      return { headers: [], rows: [] };
     }
     if (activeTab === "prescriptions") {
      const start = new Date(rxStart);
      const end = new Date(rxEnd);
      end.setHours(23, 59, 59, 999);
      const visits = (doctorVisitDb.getAll() as Array<any>).filter((v) => {
        const d = new Date(v.visitDate);
        // Filter out visits for deleted patients
        const patient = patientDb.getById(v.patientId);
        return d >= start && d <= end && patient !== undefined && patient !== null;
      });
       const rows: Row[] = visits.map((v) => {
         const p = patientDb.getById(v.patientId) as any;
         const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
         const rxCount = (doctorPrescriptionDb.getByVisit(v.id) || []).length;
         return {
           id: v.id,
           cols: [formatDate(v.visitDate), name, `${rxCount}`, v.status],
           patientId: v.patientId,
           prescriptionVisitId: v.id,
         };
       });
       return { headers: ["Date", "Patient", "Rx Count", "Status"], rows };
     }
     if (activeTab === "followups") {
      const start = new Date(fuStart);
      const end = new Date(fuEnd);
      end.setHours(23, 59, 59, 999);
      const appts = (appointmentDb.getAll() as Array<any>).filter((a) => {
        const d = new Date(a.appointmentDate);
        // Filter out appointments for deleted patients
        const patient = patientDb.getById(a.patientId);
        return d >= start && d <= end && patient !== undefined && patient !== null;
      });
       const rows: Row[] = appts
         .filter((a) => a.type === "follow-up")
         .map((a) => {
           const p = patientDb.getById(a.patientId) as any;
           const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
           return {
             id: a.id,
             cols: [formatDate(a.appointmentDate), to12h(a.appointmentTime), name, a.status],
             patientId: a.patientId,
           };
         });
       return { headers: ["Date", "Time", "Patient", "Status"], rows };
     }
     if (activeTab === "pharmacy") {
      const start = new Date(phStart);
      const end = new Date(phEnd);
      end.setHours(23, 59, 59, 999);
      const items = pharmacyQueueDb.getAll() as Array<any>;
      const filtered = items.filter((q) => {
        const dt = new Date(q.createdAt);
        const inRange = dt >= start && dt <= end;
        // Filter out items for deleted patients
        const patient = patientDb.getById(q.patientId);
        if (!inRange || !patient) return false;
        if (phType === "pending") return ["pending", "preparing"].includes((q.status || "").toLowerCase());
        if (phType === "completed") return (q.status || "").toLowerCase() === "prepared";
        if (phType === "couriered") return !!q.courier;
        return false;
      });
      const rows: Row[] = filtered.map((q) => {
        const p = patientDb.getById(q.patientId) as any;
        const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
        const count = Array.isArray(q.prescriptionIds) ? q.prescriptionIds.length : (doctorPrescriptionDb.getByVisit(q.visitId) || []).length;
        let prepMinutes = "";
        if ((q.status || "").toLowerCase() === "prepared") {
          const ms = new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime();
          prepMinutes = `${Math.max(0, Math.round(ms / 60000))}m`;
        } else if (q.deliveredAt) {
          const ms = new Date(q.deliveredAt).getTime() - new Date(q.createdAt).getTime();
          prepMinutes = `${Math.max(0, Math.round(ms / 60000))}m`;
        }
        const status = q.courier ? "couriered" : (q.status || "");
        return { id: q.id, cols: [name, `${count}`, prepMinutes, status], patientId: q.patientId, prescriptionVisitId: q.visitId };
      });
      return { headers: ["Patient", "Medicine Count", "Preparation Time", "Status"], rows };
     }
    if (activeTab === "upcoming") {
      const start = new Date(upStart);
      const end = new Date(upEnd);
      end.setHours(23, 59, 59, 999);
      const visits = doctorVisitDb.getAll() as Array<any>;
      const latestByPatient = new Map<string, any>();
      visits.forEach((v) => {
        // Filter out visits for deleted patients
        const patient = patientDb.getById(v.patientId);
        if (!patient) return;
        
        const current = latestByPatient.get(v.patientId);
        const vDate = new Date(v.visitDate);
        if (!current || new Date(current.visitDate) < vDate) latestByPatient.set(v.patientId, v);
      });
      const rows: Row[] = Array.from(latestByPatient.values())
        .filter((v) => v.nextVisit)
        .filter((v) => {
          const d = new Date(v.nextVisit);
          return d >= start && d <= end;
        })
        .map((v) => {
          const p = patientDb.getById(v.patientId) as any;
          const name = p ? `${p.firstName} ${p.lastName}` : "Unknown";
          return { id: v.id, cols: [formatDate(v.nextVisit), name, p?.registrationNumber || ""], patientId: v.patientId, visitId: v.id };
        });
      return { headers: ["Next Visit Date", "Patient", "Regd No"], rows };
    }
     return { headers: ["Event"], rows: [] };
  }, [activeTab, applyKey, aptStart, aptEnd, ptStart, ptEnd, rxStart, rxEnd, fuStart, fuEnd, phStart, phEnd, phType, feeType, feeDate, feeStart, feeEnd, feePayMethod, upStart, upEnd, billStatus, today]);
 
   const actionTitle = useMemo(() => {
     const tab = allTabs.find((t) => t.key === activeTab)?.label || "Report";
     return tab;
   }, [activeTab]);
 
   return (
     <div className="min-h-screen bg-gray-50">
       <Sidebar />
       <main className="ml-64 p-6">
         <div className="flex items-center justify-between mb-4">
           <div>
             <h1 className="text-2xl font-bold">Reports</h1>
             <p className="text-sm text-gray-500">Readable, printable, exportable, shareable</p>
           </div>
           <div className="flex gap-2">
             <Button variant="secondary" onClick={() => printHTML(actionTitle, data.headers, data.rows)}>Print / PDF</Button>
             <Button variant="secondary" onClick={() => downloadCSV(actionTitle.replace(/\s+/g, "-").toLowerCase(), data.rows, data.headers)}>Export Excel</Button>
             <Button variant="secondary" onClick={() => whatsappShare(data.headers, data.rows)}>Share WhatsApp</Button>
           </div>
         </div>
 
         <Card className="p-0 overflow-hidden">
           <div className="border-b border-gray-200 bg-gray-50 px-3">
             <div className="flex flex-wrap">
               {visibleTabs.map((t) => (
                 <button
                   key={t.key}
                   onClick={() => setActiveTab(t.key)}
                   className={`px-3 py-2 text-sm ${activeTab === t.key ? "text-indigo-700 border-b-2 border-indigo-600" : "text-gray-600 hover:text-gray-900"}`}
                 >
                   {t.label}
                 </button>
               ))}
             </div>
           </div>
 
           <div className="p-4">
            {activeTab === "appointments" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input type="date" value={aptStart} onChange={(e) => setAptStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input type="date" value={aptEnd} onChange={(e) => setAptEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "patients" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Last visit start</label>
                  <input type="date" value={ptStart} onChange={(e) => setPtStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Last visit end</label>
                  <input type="date" value={ptEnd} onChange={(e) => setPtEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "prescriptions" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input type="date" value={rxStart} onChange={(e) => setRxStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input type="date" value={rxEnd} onChange={(e) => setRxEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "followups" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input type="date" value={fuStart} onChange={(e) => setFuStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input type="date" value={fuEnd} onChange={(e) => setFuEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "pharmacy" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select value={phType} onChange={(e) => setPhType(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="pending">Pending prescriptions</option>
                    <option value="completed">Completed prescriptions</option>
                    <option value="couriered">Couriered medicines</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input type="date" value={phStart} onChange={(e) => setPhStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input type="date" value={phEnd} onChange={(e) => setPhEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "fees" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Report</label>
                  <select value={feeType} onChange={(e) => setFeeType(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="daily">Daily Fee Report</option>
                    <option value="range">Date Range Fee Report</option>
                    <option value="outstanding">Outstanding Fees Report</option>
                    <option value="refunds">Refund Report</option>
                    <option value="bills">Prescription Bills Report</option>
                  </select>
                </div>
                {feeType === "daily" && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date</label>
                    <input type="date" value={feeDate} onChange={(e) => setFeeDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                )}
                {["range", "refunds", "bills"].includes(feeType) && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start</label>
                      <input type="date" value={feeStart} onChange={(e) => setFeeStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End</label>
                      <input type="date" value={feeEnd} onChange={(e) => setFeeEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                  </>
                )}
                {(feeType === "daily" || feeType === "range") && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Payment Method</label>
                    <select value={feePayMethod} onChange={(e) => setFeePayMethod(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="all">All</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="insurance">Insurance</option>
                      <option value="exempt">Exempt</option>
                    </select>
                  </div>
                )}
                {feeType === "bills" && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Payment Status</label>
                    <select value={billStatus} onChange={(e) => setBillStatus(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="all">All</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>
                )}
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
            {activeTab === "upcoming" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input type="date" value={upStart} onChange={(e) => setUpStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input type="date" value={upEnd} onChange={(e) => setUpEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <Button variant="secondary" onClick={() => setApplyKey((k) => k + 1)}>Show</Button>
              </div>
            )}
             {data.rows.length === 0 ? (
               <div className="text-center text-gray-500 py-10">No data</div>
             ) : (
               <div className="overflow-x-auto">
                {activeTab === "fees" && (feeType === "daily" || feeType === "range") && (() => {
                  const start = feeType === "daily" ? new Date(feeDate) : new Date(feeStart);
                  const end = feeType === "daily" ? new Date(feeDate + "T23:59:59") : new Date(feeEnd + "T23:59:59");
                  let receipts = (billingReceiptDb.getAll() as Array<any>).filter((r) => {
                    const d = new Date(r.createdAt);
                    return d >= start && d <= end;
                  });
                  if (feePayMethod !== "all") {
                    receipts = receipts.filter((r) => (r.paymentMethod || "").toLowerCase() === feePayMethod);
                  }
                  const collected = receipts.filter((r) => (r.paymentStatus || "").toLowerCase() === "paid").reduce((sum, r) => sum + (r.netAmount || 0), 0);
                  const refunded = receipts.filter((r) => (r.paymentStatus || "").toLowerCase() === "refunded").reduce((sum, r) => sum + (r.netAmount || 0), 0);
                  const billed = receipts.reduce((sum, r) => sum + (r.netAmount || 0), 0);
                  const receiptQueueIds = new Set<string>(receipts.map((r) => r.billingQueueId).filter(Boolean));
                  const receiptVisitIds = new Set<string>(receipts.map((r) => r.visitId).filter(Boolean));
                  const pendingItems = (billingQueueDb.getAll() as Array<any>).filter((i) => {
                    const d = new Date(i.createdAt);
                    const inRange = d >= start && d <= end;
                    const isPending = ["pending", "partial"].includes((i.paymentStatus || "").toLowerCase());
                    const coveredByReceipt = receiptQueueIds.has(i.id) || receiptVisitIds.has(i.visitId);
                    return inRange && isPending && !coveredByReceipt && (i.netAmount || 0) > 0;
                  });
                  const pending = pendingItems.reduce((sum, i) => sum + (i.netAmount || 0), 0);
                  const breakdownMap: Record<string, { count: number; amount: number }> = {};
                  receipts.forEach((r) => {
                    const desc = (Array.isArray(r.items) && r.items[0]?.description) || "consultation";
                    if (!breakdownMap[desc]) breakdownMap[desc] = { count: 0, amount: 0 };
                    breakdownMap[desc].count += 1;
                    breakdownMap[desc].amount += r.netAmount || 0;
                  });
                  const breakdown = Object.entries(breakdownMap).map(([type, v]) => ({ type, count: v.count, amount: v.amount }));
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                      <Card className="p-3"><div className="text-xs text-gray-600">Total billed</div><div className="text-lg font-semibold">₹ {billed.toFixed(2)}</div></Card>
                      <Card className="p-3"><div className="text-xs text-gray-600">Total collected</div><div className="text-lg font-semibold">₹ {collected.toFixed(2)}</div></Card>
                      <Card className="p-3"><div className="text-xs text-gray-600">Pending</div><div className="text-lg font-semibold">₹ {pending.toFixed(2)}</div></Card>
                      <Card className="p-3"><div className="text-xs text-gray-600">Refunds</div><div className="text-lg font-semibold">₹ {refunded.toFixed(2)}</div></Card>
                      <div className="md:col-span-4">
                        <Card className="p-3">
                          <div className="text-sm font-semibold mb-2">Breakdown</div>
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {breakdown.length === 0 ? (
                                <tr><td className="px-4 py-2 text-sm text-gray-500" colSpan={3}>No data</td></tr>
                              ) : breakdown.map((b, i) => (
                                <tr key={i}>
                                  <td className="px-4 py-2 text-sm text-gray-900">{b.type}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{b.count}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">₹ {b.amount.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
                {activeTab === "fees" && feeType === "bills" && (() => {
                  const start = new Date(feeStart);
                  const end = new Date(feeEnd);
                  end.setHours(23, 59, 59, 999);
                  let bills = (medicineBillDb.getAll() as Array<any>).filter((b) => {
                    const d = new Date(b.createdAt);
                    return d >= start && d <= end;
                  });
                  if (billStatus !== "all") {
                    bills = bills.filter((b) => (b.paymentStatus || "pending").toLowerCase() === billStatus);
                  }
                  const totalCount = bills.length;
                  const totalAmount = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
                  const collectedAmount = bills.filter((b) => (b.paymentStatus || "").toLowerCase() === "paid")
                                               .reduce((sum, b) => sum + (b.grandTotal || 0), 0);
                  const pendingAmount = totalAmount - collectedAmount;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <Card className="p-3">
                        <div className="text-xs text-gray-600">Number of Billed Prescriptions</div>
                        <div className="text-lg font-semibold">{totalCount}</div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-xs text-gray-600">Total Bill</div>
                        <div className="text-lg font-semibold">₹ {totalAmount.toFixed(2)}</div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-xs text-gray-600">Total Collected</div>
                        <div className="text-lg font-semibold">₹ {collectedAmount.toFixed(2)}</div>
                      </Card>
                      <div className="md:col-span-3">
                        <Card className="p-3">
                          <div className="text-sm">
                            Pending: <span className="font-semibold">₹ {pendingAmount.toFixed(2)}</span>
                          </div>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
                 <table className="w-full">
                   <thead className="bg-gray-50">
                     <tr>
                       {data.headers.map((h) => (
                         <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                       ))}
                       <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                     {data.rows.map((r) => (
                       <tr key={r.id} className="hover:bg-gray-50">
                         {r.cols.map((c, idx) => (
                           <td key={idx} className="px-4 py-2 text-sm text-gray-900">{c}</td>
                         ))}
                         <td className="px-4 py-2">
                           <div className="flex gap-2">
                             {r.patientId && (
                               <Link href={`/patients/${r.patientId}`}>
                                 <Button size="sm" variant="outline">Patient</Button>
                               </Link>
                             )}
                             {r.receiptNumber && (
                               <Link href={`/billing?receiptId=${r.receiptNumber}`}>
                                 <Button size="sm" variant="outline">Receipt</Button>
                               </Link>
                             )}
                             {r.prescriptionVisitId && (
                               <Link href={`/pharmacy?visitId=${r.prescriptionVisitId}`}>
                                 <Button size="sm" variant="outline">Prescription</Button>
                               </Link>
                             )}
                            {r.visitId && (
                              <Link href={`/doctor-panel?patientId=${r.patientId}&visitId=${r.visitId}`}>
                                <Button size="sm" variant="outline">Visit</Button>
                              </Link>
                            )}
                            {r.billId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const bill = (medicineBillDb.getById(r.billId as any) as any) || null;
                                    const patient = r.patientId ? (patientDb.getById(r.patientId) as any) : null;
                                    if (bill) {
                                      const content = `
                                        <!doctype html>
                                        <html>
                                          <head>
                                            <meta charset="utf-8" />
                                            <title>Medicine Bill</title>
                                            <style>
                                              body { font-family: Arial, sans-serif; padding: 16px; }
                                              .header { text-align: center; margin-bottom: 10px; }
                                              .patient { margin-bottom: 8px; font-size: 14px; }
                                              .items { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 8px 0; margin: 8px 0; }
                                              .row { display: flex; justify-content: space-between; margin: 4px 0; }
                                              .total { font-weight: bold; font-size: 16px; }
                                              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 12px; }
                                            </style>
                                          </head>
                                          <body onload="window.print(); setTimeout(() => window.close(), 300);">
                                            <div class="header"><h2 style="margin:0;">Prescription Bill</h2></div>
                                            <div class="patient">
                                              <div><strong>${patient?.firstName || ""} ${patient?.lastName || ""}</strong></div>
                                              <div>Reg: ${patient?.registrationNumber || ""}</div>
                                            </div>
                                            <div class="items">
                                              ${(bill.items || []).map((it: any) => `<div class="row"><span>${it.medicine || it.description || "Item"}</span><span>₹ ${(it.amount ?? it.total ?? 0).toFixed(2)}</span></div>`).join("")}
                                            </div>
                                            <div class="row total"><span>Total</span><span>₹ ${(bill.grandTotal ?? bill.netAmount ?? 0).toFixed(2)}</span></div>
                                            <div class="footer">Get well soon</div>
                                          </body>
                                        </html>
                                      `;
                                      const w = window.open("", "_blank");
                                      if (w) {
                                        w.document.write(content);
                                        w.document.close();
                                      }
                                    }
                                  }}
                                >
                                  Print Bill
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const bill = (medicineBillDb.getById(r.billId as any) as any) || null;
                                    const patient = r.patientId ? (patientDb.getById(r.patientId) as any) : null;
                                    if (bill) {
                                      const lines = [
                                        "*Prescription Bill*",
                                        `${patient?.firstName || ""} ${patient?.lastName || ""} (Reg: ${patient?.registrationNumber || ""})`,
                                        `Total: ₹ ${(bill.grandTotal ?? bill.netAmount ?? 0).toFixed(2)}`,
                                      ];
                                      const text = encodeURIComponent(lines.join("\n"));
                                      window.open(`https://wa.me/?text=${text}`, "_blank");
                                    }
                                  }}
                                >
                                  Share Bill
                                </Button>
                              </>
                            )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
         </Card>
       </main>
     </div>
   );
 }
