'use client';

import { useState } from 'react';
import Image from 'next/image';
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
