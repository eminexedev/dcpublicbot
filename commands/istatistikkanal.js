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
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}
    try { if (typeof ctx.isCommand === 'function' && ctx.isCommand()) isSlash = true; } catch {}
    const tip = isSlash ? ctx.options.getString('tip') : (args && args[0] ? String(args[0]).toLowerCase() : null);
    const kanalTuru = isSlash ? ctx.options.getString('kanalturu') : (args && args[1] ? String(args[1]).toLowerCase() : null);

    if (!['uye','aktif'].includes(tip) || !['text','voice'].includes(kanalTuru)) {
      return ctx.reply({ 
        content: 'Geçerli tip (uye/aktif) ve kanal türü (text/voice) belirtmelisin.', 
        ephemeral: true 
      });
    }

    try {
      let channel;
      if (kanalTuru === 'text') {
        channel = await ctx.guild.channels.create({
          name: tip === 'uye' ? 'üye-sayısı-0' : 'aktif-kullanıcı-0',
          type: ChannelType.GuildText,
          reason: 'İstatistik kanalı oluşturuldu.'
        });
      } else if (kanalTuru === 'voice') {
        channel = await ctx.guild.channels.create({
          name: tip === 'uye' ? 'Üye: 0' : 'Aktif: 0',
          type: ChannelType.GuildVoice,
          reason: 'İstatistik kanalı oluşturuldu.'
        });
      }

      setStatsChannel(ctx.guild.id, tip, channel.id);
      
      await ctx.reply({ 
        content: `✅ Başarıyla yeni kanal oluşturuldu: ${channel} (${tip === 'uye' ? 'Üye Sayısı' : 'Aktif Kullanıcı'})`,
        ephemeral: false
      });
    } catch (error) {
      console.error('İstatistik kanalı oluşturma hatası:', error);
      await ctx.reply({
        content: '❌ Kanal oluşturulurken hata oluştu.',
        ephemeral: true
      });
    }
  }
};
