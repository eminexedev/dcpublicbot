const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setBanLogChannel } = require('../config');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlogkanal')
    .setDescription('Ban loglarının gönderileceği kanalı ayarlar.')
    .addChannelOption(option =>
      option.setName('kanal')
        .setDescription('Ban log kanalı')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'Ban loglarının gönderileceği kanalı ayarlar. Kullanım: .banlogkanal #kanal',
  usage: '.banlogkanal #kanal',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, args) {
    let channel;

    // Slash command kontrolü
    if (interaction.options) {
      channel = interaction.options.getChannel('kanal');
    } 
    // Prefix command kontrolü
    else if (args && args[0]) {
      // Kanal mention'ını parse et
      const channelId = args[0].replace(/[<#>]/g, '');
      channel = interaction.guild.channels.cache.get(channelId);
      
      if (!channel) {
        return interaction.reply({
          content: 'Geçersiz kanal! Bir kanal etiketlemelisin.',
          ephemeral: true
        });
      }
    } else {
      return interaction.reply({
        content: 'Bir kanal belirtmelisin. Kullanım: `/banlogkanal #kanal` veya `.banlogkanal #kanal`',
        ephemeral: true
      });
    }

    if (!channel) {
      return interaction.reply({
        content: 'Bir kanal belirtmelisin.',
        ephemeral: true
      });
    }

    // Kanalın metin kanalı olup olmadığını kontrol et
    if (!channel.isTextBased()) {
      return interaction.reply({ content: 'Ban log kanalı sadece metin kanalı olabilir.', ephemeral: true });
    }

    // Ban log kanalını ayarla
    setBanLogChannel(interaction.guild.id, channel.id);
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00) // Green success color
      .setTitle('✅ Ban Log Sistemi Aktifleştirildi')
      .setDescription(`**${channel}** kanalı ban logları için başarıyla ayarlandı.`)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png')
      .addFields(
        {
          name: '📝 Log İçeriği',
          value: '```yaml\n✓ Ban işlemleri\n✓ Moderatör bilgileri  \n✓ Ban sebepleri\n✓ Tarih ve saat\n✓ Kullanıcı detayları\n```',
          inline: false
        },
        {
          name: '🔧 Ayarlanan Kanal',
          value: `${channel}\n\`ID: ${channel.id}\``,
          inline: true
        },
        {
          name: '🚫 Ban Komutu',
          value: '**Artık kullanılabilir**\n`/ban @kullanıcı [sebep]`',
          inline: true
        },
        {
          name: '📊 Durum Kontrolü',
          value: '`/banlogdurum`',
          inline: true
        }
      )
      .setFooter({ 
        text: `${interaction.guild.name} • Ban sistemi güvenli şekilde yapılandırıldı`, 
        iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined 
      })
      .setTimestamp();
    
    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
  }
};
