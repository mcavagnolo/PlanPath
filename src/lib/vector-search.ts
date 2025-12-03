import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use the hosted models (or local if we set it up)
// We'll use the default CDN for now.
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface CodeChunk {
  id: number;
  text: string;
  source: string;
  embedding: number[];
}

let knowledgeBase: CodeChunk[] | null = null;
let embedder: any = null;

async function loadKnowledgeBase() {
  if (knowledgeBase) return knowledgeBase;
  
  try {
    // Adjust path if deployed to a subdirectory (GitHub Pages usually /PlanPath/)
    // We can use a relative path or check window.location
    const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/PlanPath') 
      ? '/PlanPath' 
      : '';
      
    const response = await fetch(`${basePath}/knowledge_base.json`);
    if (!response.ok) throw new Error("Failed to load knowledge base");
    knowledgeBase = await response.json();
    console.log(`Loaded ${knowledgeBase?.length} code chunks.`);
    return knowledgeBase;
  } catch (error) {
    console.error("Error loading knowledge base:", error);
    return [];
  }
}

async function getEmbedder() {
  if (embedder) return embedder;
  
  console.log("Loading embedding model...");
  // Use a smaller quantized model for browser
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return embedder;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findRelevantCodeSections(
  queryText: string, 
  topK: number = 5,
  filter?: { state?: string, county?: string, city?: string }
): Promise<CodeChunk[]> {
  const kb = await loadKnowledgeBase();
  if (!kb || kb.length === 0) return [];
  
  const generateEmbedding = await getEmbedder();
  
  // Generate embedding for the query
  const output = await generateEmbedding(queryText, { pooling: 'mean', normalize: true });
  const queryVector = Array.from(output.data) as number[];
  
  // Filter KB first if needed
  let candidates = kb;
  if (filter) {
    candidates = kb.filter(chunk => {
      const source = chunk.source.toLowerCase();
      // Simple inclusion check. Adjust based on actual source path format.
      // Example source: "City - El Segundo/Chapter 1..."
      if (filter.city && source.includes(filter.city.toLowerCase())) return true;
      if (filter.county && source.includes(filter.county.toLowerCase())) return true;
      if (filter.state && source.includes(filter.state.toLowerCase())) return true;
      // If no specific match but we have a filter, maybe we should be strict?
      // For now, let's assume if it matches ANY of the jurisdiction parts, it's good.
      return false;
    });
    
    // If filtering removed everything (e.g. mismatch names), fall back to full KB or return empty?
    // Let's fall back to full KB to be safe, or maybe just warn.
    if (candidates.length === 0) {
      console.warn("No documents matched filter, searching entire knowledge base.");
      candidates = kb;
    }
  }

  // Calculate similarity
  const scoredChunks = candidates.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.embedding)
  }));
  
  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);
  
  return scoredChunks.slice(0, topK);
}
