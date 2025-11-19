# PlanningPath

PlanningPath is a browser-based tool that uses AI to check building plans against building code requirements.

## Features

- **Plan Upload**: Upload building plans (PDF, Images).
- **AI Analysis**: Automated check against building codes based on location and building type.
- **Conflict Detection**: Identifies specific conflicts and provides code references.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `src/app/page.tsx`: Main application page.
- `src/components/UploadForm.tsx`: Component for handling file uploads.
- `src/components/ResultsDisplay.tsx`: Component for displaying analysis results.
- `src/lib/ai-check.ts`: Logic for AI compliance checking (currently simulated).

## Technologies

- Next.js
- TypeScript
- Tailwind CSS
