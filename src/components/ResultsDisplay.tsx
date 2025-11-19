import { Conflict } from '@/lib/ai-check';

interface ResultsDisplayProps {
  conflicts: Conflict[];
}

export default function ResultsDisplay({ conflicts }: ResultsDisplayProps) {
  if (conflicts.length === 0) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center shadow-sm">
        <h3 className="text-lg font-medium text-green-800">No Conflicts Found</h3>
        <p className="mt-2 text-green-600">The building plans appear to comply with the checked codes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
          {conflicts.length} Potential Conflict{conflicts.length !== 1 ? 's' : ''} Found
        </span>
      </div>
      
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
        <ul className="divide-y divide-gray-200">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {conflict.severity === 'high' ? (
                    <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : conflict.severity === 'medium' ? (
                    <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-900">
                      {conflict.codeReference}
                    </p>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${
                      conflict.severity === 'high' ? 'bg-red-100 text-red-800' :
                      conflict.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {conflict.severity} Priority
                    </span>
                  </div>
                  <p className="text-base text-gray-600 leading-relaxed">
                    {conflict.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              This tool is designed to err on the side of caution (false positives) to ensure safety. Please verify all findings with a certified professional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
