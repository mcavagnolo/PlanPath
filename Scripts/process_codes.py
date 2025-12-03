import os
from docx import Document
import fitz  # PyMuPDF
from pdfminer.high_level import extract_text
from sentence_transformers import SentenceTransformer

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

print(f"Total embeddings created: {len(all_embeddings)}")
print("Example embedding entry:")
print(all_embeddings[0]["source"], all_embeddings[0]["chunk_id"])
print(all_embeddings[0]["text"][:300])  # preview first 300 chars