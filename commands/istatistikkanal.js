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

  async execute(interaction) {
    const tip = interaction.options.getString('tip');
    const kanalTuru = interaction.options.getString('kanalturu');

    if (!['uye','aktif'].includes(tip) || !['text','voice'].includes(kanalTuru)) {
      return interaction.reply({ 
        content: 'Geçerli tip (uye/aktif) ve kanal türü (text/voice) belirtmelisin.', 
        ephemeral: true 
      });
    }

    try {
      let channel;
      if (kanalTuru === 'text') {
        channel = await interaction.guild.channels.create({
          name: tip === 'uye' ? 'üye-sayısı-0' : 'aktif-kullanıcı-0',
          type: ChannelType.GuildText,
          reason: 'İstatistik kanalı oluşturuldu.'
        });
      } else if (kanalTuru === 'voice') {
        channel = await interaction.guild.channels.create({
          name: tip === 'uye' ? 'Üye: 0' : 'Aktif: 0',
          type: ChannelType.GuildVoice,
          reason: 'İstatistik kanalı oluşturuldu.'
        });
      }

      setStatsChannel(interaction.guild.id, tip, channel.id);
      
      await interaction.reply({ 
        content: `✅ Başarıyla yeni kanal oluşturuldu: ${channel} (${tip === 'uye' ? 'Üye Sayısı' : 'Aktif Kullanıcı'})`,
        ephemeral: false
      });
    } catch (error) {
      console.error('İstatistik kanalı oluşturma hatası:', error);
      await interaction.reply({
        content: '❌ Kanal oluşturulurken hata oluştu.',
        ephemeral: true
      });
    }
  }
};
