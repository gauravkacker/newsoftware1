import { doctorSettingsDb } from './db/doctor-panel';
import type { DoctorPrescription } from './db/schema';

interface PrescriptionSettings {
  prescriptionMarginLeft: string;
  prescriptionMarginRight: string;
  prescriptionHeaderHeight: string;
  prescriptionFooterHeight: string;
  prescriptionPageHeight: string;
  prescriptionContentFontFamily: string;
  prescriptionContentFontSize: string;
  prescriptionContentFontBold: boolean;
  prescriptionContentFontItalic: boolean;
  prescriptionContentFontUnderline: boolean;
  prescriptionPatientDetailsFontFamily: string;
  prescriptionPatientDetailsFontSize: string;
  prescriptionPatientDetailsFontBold: boolean;
  prescriptionPatientDetailsFontItalic: boolean;
  prescriptionHeaderImage: string;
  prescriptionFooterImage: string;
  prescriptionDoctorSignature: string;
  prescriptionDoctorSeal: string;
  prescriptionShowName: boolean;
  prescriptionShowDate: boolean;
  prescriptionShowRegNo: boolean;
  prescriptionShowMobile: boolean;
  prescriptionShowDoctorName: boolean;
  prescriptionShowAddress: boolean;
  prescriptionShowAge: boolean;
  prescriptionShowSex: boolean;
  prescriptionShowMedicineName: boolean;
  prescriptionShowPotency: boolean;
  prescriptionShowPattern: boolean;
  prescriptionShowDoseForm: boolean;
  prescriptionShowFrequency: boolean;
  prescriptionShowDuration: boolean;
  prescriptionShowNextVisit: boolean;
  prescriptionSignaturePosition: 'left' | 'right';
  prescriptionLanguage: 'english' | 'hindi';
  prescriptionShowChiefComplaint: boolean;
}

// Get prescription settings
export function getPrescriptionSettings(): PrescriptionSettings {
  const defaults: PrescriptionSettings = {
    prescriptionMarginLeft: '20mm',
    prescriptionMarginRight: '20mm',
    prescriptionHeaderHeight: '80mm',
    prescriptionFooterHeight: '30mm',
    prescriptionPageHeight: '297mm',
    prescriptionContentFontFamily: 'Arial',
    prescriptionContentFontSize: '11pt',
    prescriptionContentFontBold: false,
    prescriptionContentFontItalic: false,
    prescriptionContentFontUnderline: false,
    prescriptionPatientDetailsFontFamily: 'Arial',
    prescriptionPatientDetailsFontSize: '10pt',
    prescriptionPatientDetailsFontBold: true,
    prescriptionPatientDetailsFontItalic: false,
    prescriptionHeaderImage: '',
    prescriptionFooterImage: '',
    prescriptionDoctorSignature: '',
    prescriptionDoctorSeal: '',
    prescriptionShowName: true,
    prescriptionShowDate: true,
    prescriptionShowRegNo: true,
    prescriptionShowMobile: true,
    prescriptionShowDoctorName: true,
    prescriptionShowAddress: true,
    prescriptionShowAge: true,
    prescriptionShowSex: true,
    prescriptionShowMedicineName: true,
    prescriptionShowPotency: true,
    prescriptionShowPattern: true,
    prescriptionShowDoseForm: true,
    prescriptionShowFrequency: true,
    prescriptionShowDuration: true,
    prescriptionShowNextVisit: true,
    prescriptionSignaturePosition: 'right',
    prescriptionLanguage: 'english',
    prescriptionShowChiefComplaint: true,
  };

  try {
    const raw = doctorSettingsDb.get('printSettings');
    if (raw) {
      const settings = JSON.parse(raw as string);
      return { ...defaults, ...settings };
    }
  } catch (e) {
    console.error('Error loading prescription settings:', e);
  }

  return defaults;
}

// Hindi translations
const hindiTranslations: Record<string, string> = {
  'morning': 'सुबह',
  'afternoon': 'दोपहर',
  'evening': 'शाम',
  'night': 'रात',
  'for': 'के लिए',
  'days': 'दिन',
  'day': 'दिन',
  'pills': 'गोलियां',
  'pill': 'गोली',
  'drops': 'बूंदें',
  'drop': 'बूंद',
  'tablets': 'गोलियां',
  'tablet': 'गोली',
  'capsules': 'कैप्सूल',
  'capsule': 'कैप्सूल',
  'Dose & Timing:': 'खुराक और समय:',
  'Next Visit:': 'अगली मुलाकात:',
  'week': 'सप्ताह',
  'weeks': 'सप्ताह',
  'month': 'महीना',
  'months': 'महीने',
};

// Translate text to Hindi
function translateToHindi(text: string, language: 'english' | 'hindi'): string {
  if (language === 'english') return text;
  
  let translated = text;
  Object.entries(hindiTranslations).forEach(([english, hindi]) => {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    translated = translated.replace(regex, hindi);
  });
  
  return translated;
}

// Format medicine for display
export function formatMedicineDisplay(
  prescription: DoctorPrescription,
  settings: PrescriptionSettings
): string {
  const line1Parts: string[] = [];
  const line2Parts: string[] = [];

  // Line 1: Medicine Name Potency (Quantity)
  if (settings.prescriptionShowMedicineName) {
    line1Parts.push(prescription.medicine);
  }

  if (settings.prescriptionShowPotency && prescription.potency) {
    line1Parts.push(prescription.potency);
  }

  // Add quantity in brackets with dose form if available
  if (prescription.quantity) {
    if (prescription.doseForm) {
      line1Parts.push(`(${prescription.quantity} ${prescription.doseForm})`);
    } else {
      line1Parts.push(`(${prescription.quantity})`);
    }
  }

  // Line 2: Dose & Timing: natural language description
  if (settings.prescriptionShowPattern && prescription.dosePattern) {
    const doses = prescription.dosePattern.split('-').map(d => parseInt(d) || 0);
    const [morning, afternoon, evening] = doses;
    const doseForm = (prescription.doseForm || 'dose').toLowerCase();

    const timeParts: string[] = [];
    if (morning > 0) {
      timeParts.push(`${morning} ${doseForm} morning`);
    }
    if (afternoon > 0) {
      timeParts.push(`${afternoon} ${doseForm} afternoon`);
    }
    if (evening > 0) {
      const timeLabel = afternoon > 0 ? 'night' : 'evening';
      timeParts.push(`${evening} ${doseForm} ${timeLabel}`);
    }

    if (timeParts.length > 0) {
      let doseTimingText = timeParts.join(' - ');
      
      // Add duration
      if (settings.prescriptionShowDuration && prescription.duration) {
        doseTimingText += ` for ${prescription.duration}`;
      }

      // Translate if Hindi is selected
      doseTimingText = translateToHindi(doseTimingText, settings.prescriptionLanguage);
      
      // Add "Dose & Timing:" label (translated if Hindi)
      const label = translateToHindi('Dose & Timing:', settings.prescriptionLanguage);
      line2Parts.push(`${label} ${doseTimingText}`);
    }
  }

  // Combine lines
  const line1 = line1Parts.join(' ');
  const line2 = line2Parts.join(' ');

  return line2 ? `${line1}\n${line2}` : line1;
}

// Generate prescription HTML
export function generatePrescriptionHTML(
  patient: {
    firstName: string;
    lastName: string;
    registrationNumber?: string;
    mobileNumber?: string;
    age?: number;
    sex?: string;
    address?: string;
  },
  prescriptions: DoctorPrescription[],
  visit?: {
    chiefComplaint?: string;
    diagnosis?: string;
    advice?: string;
    visitDate?: Date | string;
    nextVisit?: Date | string;
  },
  doctorName?: string
): string {
  const settings = getPrescriptionSettings();

  const patientDetailsStyle = `
    font-family: ${settings.prescriptionPatientDetailsFontFamily};
    font-size: ${settings.prescriptionPatientDetailsFontSize};
    font-weight: ${settings.prescriptionPatientDetailsFontBold ? 'bold' : 'normal'};
    font-style: ${settings.prescriptionPatientDetailsFontItalic ? 'italic' : 'normal'};
  `;

  const contentStyle = `
    font-family: ${settings.prescriptionContentFontFamily};
    font-size: ${settings.prescriptionContentFontSize};
    font-weight: ${settings.prescriptionContentFontBold ? 'bold' : 'normal'};
    font-style: ${settings.prescriptionContentFontItalic ? 'italic' : 'normal'};
    text-decoration: ${settings.prescriptionContentFontUnderline ? 'underline' : 'none'};
  `;

  const visitDate = visit?.visitDate ? new Date(visit.visitDate) : new Date();
  const nextVisitDate = visit?.nextVisit ? new Date(visit.nextVisit) : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Prescription</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: ${settings.prescriptionContentFontFamily};
          font-size: ${settings.prescriptionContentFontSize};
        }
        .prescription-page {
          width: 210mm;
          min-height: ${settings.prescriptionPageHeight};
          position: relative;
        }
        .header {
          height: ${settings.prescriptionHeaderHeight};
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .header img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .patient-details {
          background-color: #e5e7eb;
          padding: 8px 12px;
          margin-left: ${settings.prescriptionMarginLeft};
          margin-right: ${settings.prescriptionMarginRight};
          margin-top: 8px;
          ${patientDetailsStyle}
        }
        .patient-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .content {
          padding: 12px;
          margin-left: ${settings.prescriptionMarginLeft};
          margin-right: ${settings.prescriptionMarginRight};
          ${contentStyle}
          padding-bottom: 80px;
        }
        .content-section {
          margin-bottom: 12px;
        }
        .content-label {
          font-weight: bold;
          margin-bottom: 4px;
        }
        .prescription-list {
          line-height: 1.8;
        }
        .signature-container {
          margin-top: 20px;
          display: flex;
          justify-content: ${settings.prescriptionSignaturePosition === 'left' ? 'flex-start' : 'flex-end'};
          align-items: flex-end;
          gap: 12px;
        }
        .signature-seal-wrapper {
          display: flex;
          flex-direction: column;
          align-items: ${settings.prescriptionSignaturePosition === 'left' ? 'flex-start' : 'flex-end'};
          gap: 8px;
        }
        .signature-seal-wrapper img {
          max-height: 60px;
          max-width: 150px;
          object-fit: contain;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="prescription-page">
        <!-- Header -->
        ${settings.prescriptionHeaderImage ? `
          <div class="header">
            <img src="${settings.prescriptionHeaderImage}" alt="Header" />
          </div>
        ` : ''}

        <!-- Patient Details -->
        <div class="patient-details">
          <div class="patient-row">
            ${settings.prescriptionShowName ? `
              <div>
                <strong>Name:</strong> ${patient.firstName} ${patient.lastName}${settings.prescriptionShowAge && patient.age ? ` (${patient.age} yrs)` : ''}
              </div>
            ` : '<div></div>'}
            ${settings.prescriptionShowDate ? `<div><strong>Date:</strong> ${visitDate.toLocaleDateString('en-IN')}</div>` : '<div></div>'}
          </div>
          <div class="patient-row">
            ${settings.prescriptionShowRegNo && patient.registrationNumber ? `<div><strong>Regd No:</strong> ${patient.registrationNumber}</div>` : '<div></div>'}
            ${settings.prescriptionShowMobile && patient.mobileNumber ? `<div><strong>Mobile No:</strong> ${patient.mobileNumber}</div>` : '<div></div>'}
          </div>
          <div class="patient-row">
            <div>
              ${settings.prescriptionShowDoctorName && doctorName ? `<div>${doctorName}</div>` : ''}
              ${settings.prescriptionShowAddress && patient.address ? `<div style="font-size: 0.9em; color: #666;">${patient.address}</div>` : ''}
            </div>
            <div>
              ${settings.prescriptionShowSex && patient.sex ? `<span><strong>Sex:</strong> ${patient.sex}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="content">
          ${settings.prescriptionShowChiefComplaint && visit?.chiefComplaint ? `
            <div class="content-section">
              <div class="content-label">Chief Complaint:</div>
              <div>${visit.chiefComplaint}</div>
            </div>
          ` : ''}

          ${visit?.diagnosis ? `
            <div class="content-section">
              <div class="content-label">Diagnosis:</div>
              <div>${visit.diagnosis}</div>
            </div>
          ` : ''}

          <div class="content-section">
            <div class="content-label">Rx:</div>
            <div class="prescription-list">
              ${prescriptions.map((rx, index) => {
                const medicineText = formatMedicineDisplay(rx, settings);
                const lines = medicineText.split('\n');
                return `
                  <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
                    ${index + 1}. ${lines.join('<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${visit?.advice ? `
            <div class="content-section">
              <div class="content-label">Advice:</div>
              <div>${visit.advice}</div>
            </div>
          ` : ''}

          ${settings.prescriptionShowNextVisit && nextVisitDate ? `
            <div class="content-section">
              <div class="content-label">${translateToHindi('Next Visit:', settings.prescriptionLanguage)}</div>
              <div>${translateToHindi(nextVisitDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), settings.prescriptionLanguage)}</div>
            </div>
          ` : ''}

          <!-- Signature and Seal -->
          ${settings.prescriptionDoctorSignature || settings.prescriptionDoctorSeal ? `
            <div class="signature-container">
              <div class="signature-seal-wrapper">
                ${settings.prescriptionDoctorSignature ? `<img src="${settings.prescriptionDoctorSignature}" alt="Signature" />` : ''}
                ${settings.prescriptionDoctorSeal ? `<img src="${settings.prescriptionDoctorSeal}" alt="Seal" />` : ''}
              </div>
            </div>
          ` : ''}
        </div>

        ${settings.prescriptionFooterImage ? `
          <div style="position: fixed; bottom: 0; left: 0; right: 0; height: ${settings.prescriptionFooterHeight}; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img src="${settings.prescriptionFooterImage}" alt="Footer" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}
