'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { fetchJurisdictionOptions } from '@/lib/jurisdiction';

type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
};

const FileTreeItem = ({ 
  node, 
  onDelete, 
  onAddFolder 
}: { 
  node: FileNode; 
  onDelete: (path: string, type: 'file' | 'folder') => void;
  onAddFolder: (path: string) => void;
}) => {
  if (node.type === 'file') {
    // Hide .keep files from the UI
    if (node.name === '.keep') return null;

    return (
      <div className="pl-6 py-1 text-sm text-gray-600 flex items-center gap-2 group">
        <span className="opacity-50">📄</span> 
        <span className="flex-1 truncate">{node.name}</span>
        <button 
          onClick={() => onDelete(node.path, 'file')}
          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
          title="Delete File"
        >
          🗑️
        </button>
      </div>
    );
  }
  
  return (
    <details className="pl-2">
      <summary className="cursor-pointer py-1 text-sm font-medium text-gray-800 hover:text-blue-600 select-none flex items-center gap-2 group">
        <span>📁</span> 
        <span className="flex-1">{node.name}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <button 
            onClick={(e) => {
              e.preventDefault();
              onAddFolder(node.path);
            }}
            className="text-green-600 hover:text-green-800 p-1"
            title="Add Subfolder"
          >
            ➕
          </button>
          <button 
            onClick={(e) => {
              e.preventDefault();
              onDelete(node.path, 'folder');
            }}
            className="text-red-500 hover:text-red-700 p-1"
            title="Delete Folder"
          >
            🗑️
          </button>
        </div>
      </summary>
      <div className="border-l border-gray-200 ml-2.5">
        {node.children?.map((child) => (
          <FileTreeItem 
            key={child.path} 
            node={child} 
            onDelete={onDelete}
            onAddFolder={onAddFolder}
          />
        ))}
        {node.children?.length === 0 && (
          <div className="pl-6 py-1 text-xs text-gray-400 italic">Empty folder</div>
        )}
      </div>
    </details>
  );
};

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  
  // Single Upload State
  const [singleCategory, setSingleCategory] = useState('');
  const [singleJurisdiction, setSingleJurisdiction] = useState('');

  // Bulk Upload State
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkJurisdiction, setBulkJurisdiction] = useState('');
  
  const [jurisdictionOptions, setJurisdictionOptions] = useState({
    states: [] as string[],
    counties: [] as string[],
    cities: [] as string[]
  });

  useEffect(() => {
    fetchJurisdictionOptions().then(setJurisdictionOptions);
  }, []);

  const [folderFiles, setFolderFiles] = useState<FileList | null>(null);

  const getOptionsForCategory = (category: string) => {
    switch(category) {
      case 'State': return jurisdictionOptions.states;
      case 'County': return jurisdictionOptions.counties;
      case 'City': return jurisdictionOptions.cities;
      default: return [];
    }
  };

  const fetchFileTree = async (path: string): Promise<FileNode[]> => {
    const rootRef = ref(storage, path);
    try {
      const res = await listAll(rootRef);
      
      const nodes: FileNode[] = [];

      for (const folderRef of res.prefixes) {
        nodes.push({
          name: folderRef.name,
          path: folderRef.fullPath,
          type: 'folder',
          children: await fetchFileTree(folderRef.fullPath)
        });
      }

      for (const fileRef of res.items) {
        nodes.push({
          name: fileRef.name,
          path: fileRef.fullPath,
          type: 'file'
        });
      }
      
      return nodes;
    } catch (error) {
      console.error("Error fetching file tree:", error);
      return [];
    }
  };

  const refreshTree = () => {
    setLoadingTree(true);
    fetchFileTree('knowledge-base')
      .then(nodes => setFileTree(nodes))
      .finally(() => setLoadingTree(false));
  };

  useEffect(() => {
    refreshTree();
  }, []);

  const handleFolderUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFiles || folderFiles.length === 0) return;
    if (!bulkCategory || !bulkJurisdiction) {
      alert("Please select a destination folder.");
      return;
    }

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

      // New structure: knowledge-base/Category/Jurisdiction/filename
      // We preserve the relative path structure within the selected jurisdiction
      const path = `knowledge-base/${bulkCategory}/${bulkJurisdiction}/${relativePath}`;
      
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
    refreshTree(); // Refresh tree after upload
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !singleCategory || !singleJurisdiction) return;
    setUploading(true);
    setMessage('');

    try {
      // Construct hierarchical path: knowledge-base/Category/Jurisdiction/filename
      const path = `knowledge-base/${singleCategory}/${singleJurisdiction}/${file.name}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, file);
      
      setMessage(`Successfully uploaded ${file.name} to ${path}`);
      setFile(null);
      refreshTree(); // Refresh tree after upload
    } catch (error) {
      console.error(error);
      setMessage('Error uploading file. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const deleteFolder = async (path: string) => {
    const folderRef = ref(storage, path);
    const res = await listAll(folderRef);
    
    // Recursively delete subfolders
    for (const folder of res.prefixes) {
      await deleteFolder(folder.fullPath);
    }
    
    // Delete files in current folder
    for (const file of res.items) {
      await deleteObject(file);
    }
  };

  const handleDelete = async (path: string, type: 'file' | 'folder') => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    setLoadingTree(true);
    try {
      if (type === 'file') {
        await deleteObject(ref(storage, path));
      } else {
        await deleteFolder(path);
      }
      setMessage(`${type === 'file' ? 'File' : 'Folder'} deleted successfully.`);
      refreshTree();
    } catch (error) {
      console.error(error);
      setMessage(`Error deleting ${type}.`);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleAddFolder = async (parentPath: string) => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;

    // Sanitize folder name
    const safeName = folderName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
    if (!safeName) {
      alert("Invalid folder name.");
      return;
    }

    setLoadingTree(true);
    try {
      // Create a placeholder file to "create" the folder
      const placeholderRef = ref(storage, `${parentPath}/${safeName}/.keep`);
      await uploadBytes(placeholderRef, new Blob(["placeholder"]));
      
      setMessage(`Folder "${safeName}" created.`);
      refreshTree();
    } catch (error) {
      console.error(error);
      setMessage("Error creating folder.");
    } finally {
      setLoadingTree(false);
    }
  };

  const handleClearKnowledgeBase = async () => {
    if (!confirm('Are you sure you want to delete ALL files in the Knowledge Base? This cannot be undone.')) return;
    
    setUploading(true);
    setMessage('Deleting all files...');
    
    try {
      await deleteFolder('knowledge-base');
      setMessage('Knowledge Base cleared successfully.');
      refreshTree();
    } catch (error) {
      console.error(error);
      setMessage('Error clearing Knowledge Base.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#fff9ea] shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <Image 
              src="/PlanPath/logos/PlanPath Logo wName (Horizontal).png" 
              alt="PlanPath Logo" 
              width={200} 
              height={50} 
              className="h-12 w-auto"
              priority
            />
          </div>
          <nav>
            <a href="/PlanPath/" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Documentation</a>
          </nav>
        </div>
      </header>

      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Knowledge Base Administration</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Upload Tools */}
            <div className="space-y-8">
              
              {/* Bulk Upload Section */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Bulk Upload Codes Folder</h2>
                <form onSubmit={handleFolderUpload} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      <select
                        value={bulkCategory}
                        onChange={(e) => {
                          setBulkCategory(e.target.value);
                          setBulkJurisdiction(''); // Reset jurisdiction when category changes
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="State">State</option>
                        <option value="County">County</option>
                        <option value="City">City</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Jurisdiction</label>
                      <select
                        value={bulkJurisdiction}
                        onChange={(e) => setBulkJurisdiction(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                        required
                        disabled={!bulkCategory}
                      >
                        <option value="">Select Jurisdiction</option>
                        {getOptionsForCategory(bulkCategory).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Folder</label>
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
                    disabled={uploading || !folderFiles || !bulkCategory || !bulkJurisdiction}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      <select
                        value={singleCategory}
                        onChange={(e) => {
                          setSingleCategory(e.target.value);
                          setSingleJurisdiction(''); // Reset jurisdiction when category changes
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="State">State</option>
                        <option value="County">County</option>
                        <option value="City">City</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Jurisdiction</label>
                      <select
                        value={singleJurisdiction}
                        onChange={(e) => setSingleJurisdiction(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                        required
                        disabled={!singleCategory}
                      >
                        <option value="">Select Jurisdiction</option>
                        {getOptionsForCategory(singleCategory).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
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
              </div>

              {message && (
                <div className={`p-4 rounded-md ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {message}
                </div>
              )}
            </div>

            {/* Right Column: File Tree */}
            <div className="bg-white p-8 rounded-lg shadow-md h-fit">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Knowledge Base Files</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAddFolder('knowledge-base')}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                    disabled={loadingTree}
                  >
                    + New Root Folder
                  </button>
                  <span className="text-gray-300">|</span>
                  <button 
                    onClick={refreshTree}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                    disabled={loadingTree}
                  >
                    {loadingTree ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
              
              <div className="border rounded-md p-4 bg-gray-50 min-h-[400px] max-h-[800px] overflow-y-auto">
                {loadingTree && fileTree.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">Loading files...</div>
                ) : fileTree.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No files found in Knowledge Base</div>
                ) : (
                  fileTree.map(node => (
                    <FileTreeItem 
                      key={node.path} 
                      node={node} 
                      onDelete={handleDelete}
                      onAddFolder={handleAddFolder}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#fff9ea] border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <Image 
            src="/PlanPath/logos/PlanPath Logo.png" 
            alt="PlanPath Icon" 
            width={32} 
            height={32} 
            className="h-8 w-8 mb-2"
          />
          <p className="text-center text-sm text-gray-500">
            &copy; 2025 PlanPath. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
