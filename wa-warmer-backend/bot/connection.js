import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import P from 'pino';
import { supabase } from '../services/supabase.js';
import { botManager } from './manager.js';
import { handleIncomingMessage } from './messages.js';

export async function connectAccount(userId, accountId, accountData, io, sessionPath) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  });

  const botInstance = {
    sock,
    isReady: false,
    dailyCount: 0,
    groupDailyCount: 0,
    lastActivity: null,
    accountData
  };

  // Event handler untuk update koneksi
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Kirim QR code ke frontend jika ada
    if (qr && !accountData.pairing_enabled) {
      io.to(`user:${userId}`).emit('qr', { accountId, qr });
    }

    if (connection === 'open') {
      console.log(`[${accountId}] Connected successfully`);
      botInstance.isReady = true;
      botInstance.lastActivity = new Date().toISOString();

      // Update database
      await supabase
        .from('whatsapp_accounts')
        .update({
          is_connected: true,
          jid: sock.user?.id,
          last_activity: new Date()
        })
        .eq('id', accountId);

      botManager.broadcastStatus(userId);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[${accountId}] Connection closed. Reconnecting: ${shouldReconnect}`);
      botInstance.isReady = false;

      // Update database
      await supabase
        .from('whatsapp_accounts')
        .update({ is_connected: false })
        .eq('id', accountId);

      botManager.broadcastStatus(userId);

      // Reconnect jika bukan logout
      if (shouldReconnect) {
        setTimeout(() => {
          botManager.startAccount(userId, accountId, accountData);
        }, 5000);
      } else {
        // Jika logout, hapus sesi dan minta user scan ulang
        botManager.stopAccount(userId, accountId);
        io.to(`user:${userId}`).emit('account-logged-out', { accountId });
      }
    }
  });

  // Event handler untuk pesan masuk
  sock.ev.on('messages.upsert', async (msg) => {
    if (!botInstance.isReady) return;
    await handleIncomingMessage(userId, accountId, botInstance, msg);
  });

  // Simpan kredensial secara berkala
  sock.ev.on('creds.update', saveCreds);

  return botInstance;
}