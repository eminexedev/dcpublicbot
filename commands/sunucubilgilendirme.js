const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../sunucuBilgiConfig.json');

function getConfig(guildId) {
  if (!fs.existsSync(configPath)) return {};
  const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return data[guildId] || {};
}

function setConfig(guildId, data) {
  let all = {};
  if (fs.existsSync(configPath)) {
    all = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  all[guildId] = data;
  fs.writeFileSync(configPath, JSON.stringify(all, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sunucubilgilendirme')
    .setDescription('Boost ve kurallar bilgilendirme mesajlarını ayarlar (webhook ile gönderir).')
    .addChannelOption(option =>
      option.setName('boostkanal').setDescription('Booster avantajlarının gönderileceği kanal').setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('kurallarkanal').setDescription('Kuralların gönderileceği kanal').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(ctx) {
    const guild = ctx.guild;
    let boostChannel, rulesChannel;
    // Slash komut
    if (ctx.options && ctx.options.getChannel) {
      boostChannel = ctx.options.getChannel('boostkanal');
      rulesChannel = ctx.options.getChannel('kurallarkanal');
    } else if (ctx.message) {
      // Prefix komut: .sunucubilgilendirme #boostkanal #kurallarkanal
      if (!ctx.args[0] || !ctx.args[1]) {
        return ctx.channel.send('Kullanım: .sunucubilgilendirme #boostkanal #kurallarkanal');
      }
      const boostId = ctx.args[0].replace(/<#(\d+)>/, '$1');
      const rulesId = ctx.args[1].replace(/<#(\d+)>/, '$1');
      boostChannel = guild.channels.cache.get(boostId);
      rulesChannel = guild.channels.cache.get(rulesId);
      if (!boostChannel || !rulesChannel) {
        return ctx.channel.send('Kanal(lar) bulunamadı.');
      }
    } else {
      return;
    }

    // Webhook oluştur veya bul
    const boostWebhook = await ensureWebhook(boostChannel, 'Booster Avantajları');
    const rulesWebhook = await ensureWebhook(rulesChannel, `${guild.name} Kuralları`);

    // Mesaj içerikleri (isteğe göre düzenlenebilir)
    const boostMsg =
      '<`1417930231070851082`> **Sunucumuza boost basan üyeler için avantajlar:**\n\n- Özel booster rolü\n- Booster sohbet kanalı\n- Sunucuya özel emoji ekleme\n- İsmini istediğin gibi değiştirme\n- Ve daha fazlası!\n\nBoost basarak destek olduğun için teşekkürler!';
    const rulesMsg =
      `📜 **${guild.name} Kuralları**\n\n1. Saygılı olun.\n2. Spam ve reklam yasaktır.\n3. Küfür, hakaret ve ayrımcılık yasaktır.\n4. Yetkililerin uyarılarına uyun.\n5. Discord'un kullanım koşullarına uyun.\n\nKurallara uymayanlar sunucudan uzaklaştırılır.`;

    // Webhook ile mesaj gönder
    await boostWebhook.send({ content: boostMsg });
    await rulesWebhook.send({ content: rulesMsg });

    // Config kaydet
    setConfig(guild.id, {
      boostChannelId: boostChannel.id,
      rulesChannelId: rulesChannel.id,
      boostWebhookId: boostWebhook.id,
      rulesWebhookId: rulesWebhook.id
    });

    if (ctx.reply) {
      await ctx.reply({ content: 'Bilgilendirme mesajları başarıyla gönderildi ve ayarlandı.' });
    } else if (ctx.channel) {
      await ctx.channel.send('Bilgilendirme mesajları başarıyla gönderildi ve ayarlandı.');
    }
  }
};

async function ensureWebhook(channel, name) {
  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(w => w.name === name);
  if (!webhook) {
    webhook = await channel.createWebhook({ name });
  }
  return webhook;
}
