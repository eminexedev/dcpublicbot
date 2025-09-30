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
    GatewayIntentBits.GuildPresences // Aktif kullanıcı sayımı için gerekli
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
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
  // Durumları gösteren ready.js'i çağır
  const { getPrefix } = require('./config');
  require('./events/ready')(client, getPrefix);

  // İstatistik kanallarını güncelle
  client.guilds.cache.forEach(guild => updateStatsChannels(guild));

  // Komutları deploy et
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
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
  }
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('Komutlar yükleniyor...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
  } catch (error) {
    console.error('Komut deploy hatası:', error);
  }
}

// Voice stats event handler'ını ekle
require('./events/voiceStats')(client);

client.login(process.env.TOKEN);

require('./events/statsTracker')(client);

// process ignore logic & system
/*
process.on('uncaughtException', (err) => {
  console.errkr('Expection handled:', err);
*/
process.on('unhandledRejection', (reason, promise) => {
  console.error('Beklenmeyen hata (unhandledRejection):', reason);
});
