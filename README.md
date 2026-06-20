# Parchment MVP

Parchment is a slow-mail digital correspondence experience built with:

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Firebase Auth + Firestore

## Routes

- `/sign-in`
- `/sign-up`
- `/desk`
- `/registry`
- `/mailbox`

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in your Firebase `NEXT_PUBLIC_FIREBASE_*` variables.
3. Install dependencies:
   - `npm install`
4. Start development:
   - `npm run dev`

If Firebase variables are missing, the app displays a setup blocker screen.

## Scripts

- `npm run dev` - start local dev server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest with coverage
- `npm run build` - production build

