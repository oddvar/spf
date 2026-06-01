import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { seedMatches } from './seeds/matches.js';
import authRouter from './routes/auth.js';
import predictionsRouter from './routes/predictions.js';
import bestThirdsRouter from './routes/bestThirds.js';

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

initDb()
  .then(seedMatches)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
