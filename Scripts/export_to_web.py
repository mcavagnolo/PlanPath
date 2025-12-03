import pickle
import faiss
import json
import numpy as np
import os

def export_to_json():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(script_dir, "codes.index")
    metadata_path = os.path.join(script_dir, "codes_metadata.pkl")
    output_path = os.path.join(script_dir, "../public/knowledge_base.json")

    print(f"Loading FAISS index from {index_path}...")
    index = faiss.read_index(index_path)
    
    print(f"Loading metadata from {metadata_path}...")
    with open(metadata_path, "rb") as f:
        metadata = pickle.load(f)
    
    # Extract vectors from FAISS index
    # IndexFlatL2 stores vectors directly
    try:
        # For IndexFlatL2, we can access .xb (if it was exposed via python directly as a numpy array, but usually we use reconstruct)
        # Or we can reconstruct all vectors
        ntotal = index.ntotal
        print(f"Reconstructing {ntotal} vectors...")
        vectors = np.zeros((ntotal, index.d), dtype=np.float32)
        for i in range(ntotal):
            vectors[i] = index.reconstruct(i)
            
        # Combine into a list of objects
        export_data = []
        for i in range(ntotal):
            export_data.append({
                "id": i,
                "text": metadata[i]["text"],
                "source": metadata[i]["source"],
                # Convert numpy array to list for JSON serialization
                # Rounding to 4 decimals to save space, usually sufficient for cosine similarity
                "embedding": [round(float(x), 4) for x in vectors[i]]
            })
            
        # output_path is already defined above
        print(f"Saving to {output_path}...")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f)
            
        print("Done!")
        
    except Exception as e:
        print(f"Error exporting: {e}")

if __name__ == "__main__":
    export_to_json()
