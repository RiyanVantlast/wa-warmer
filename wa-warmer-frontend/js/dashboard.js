import { requireAuth, signOut, getUserProfile } from './auth.js';
import { supabase } from './supabase.js';

// Inisialisasi
const session = await requireAuth();
if (!session) throw new Error('Not authenticated');

const profile = await getUserProfile();
const API_BASE = 'https://your-backend-url.com/api';
let socket;

// Fungsi untuk memuat dan menampilkan akun
async function loadAccounts() {
  const { data: accounts, error } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Failed to load accounts:', error);
    return;
  }

  const container = document.getElementById('accountsContainer');
  if (accounts.length === 0) {
    container.innerHTML = '<div class="text-center py-10 text-gray-500 col-span-full">Belum ada akun. Klik "Tambah Akun" untuk memulai.</div>';
    return;
  }

  container.innerHTML = accounts.map(acc => `
    <div class="bg-white rounded-lg shadow p-4 border ${acc.is_connected ? 'border-green-200' : 'border-gray-200'}">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-medium">${acc.account_name}</h3>
          <p class="text-sm text-gray-500">${acc.phone_number || '-'}</p>
          <span class="inline-block mt-2 px-2 py-1 text-xs rounded ${acc.is_connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
            ${acc.is_connected ? 'Online' : 'Offline'}
          </span>
        </div>
        <button data-account-id="${acc.id}" class="connect-btn text-indigo-600 hover:text-indigo-800">
          <i class="fas fa-sync-alt"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Tambahkan event listener untuk tombol connect
  document.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', () => connectAccount(btn.dataset.accountId));
  });
}

// Fungsi untuk koneksi akun (panggil backend)
async function connectAccount(accountId) {
  try {
    const res = await fetch(`${API_BASE}/accounts/${accountId}/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    if (!res.ok) throw new Error('Failed to connect');
    addLog('SYSTEM', `Menghubungkan akun ${accountId}...`);
  } catch (err) {
    console.error(err);
    addLog('ERROR', `Gagal menghubungkan akun: ${err.message}`);
  }
}

// Setup Socket.IO
function setupSocket() {
  socket = io(API_BASE.replace('/api', ''), {
    auth: { token: session.access_token }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    addLog('SYSTEM', 'Terhubung ke server');
  });

  socket.on('status-update', (status) => {
    console.log('Status update:', status);
    // Update tampilan status akun
    loadAccounts(); // Refresh sederhana
  });

  socket.on('qr', ({ accountId, qr }) => {
    addLog('SYSTEM', `QR Code tersedia untuk akun ${accountId}. Silakan scan.`);
    // Bisa ditampilkan dalam modal
    console.log('QR:', qr);
  });

  socket.on('log', (data) => {
    addLog(data.account, data.message);
  });
}

function addLog(account, message) {
  const container = document.getElementById('logContainer');
  const time = new Date().toLocaleTimeString('id-ID');
  const entry = document.createElement('div');
  entry.className = 'py-1 border-b border-gray-800 last:border-0';
  entry.innerHTML = `<span class="text-indigo-400">[${time}]</span> <span class="text-emerald-400">[${account}]</span> <span class="text-gray-300">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
  if (container.children.length > 50) container.removeChild(container.children[0]);
}

// Event listeners
document.getElementById('logoutBtn')?.addEventListener('click', signOut);
document.getElementById('addAccountBtn')?.addEventListener('click', () => {
  // Buka modal form tambah akun
  alert('Form tambah akun (akan diimplementasikan)');
});

// Inisialisasi halaman
loadAccounts();
setupSocket();