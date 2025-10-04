const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Bulunduğunuz metin kanalını kilitler (yazmaya kapatır).')
    .addRoleOption(option =>
      option.setName('yetkili-rol')
        .setDescription('Bu role sahip kullanıcılar kilitle etkilenmez (opsiyonel)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Bulunduğunuz metin kanalını kilitler (yazmaya kapatır). Yetkili rol belirterek o rolü istisna yapabilirsiniz.',
  usage: '/lock [yetkili-rol]',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.GuildText) {
      return interaction.reply({ 
        content: '❌ Bu komut sadece metin kanallarında kullanılabilir.', 
        ephemeral: true
      });
    }

    const exemptRole = interaction.options.getRole('yetkili-rol');

    try {
      // @everyone rolünü kilitle
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false
      });

      // Eğer muaf rol belirtildiyse, o role yazma izni ver
      if (exemptRole) {
        await interaction.channel.permissionOverwrites.edit(exemptRole.id, {
          SendMessages: true,
          AddReactions: true,
          CreatePublicThreads: true,
          CreatePrivateThreads: true,
          SendMessagesInThreads: true
        });
      }

      const lockEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔒 Kanal Kilitlendi')
        .setDescription(`Bu kanal ${interaction.user.tag} tarafından kilitlendi.`)
        .addFields(
          {
            name: '📝 Durum',
            value: 'Bu kanalda artık mesaj gönderilemez.',
            inline: true
          },
          {
            name: '🔓 Kilit Açma',
            value: '`/unlock` komutuyla kilidi açabilirsiniz.',
            inline: true
          }
        );

      if (exemptRole) {
        lockEmbed.addFields({
          name: '👑 Muaf Rol',
          value: `${exemptRole} rolüne sahip kullanıcılar yazabilir.`,
          inline: false
        });
      }

      lockEmbed
        .setFooter({ text: `${interaction.guild.name} • Kanal güvenliği`, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [lockEmbed] });

      // Log kanalına bildirim gönder
      await sendLockLog(interaction.guild, interaction.channel, interaction.user, exemptRole);

    } catch (error) {
      console.error('Kanal kilitleme hatası:', error);
      await interaction.reply({
        content: '❌ Kanal kilitlenirken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};

// Log fonksiyonu
async function sendLockLog(guild, channel, user, exemptRole) {
  try {
    const logChannelId = findAnyLogChannel(guild.id);
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
      .setColor('#FF6B35')
      .setTitle('🔒 Kanal Kilitlendi')
      .setDescription(`**${channel.name}** kanalı kilitlendi.`)
      .addFields(
        {
          name: '👤 Yetkili',
          value: `${user.tag} (${user.id})`,
          inline: true
        },
        {
          name: '📝 Kanal',
          value: `${channel.name} (${channel.id})`,
          inline: true
        }
      );

    if (exemptRole) {
      logEmbed.addFields({
        name: '👑 Muaf Rol',
        value: `${exemptRole.name} (${exemptRole.id})`,
        inline: true
      });
    }

    logEmbed
      .setFooter({ text: guild.name, iconURL: guild.iconURL() })
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Lock log gönderme hatası:', error);
  }
}