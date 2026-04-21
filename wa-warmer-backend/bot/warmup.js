import { botManager } from './manager.js';
import { sendHumanLikeMessage } from './messages.js';
import { supabase } from '../services/supabase.js';

// Daftar cron job per user
const userCronJobs = new Map();

export async function scheduleWarmUpForUser(userId) {
  // Hentikan job lama jika ada
  if (userCronJobs.has(userId)) {
    userCronJobs.get(userId).stop();
  }

  const userData = botManager.getUserData(userId);
  if (!userData || !userData.config) return;

  // Jadwalkan setiap 3 jam pada jam kerja
  const job = cron.schedule('0 9,12,15,18,21 * * *', () => {
    runWarmUpCycle(userId);
  });

  userCronJobs.set(userId, job);
  console.log(`[Warmup] Scheduled for user ${userId}`);
}

export async function runWarmUpCycle(userId) {
  const userData = botManager.getUserData(userId);
  if (!userData) return;

  const readyAccounts = [];
  for (const [accId, bot] of userData.accounts.entries()) {
    if (bot.isReady) {
      readyAccounts.push({ accId, bot });
    }
  }

  if (readyAccounts.length < 2) {
    console.log(`[Warmup] User ${userId} has less than 2 ready accounts, skipping`);
    return;
  }

  // Ambil pool percakapan dari database
  const { data: pools } = await supabase
    .from('conversation_pools')
    .select('*')
    .eq('user_id', userId);

  // Pasangkan akun secara acak
  const shuffled = [...readyAccounts].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }
  }

  for (const [accA, accB] of pairs) {
    // Kirim pesan dari A ke B
    await sendHumanLikeMessage(userId, accA.accId, accB.accId, pools);
    // Jeda sejenak
    await new Promise(resolve => setTimeout(resolve, 10000 + Math.random() * 15000));
  }

  console.log(`[Warmup] Cycle completed for user ${userId}`);
}