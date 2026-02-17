# CineSense AI

AI-powered movie recommender built with Next.js, Tailwind CSS, OpenAI, and the
OMDb API.

## Setup

1. Install dependencies
   - `npm install`
2. Create `.env.local` with:
   - `OMDB_API_KEY=your_key_here`
   - `GEMINI_API_KEY=your_key_here` (required for Mood Chat)
   - `OPENAI_API_KEY=your_key_here` (optional, recommender only)
3. Start the dev server
   - `npm run dev`

## Features

- Natural language prompt to describe a movie mood
- AI keyword extraction (OpenAI) with fallback heuristic
- OMDb movie lookup + detail fetch
- Loading spinner, error handling, retry, and history list
- Dark mode toggle

Updated back to cinesense