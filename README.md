# PlanPath

PlanPath is a browser-based tool that uses AI to check building plans against building code requirements.

## Features

- **Plan Upload**: Upload building plans (PDF, Images).
- **AI Analysis**: Automated check against building codes based on location and building type.
- **Conflict Detection**: Identifies specific conflicts and provides code references.

## Getting Started

### Prerequisites

1.  **Firebase Project**: Create a new project at [console.firebase.google.com](https://console.firebase.google.com/).
2.  **Web App**: Add a web app to your Firebase project to get the configuration keys.
3.  **Environment Variables**: Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials.

### Installation

First, install dependencies:

```bash
npm install
```

Then, run the development server:

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
