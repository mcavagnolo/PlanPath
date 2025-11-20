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

// Helper to convert first page of PDF to Image (Base64)
async function convertPdfToImage(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    
    // Hardcode a stable version for the worker to avoid 404s with newer/beta versions
    // Using version 3.11.174 which is stable and widely available on cdnjs
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Get first page
    
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error("Canvas context not available");
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // @ts-ignore - pdfjs-dist types mismatch for render context
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    
    return canvas.toDataURL('image/jpeg');
  } catch (error) {
    console.error("Error converting PDF to image:", error);
    throw new Error("Failed to convert PDF plan to image.");
  }
}

// Helper to extract text from a PDF file (ArrayBuffer)
async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues with canvas/DOM
    const pdfjsLib = await import('pdfjs-dist');
    
    // Initialize worker with stable version
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    
    // Limit to first 5 pages to avoid token limits (TPM) on new accounts
    const maxPages = Math.min(pdf.numPages, 5);
    
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

    // Limit to first 1 file per folder to manage context size and stay within TPM limits
    const filesToProcess = res.items.slice(0, 1);

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

        // Truncate to 10,000 characters (approx 2,500 tokens) per file
        context += `\n\n=== DOCUMENT: ${itemRef.name} (from ${path}) ===\n${text.substring(0, 10000)}... [truncated]\n`;
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
  
  try {
    let base64Image = "";
    
    if (file.type === 'application/pdf') {
      console.log("Converting PDF plan to image...");
      base64Image = await convertPdfToImage(file);
    } else {
      base64Image = await toBase64(file);
    }
    
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
