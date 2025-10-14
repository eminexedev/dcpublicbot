// Discord botunun ana dosyası
require('@dotenvx/dotenvx').config()
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const os = require('os');
const DEBUG_SHUTDOWN = process.env.DEBUG_SHUTDOWN === '1';

// Global log ayarları
const GLOBAL_LOG_CHANNEL_ID = '1427764280454807623';
let __globalLogReady = false;
let __globalLogQueue = [];
let __globalLogChannel = null; // Hazır olduğunda cache'lenecek
let __shuttingDown = false;

async function sendGlobalLog(client, content) {
  try {
    if (!content) return;
    let payloadObj = null;
    if (typeof content === 'string') {
      const prefix = `📜 [${new Date().toISOString()}]`;
      const body = `${prefix} ${content}`;
      const payload = body.length > 1900 ? body.slice(0, 1900) + ' … [truncated]' : body;
      payloadObj = { content: payload };
    } else if (typeof content === 'object') {
      payloadObj = content;
    } else {
      payloadObj = { content: String(content) };
    }
    let sent = false;
    // 1) Gateway üzerinden (mevcut client) dene
    try {
      let channel = __globalLogChannel || client?.channels?.cache?.get(GLOBAL_LOG_CHANNEL_ID);
      if (!channel && client) {
        channel = await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID).catch(()=>null);
        if (channel) __globalLogChannel = channel;
      }
      if (channel) {
        // Debug
        // console.log('[GLOBAL-LOG] Sending via gateway...');
        await channel.send(payloadObj);
        sent = true;
      }
    } catch {}
    // 2) REST fallback (client kapalı olsa bile token ile gönder)
    if (!sent) {
      try {
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10', timeout: 15000 }).setToken(process.env.TOKEN);
        // REST, content boşsa body'de content alanı olmadan da kabul eder; embeds varsa direkt göndeririz
        // console.log('[GLOBAL-LOG] Sending via REST fallback...');
        await rest.post(Routes.channelMessages(GLOBAL_LOG_CHANNEL_ID), { body: payloadObj });
        sent = true;
      } catch (e) {
        if (DEBUG_SHUTDOWN) console.error('[GLOBAL-LOG REST ERROR]', e?.message || e);
      }
    }
    if (!sent) {
      // Client hazır değil ya da REST gönderimi başarısız—sıraya al (yalnızca kısa metin)
      __globalLogQueue.push(typeof payloadObj.content === 'string' ? payloadObj.content : '[embed]');
    }
  } catch (e) {
    // En kötü ihtimalle konsola yaz
    console.error('[GLOBAL-LOG ERROR]', e?.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences, // Aktif kullanıcı sayımı için gerekli
    GatewayIntentBits.GuildVoiceStates // SES istatistikleri için GEREKLİ intent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
  rest: {
    timeout: 30000, // 30 saniye timeout
    retries: 3, // 3 kez tekrar dene
  },
  ws: {
    large_threshold: 50, // Optimize edilmiş guild threshold
  }
});
// VSCode/cmd gibi ortamlarda SIGINT yakalanmıyorsa, Ctrl+C keypress fallback
function setupCtrlCKeyListener() {
  try {
    if (!process.stdin || !process.stdin.isTTY) return;
    if (process.stdin._ctrlCHandled) return;
    const readline = require('readline');
    readline.emitKeypressEvents(process.stdin);
    try { process.stdin.setRawMode(true); } catch {}
    process.stdin._ctrlCHandled = true;
    process.stdin.on('keypress', (str, key) => {
      if (key && key.ctrl && key.name === 'c') {
        if (DEBUG_SHUTDOWN) console.log('[SHUTDOWN] CTRL+C keypress yakalandı');
        gracefulShutdown('CTRL+C');
      }
    });
  } catch (e) {
    console.warn('[CTRL+C FALLBACK WARN]', e?.message);
  }
}


// Basit metrik toplayıcı
client.metrics = {
  since: Date.now(),
  slash: 0,
  prefix: 0,
  buttons: 0,
  selects: 0,
  modals: 0,
  errors: 0,
  commandUsage: {},
  // Tepki süresi ölçümü için
  totalCommandCount: 0,
  totalCommandMs: 0,
  commandTimings: {}, // { [commandName]: { count: number, totalMs: number } }
};

// İstatistik kanalı güncelleme
const { getStatsChannels } = require('./statsConfig');

async function updateStatsChannels(guild) {
  const stats = getStatsChannels(guild.id);
  if (stats.uye) {
    const uyeChannel = guild.channels.cache.get(stats.uye);
    if (uyeChannel) {
      const count = guild.memberCount;
      if (uyeChannel.type === 2) { // Voice
        await uyeChannel.setName(`Üye: ${count}`);
      } else if (uyeChannel.type === 0) { // Text
        await uyeChannel.setName(`üye-sayısı-${count}`);
      }
    }
  }
  if (stats.aktif) {
    const aktifChannel = guild.channels.cache.get(stats.aktif);
    if (aktifChannel) {
      const online = guild.members.cache.filter(m => m.presence && ["online","idle","dnd"].includes(m.presence.status) && !m.user.bot).size;
      if (aktifChannel.type === 2) {
        await aktifChannel.setName(`Aktif: ${online}`);
      } else if (aktifChannel.type === 0) {
        await aktifChannel.setName(`aktif-kullanıcı-${online}`);
      }
    }
  }
}

client.on('guildMemberAdd', member => updateStatsChannels(member.guild));
client.on('guildMemberRemove', member => updateStatsChannels(member.guild));
client.once('ready', async () => {
  console.log('✅ Client ready event tetiklendi. Giriş yapan bot:', client.user?.tag);
  __globalLogReady = true;
  // Global log kanalını önceden al ve cache'le
  try {
    __globalLogChannel = client.channels.cache.get(GLOBAL_LOG_CHANNEL_ID) || await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID).catch(()=>null);
  } catch {}
  // Kuyruktaki logları gönder
  if (__globalLogQueue.length) {
    for (const msg of __globalLogQueue.splice(0)) {
      await sendGlobalLog(client, msg);
    }
  }
  await sendGlobalLog(client, `✅ Bot hazır: ${client.user?.tag}`);
  // Saatlik durum logları planla
  scheduleHourlyLogs(client);
  console.log('🔍 Aktif intentler:', client.options.intents.bitfield?.toString());
  const { getPrefix } = require('./config');
  require('./events/ready')(client, getPrefix);

  client.guilds.cache.forEach(guild => updateStatsChannels(guild));
  await deployCommands();
});

function scheduleHourlyLogs(client) {
  const toMb = (b) => (b / (1024 * 1024)).toFixed(1);
  const fmtUptime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const sendStatus = async () => {
    try {
      const mem = process.memoryUsage();
      const guilds = client.guilds.cache.size;
      const ping = Math.round(client.ws.ping || 0);
      const uptime = fmtUptime(process.uptime());
      const load = os.loadavg?.() || [0,0,0];
      const cpus = os.cpus?.() || [];
      const cpuModel = cpus[0]?.model || 'n/a';
      // Basit CPU kullanım yüzdesi tahmini (1 dakikalık loadavg / CPU sayısı)
      const cpuCount = Math.max(1, cpus.length || 1);
      const cpuPct = Math.min(100, Math.max(0, (load[0] / cpuCount) * 100)).toFixed(0);
      const m = client.metrics || { slash:0,prefix:0,buttons:0,selects:0,modals:0,errors:0 };
      const usage = Object.entries(m.commandUsage || {}).sort((a,b)=>b[1]-a[1]).slice(0,10);
      const topLines = usage.length
        ? usage.map(([name,count]) => {
            const t = m.commandTimings?.[name];
            const avg = t && t.count ? Math.round(t.totalMs / t.count) : '—';
            return `• ${name}: ${count}x, avg ${avg}ms`;
          }).join('\n')
        : '—';

      const overallAvg = m.totalCommandCount ? Math.round(m.totalCommandMs / m.totalCommandCount) : null;
      const embed = {
        title: '⏰ Saatlik Durum Raporu',
        color: 0x5865F2,
        timestamp: new Date(),
        fields: [
          { name: 'Sistem', value: `Sunucular: ${guilds}\nPing: ${ping}ms\nUptime: ${uptime}`, inline: true },
          { name: 'Bellek', value: `RSS: ${toMb(mem.rss)}MB\nHeap: ${toMb(mem.heapUsed)}MB`, inline: true },
          { name: 'CPU', value: `${cpuPct}%\n${cpuModel}`, inline: true },
          { name: 'Etkileşim', value: `Slash: ${m.slash}\nPrefix: ${m.prefix}\nButtons: ${m.buttons}\nSelects: ${m.selects}\nModals: ${m.modals}\nErrors: ${m.errors}`, inline: true },
          { name: 'Komut Ort. Tepki', value: overallAvg !== null ? `${overallAvg}ms (${m.totalCommandCount} komut)` : '—', inline: true },
          { name: 'Top-10 Komut', value: topLines, inline: false },
        ]
      };
      await sendGlobalLog(client, { embeds: [embed] });
      // Sayaçları saatlik sıfırla (kümülatif istiyorsan kaldırabiliriz)
      client.metrics.slash = 0;
      client.metrics.prefix = 0;
      client.metrics.buttons = 0;
      client.metrics.selects = 0;
      client.metrics.modals = 0;
      client.metrics.errors = 0;
      client.metrics.commandUsage = {};
      client.metrics.totalCommandCount = 0;
      client.metrics.totalCommandMs = 0;
      client.metrics.commandTimings = {};
    } catch (e) {
      console.error('[HOURLY-LOG ERROR]', e?.message);
    }
  };
  // İlkini 5 dk sonra, sonra her saat başı
  setTimeout(() => {
    sendStatus();
    setInterval(sendStatus, 60 * 60 * 1000);
  }, 5 * 60 * 1000);
}

// Otomatik log kanalı sistemi
const { getAutoLogChannel, setAutoLogChannel } = require('./config');
// Sunucuya katıldığında otomatik log kanalı oluştur
client.on('guildCreate', async (guild) => {
  let logChannel = guild.channels.cache.find(c => c.name === 'bot-log' && c.type === 0);
  if (!logChannel) {
    logChannel = await guild.channels.create({
      name: 'bot-log',
      type: 0, // Text channel
      reason: 'Bot log kanalı otomatik oluşturuldu.'
    });
  }
  setAutoLogChannel(guild.id, logChannel.id);
});
// Davet sistemi
const { setupInviteTracking } = require('./events/inviteTracker');
// Karşılama sistemi eventleri
const { onMemberJoin, onMemberLeave } = require('./events/memberEvents');

// Invite tracker başlat
setupInviteTracking(client);

// Üye giriş/çıkış eventleri
client.on('guildMemberAdd', onMemberJoin);
client.on('guildMemberRemove', onMemberLeave);

// Komut handler'ı yükle
require('./commandHandler')(client);

// Komutları Discord'a otomatik deploy eden fonksiyon
async function deployCommands() {
  const { REST, Routes } = require('discord.js');
  const fs = require('fs');
  const commands = [];
  const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);
      if (command.data && typeof command.data.toJSON === 'function') {
        commands.push(command.data.toJSON());
        console.log(`✅ ${file} komutu yüklendi`);
      } else {
        console.log(`⚠️ ${file} komutu slash command desteği yok (data özelliği eksik)`);
      }
    } catch (error) {
      console.error(`❌ ${file} komutu yüklenirken hata:`, error.message);
    }
  }
  const rest = new REST({ 
    version: '10',
    timeout: 30000, // 30 saniye timeout
    retries: 3 // 3 kez tekrar dene
  }).setToken(process.env.TOKEN);
  try {
    console.log('Slash komutları Discord\'a yükleniyor...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log(`✅ ${commands.length} slash komutu başarıyla yüklendi!`);
  } catch (error) {
    console.error('Komut deploy hatası:', error);
  }
}

// Voice stats event handler'ını ekle
require('./events/voiceStats')(client);

// Role change logger event handler'ını ekle
require('./events/roleLogger')(client);

// Template interactions event handler'ını ekle
require('./events/templateInteractions')(client);

// Security protection event handler'ını ekle
require('./events/securityProtection')(client);

// Özel oda (private voice) sistemi
require('./events/privateVoice')(client);

// Bot'u başlat
async function startBot() {
  try {
    console.log('Bot Discord\'a bağlanıyor...');
    await sendGlobalLog(client, '🚀 Bot başlatılıyor, Discord\'a bağlanıyor...');
    await client.login(process.env.TOKEN);
    console.log('✅ Bot başarıyla Discord\'a bağlandı!');
    await sendGlobalLog(client, '✅ Bot başarıyla Discord\'a bağlandı!');
    if (!client.options.intents.has?.(GatewayIntentBits.GuildVoiceStates)) {
      console.warn('⚠️ GuildVoiceStates intent aktif değil gibi görünüyor. Voice verileri toplanmayacak.');
    } else {
      console.log('🎙️ GuildVoiceStates intent aktif. Ses istatistikleri toplanabilir.');
    }
  } catch (error) {
    console.error('❌ Bot Discord\'a bağlanırken hata:', error.message);
    await sendGlobalLog(client, `❌ Giriş hatası: ${error.message || error}`);
    if (error.code === 'TokenInvalid') {
      console.error('Token geçersiz! .env dosyasındaki TOKEN değerini kontrol edin.');
    } else if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error('Bağlantı zaman aşımı! İnternet bağlantınızı kontrol edin.');
      console.log('5 saniye sonra tekrar denenecek...');
      await sendGlobalLog(client, '⏳ Bağlantı zaman aşımı, 5 sn sonra tekrar denenecek...');
      setTimeout(startBot, 5000);
      return;
    }
    process.exit(1);
  }
}

startBot();

// Ctrl+C keypress fallback kurulumu
setupCtrlCKeyListener();

require('./events/statsTracker')(client);
try {
  const { normalize } = require('./utils/statsNormalizator');
  normalize();
  console.log('🧹 statsData.json normalize edildi.');
} catch (e) {
  console.warn('⚠️ stats normalize sırasında hata:', e.message);
}

// Günlük / haftalık / aylık özet istatistikleri periyodik olarak üret
const fs = require('fs');
const path = require('path');
const statsPath = path.join(__dirname, 'statsData.json');

function loadStatsRaw() {
  if (!fs.existsSync(statsPath)) return {};
  try { return JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch { return {}; }
}
function saveStatsRaw(data) { fs.writeFileSync(statsPath, JSON.stringify(data, null, 2)); }

function pushCapped(arr, item, cap) {
  arr.push(item);
  if (arr.length > cap) arr.shift();
}

function aggregateHistory() {
  const stats = loadStatsRaw();
  const now = Date.now();
  const dayKey = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  for (const guildId of Object.keys(stats)) {
    const g = stats[guildId];
    if (!g.history) g.history = { daily: [], weekly: [], monthly: [] };
    if (!g.users) g.users = {}; if (!g.voiceUsers) g.voiceUsers = {};
    const totalMsgs = Object.values(g.users).reduce((a,b)=>a+(typeof b==='number'?b:0),0);
    const totalVoice = Object.values(g.voiceUsers).reduce((a,b)=>a+(typeof b==='number'?b:0),0);
    if (!g.history.daily.some(d => d.date === dayKey)) {
      pushCapped(g.history.daily, { date: dayKey, totalMsgs, totalVoice }, 60); // son 60 gün
    }
    // Haftalık (her Pazartesi yeni kayıt)
    const nowDate = new Date();
    const weekId = nowDate.getFullYear() + '-W' + Math.ceil((((nowDate - new Date(nowDate.getFullYear(),0,1)) / 86400000) + new Date(nowDate.getFullYear(),0,1).getDay()+1)/7);
    if (!g.history.weekly.some(w => w.week === weekId)) {
      pushCapped(g.history.weekly, { week: weekId, totalMsgs, totalVoice }, 26); // ~6 ay
    }
    // Aylık
    const monthId = new Date().toISOString().slice(0,7); // YYYY-MM
    if (!g.history.monthly.some(m => m.month === monthId)) {
      pushCapped(g.history.monthly, { month: monthId, totalMsgs, totalVoice }, 24); // 2 yıl
    }
  }
  saveStatsRaw(stats);
  console.log('📈 History aggregate çalıştı.');
}

// Her saat başı tetikle (ilk tetikleme 30s sonra)
setTimeout(()=>{
  aggregateHistory();
  setInterval(aggregateHistory, 3600*1000);
}, 30*1000);

// Gelişmiş hata yakalama sistemi
process.on('uncaughtException', async (error) => {
  console.error('❌ Yakalanmamış Exception:', error);
  console.error('Stack:', error.stack);
  await sendGlobalLog(client, `🔥 uncaughtException: ${error?.message || error}`);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Beklenmeyen hata (unhandledRejection):', reason);
  await sendGlobalLog(client, `❗ unhandledRejection: ${reason?.message || reason}`);
  
  // Özel hata türlerini yakala
  if (reason && reason.code) {
    switch (reason.code) {
      case 'UND_ERR_CONNECT_TIMEOUT':
        console.error('Discord bağlantı zaman aşımı! İnternet bağlantınızı kontrol edin.');
        break;
      case 'TokenInvalid':
        console.error('Bot token geçersiz! .env dosyasını kontrol edin.');
        break;
      case 'DisallowedIntents':
        console.error('Bot intent\'leri Discord Developer Portal\'da etkinleştirilmemiş.');
        break;
      default:
        console.error('Bilinmeyen hata kodu:', reason.code);
    }
  }
});

// Kapanış / yeniden başlatma logları
async function gracefulShutdown(signal) {
  if (__shuttingDown) return;
  __shuttingDown = true;
  const msg = signal ? `🛑 Bot kapanıyor...` : '🛑 Bot discorddan düştü';
  if (DEBUG_SHUTDOWN) console.log('[SHUTDOWN] Handler tetiklendi:', signal || 'NO-SIGNAL');
  // Önce kanalı refresh etmeyi dene (destroy öncesi)
  try {
    __globalLogChannel = client.channels.cache.get(GLOBAL_LOG_CHANNEL_ID) || await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID).catch(()=>__globalLogChannel);
  } catch {}
  // Kapanış mesajını gönder ve mümkünse kuyruktakileri de boşalt
  try {
    if (DEBUG_SHUTDOWN) console.log('[SHUTDOWN] Kapanış logu gönderiliyor...');
    await sendGlobalLog(client, msg);
    if (__globalLogQueue.length) {
      if (DEBUG_SHUTDOWN) console.log('[SHUTDOWN] Kuyrukta', __globalLogQueue.length, 'mesaj var, gönderiliyor...');
      for (const q of __globalLogQueue.splice(0)) {
        await sendGlobalLog(client, q);
      }
    }
  } catch {}
  // Ağın teslim etmesi için kısa bekleme (3.5s)
  await new Promise(res => setTimeout(res, 4500));
  try { await client.destroy(); } catch {}
  // Son bir küçük bekleme, sonra çık
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// Windows için Ctrl+Break
process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
// Bazı ortamlarda kapanış HUP ile gelebilir
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
process.on('beforeExit', async (code) => {
  try {
    await Promise.race([
      sendGlobalLog(client, `🛑 Process beforeExit: code=${code}`),
      new Promise(res => setTimeout(res, 1500))
    ]);
  } catch {}
});
process.on('exit', (code) => {
  // Bu aşamada async işlemler güvenilir değildir; konsola yazmakla yetinelim.
  console.log(`[EXIT] code=${code}`);
});
