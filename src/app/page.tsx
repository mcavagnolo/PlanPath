'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import UploadForm from '@/components/UploadForm';
import ResultsDisplay from '@/components/ResultsDisplay';
import { checkBuildingPlan, Conflict } from '@/lib/ai-check';
import { ref, uploadBytes, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { jsPDF } from 'jspdf';

type ProjectFile = {
  name: string;
  url: string;
};

type Project = {
  name: string;
  files: ProjectFile[];
};

export default function Home() {
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Fetch projects from Firebase Storage
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const projectsRef = ref(storage, 'Projects');
      const res = await listAll(projectsRef);
      
      const projectList: Project[] = [];

      for (const folderRef of res.prefixes) {
        const filesRes = await listAll(folderRef);
        const files: ProjectFile[] = [];
        
        for (const fileRef of filesRes.items) {
          const url = await getDownloadURL(fileRef);
          files.push({ name: fileRef.name, url });
        }

        projectList.push({
          name: folderRef.name,
          files: files
        });
      }
      setProjects(projectList);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const generatePDF = (conflicts: Conflict[], location: string) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(`Building Code Analysis: ${location}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
    
    let y = 50;
    
    conflicts.forEach((conflict, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${conflict.codeReference}`, 20, y);
      y += 7;
      
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(conflict.description, 170);
      doc.text(descLines, 20, y);
      y += (descLines.length * 5) + 5;
      
      doc.setTextColor(255, 0, 0);
      doc.text(`Severity: ${conflict.severity.toUpperCase()}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 10;
    });

    return doc.output('blob');
  };

  const handleAnalyze = async (
    file: File, 
    location: string, 
    buildingType: string, 
    jurisdiction: { state: string, county: string, city: string },
    apiKey: string
  ) => {
    setIsAnalyzing(true);
    setConflicts(null);
    
    // Sanitize project name (location) to be folder-safe
    const projectName = location.replace(/[^a-zA-Z0-9 -]/g, '').trim();

    try {
      // 1. Upload the original plan
      const planRef = ref(storage, `Projects/${projectName}/${file.name}`);
      await uploadBytes(planRef, file);

      // 2. Run Analysis
      const results = await checkBuildingPlan(file, location, buildingType, jurisdiction, apiKey);
      setConflicts(results);

      // 3. Generate PDF Report
      const pdfBlob = generatePDF(results, location);
      const pdfFile = new File([pdfBlob], 'Analysis_Results.pdf', { type: 'application/pdf' });

      // 4. Upload PDF Report
      const reportRef = ref(storage, `Projects/${projectName}/Analysis_Results.pdf`);
      await uploadBytes(reportRef, pdfFile);

      // 5. Refresh Projects List
      await fetchProjects();

    } catch (error) {
      console.error('Analysis failed:', error);
      alert('An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#fff9ea] shadow-sm z-10">
        <div className="w-full px-6 py-4 flex items-center justify-between">
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
            <a href="/PlanPath/admin" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Admin</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Documentation</a>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 w-full">
        
        {/* Left Sidebar: Projects */}
        <aside className="w-72 bg-white border-r border-gray-200 hidden lg:block flex-shrink-0">
          <div className="p-6 sticky top-0">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Projects</h3>
            
            {loadingProjects ? (
              <div className="text-sm text-gray-500 animate-pulse">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-gray-500 italic">No projects yet.</div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <details key={project.name} className="group">
                    <summary className="list-none cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600">
                      <span>{project.name}</span>
                      <span className="transform group-open:rotate-90 transition-transform text-gray-400">▶</span>
                    </summary>
                    <div className="mt-2 ml-2 space-y-2 border-l-2 border-gray-100 pl-2">
                      {project.files.map((file) => (
                        <a 
                          key={file.name}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-gray-600 hover:text-blue-600 hover:underline truncate"
                          title={file.name}
                        >
                          {file.name.endsWith('.pdf') ? '📄' : '🖼️'} {file.name}
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Automated Building Code Compliance
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Upload your building plans to instantly identify potential conflicts with local building codes using our advanced AI analysis.
            </p>
          </div>

          <div className="grid gap-8">
            <section>
              <UploadForm onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            </section>
            
            {conflicts && (
              <section className="transition-all duration-500 ease-in-out">
                <ResultsDisplay conflicts={conflicts} />
              </section>
            )}
          </div>
        </main>
      </div>
      
      <footer className="bg-[#fff9ea] border-t border-gray-200 mt-auto">
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
