const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mutereset')
    .setDescription('Muted rolünün tüm kanal izinlerini sıfırlar ve yeniden ayarlar')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Muted rolünü bul
      const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
      
      if (!muteRole) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('❌ Hata')
              .setDescription('Muted rolü bulunamadı! Önce birini mute edin.')
          ]
        });
      }

      const channels = interaction.guild.channels.cache;
      let deletedCount = 0;
      let createdCount = 0;
      let errorCount = 0;

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔄 Muted Rolü Sıfırlanıyor...')
        .setDescription(`${channels.size} kanalda işlem yapılıyor...`);

      await interaction.editReply({ embeds: [embed] });

      console.log('🔄 Muted rolü sıfırlanıyor...');

      // Önce tüm mevcut izinleri sil
      for (const [channelId, channel] of channels) {
        try {
          if (channel.permissionOverwrites.cache.has(muteRole.id)) {
            await channel.permissionOverwrites.delete(muteRole);
            console.log(`🗑️ Silindi: ${channel.name}`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`❌ Silme hatası ${channel.name}:`, error.message);
          errorCount++;
        }
      }

      console.log(`📊 Silme işlemi: ${deletedCount} başarılı, ${errorCount} hata`);

      // 1 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Şimdi yeni izinleri ekle
      for (const [channelId, channel] of channels) {
        try {
          if (channel.isTextBased()) {
            // SÜPER GÜÇLÜ MUTE RESET - TÜM TEXT İZİNLERİ DENY
            await channel.permissionOverwrites.create(muteRole, {
              ViewChannel: null, // Varsayılan
              SendMessages: false, // ❌ MESAJ GÖNDEREMİYOR - DENY!
              AddReactions: false, // ❌ REACTION EKLEYEMİYOR - DENY!
              CreatePublicThreads: false, // ❌ PUBLIC THREAD OLUŞTURAMAZ - DENY!
              CreatePrivateThreads: false, // ❌ PRIVATE THREAD OLUŞTURAMAZ - DENY!
              SendMessagesInThreads: false, // ❌ THREAD'LERDE MESAJ GÖNDEREMİYOR - DENY!
              UseApplicationCommands: false, // ❌ SLASH KOMUT KULLANAMAZ - DENY!
              SendTTSMessages: false, // ❌ TTS MESAJ GÖNDEREMİYOR - DENY!
              UseExternalEmojis: false, // ❌ HARİCİ EMOJİ KULLANAMAZ - DENY!
              UseExternalStickers: false, // ❌ HARİCİ STİCKER KULLANAMAZ - DENY!
              AttachFiles: false, // ❌ DOSYA EKLEYEMİYOR - DENY!
              EmbedLinks: false, // ❌ LİNK EMBED YAPAMAZ - DENY!
              MentionEveryone: false, // ❌ EVERYONE MENTION YAPAMAZ - DENY!
              ManageMessages: false, // ❌ MESAJ YÖNETEMİYOR - DENY!
              ManageThreads: false, // ❌ THREAD YÖNETEMİYOR - DENY!
              ReadMessageHistory: true, // ✅ ESKİ MESAJLARI OKUYABİLİR
              SendVoiceMessages: false, // ❌ SES MESAJI GÖNDEREMİYOR - DENY!
              SendPolls: false, // ❌ ANKET GÖNDEREMİYOR - DENY!
              UseEmbeddedActivities: false // ❌ EMBEDDED AKTİVİTE KULLANAMAZ - DENY!
            });
            console.log(`✅ Metin: ${channel.name}`);
            createdCount++;
          } else if (channel.isVoiceBased()) {
            await channel.permissionOverwrites.create(muteRole, {
              ViewChannel: null,
              Connect: true, // Girebilir ama konuşamaz
              Speak: false, // KONUŞAMAZ - EN ÖNEMLİ
              Stream: false,
              UseVAD: false,
              UseApplicationCommands: false,
              UseSoundboard: false,
              UseExternalSounds: false,
              SendMessages: false,
              AddReactions: false,
              RequestToSpeak: false,
              ManageChannels: false,
              MuteMembers: false,
              DeafenMembers: false,
              MoveMembers: false
            });
            console.log(`✅ Ses: ${channel.name}`);
            createdCount++;
          }
        } catch (error) {
          console.error(`❌ Oluşturma hatası ${channel.name}:`, error.message);
          errorCount++;
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Muted Rolü Sıfırlandı')
        .addFields(
          { name: '🗑️ Silinen İzinler', value: `${deletedCount}`, inline: true },
          { name: '✅ Oluşturulan İzinler', value: `${createdCount}`, inline: true },
          { name: '❌ Hatalar', value: `${errorCount}`, inline: true }
        )
        .setDescription(`Muted rolü ${channels.size} kanalda yeniden yapılandırıldı.`)
        .setTimestamp();

      console.log(`🎯 Tamamlandı: ${createdCount} oluşturuldu, ${errorCount} hata`);

      await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
      console.error('Mutereset komutu hatası:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Beklenmeyen Hata')
        .setDescription(`\`\`\`${error.message}\`\`\``);

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }
};
