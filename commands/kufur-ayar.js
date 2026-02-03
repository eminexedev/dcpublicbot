const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getProfanityChannels, addProfanityChannel, removeProfanityChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kufur-ayar')
    .setDescription('Küfür engel sisteminde aktif olacak kanalları yönetir.')
    .addSubcommand(sub =>
      sub.setName('ekle')
        .setDescription('Filtreden etkilenecek kanala ekle')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Metin kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('kaldir')
        .setDescription('Filtreden bir kanalı kaldır')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Metin kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('Aktif kanalların listesini gösterir')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'Küfür engel kanallarını yönetir. Kullanım: .kufur-ayar ekle #kanal | .kufur-ayar kaldir #kanal | .kufur-ayar liste',
  usage: '.kufur-ayar <ekle|kaldir|liste> [#kanal]',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}
    try { if (typeof ctx.isCommand === 'function' && ctx.isCommand()) isSlash = true; } catch {}

    let sub, channel;
    if (isSlash) {
      sub = ctx.options.getSubcommand();
      channel = ctx.options.getChannel('kanal');
    } else {
      sub = (args && args[0]) ? String(args[0]).toLowerCase() : null;
      const raw = args && args[1];
      if (raw) {
        const idMatch = raw.match(/<#(\d{17,})>/);
        const channelId = idMatch ? idMatch[1] : raw;
        channel = ctx.guild.channels.cache.get(channelId);
      }
    }

    if (!sub || !['ekle','kaldir','liste'].includes(sub)) {
      return ctx.reply({ content: 'Geçerli alt komut: ekle | kaldir | liste', ephemeral: true });
    }

    const guildId = ctx.guild.id;
    if (sub === 'liste') {
      const list = getProfanityChannels(guildId);
      if (!list.length) return ctx.reply('Aktif kanal yok.');
      const lines = list.map(id => {
        const ch = ctx.guild.channels.cache.get(id);
        return ch ? `${ch}` : `#silinmis (${id})`;
      }).join('\n');
      return ctx.reply({ content: `Aktif kanallar:\n${lines}` });
    }

    if (!channel || channel.type !== 0) {
      return ctx.reply({ content: 'Metin kanalı belirtmelisin.', ephemeral: true });
    }

    if (sub === 'ekle') {
      addProfanityChannel(guildId, channel.id);
      return ctx.reply({ content: `✅ Filtre aktif kanallara eklendi: ${channel}` });
    }
    if (sub === 'kaldir') {
      removeProfanityChannel(guildId, channel.id);
      return ctx.reply({ content: `✅ Filtre bu kanaldan kaldırıldı: ${channel}` });
    }
  }
};
