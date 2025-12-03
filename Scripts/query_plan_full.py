import fitz  # PyMuPDF
from pdfminer.high_level import extract_text
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle

# ---------- Step 1: Extract text from the plan ----------
plan_path = r"C:\Users\mcava\OneDrive\Apps\PlanPath\Plans\230209_VIRGINIA ST RESIDENCE - RESUBMITTAL.pdf"

def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception:
        return extract_text(pdf_path)

plan_text = extract_text_from_pdf(plan_path)

# ---------- Step 2: Chunk the plan ----------
def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

plan_chunks = chunk_text(plan_text)

# ---------- Step 3: Generate embeddings for plan chunks ----------
model = SentenceTransformer("all-MiniLM-L6-v2")

plan_embeddings = []
for i, chunk in enumerate(plan_chunks):
    vector = model.encode(chunk)
    plan_embeddings.append({
        "chunk_id": i,
        "embedding": vector,
        "text": chunk
    })

print(f"Generated {len(plan_embeddings)} embeddings for the plan.")

# ---------- Step 4: Load FAISS index + metadata ----------
index = faiss.read_index("codes.index")
with open("codes_metadata.pkl", "rb") as f:
    code_embeddings = pickle.load(f)

print(f"Loaded FAISS index with {index.ntotal} code chunks.")

# ---------- Step 5: Query each plan chunk ----------
for plan_chunk in plan_embeddings:
    query_vector = plan_chunk["embedding"].astype("float32")
    D, I = index.search(np.array([query_vector]), k=3)  # top 3 matches per chunk

    print(f"\nPlan Chunk {plan_chunk['chunk_id']} (preview):")
    print(plan_chunk["text"][:200])  # preview first 200 chars of plan chunk
    print("Top matches in building codes:")

    for idx in I[0]:
        print("  Source:", code_embeddings[idx]["source"])
        print("  Text:", code_embeddings[idx]["text"][:200])  # preview first 200 chars
        print("  ----")