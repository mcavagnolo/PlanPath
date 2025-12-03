import os

# Parent folder where all your .txt files live
parent_folder = r"C:\Users\mcava\OneDrive\Apps\PlanPath\Codes"

def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

all_chunks = []

# Walk through all subfolders and files
for root, dirs, files in os.walk(parent_folder):
    for filename in files:
        if filename.lower().endswith(".txt"):
            file_path = os.path.join(root, filename)
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            
            chunks = chunk_text(text)
            for i, chunk in enumerate(chunks):
                all_chunks.append({
                    "source": filename,
                    "chunk_id": i,
                    "text": chunk
                })

print(f"Total chunks created: {len(all_chunks)}")
print(all_chunks[0]["text"][:500])  # preview first chunk