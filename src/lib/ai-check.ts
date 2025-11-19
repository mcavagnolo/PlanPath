import OpenAI from 'openai';

export interface Conflict {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  codeReference: string;
}

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side execution
});

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

export async function checkBuildingPlan(
  file: File,
  location: string,
  buildingType: string
): Promise<Conflict[]> {
  
  // Basic validation for file type
  if (file.type === 'application/pdf') {
    // Note: GPT-4o Vision does not support PDF directly in this manner without conversion.
    // For this prototype, we will return a mock error or handle it gracefully.
    // In a full production app, we would convert PDF pages to images first.
    console.warn("PDF upload detected. AI Vision works best with Images (PNG/JPG).");
    // Proceeding might fail or we can fallback to mock for PDF for now.
    // Let's try to proceed but warn the user in the UI (handled by caller).
  }

  try {
    const base64Image = await toBase64(file);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert building code compliance auditor. 
          Analyze the provided floor plan image against building codes for the specified location and building type.
          Identify specific code violations or potential conflicts.
          
          Return ONLY a JSON object with a "conflicts" array. 
          Each conflict object must have:
          - id: string (unique)
          - description: string (clear explanation of the violation)
          - severity: "high" | "medium" | "low"
          - codeReference: string (cite the specific code section, e.g., "IBC 1005.1")
          
          If no conflicts are found, return an empty array.
          Err on the side of caution (false positives are better than missed violations).`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Location: ${location}\nBuilding Type: ${buildingType}` },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096
    });

    const content = response.choices[0].message.content;
    if (!content) return [];

    const result = JSON.parse(content);
    return result.conflicts || [];

  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw new Error("Failed to analyze plan with AI.");
  }
}
