const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setStatsChannel } = require('../statsConfig');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('istatistikkanal')
    .setDescription('Üye veya aktif kullanıcı sayısını gösterecek yeni kanal oluşturur ve ismini otomatik günceller.')
    .addStringOption(option =>
      option.setName('tip').setDescription('Göstergesi (uye/aktif)').setRequired(true)
        .addChoices(
          { name: 'Üye Sayısı', value: 'uye' },
          { name: 'Aktif Kullanıcı', value: 'aktif' }
        )
    )
    .addStringOption(option =>
      option.setName('kanalturu').setDescription('Kanal türü').setRequired(true)
        .addChoices(
          { name: 'Metin Kanalı', value: 'text' },
          { name: 'Ses Kanalı', value: 'voice' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'Üye veya aktif kullanıcı sayısını gösterecek kanal oluşturur. Kullanım: .istatistikkanal <tip> <kanal_türü>',
  usage: '.istatistikkanal <tip> <kanal_türü>',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    let tip, kanalturu;

    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      tip = ctx.options.getString('tip');
      kanalturu = ctx.options.getString('kanalturu');
    } else {
      // Prefix komut
      if (!args[0] || !args[1]) {
        return ctx.reply({
          content: 'Lütfen tip (uye/aktif) ve kanal türü (text/voice) belirtin.\nÖrnek: `.istatistikkanal uye voice`',
          ephemeral: true
        });
      }
      tip = args[0];
      kanalturu = args[1];
    }

    if (!tip || !kanalturu) {
      return ctx.reply({
        content: 'Lütfen tip (uye/aktif) ve kanal türü (text/voice) belirtin.\nÖrnek: `.istatistikkanal uye voice`',
        ephemeral: true
      });
    }

    if (!['uye','aktif'].includes(tip) || !['text','voice'].includes(kanalturu)) {
      return ctx.reply({ 
        content: 'Geçerli tip (uye/aktif) ve kanal türü (text/voice) belirtmelisin.', 
        ephemeral: true 
      });
    }

    let channel;
    if (kanalturu === 'text') {
      channel = await ctx.guild.channels.create({
        name: tip === 'uye' ? 'üye-sayısı-0' : 'aktif-kullanıcı-0',
        type: ChannelType.GuildText,
        reason: 'İstatistik kanalı oluşturuldu.'
      });
    } else if (kanalturu === 'voice') {
      channel = await ctx.guild.channels.create({
        name: tip === 'uye' ? 'Üye: 0' : 'Aktif: 0',
        type: ChannelType.GuildVoice,
        reason: 'İstatistik kanalı oluşturuldu.'
      });
    }

    setStatsChannel(ctx.guild.id, tip, channel.id);
    await ctx.reply({ 
      content: `Başarıyla yeni kanal oluşturuldu: ${channel} (${tip === 'uye' ? 'Üye Sayısı' : 'Aktif Kullanıcı'})` 
    });
  }
};
