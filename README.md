# SPF 2026

A World Cup 2026 prediction system built with React 19 (Vite) + Express + MySQL.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Create a `.env` file in the project root
   - Configure `DATABASE_URL`, `JWT_SECRET`, `PORT`, etc.

3. Start the development server:
   ```bash
   npm run dev
   ```

This command runs both the backend (Express on `:3001`) and frontend (Vite on `:5173`) in watch mode.

## Development Scripts

- `npm run dev` - Start both server and client in development mode with hot reload
- `npm run build` - Build the project for production
- `npm start` - Run the production build
- `npm run lint` - Run ESLint
- `npm run format` - Format files with Prettier

## Project Structure

```
spf2026/
├── server/                 # Express backend (TypeScript)
│   ├── src/
│   │   ├── db.ts          # Database schema and migrations
│   │   ├── index.ts       # Server entry point
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API endpoints
│   │   └── seeds/         # Database seeding
│   └── package.json
├── client/                # React 19 frontend (Vite)
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utilities
│   │   └── index.css      # Styles
│   └── package.json
└── package.json           # Monorepo root
```

## Features

- **Group Stage Predictions**: Predict the outcome (H/D/A) of all 72 group stage matches
- **Best Third-Place Teams**: Select which 8 third-place teams advance to the Round of 32
- **Knockout Bracket**: Predict Round of 32 through Final winners using official FIFA slot assignments
- **User Authentication**: JWT-based auth with 7-day session expiry
- **Timezone Support**: Match times displayed in user's local timezone
- **Scoring System**: 270 total points available across all prediction rounds

## Scoring Breakdown

| Round | Points per Match |
|-------|-----------------|
| Group stage matches | 1 |
| Round of 32 | 2 |
| Round of 16 | 3 |
| Quarter-finals | 4 |
| Semi-finals | 5 |
| Final | 6 |
| Third place | 7 |
| Winner bonus | 15 |
| **Total** | **270** |
