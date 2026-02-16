import { NextRequest, NextResponse } from "next/server";

interface ParsedPrescription {
  medicineName: string;
  potency: string;
  quantity: string;
  doseForm: string;
  dosePerIntake: string;
  frequency: string;
  pattern: string;
  duration: string;
  prescriptionText: string;
}

// Fallback regex parser for when AI is not available
function parseWithRegex(input: string): ParsedPrescription {
  const text = input.trim().toLowerCase();
  const originalText = input.trim();

  const frequencyMap: Record<string, { pattern: string; frequency: string }> = {
    od: { pattern: "1-0-0", frequency: "OD" },
    bd: { pattern: "1-0-1", frequency: "BD" },
    tds: { pattern: "1-1-1", frequency: "TDS" },
    tid: { pattern: "1-1-1", frequency: "TDS" },
    qid: { pattern: "1-1-1-1", frequency: "QID" },
    hs: { pattern: "0-0-1", frequency: "HS" },
    sos: { pattern: "SOS", frequency: "SOS" },
    weekly: { pattern: "Weekly", frequency: "Weekly" },
    monthly: { pattern: "Monthly", frequency: "Monthly" },
  };

  const durationMatch = text.match(/(\d+)\s*(days?|weeks?|months?)/i);
  const duration = durationMatch ? `${durationMatch[1]} ${durationMatch[2]}` : "";

  let quantity = "";
  const fractionQuantityMatch = text.match(/(\d+)\/(\d+)\s*(dr|oz|ml)/i);
  if (fractionQuantityMatch) {
    quantity = `${fractionQuantityMatch[1]}/${fractionQuantityMatch[2]}${fractionQuantityMatch[3]}`;
  } else {
    const wholeQuantityMatch = text.match(/(?<!\/)(\d+)\s*(dr|oz|ml)\b/i);
    if (wholeQuantityMatch) {
      quantity = `${wholeQuantityMatch[1]}${wholeQuantityMatch[2]}`;
    }
  }

  let doseForm = "";
  let dosePerIntake = "";
  const doseFormWithNumberMatch = text.match(/(\d+)\s*(pills?|drops?|tablets?|capsules?|powder|ointment|cream)\b/i);
  if (doseFormWithNumberMatch) {
    doseForm = doseFormWithNumberMatch[2].toLowerCase();
    dosePerIntake = doseFormWithNumberMatch[1];
  } else {
    const doseFormNoNumberMatch = text.match(/\b(pills?|drops?|tablets?|capsules?|liquid|powder|ointment|cream)\b/i);
    if (doseFormNoNumberMatch) {
      doseForm = doseFormNoNumberMatch[1].toLowerCase();
      dosePerIntake = "";
    }
  }

  let frequency = "";
  let pattern = "";
  const customPatternMatch = text.match(/\b(\d+)-(\d+)-(\d+)\b/);
  if (customPatternMatch) {
    pattern = `${customPatternMatch[1]}-${customPatternMatch[2]}-${customPatternMatch[3]}`;
    const doses = [customPatternMatch[1], customPatternMatch[2], customPatternMatch[3]].map(Number);
    const nonZeroDoses = doses.filter(d => d > 0).length;
    if (nonZeroDoses === 1) frequency = "OD";
    else if (nonZeroDoses === 2) frequency = "BD";
    else if (nonZeroDoses === 3) frequency = "TDS";
    else if (nonZeroDoses === 4) frequency = "QID";
  } else {
    for (const [key, value] of Object.entries(frequencyMap)) {
      if (text.includes(key)) {
        frequency = value.frequency;
        pattern = value.pattern;
        break;
      }
    }
  }

  const potencyMatch = text.match(/\b(\d+)\s*(c|ch|m|x)\b/i);
  let potency = potencyMatch ? `${potencyMatch[1]}${potencyMatch[2].toUpperCase()}` : "";

  let medicineName = "";
  const words = originalText.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lowerWord = word.toLowerCase();
    
    if (/^\d+[cchmx]$/i.test(word)) break;
    if (/^\d+\/\d+/.test(word)) break;
    if (/^\d+$/.test(word)) {
      const nextWord = words[i + 1]?.toLowerCase();
      if (nextWord && /^[cchmx]$/.test(nextWord)) break;
      const numVal = parseInt(word);
      if ([1, 3, 6, 12, 30, 60, 100, 200, 1000, 10000].includes(numVal) && !potency) break;
    }
    if (["dr", "oz", "ml", "pills", "drops", "tablets", "capsules", "liquid", "powder", "ointment", "cream"].includes(lowerWord)) break;
    if (Object.keys(frequencyMap).includes(lowerWord)) break;
    if (["for", "days", "weeks", "months"].includes(lowerWord)) break;
    if (/^\d+-\d+-\d+$/.test(word)) break;
    
    medicineName = medicineName ? `${medicineName} ${word}` : word;
  }

  medicineName = medicineName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  let prescriptionText = "";
  if (medicineName && potency) {
    prescriptionText = `${medicineName} ${potency}`;
  } else if (medicineName) {
    prescriptionText = medicineName;
  }

  if (dosePerIntake && doseForm && pattern) {
    const doses = pattern.split("-");
    if (doses.length === 3 && !pattern.includes("SOS") && !pattern.includes("Weekly") && !pattern.includes("Monthly")) {
      const morning = doses[0] !== "0" ? `${dosePerIntake} ${doseForm} morning` : "";
      const afternoon = doses[1] !== "0" ? `${dosePerIntake} ${doseForm} afternoon` : "";
      const evening = doses[2] !== "0" ? `${dosePerIntake} ${doseForm} night` : "";
      const parts = [morning, afternoon, evening].filter(Boolean);
      if (parts.length > 0) prescriptionText += `\n${parts.join(" – ")}`;
    } else if (pattern === "SOS") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} SOS`;
    } else if (pattern === "Weekly") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} Weekly`;
    } else if (pattern === "Monthly") {
      prescriptionText += `\n${dosePerIntake} ${doseForm} Monthly`;
    }
  }

  if (duration) prescriptionText += `\nfor ${duration}`;

  return {
    medicineName,
    potency,
    quantity,
    doseForm,
    dosePerIntake,
    frequency,
    pattern,
    duration,
    prescriptionText,
  };
}

// Parse with Groq (FREE AI - Llama 3)
async function parseWithGroq(input: string, apiKey: string): Promise<ParsedPrescription | null> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a homeopathic prescription parser. Extract the following fields from the prescription text and return ONLY a JSON object (no markdown, no explanation):
- medicineName: The full medicine name (e.g., "Ars Alb", "Nux Vomica", "Arnica Montana")
- potency: The potency (e.g., "1M", "200C", "30CH", "6X")
- quantity: The quantity with unit (e.g., "1/2oz", "2dr", "30ml")
- doseForm: The form (e.g., "pills", "drops", "liquid", "tablets")
- dosePerIntake: Number of pills/drops per dose (e.g., "4", "2")
- frequency: Abbreviated frequency (e.g., "OD", "BD", "TDS", "QID", "HS", "SOS", "Weekly")
- pattern: Dosing pattern (e.g., "1-0-0" for OD, "1-0-1" for BD, "1-1-1" for TDS, "6-6-6" for 6-6-6 pattern)
- duration: Duration with unit (e.g., "7 days", "4 weeks", "1 month")

Common homeopathic abbreviations:
- OD = once daily (pattern: 1-0-0)
- BD = twice daily (pattern: 1-0-1)
- TDS = three times daily (pattern: 1-1-1)
- QID = four times daily (pattern: 1-1-1-1)
- HS = at bedtime (pattern: 0-0-1)
- SOS = as needed

Return ONLY valid JSON, no other text.`
          },
          {
            role: "user",
            content: input
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("Groq API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("No content in Groq response");
      return null;
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    // Generate prescription text
    let prescriptionText = "";
    if (parsed.medicineName && parsed.potency) {
      prescriptionText = `${parsed.medicineName} ${parsed.potency}`;
    } else if (parsed.medicineName) {
      prescriptionText = parsed.medicineName;
    }

    if (parsed.dosePerIntake && parsed.doseForm && parsed.pattern) {
      const doses = parsed.pattern.split("-");
      if (doses.length === 3 && !parsed.pattern.includes("SOS") && !parsed.pattern.includes("Weekly") && !parsed.pattern.includes("Monthly")) {
        const morning = doses[0] !== "0" ? `${parsed.dosePerIntake} ${parsed.doseForm} morning` : "";
        const afternoon = doses[1] !== "0" ? `${parsed.dosePerIntake} ${parsed.doseForm} afternoon` : "";
        const evening = doses[2] !== "0" ? `${parsed.dosePerIntake} ${parsed.doseForm} night` : "";
        const parts = [morning, afternoon, evening].filter(Boolean);
        if (parts.length > 0) prescriptionText += `\n${parts.join(" – ")}`;
      }
    }

    if (parsed.duration) prescriptionText += `\nfor ${parsed.duration}`;

    return {
      medicineName: parsed.medicineName || "",
      potency: parsed.potency || "",
      quantity: parsed.quantity || "",
      doseForm: parsed.doseForm || "",
      dosePerIntake: parsed.dosePerIntake || "",
      frequency: parsed.frequency || "",
      pattern: parsed.pattern || "",
      duration: parsed.duration || "",
      prescriptionText,
    };
  } catch (error) {
    console.error("Error parsing with Groq:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { input, apiKey } = await request.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    // If API key provided, use AI parsing
    if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
      const aiResult = await parseWithGroq(input, apiKey.trim());
      if (aiResult) {
        return NextResponse.json({ 
          success: true, 
          data: aiResult,
          method: "ai"
        });
      }
      // Fall back to regex if AI fails
      console.log("AI parsing failed, falling back to regex");
    }

    // Use regex parser as fallback
    const result = parseWithRegex(input);
    return NextResponse.json({ 
      success: true, 
      data: result,
      method: "regex"
    });
  } catch (error) {
    console.error("Parse prescription error:", error);
    return NextResponse.json(
      { error: "Failed to parse prescription" },
      { status: 500 }
    );
  }
}
