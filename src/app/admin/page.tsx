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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !state) return;

    setUploading(true);
    setMessage('');

    try {
      // Construct hierarchical path: knowledge-base/State/County/City/filename
      const path = `knowledge-base/${state}/${county || 'General'}/${city || 'General'}/${file.name}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
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
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Knowledge Base Manager</h1>
        <p className="text-gray-600 mb-6">Upload building codes and zoning documents to the hierarchical knowledge base.</p>
        
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
  );
}
