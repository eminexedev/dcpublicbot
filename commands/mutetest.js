const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mutetest')
    .setDescription('Belirli bir kullanıcının mute durumunu test eder')
    .addUserOption(option =>
      option
        .setName('kullanici')
        .setDescription('Test edilecek kullanıcı')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('kullanici');
      const member = await interaction.guild.members.fetch(targetUser.id);
      
      // Muted rolünü kontrol et
      const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
      
      if (!muteRole) {
        return await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('❌ Muted Rolü Bulunamadı')
              .setDescription('Muted rolü mevcut değil.')
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      const hasMuteRole = member.roles.cache.has(muteRole.id);
      
      const embed = new EmbedBuilder()
        .setTitle('🔍 Mute Durumu Testi')
        .setColor(hasMuteRole ? '#FFA500' : '#00FF00')
        .addFields(
          { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
          { name: '🏷️ Muted Rolü', value: hasMuteRole ? '✅ Var' : '❌ Yok', inline: true }
        );

      if (!hasMuteRole) {
        embed.setDescription('✅ Kullanıcı mute değil.');
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Kanal izinlerini kontrol et
      const textChannels = interaction.guild.channels.cache.filter(ch => ch.isTextBased());
      const voiceChannels = interaction.guild.channels.cache.filter(ch => ch.isVoiceBased());
      
      let textCanSend = 0;
      let textBlocked = 0;
      let voiceCanSpeak = 0;
      let voiceBlocked = 0;
      
      let problemChannels = [];

      // Text kanalları test et
      for (const [id, channel] of textChannels) {
        const permissions = channel.permissionsFor(member);
        const canSend = permissions?.has('SendMessages');
        
        if (canSend) {
          textCanSend++;
          problemChannels.push(`📝 ${channel.name} - Mesaj gönderebiliyor`);
        } else {
          textBlocked++;
        }
      }

      // Voice kanalları test et
      for (const [id, channel] of voiceChannels) {
        const permissions = channel.permissionsFor(member);
        const canSpeak = permissions?.has('Speak');
        
        if (canSpeak) {
          voiceCanSpeak++;
          problemChannels.push(`🔊 ${channel.name} - Konuşabiliyor`);
        } else {
          voiceBlocked++;
        }
      }

      embed.addFields(
        { name: '📝 Text Kanalları', value: `✅ ${textBlocked} engelli\n❌ ${textCanSend} problem`, inline: true },
        { name: '🔊 Ses Kanalları', value: `✅ ${voiceBlocked} engelli\n❌ ${voiceCanSpeak} problem`, inline: true }
      );

      if (problemChannels.length > 0) {
        embed.setColor('#FF0000');
        embed.setDescription('❌ **MUTE ÇALIŞMIYOR!** Aşağıdaki kanallarda sorun var:');
        
        // Problem kanallarını grupla (en fazla 1024 karakter)
        let problemText = problemChannels.slice(0, 10).join('\n');
        if (problemChannels.length > 10) {
          problemText += `\n... ve ${problemChannels.length - 10} kanal daha`;
        }
        
        embed.addFields(
          { name: '🚨 Problem Kanalları', value: problemText || 'Çok fazla problem var', inline: false }
        );
      } else {
        embed.setColor('#00FF00');
        embed.setDescription('✅ Mute düzgün çalışıyor!');
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error('Mutetest komutu hatası:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Test Hatası')
        .setDescription(`\`\`\`${error.message}\`\`\``);

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};
