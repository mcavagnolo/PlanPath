'use client';

import { useState, useEffect } from 'react';
import { fetchJurisdictionOptions } from '@/lib/jurisdiction';
import { listDocumentsForJurisdiction } from '@/lib/ai-check';

interface UploadFormProps {
  onAnalyze: (
    file: File, 
    location: string, 
    buildingType: string, 
    jurisdiction: { state: string, county: string, city: string }, 
    apiKey: string,
    selectedDocumentPath?: string
  ) => void;
  isAnalyzing: boolean;
}

export default function UploadForm({ onAnalyze, isAnalyzing }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState('');
  const [buildingType, setBuildingType] = useState('residential');
  const [apiKey, setApiKey] = useState('');
  
  // Jurisdiction State
  const [state, setState] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');

  // Document Selection State
  const [availableDocuments, setAvailableDocuments] = useState<{ name: string, path: string, type: string }[]>([]);
  const [selectedDocument, setSelectedDocument] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [jurisdictionOptions, setJurisdictionOptions] = useState({
    states: [] as string[],
    counties: [] as string[],
    cities: [] as string[]
  });

  useEffect(() => {
    fetchJurisdictionOptions().then(setJurisdictionOptions);
  }, []);

  // Fetch available documents when jurisdiction changes
  useEffect(() => {
    if (state || county || city) {
      setLoadingDocs(true);
      listDocumentsForJurisdiction({ state, county, city })
        .then(docs => {
          setAvailableDocuments(docs);
          setSelectedDocument(''); // Reset selection
        })
        .catch(err => console.error("Error fetching docs:", err))
        .finally(() => setLoadingDocs(false));
    } else {
      setAvailableDocuments([]);
    }
  }, [state, county, city]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && location && apiKey) {
      onAnalyze(file, location, buildingType, { state, county, city }, apiKey, selectedDocument);
    } else if (!apiKey) {
      alert("Please enter your OpenAI API Key.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white shadow-lg rounded-xl border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="sk-..."
            required
          />
          <p className="text-xs text-gray-500 mt-1">Your key is used only for this session and is never stored on our servers.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project Name / Address</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. 123 Main St, El Segundo"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Building Type</label>
          <select
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed-use">Mixed Use</option>
            <option value="industrial">Industrial</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select State</option>
            {jurisdictionOptions.states.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">County</label>
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select County</option>
            {jurisdictionOptions.counties.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select City</option>
            {jurisdictionOptions.cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Document Selection */}
      {(state || county || city) && (
        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
          <label className="block text-sm font-medium text-blue-900 mb-2">
            Select Specific Code Document (Optional)
          </label>
          <p className="text-xs text-blue-700 mb-2">
            Select a specific document to check against. If none is selected, we will search across all available documents (which may be less accurate for large files).
          </p>
          
          {loadingDocs ? (
            <div className="text-sm text-gray-500">Loading available documents...</div>
          ) : availableDocuments.length > 0 ? (
            <select
              value={selectedDocument}
              onChange={(e) => setSelectedDocument(e.target.value)}
              className="w-full px-4 py-2 border border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">-- Check Against All (Auto-Detect) --</option>
              {availableDocuments.map((doc) => (
                <option key={doc.path} value={doc.path}>
                  [{doc.type}] {doc.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-500 italic">No specific documents found for this jurisdiction.</div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Building Plan (PDF/Image)</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors">
          <div className="space-y-1 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      if (selectedFile.size > 50 * 1024 * 1024) {
                        alert('File size exceeds 50MB limit.');
                        e.target.value = '';
                        setFile(null);
                      } else {
                        setFile(selectedFile);
                      }
                    } else {
                      setFile(null);
                    }
                  }}
                  required
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PDF, PNG, JPG up to 50MB</p>
            {file && <p className="text-sm text-green-600 font-semibold mt-2">Selected: {file.name}</p>}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!file || !location || isAnalyzing}
        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
          isAnalyzing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      >
        {isAnalyzing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing Plans...
          </>
        ) : (
          'Analyze Plans'
        )}
      </button>
    </form>
  );
}
