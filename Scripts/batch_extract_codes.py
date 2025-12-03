import os
from docx import Document
import fitz  # PyMuPDF
from pdfminer.high_level import extract_text

# Set this to the parent folder that contains all your city code subfolders
parent_folder = r"C:\Users\mcava\OneDrive\Apps\PlanPath\Codes"

def extract_text_from_docx(docx_path):
    doc = Document(docx_path)
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_pdf(pdf_path):
    try:
        # Try PyMuPDF first
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception:
        # Fallback to pdfminer
        return extract_text(pdf_path)

# Walk through all subfolders and files
for root, dirs, files in os.walk(parent_folder):
    for filename in files:
        file_path = os.path.join(root, filename)
        
        if filename.lower().endswith(".docx"):
            text = extract_text_from_docx(file_path)
        elif filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(file_path)
        else:
            continue  # skip non-docx/pdf files
        
        # Save extracted text to a .txt file alongside the original
        output_path = file_path + ".txt"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        print(f"Processed: {file_path} -> {output_path}")