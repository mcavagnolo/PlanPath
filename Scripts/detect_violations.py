import os
import fitz
import argparse
import glob
from pdfminer.high_level import extract_text
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
# Try to load from .env.local in the project root (one level up)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
load_dotenv(env_path)

# Initialize OpenAI client
# Check for both standard OPENAI_API_KEY and NEXT_PUBLIC_OPENAI_API_KEY
api_key = os.getenv("OPENAI_API_KEY") or os.getenv("NEXT_PUBLIC_OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception:
        return extract_text(pdf_path)

def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def summarize_violation(plan_text, code_text):
    """
    Uses OpenAI API to compare plan text against building code for violations.
    """
    if not client.api_key or client.api_key == "your_api_key_here":
        return f"AI Analysis Skipped (No API Key).\n- Plan: {plan_text[:100]}...\n- Code: {code_text[:100]}..."

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert building code compliance auditor. Analyze the provided plan text against the building code text. Identify any potential violations or non-compliance issues. If a violation exists, explain it clearly. If no violation is found, state 'No violation detected'."},
                {"role": "user", "content": f"Plan Text:\n{plan_text}\n\nBuilding Code Text:\n{code_text}"}
            ],
            temperature=0.3,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error during AI analysis: {str(e)}"

def process_plan(plan_path, index, code_embeddings, model, k_matches, output_dir):
    print(f"Processing: {plan_path}")
    plan_filename = os.path.basename(plan_path)
    report_filename = os.path.join(output_dir, f"violations_{plan_filename.replace('.pdf', '')}.txt")
    
    plan_text = extract_text_from_pdf(plan_path)
    plan_chunks = chunk_text(plan_text)
    
    # Generate embeddings for plan chunks
    plan_embeddings = []
    for i, chunk in enumerate(plan_chunks):
        vector = model.encode(chunk)
        plan_embeddings.append({
            "chunk_id": i,
            "embedding": vector,
            "text": chunk
        })
    
    with open(report_filename, "w", encoding="utf-8") as report:
        report.write(f"Violation Report for Plan: {plan_filename}\n")
        report.write("="*80 + "\n\n")
        
        for plan_chunk in plan_embeddings:
            query_vector = plan_chunk["embedding"].astype("float32")
            D, I = index.search(np.array([query_vector]), k=k_matches)
            
            for idx in I[0]:
                code_match = code_embeddings[idx]
                violation_summary = summarize_violation(plan_chunk["text"], code_match["text"])
                
                # Only report if it's not a "No violation" result to reduce noise
                if "No violation detected" not in violation_summary:
                    report.write(f"--- Potential Violation Detected ---\n")
                    report.write(f"Plan Section (Chunk {plan_chunk['chunk_id']}):\n{plan_chunk['text'][:200]}...\n\n")
                    report.write(f"Reference Code ({code_match['source']}):\n{code_match['text'][:200]}...\n\n")
                    report.write(f"Analysis:\n{violation_summary}\n")
                    report.write("-" * 50 + "\n\n")
    
    print(f"Report saved: {report_filename}")

def main():
    parser = argparse.ArgumentParser(description="Detect building code violations in PDF plans.")
    parser.add_argument("--plan_path", type=str, required=True, help="Path to a PDF plan or directory of plans.")
    parser.add_argument("--k", type=int, default=3, help="Number of code matches to retrieve per chunk.")
    parser.add_argument("--output_dir", type=str, default=".", help="Directory to save reports.")
    
    args = parser.parse_args()
    
    # Load FAISS index and metadata
    if not os.path.exists("codes.index") or not os.path.exists("codes_metadata.pkl"):
        print("Error: FAISS index or metadata not found. Run process_codes_faiss.py first.")
        return

    index = faiss.read_index("codes.index")
    with open("codes_metadata.pkl", "rb") as f:
        code_embeddings = pickle.load(f)
        
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Handle single file or directory
    if os.path.isdir(args.plan_path):
        pdf_files = glob.glob(os.path.join(args.plan_path, "*.pdf"))
        for pdf_file in pdf_files:
            process_plan(pdf_file, index, code_embeddings, model, args.k, args.output_dir)
    elif os.path.isfile(args.plan_path):
        process_plan(args.plan_path, index, code_embeddings, model, args.k, args.output_dir)
    else:
        print(f"Error: Path not found: {args.plan_path}")

if __name__ == "__main__":
    main()