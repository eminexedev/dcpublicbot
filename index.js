// Discord botunun ana dosyası
require('dotenv').config();
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
client.on('ready', () => {
  client.guilds.cache.forEach(guild => updateStatsChannels(guild));
});

// Prefix tabanlı ve etiketli komutlar için
const { getPrefix } = require('./prefixConfig');

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const allPrefixes = ['.', '!', '/'];
  const guildPrefix = getPrefix(message.guild.id);
  const prefixesToCheck = Array.from(new Set([guildPrefix, ...allPrefixes]));
  const mentionRegex = new RegExp(`^<@!?${client.user.id}>`);
  let usedPrefix = null;
  for (const p of prefixesToCheck) {
    if (message.content.startsWith(p)) {
      usedPrefix = p;
      break;
    }
  }
  if (!usedPrefix && mentionRegex.test(message.content)) {
    // Sadece etiketle yazıldıysa info embed gönder
    if (message.content.trim() === message.content.match(mentionRegex)[0]) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('Public Bot Hakkında')
        .setColor('#5865F2')
        .setDescription('Gelişmiş moderasyon, çekiliş ve istatistik özellikleri sunar.')
        .addFields(
          { name: 'Prefix', value: `Sunucu prefixi: \`${guildPrefix}\``, inline: true },
          { name: 'Yardım', value: '`/yardim` veya `@Bot yardim` ile tüm komutları görebilirsin.', inline: true },
          { name: 'Geliştirici', value: '<@1386063084530962534>', inline: true }
        )
        .setFooter({ text: 'Daha fazla bilgi için /yardim komutunu kullan.' });
      return message.reply({ embeds: [embed] });
    }
    usedPrefix = message.content.match(mentionRegex)[0];
  }
  if (!usedPrefix) return;
  const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;
  // Komutları dinamik olarak çalıştır
  const command = client.commands?.get(commandName);
  if (!command) return;
  try {
    // Yetki kontrolü (varsa)
    if (command.data && command.data.default_member_permissions) {
      const requiredPerms = BigInt(command.data.default_member_permissions);
      if ((message.member.permissions.bitfield & requiredPerms) !== requiredPerms) {
        return message.reply('Bu komutu kullanmak için yeterli yetkin yok.');
      }
    }
    // Komutun execute fonksiyonunu message ile çağır
    if (command.execute) {
      await command.execute({
        message,
        args,
        guild: message.guild,
        member: message.member,
        author: message.author,
        channel: message.channel,
        client
      });
    }
  } catch (err) {
    console.error(err);
    message.reply('Bir hata oluştu.');
  }
});

// Otomatik log kanalı sistemi
const { getAutoLogChannel, setAutoLogChannel } = require('./autoLogConfig');
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

client.once('ready', () => {
  console.log(`Bot aktif: ${client.user.tag}`);
});

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
    console.log('Komutlar başarıyla yüklendi!');
  } catch (error) {
    console.error('Komut deploy hatası:', error);
  }
}

// Bot başlatıldığında komutları deploy et
client.once('ready', async () => {
  await deployCommands();
  console.log(`Bot aktif: ${client.user.tag}`);
});

client.login(process.env.TOKEN);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Beklenmeyen hata (unhandledRejection):', reason);
});
