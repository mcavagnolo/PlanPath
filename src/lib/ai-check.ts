import OpenAI from 'openai';
import { ref, listAll, getBytes } from 'firebase/storage';
import { storage } from './firebase';

export interface Conflict {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  codeReference: string;
}

function getKeywords(buildingType: string): string[] {
  const baseKeywords = ["code", "regulation", "compliance", "violation", "requirement", "standard", "section", "chapter", "table", "figure"];
  const typeKeywords = buildingType.toLowerCase().split(/\s+/).filter(k => k.length > 2); 
  const commonTerms = ["height", "setback", "area", "width", "depth", "egress", "stair", "fire", "safety", "zone", "district", "use", "occupancy", "parking", "access", "material", "construction"];
  
  return Array.from(new Set([...baseKeywords, ...typeKeywords, ...commonTerms]));
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
async function extractTextFromPdf(data: ArrayBuffer, keywords: string[]): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues with canvas/DOM
    const pdfjsLib = await import('pdfjs-dist');
    
    // Initialize worker with stable version
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let relevantText = '';
    let totalChars = 0;
    const MAX_CHARS = 20000; // Approx 5k tokens
    
    // Scan ALL pages (or up to a reasonable limit like 50 to prevent timeouts)
    const maxPagesToScan = Math.min(pdf.numPages, 50);
    
    for (let i = 1; i <= maxPagesToScan; i++) {
      if (totalChars >= MAX_CHARS) break;

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      // Simple keyword matching
      const lowerPageText = pageText.toLowerCase();
      const hasKeyword = keywords.some(kw => lowerPageText.includes(kw.toLowerCase()));

      if (hasKeyword) {
        relevantText += `--- Page ${i} (Relevant) ---\n${pageText}\n`;
        totalChars += pageText.length;
      }
    }
    
    // Fallback: If no keywords found, return first 3 pages
    if (!relevantText) {
       for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          relevantText += `--- Page ${i} ---\n${pageText}\n`;
       }
    }
    
    return relevantText;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return "Error parsing PDF document.";
  }
}

// Helper to fetch and read documents from a specific path
async function fetchDocumentsFromPath(path: string, keywords: string[]): Promise<string> {
  try {
    const folderRef = ref(storage, path);
    const res = await listAll(folderRef);
    
    let context = "";

    // Process ALL files, but stop when context is large enough
    // We remove the strict 1-file limit but add a total size limit
    
    for (const itemRef of res.items) {
      if (context.length > 30000) break; // Global safety limit for this folder (approx 7.5k tokens)

      try {
        // Download file content
        const bytes = await getBytes(itemRef);
        
        let text = "";
        if (itemRef.name.toLowerCase().endsWith('.pdf')) {
          text = await extractTextFromPdf(bytes, keywords);
        } else {
          // Assume text file
          text = new TextDecoder().decode(bytes);
          // For text files, we just take the first 10k chars for now
          text = text.substring(0, 10000);
        }

        if (text.length > 0) {
          context += `\n\n=== DOCUMENT: ${itemRef.name} (from ${path}) ===\n${text}\n`;
        }
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

// Helper to list available documents for a jurisdiction
export async function listDocumentsForJurisdiction(
  jurisdiction: { state: string, county: string, city: string }
): Promise<{ name: string, path: string, type: string }[]> {
  const documents: { name: string, path: string, type: string }[] = [];

  const paths = [
    { type: 'State', path: `knowledge-base/State/${jurisdiction.state}` },
    { type: 'County', path: `knowledge-base/County/${jurisdiction.county}` },
    { type: 'City', path: `knowledge-base/City/${jurisdiction.city}` }
  ];

  for (const p of paths) {
    if (!p.path.endsWith('/')) { // Basic check, though empty strings might be passed
       try {
         // Skip if the jurisdiction part is empty (e.g. no city selected)
         const parts = p.path.split('/');
         if (!parts[2]) continue; 

         const folderRef = ref(storage, p.path);
         const res = await listAll(folderRef);
         
         res.items.forEach(item => {
           documents.push({
             name: item.name,
             path: item.fullPath,
             type: p.type
           });
         });
       } catch (error) {
         // Ignore errors (e.g. folder doesn't exist)
         console.log(`No documents found for ${p.type} at ${p.path}`);
       }
    }
  }

  return documents;
}

export async function checkBuildingPlan(
  file: File,
  location: string,
  buildingType: string,
  jurisdiction?: { state: string, county: string, city: string },
  apiKey?: string,
  selectedDocumentPath?: string
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

    // Generate keywords for filtering
    const keywords = getKeywords(buildingType);
    console.log("Using keywords for filtering:", keywords);

    // Fetch actual code documents
    if (selectedDocumentPath) {
       console.log(`Fetching selected document: ${selectedDocumentPath}`);
       // Fetch ONLY the selected document
       // We can reuse fetchDocumentsFromPath but we need to pass the folder path and maybe filter?
       // Actually fetchDocumentsFromPath takes a folder path. 
       // Let's create a helper to fetch a single file or just use getBytes directly here.
       
       try {
         const fileRef = ref(storage, selectedDocumentPath);
         const bytes = await getBytes(fileRef);
         let text = "";
         if (selectedDocumentPath.toLowerCase().endsWith('.pdf')) {
            // Still use keyword filtering for the single large PDF
            text = await extractTextFromPdf(bytes, keywords);
         } else {
            text = new TextDecoder().decode(bytes);
            text = text.substring(0, 20000); // Larger limit for single file
         }
         
         jurisdictionContext += `\n\nREFERENCE BUILDING CODES (Selected Document: ${fileRef.name}):\n${text}`;
       } catch (err) {
         console.error("Error reading selected document:", err);
         jurisdictionContext += `\n\n(Error reading selected document. Using general knowledge.)`;
       }

    } else if (jurisdiction) {
      console.log("Fetching jurisdiction documents...");
      const stateDocs = jurisdiction.state ? await fetchDocumentsFromPath(`knowledge-base/State/${jurisdiction.state}`, keywords) : "";
      const countyDocs = jurisdiction.county ? await fetchDocumentsFromPath(`knowledge-base/County/${jurisdiction.county}`, keywords) : "";
      const cityDocs = jurisdiction.city ? await fetchDocumentsFromPath(`knowledge-base/City/${jurisdiction.city}`, keywords) : "";
      
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
