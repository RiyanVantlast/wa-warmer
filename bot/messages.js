import { botManager } from './manager.js';

export async function handleIncomingMessage(userId, accountId, botInstance, msg) {
  // Implementasi logika balas pesan otomatis di sini
  // Panggil sendHumanLikeMessage untuk membalas
}

export async function sendHumanLikeMessage(userId, senderId, receiverId, pools) {
  const userData = botManager.getUserData(userId);
  const sender = botManager.getAccount(userId, senderId);
  const receiver = botManager.getAccount(userId, receiverId);

  if (!sender || !receiver || !sender.isReady || !receiver.isReady) return;

  // Pilih pesan dari pool
  const themeMessages = pools?.find(p => p.theme === 'greeting')?.messages || ["Halo!"];
  const rawMessage = themeMessages[Math.floor(Math.random() * themeMessages.length)];

  // Kirim pesan
  try {
    await sender.sock.sendMessage(receiver.accountData.jid, { text: rawMessage });
    sender.dailyCount++;
    sender.lastActivity = new Date().toISOString();

    // Catat ke database
    await botManager.recordMessage(userId, senderId, false);
    botManager.broadcastStatus(userId);

    userData.io.to(`user:${userId}`).emit('log', {
      account: sender.accountData.account_name,
      message: `📤 "${rawMessage}" -> ${receiver.accountData.account_name}`
    });
  } catch (err) {
    console.error(`[Messages] Failed to send from ${senderId} to ${receiverId}:`, err);
  }
}