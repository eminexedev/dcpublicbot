const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sleep')
    .setDescription('Sesteki kullanıcı(ları) AFK kanalına taşır')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('AFK kanalına taşınacak kullanıcı')
        .setRequired(true)
    ),

  category: 'voice',
  description: 'Belirttiğin kullanıcıyı AFK kanalına taşır (hedef zorunlu).',
  usage: '.sleep @kullanıcı | .sleep kullanıcıID | /sleep kullanici:@kullanıcı',

  async execute(ctx, args) {
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}

    const guild = ctx.guild || ctx.message?.guild;
    if (!guild) {
      const msg = 'Sunucu bağlamı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me) {
      const msg = 'Bot üye bilgisi alınamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Komutu kullanan
    const author = isSlash ? ctx.user : ctx.author;
    const member = guild.members.cache.get(author.id) || await guild.members.fetch(author.id).catch(() => null);
    if (!member) {
      const msg = 'Üye bilgisi alınamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    const actorChannel = member.voice?.channel;
    if (!actorChannel) {
      const msg = 'Önce bir ses kanalına katılmalısın.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // AFK kanalı
    const afkId = guild.afkChannelId;
    const afkChannel = afkId ? guild.channels.cache.get(afkId) : null;
    if (!afkChannel || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(afkChannel.type)) {
      const msg = '❌ Sunucuda bir AFK kanalı ayarlanmamış gibi görünüyor. Sunucu Ayarları > Kanal > AFK Kanalı kısmından ayarlayın.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Bot yetkisi
    const botCanMove = me.permissions.has(PermissionFlagsBits.MoveMembers) && me.permissionsIn(afkChannel).has(PermissionFlagsBits.Connect);
    if (!botCanMove) {
      const msg = '❌ Botun Üyeleri Taşı (Move Members) ve AFK kanalına Bağlan (Connect) yetkisi olmalı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    let targetUserId = null;
    if (isSlash) {
      const u = ctx.options?.getUser('kullanici');
      targetUserId = u?.id || null;
    } else {
      const raw = args?.[0];
      if (!raw) {
        const msg = 'Kullanım: `.sleep @kullanıcı` veya `.sleep kullanıcıID`';
        return ctx.reply(msg);
      }
      const idMatch = raw.match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
      targetUserId = idMatch ? (idMatch[1] || idMatch[2]) : null;
    }

    if (!targetUserId) {
      const msg = 'Geçerli bir kullanıcı belirtmelisin.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    const target = await guild.members.fetch(targetUserId).catch(() => null);
    if (!target) {
      const msg = 'Hedef kullanıcı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (!target.voice?.channel) {
      const msg = 'Hedef kullanıcı bir ses kanalında değil.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (target.id === member.id) {
      const msg = 'Kendini AFK kanalına taşıyamazsın. 🙂';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    try {
      await target.voice.setChannel(afkChannel, `sleep komutu: ${member.user.tag}`);
      const actorMention = member.toString();
      const targetMention = target.toString();
      const text = `✅ ${targetMention} AFK kanalına taşındı. Taşıyan: ${actorMention}`;
      return isSlash ? ctx.reply({ content: text, ephemeral: true }) : ctx.reply(text);
    } catch (err) {
      console.error('[SLEEP CMD] move error:', err);
      const text = `❌ ${target} taşınamadı. Yetkiler/kanal durumunu kontrol edin.`;
      return isSlash ? ctx.reply({ content: text, ephemeral: true }) : ctx.reply(text);
    }
  }
};
