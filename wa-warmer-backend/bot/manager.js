import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { supabase } from '../services/supabase.js';
import { connectAccount } from './connection.js';
import { runWarmUpCycle } from './warmup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BotManager {
  constructor() {
    // Map: userId -> { accounts: Map(accountId -> botInstance), config, io }
    this.users = new Map();
    this.sessionsDir = path.join(__dirname, '..', 'sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  // Inisialisasi bot untuk user tertentu, dipanggil saat user pertama kali connect
  async initializeUser(userId, io) {
    if (this.users.has(userId)) {
      console.log(`[BotManager] User ${userId} already initialized`);
      return;
    }

    console.log(`[BotManager] Initializing user ${userId}`);
    const userData = {
      accounts: new Map(),
      io: io,
      config: null
    };
    this.users.set(userId, userData);

    // Ambil konfigurasi user dari database
    const { data: config, error } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(`[BotManager] Failed to fetch config for user ${userId}:`, error);
    } else {
      userData.config = config;
    }

    // Muat semua akun WhatsApp yang terdaftar untuk user ini
    const { data: accounts, error: accError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('user_id', userId);

    if (accError) {
      console.error(`[BotManager] Failed to fetch accounts for user ${userId}:`, accError);
      return;
    }

    for (const acc of accounts) {
      // Mulai setiap akun
      await this.startAccount(userId, acc.id, acc);
    }

    // Jadwalkan cron job untuk user ini
    this.scheduleWarmUpForUser(userId);
  }

  scheduleWarmUpForUser(userId) {
    // Hapus job lama jika ada
    // ... (implementasi sederhana: gunakan cron global yang memanggil semua user)
    // Untuk kemudahan, kita bisa menggunakan satu cron global yang iterasi semua user.
    // Lihat implementasi lengkap di bagian bawah.
  }

  async startAccount(userId, accountId, accountData) {
    const userData = this.users.get(userId);
    if (!userData) {
      console.error(`[BotManager] User ${userId} not found`);
      return;
    }

    if (userData.accounts.has(accountId)) {
      console.log(`[BotManager] Account ${accountId} already running`);
      return;
    }

    console.log(`[BotManager] Starting account ${accountId} for user ${userId}`);
    const sessionPath = path.join(this.sessionsDir, userId, accountId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    try {
      const botInstance = await connectAccount(userId, accountId, accountData, userData.io, sessionPath);
      userData.accounts.set(accountId, botInstance);
    } catch (err) {
      console.error(`[BotManager] Failed to start account ${accountId}:`, err);
    }
  }

  stopAccount(userId, accountId) {
    const userData = this.users.get(userId);
    if (!userData) return;

    const bot = userData.accounts.get(accountId);
    if (bot && bot.sock) {
      bot.sock.end();
    }
    userData.accounts.delete(accountId);
  }

  stopAllForUser(userId) {
    const userData = this.users.get(userId);
    if (!userData) return;

    for (const [accId, bot] of userData.accounts.entries()) {
      if (bot.sock) bot.sock.end();
    }
    this.users.delete(userId);
  }

  getAccount(userId, accountId) {
    return this.users.get(userId)?.accounts.get(accountId);
  }

  getUserData(userId) {
    return this.users.get(userId);
  }

  broadcastStatus(userId) {
    const userData = this.users.get(userId);
    if (!userData || !userData.io) return;

    const status = {};
    for (const [accId, bot] of userData.accounts.entries()) {
      status[accId] = {
        ready: bot.isReady || false,
        messagesToday: bot.dailyCount || 0,
        groupMessagesToday: bot.groupDailyCount || 0,
        lastActivity: bot.lastActivity || null,
        jid: bot.sock?.user?.id || null
      };
    }
    userData.io.to(`user:${userId}`).emit('status-update', status);
  }

  async recordMessage(userId, accountId, isGroup = false) {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('account_id', accountId)
      .eq('date', today)
      .single();

    if (existing) {
      const updateField = isGroup ? 'group_messages_sent' : 'messages_sent';
      await supabase
        .from('daily_stats')
        .update({ [updateField]: existing[updateField] + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('daily_stats')
        .insert({
          user_id: userId,
          account_id: accountId,
          date: today,
          messages_sent: isGroup ? 0 : 1,
          group_messages_sent: isGroup ? 1 : 0
        });
    }
  }
}

export const botManager = new BotManager();