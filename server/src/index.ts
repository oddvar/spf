import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { seedMatches, seedKnockoutMatches } from './seeds/matches.js';
import authRouter from './routes/auth.js';
import predictionsRouter from './routes/predictions.js';
import bestThirdsRouter from './routes/bestThirds.js';
import knockoutRouter from './routes/knockout.js';
import settingsRouter from './routes/settings.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', predictionsRouter);
app.use('/api', bestThirdsRouter);
app.use('/api', knockoutRouter);
app.use('/api', settingsRouter);

initDb()
  .then(seedMatches)
  .then(seedKnockoutMatches)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
