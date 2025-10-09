const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cek')
    .setDescription('Belirtilen kullanıcıyı bulunduğun ses kanalına çeker.')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Çekilecek kullanıcı')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  category: 'moderation',
  description: 'Kullanıcıyı komutu kullananın ses kanalına taşır.',
  usage: '.çek @kullanıcı | .cek @kullanıcı | /cek kullanıcı:@kullanıcı',
  permissions: [PermissionFlagsBits.MoveMembers],

  async execute(ctx, args) {
    // Slash mı prefix mi?
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}

    const guild = ctx.guild || ctx.message?.guild;
    if (!guild) {
      const msg = 'Sunucu bağlamı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Yetki kontrolü (kullanıcı)
    const member = guild.members.cache.get(isSlash ? ctx.user.id : ctx.author.id);
    if (!member) {
      const msg = 'Üye bilgisi alınamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (!member.permissions.has(PermissionFlagsBits.MoveMembers)) {
      const msg = '❌ Bu komutu kullanmak için Üyeleri Taşı (Move Members) yetkisine sahip olmalısın.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Hedef kullanıcıyı al
    let targetUserId = null;
    if (isSlash) {
      const u = ctx.options?.getUser('kullanici');
      if (u) targetUserId = u.id;
    } else {
      const raw = args?.[0];
      if (!raw) {
        return ctx.reply('Kullanım: `.çek @kullanıcı` veya `.çek kullanıcıID`');
      }
      const idMatch = raw.match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
      targetUserId = idMatch ? (idMatch[1] || idMatch[2]) : null;
    }

    if (!targetUserId) {
      const msg = 'Geçerli bir kullanıcı belirtmelisin.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      const msg = 'Hedef kullanıcı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (targetMember.id === member.id) {
      const msg = 'Kendini taşıyamazsın.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Komutu kullananın ses kanalı
    const actorChannel = member.voice?.channel;
    if (!actorChannel) {
      const msg = 'Önce bir ses kanalına katılmalısın.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(actorChannel.type)) {
      const msg = 'Bu komut sadece sunucu ses/stage kanallarında kullanılabilir.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Hedefin mevcut kanalı
    const targetChannel = targetMember.voice?.channel;
    if (!targetChannel) {
      const msg = 'Hedef kullanıcı bir ses kanalında değil.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (targetChannel.id === actorChannel.id) {
      const msg = 'Hedef kullanıcı zaten bulunduğun ses kanalında.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Bot yetkisi kontrolü
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me) {
      const msg = 'Bot üye bilgisi alınamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    const botCanMove = me.permissions.has(PermissionFlagsBits.MoveMembers) && guild.members.me.permissionsIn(actorChannel).has(PermissionFlagsBits.Connect);
    if (!botCanMove) {
      const msg = 'Botun Üyeleri Taşı (Move Members) ve hedef kanala Bağlan (Connect) yetkisi olmalı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Kanal kullanıcı limiti dolu mu?
    if (actorChannel.userLimit && actorChannel.members.size >= actorChannel.userLimit) {
      const msg = 'Hedef ses kanalı dolu (kullanıcı limiti).';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    try {
      await targetMember.voice.setChannel(actorChannel, `Çek komutu: ${member.user.tag}`);
      const msg = `✅ ${targetMember} kullanıcısı ${actorChannel} kanalına taşındı.`;
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    } catch (err) {
      console.error('[CEK CMD] move error:', err);
      const msg = '❌ Kullanıcı taşınırken bir hata oluştu. Yetkiler ve kanal durumunu kontrol edin.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
  }
};
