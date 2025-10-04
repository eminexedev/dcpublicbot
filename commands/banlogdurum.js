const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getBanLogChannel } = require('../config');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlogdurum')
    .setDescription('Ban log kanalı ayarlarını görüntüler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'Ban log kanalı ayarlarını görüntüler. Kullanım: .banlogdurum',
  usage: '.banlogdurum',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(interaction) {
    const banLogChannelId = getBanLogChannel(interaction.guild.id);
    
    const statusEmbed = new EmbedBuilder()
      .setTitle('🔨 Ban Log Sistemi Durumu')
      .setColor('#FF6B35')
      .setTimestamp()
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (banLogChannelId) {
      const logChannel = interaction.guild.channels.cache.get(banLogChannelId);
      if (logChannel) {
        statusEmbed.setDescription('✅ Ban log sistemi aktif!')
          .addFields(
            {
              name: '📢 Ban Log Kanalı',
              value: `${logChannel} (\`${logChannel.name}\`)`,
              inline: false
            },
            {
              name: '🆔 Kanal ID',
              value: `\`${banLogChannelId}\``,
              inline: true
            },
            {
              name: '📊 Durum',
              value: '`🟢 Aktif`',
              inline: true
            },
            {
              name: '🔨 Ban Komut Durumu',
              value: '`✅ Kullanılabilir`',
              inline: true
            }
          );
      } else {
        statusEmbed.setDescription('⚠️ Ban log kanalı ayarlanmış ama kanal bulunamıyor!')
          .addFields(
            {
              name: '❌ Problem',
              value: 'Ayarlanan kanal silinmiş veya erişilemiyor.',
              inline: false
            },
            {
              name: '🆔 Kayıtlı Kanal ID',
              value: `\`${banLogChannelId}\``,
              inline: true
            },
            {
              name: '💡 Çözüm',
              value: '`/banlogkanal` komutuyla yeni bir kanal ayarlayın.',
              inline: false
            },
            {
              name: '🔨 Ban Komut Durumu',
              value: '`❌ Kullanılamaz`',
              inline: true
            }
          );
      }
    } else {
      statusEmbed.setDescription('❌ Ban log sistemi henüz ayarlanmamış!')
        .addFields(
          {
            name: '📝 Nasıl Ayarlanır?',
            value: '`/banlogkanal #kanal` komutuyla ban logları için özel kanal ayarlayabilirsiniz.',
            inline: false
          },
          {
            name: '⚠️ Önemli Uyarı',
            value: 'Ban log kanalı ayarlanmadan `/ban` komutu kullanılamaz!',
            inline: false
          },
          {
            name: '📊 Durum',
            value: '`🔴 Pasif`',
            inline: true
          },
          {
            name: '🔨 Ban Komut Durumu',
            value: '`❌ Kullanılamaz`',
            inline: true
          }
        );
    }

    return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
  }
};
