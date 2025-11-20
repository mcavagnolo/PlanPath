'use client';

import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function AdminPage() {
  const [state, setState] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const [folderFiles, setFolderFiles] = useState<FileList | null>(null);

  // Helper to determine hierarchy from path
  const getHierarchyFromPath = (filePath: string) => {
    const parts = filePath.split('/');
    let state = 'California'; // Default based on user data
    let county = 'General';
    let city = 'General';

    // Simple heuristic based on folder names provided by user
    if (filePath.includes('California Building Code')) {
      state = 'California';
    }
    if (filePath.includes('LA County')) {
      county = 'Los Angeles';
    }
    if (filePath.includes('El Segundo')) {
      city = 'El Segundo';
    }

    return { state, county, city };
  };

  const handleFolderUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFiles || folderFiles.length === 0) return;

    setUploading(true);
    setMessage(`Uploading ${folderFiles.length} files...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < folderFiles.length; i++) {
      const file = folderFiles[i];
      setMessage(`Uploading ${i + 1}/${folderFiles.length}: ${file.name}...`);

      // webkitRelativePath gives us "Folder/Subfolder/file.ext"
      const relativePath = file.webkitRelativePath || file.name;
      
      // Skip hidden files
      if (file.name.startsWith('.')) continue;

      const { state, county, city } = getHierarchyFromPath(relativePath);
      const path = `knowledge-base/${state}/${county}/${city}/${file.name}`;
      
      try {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}`, error);
        errorCount++;
      }
    }

    setMessage(`Upload complete: ${successCount} successful, ${errorCount} failed.`);
    setUploading(false);
    setFolderFiles(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !state) return;
    // ... existing single file logic ...
    setUploading(true);
    setMessage('');

    try {
      // Construct hierarchical path: knowledge-base/State/County/City/filename
      const path = `knowledge-base/${state}/${county || 'General'}/${city || 'General'}/${file.name}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file);
      
      setMessage(`Successfully uploaded ${file.name} to ${path}`);
      setFile(null);
    } catch (error) {
      console.error(error);
      setMessage('Error uploading file. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Bulk Upload Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Bulk Upload Codes Folder</h2>
          <p className="text-gray-600 mb-4">
            Select the root "Codes" folder. The system will automatically map "California", "LA County", and "El Segundo" folders to the correct hierarchy.
          </p>
          <form onSubmit={handleFolderUpload} className="space-y-4">
            <div>
              <input
                type="file"
                // @ts-ignore - webkitdirectory is not standard but supported
                webkitdirectory=""
                directory=""
                multiple
                onChange={(e) => setFolderFiles(e.target.files)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={uploading || !folderFiles}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
            >
              {uploading ? 'Uploading Folder...' : 'Upload All Files'}
            </button>
          </form>
        </div>

        {/* Single File Upload Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Single File Upload</h2>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
              placeholder="e.g. New York"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">County (Optional)</label>
              <input
                type="text"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                placeholder="e.g. Kings"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City (Optional)</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                placeholder="e.g. New York City"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Document (PDF/Text)</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Upload to Knowledge Base'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-4 rounded-md ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
