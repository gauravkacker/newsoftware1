 "use client";
 
 import React, { useEffect, useState } from "react";
 import { Sidebar } from "@/components/layout/Sidebar";
 import { Button } from "@/components/ui/Button";
 import { Card } from "@/components/ui/Card";
 import { doctorSettingsDb } from "@/lib/db/doctor-panel";
 
 export default function PrescriptionSettingsPage() {
  const [viewSettings, setViewSettings] = useState<any>(() => {
    const raw = doctorSettingsDb.get("prescriptionSettings");
    if (raw) {
      try {
        const parsed = JSON.parse(raw as string);
        return parsed.view || {
          patient: { name: true, age: true, sex: true, visitDate: true, regNo: true },
          rxFields: { medicine: true, potency: true, quantity: true, doseForm: true, dosePattern: true, frequency: true, duration: true, instructions: true, showCombinationDetails: true },
          additional: { caseText: true, advice: true, nextVisit: true, bp: true, pulse: true, tempF: true, weightKg: true }
        };
      } catch {}
    }
    return {
      patient: { name: true, age: true, sex: true, visitDate: true, regNo: true },
      rxFields: { medicine: true, potency: true, quantity: true, doseForm: true, dosePattern: true, frequency: true, duration: true, instructions: true, showCombinationDetails: true },
      additional: { caseText: true, advice: true, nextVisit: true, bp: true, pulse: true, tempF: true, weightKg: true }
    };
  });
  const [printSettings, setPrintSettings] = useState<any>(() => {
    const raw = doctorSettingsDb.get("prescriptionSettings");
    if (raw) {
      try {
        const parsed = JSON.parse(raw as string);
        return parsed.print || {
          patient: { name: true, age: true, sex: true, visitDate: true, regNo: true },
          rxFields: { medicine: true, potency: true, quantity: true, doseForm: true, dosePattern: true, frequency: true, duration: true, instructions: true, showCombinationDetails: true },
          additional: { caseText: true, advice: true, nextVisit: true, bp: true, pulse: true, tempF: true, weightKg: true }
        };
      } catch {}
    }
    return {
      patient: { name: true, age: true, sex: true, visitDate: true, regNo: true },
      rxFields: { medicine: true, potency: true, quantity: true, doseForm: true, dosePattern: true, frequency: true, duration: true, instructions: true, showCombinationDetails: true },
      additional: { caseText: true, advice: true, nextVisit: true, bp: true, pulse: true, tempF: true, weightKg: true }
    };
  });
  const [signatureUrl, setSignatureUrl] = useState<string>(() => {
    const raw = doctorSettingsDb.get("prescriptionSettings");
    if (raw) {
      try {
        const parsed = JSON.parse(raw as string);
        return parsed.signatureUrl || "";
      } catch {}
    }
    return "";
  });
   const [isSaving, setIsSaving] = useState(false);
 
  
 
   const handleToggle = (target: "view" | "print", group: "patient" | "rxFields" | "additional", key: string) => {
     if (target === "view") {
       setViewSettings((prev: any) => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } }));
     } else {
       setPrintSettings((prev: any) => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } }));
     }
   };
 
   const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = () => {
       const dataUrl = reader.result as string;
       compressPng(dataUrl, 600, 200, 0.8).then((pngUrl) => {
         setSignatureUrl(pngUrl);
       });
     };
     reader.readAsDataURL(file);
   };
 
   const handleSave = () => {
     setIsSaving(true);
     const payload = {
       view: viewSettings,
       print: printSettings,
       signatureUrl: signatureUrl
     };
     doctorSettingsDb.set("prescriptionSettings", JSON.stringify(payload), "doctor");
     setTimeout(() => setIsSaving(false), 400);
     alert("Prescription settings saved.");
   };
 
  return (
     <div className="min-h-screen bg-gray-50">
      <Sidebar />
       <main className="ml-64 p-6">
         <div className="max-w-4xl mx-auto space-y-6">
           <h1 className="text-2xl font-bold">Prescription Settings</h1>
           <Card className="p-4">
             <h2 className="text-lg font-semibold mb-2">View: Patient details</h2>
             <div className="grid grid-cols-2 gap-2">
               {["name","age","sex","visitDate","regNo"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!viewSettings.patient[key]} onChange={() => handleToggle("view","patient",key)} />
                   <span className="capitalize">{key}</span>
                 </label>
               ))}
             </div>
             <h2 className="text-lg font-semibold mt-4 mb-2">View: Prescription fields</h2>
             <div className="grid grid-cols-2 gap-2">
               {["medicine","potency","quantity","doseForm","dosePattern","frequency","duration","instructions","showCombinationDetails"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!viewSettings.rxFields[key]} onChange={() => handleToggle("view","rxFields",key)} />
                   <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                 </label>
               ))}
             </div>
             <h2 className="text-lg font-semibold mt-4 mb-2">View: Additional</h2>
             <div className="grid grid-cols-2 gap-2">
               {["caseText","advice","nextVisit","bp","pulse","tempF","weightKg"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!viewSettings.additional[key]} onChange={() => handleToggle("view","additional",key)} />
                   <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                 </label>
               ))}
             </div>
           </Card>
 
           <Card className="p-4">
             <h2 className="text-lg font-semibold mb-2">Print: Patient details</h2>
             <div className="grid grid-cols-2 gap-2">
               {["name","age","sex","visitDate","regNo"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!printSettings.patient[key]} onChange={() => handleToggle("print","patient",key)} />
                   <span className="capitalize">{key}</span>
                 </label>
               ))}
             </div>
             <h2 className="text-lg font-semibold mt-4 mb-2">Print: Prescription fields</h2>
             <div className="grid grid-cols-2 gap-2">
               {["medicine","potency","quantity","doseForm","dosePattern","frequency","duration","instructions","showCombinationDetails"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!printSettings.rxFields[key]} onChange={() => handleToggle("print","rxFields",key)} />
                   <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                 </label>
               ))}
             </div>
             <h2 className="text-lg font-semibold mt-4 mb-2">Print: Additional</h2>
             <div className="grid grid-cols-2 gap-2">
               {["caseText","advice","nextVisit","bp","pulse","tempF","weightKg"].map((key) => (
                 <label key={key} className="flex items-center gap-2">
                   <input type="checkbox" checked={!!printSettings.additional[key]} onChange={() => handleToggle("print","additional",key)} />
                   <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                 </label>
               ))}
             </div>
           </Card>
 
           <Card className="p-4">
             <h2 className="text-lg font-semibold mb-2">Doctor Signature</h2>
             <p className="text-sm text-gray-600 mb-2">Upload a transparent PNG. It will be compressed and shown in the preview and prints.</p>
             <div className="flex items-center gap-4">
               {signatureUrl ? (
                 <img src={signatureUrl} alt="Signature" className="h-16 object-contain border rounded bg-white" />
               ) : (
                 <div className="h-16 w-40 border rounded bg-gray-100 flex items-center justify-center text-gray-500 text-sm">No signature</div>
               )}
               <input type="file" accept="image/*" onChange={handleSignatureUpload} />
             </div>
           </Card>
 
           <div className="flex justify-end">
             <Button variant="primary" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
               {isSaving ? "Saving..." : "Save Settings"}
             </Button>
           </div>
         </div>
       </main>
     </div>
   );
 }
 
 // Compress to PNG while keeping transparency (if present)
 function compressPng(dataUrl: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
   return new Promise((resolve, reject) => {
     const img = new Image();
     img.onload = () => {
       let width = img.width;
       let height = img.height;
       if (width > height) {
         if (width > maxWidth) {
           height = Math.round((height * maxWidth) / width);
           width = maxWidth;
         }
       } else {
         if (height > maxHeight) {
           width = Math.round((width * maxHeight) / height);
           height = maxHeight;
         }
       }
       const canvas = document.createElement("canvas");
       canvas.width = width;
       canvas.height = height;
       const ctx = canvas.getContext("2d");
       if (!ctx) { reject(new Error("Canvas context not available")); return; }
       ctx.clearRect(0, 0, width, height);
       ctx.drawImage(img, 0, 0, width, height);
       // PNG ignores quality parameter; still return PNG for transparency
       const pngUrl = canvas.toDataURL("image/png");
       resolve(pngUrl);
     };
     img.onerror = reject;
     img.src = dataUrl;
   });
 }
