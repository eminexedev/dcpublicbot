const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPrefix, setPrefix } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Sunucu prefix\'ini ayarlar veya görüntüler.')
    .addStringOption(option =>
      option.setName('yeni_prefix')
        .setDescription('Ayarlanacak yeni prefix (boş bırakırsanız mevcut prefix gösterilir)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    const currentPrefix = getPrefix(interaction.guild.id);
    const newPrefix = interaction.options.getString('yeni_prefix');
    
    if (!newPrefix) {
      // Mevcut prefix'i göster
      const infoEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📝 Sunucu Prefix Bilgisi')
        .setDescription(`**${interaction.guild.name}** sunucusunun mevcut prefix'i:`)
        .addFields(
          {
            name: '🔖 Mevcut Prefix',
            value: `\`${currentPrefix}\``,
            inline: true
          },
          {
            name: '📋 Örnek Kullanım',
            value: `\`${currentPrefix}ban @kullanıcı\`\n\`${currentPrefix}kick @kullanıcı\``,
            inline: true
          },
          {
            name: '⚙️ Prefix Değiştirme',
            value: '`/prefix yeni_prefix:[prefix]`',
            inline: false
          }
        )
        .setFooter({ 
          text: `${interaction.guild.name} • Prefix sistemi`, 
          iconURL: interaction.guild.iconURL() 
        })
        .setTimestamp();

      return interaction.reply({ embeds: [infoEmbed], ephemeral: true });
    }

    // Yeni prefix'i ayarla
    if (newPrefix.length > 5) {
      return interaction.reply({
        content: '❌ Prefix en fazla 5 karakter olabilir.',
        ephemeral: true
      });
    }

    if (newPrefix.includes(' ')) {
      return interaction.reply({
        content: '❌ Prefix boşluk karakteri içeremez.',
        ephemeral: true
      });
    }

    try {
      setPrefix(interaction.guild.id, newPrefix);

      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Prefix Başarıyla Değiştirildi')
        .setDescription(`**${interaction.guild.name}** sunucusunun prefix'i güncellendi.`)
        .addFields(
          {
            name: '🔖 Eski Prefix',
            value: `\`${currentPrefix}\``,
            inline: true
          },
          {
            name: '🆕 Yeni Prefix',
            value: `\`${newPrefix}\``,
            inline: true
          },
          {
            name: '📋 Örnek Kullanım',
            value: `\`${newPrefix}ban @kullanıcı\`\n\`${newPrefix}kick @kullanıcı\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${interaction.guild.name} • Prefix sistemi güncellendi`, 
          iconURL: interaction.guild.iconURL() 
        })
        .setTimestamp();

      return interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
      console.error('Prefix ayarlama hatası:', error);
      return interaction.reply({
        content: '❌ Prefix ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};