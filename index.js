import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSockets } from './sockets/index.js';
import { botManager } from './bot/manager.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import warmupRoutes from './routes/warmup.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Socket.IO
const io = setupSockets(server);

// Global cron untuk warm-up semua user
import cron from 'node-cron';
cron.schedule('0 9,12,15,18,21 * * *', async () => {
  console.log('[Global] Running warm-up for all active users');
  const { data: activeUsers } = await supabase.from('profiles').select('id');
  for (const user of activeUsers || []) {
    await runWarmUpCycle(user.id);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});