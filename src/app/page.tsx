'use client';

import { useState } from 'react';
import UploadForm from '@/components/UploadForm';
import ResultsDisplay from '@/components/ResultsDisplay';
import { checkBuildingPlan, Conflict } from '@/lib/ai-check';

export default function Home() {
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async (file: File, location: string, buildingType: string) => {
    setIsAnalyzing(true);
    setConflicts(null);
    try {
      const results = await checkBuildingPlan(file, location, buildingType);
      setConflicts(results);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900">PlanningPath</h1>
          </div>
          <nav>
            <a href="#" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Documentation</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Support</a>
          </nav>
        </div>
      </header>

      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
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
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; 2025 PlanningPath. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
