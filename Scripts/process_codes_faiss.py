import os
import numpy as np
import faiss
from docx import Document
import fitz  # PyMuPDF
from pdfminer.high_level import extract_text
from sentence_transformers import SentenceTransformer
import pickle

# Parent folder containing all your code files (.docx and .pdf)
parent_folder = r"C:\Users\mcava\OneDrive\Apps\PlanPath\Codes"

# ---------- Step 1: Extract text ----------
def extract_text_from_docx(docx_path):
    doc = Document(docx_path)
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception:
        return extract_text(pdf_path)

# ---------- Step 2: Chunk text ----------
def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

# ---------- Step 3: Generate embeddings ----------
model = SentenceTransformer("all-MiniLM-L6-v2")

all_embeddings = []
vectors = []

for root, dirs, files in os.walk(parent_folder):
    for filename in files:
        file_path = os.path.join(root, filename)

        if filename.lower().endswith(".docx"):
            text = extract_text_from_docx(file_path)
        elif filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(file_path)
        else:
            continue

        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            vector = model.encode(chunk)
            all_embeddings.append({
                "source": filename,
                "chunk_id": i,
                "embedding": vector,
                "text": chunk
            })
            vectors.append(vector)

# ---------- Step 4: Store in FAISS ----------
dimension = len(vectors[0])  # embedding size
index = faiss.IndexFlatL2(dimension)

vectors_np = np.array(vectors).astype("float32")
index.add(vectors_np)

print(f"FAISS index size: {index.ntotal}")

# ---------- Step 5: Save FAISS index + metadata ----------
faiss.write_index(index, "codes.index")

with open("codes_metadata.pkl", "wb") as f:
    pickle.dump(all_embeddings, f)

print("Embeddings and FAISS index saved successfully!")