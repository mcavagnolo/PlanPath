import OpenAI from 'openai';
import { ref, listAll, getBytes } from 'firebase/storage';
import { storage } from './firebase';

export interface Conflict {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  codeReference: string;
}

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

// Helper to extract text from a PDF file (ArrayBuffer)
async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues with canvas/DOM
    const pdfjsLib = await import('pdfjs-dist');
    
    // Initialize worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    
    // Limit to first 20 pages to avoid token limits and performance issues
    const maxPages = Math.min(pdf.numPages, 20);
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return "Error parsing PDF document.";
  }
}

// Helper to fetch and read documents from a specific path
async function fetchDocumentsFromPath(path: string): Promise<string> {
  try {
    const folderRef = ref(storage, path);
    const res = await listAll(folderRef);
    
    let context = "";

    // Limit to first 3 files per folder to manage context size
    const filesToProcess = res.items.slice(0, 3);

    for (const itemRef of filesToProcess) {
      try {
        // Download file content
        const bytes = await getBytes(itemRef);
        
        let text = "";
        if (itemRef.name.toLowerCase().endsWith('.pdf')) {
          text = await extractTextFromPdf(bytes);
        } else {
          // Assume text file
          text = new TextDecoder().decode(bytes);
        }

        context += `\n\n=== DOCUMENT: ${itemRef.name} (from ${path}) ===\n${text.substring(0, 20000)}... [truncated]\n`;
      } catch (err) {
        console.warn(`Failed to read file ${itemRef.name}:`, err);
      }
    }
    
    return context;
  } catch (error) {
    console.warn(`Error listing files in ${path}:`, error);
    return "";
  }
}

export async function checkBuildingPlan(
  file: File,
  location: string,
  buildingType: string,
  jurisdiction?: { state: string, county: string, city: string },
  apiKey?: string
): Promise<Conflict[]> {
  
  if (!apiKey) {
    throw new Error("OpenAI API Key is required.");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
  
  // Basic validation for file type
  if (file.type === 'application/pdf') {
    console.warn("PDF upload detected. AI Vision works best with Images (PNG/JPG).");
  }

  try {
    const base64Image = await toBase64(file);
    
    let jurisdictionContext = jurisdiction 
      ? `Jurisdiction: State of ${jurisdiction.state}, County of ${jurisdiction.county}, City of ${jurisdiction.city}.`
      : '';

    // Fetch actual code documents
    if (jurisdiction) {
      console.log("Fetching jurisdiction documents...");
      const stateDocs = jurisdiction.state ? await fetchDocumentsFromPath(`knowledge-base/State/${jurisdiction.state}`) : "";
      const countyDocs = jurisdiction.county ? await fetchDocumentsFromPath(`knowledge-base/County/${jurisdiction.county}`) : "";
      const cityDocs = jurisdiction.city ? await fetchDocumentsFromPath(`knowledge-base/City/${jurisdiction.city}`) : "";
      
      if (stateDocs || countyDocs || cityDocs) {
        jurisdictionContext += `\n\nREFERENCE BUILDING CODES:\n${stateDocs}\n${countyDocs}\n${cityDocs}`;
      } else {
        jurisdictionContext += `\n\n(No specific code documents found in Knowledge Base. Using general knowledge.)`;
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert building code compliance auditor. 
          Analyze the provided floor plan image against building codes for the specified location and building type.
          
          ${jurisdictionContext}

          Building Type: ${buildingType}
          Location: ${location}

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
