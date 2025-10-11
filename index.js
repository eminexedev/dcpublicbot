// Discord botunun ana dosyası
require('@dotenvx/dotenvx').config()
const { Client, GatewayIntentBits, Partials } = require('discord.js');

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
      // Sadece "online", "idle" ve "dnd" olan gerçek kullanıcıları say
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
client.once('clientReady', async () => {
  console.log('✅ Client ready event tetiklendi. Giriş yapan bot:', client.user?.tag);
  console.log('🔍 Aktif intentler:', client.options.intents.bitfield?.toString());
  const { getPrefix } = require('./config');
  require('./events/ready')(client, getPrefix);

  client.guilds.cache.forEach(guild => updateStatsChannels(guild));
  await deployCommands();
});

// commandHandler.js tüm komutları hallediyor, burada ek işleyici gerekli değil

// Otomatik log kanalı sistemi
const { getAutoLogChannel, setAutoLogChannel } = require('./config');
// Sunucuya katıldığında otomatik log kanalı oluştur
client.on('guildCreate', async (guild) => {
  let logChannel = guild.channels.cache.find(c => c.name === 'bot-log' && c.type === 0);
  if (!logChannel) {
    logChannel = await guild.channels.create({
      name: 'bot-log',
      type: 0,
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

// Template interactions event handler'ını ekle
require('./events/templateInteractions')(client);

// Security protection event handler'ını ekle
require('./events/securityProtection')(client);

// Bot'u başlat
async function startBot() {
  try {
    console.log('Bot Discord\'a bağlanıyor...');
    await client.login(process.env.TOKEN);
    console.log('✅ Bot başarıyla Discord\'a bağlandı!');
    if (!client.options.intents.has?.(GatewayIntentBits.GuildVoiceStates)) {
      console.warn('⚠️ GuildVoiceStates intent aktif değil gibi görünüyor. Voice verileri toplanmayacak.');
    } else {
      console.log('🎙️ GuildVoiceStates intent aktif. Ses istatistikleri toplanabilir.');
    }
  } catch (error) {
    console.error('❌ Bot Discord\'a bağlanırken hata:', error.message);
    if (error.code === 'TokenInvalid') {
      console.error('Token geçersiz! .env dosyasındaki TOKEN değerini kontrol edin.');
    } else if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error('Bağlantı zaman aşımı! İnternet bağlantınızı kontrol edin.');
      console.log('5 saniye sonra tekrar denenecek...');
      setTimeout(startBot, 5000);
      return;
    }
    process.exit(1);
  }
}

startBot();

require('./events/statsTracker')(client);

// İstatistik dosyasını normalize et (eksik alanları tamamla / NaN temizle)
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
    // Günlük toplamlar
    const totalMsgs = Object.values(g.users).reduce((a,b)=>a+(typeof b==='number'?b:0),0);
    const totalVoice = Object.values(g.voiceUsers).reduce((a,b)=>a+(typeof b==='number'?b:0),0);
    // Aynı gün içinde tekrar ekleme yapmayalım
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
process.on('uncaughtException', (error) => {
  console.error('❌ Yakalanmamış Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Beklenmeyen hata (unhandledRejection):', reason);
  
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
