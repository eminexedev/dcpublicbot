const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');
const { getJailRole, getUnjailRole, getUnjailLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Bir kullanıcıyı jail\'den çıkarır ve eski rollerini geri verir.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Jail\'den çıkarılacak kullanıcı').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  description: 'Bir kullanıcıyı jail\'den çıkarır ve eski rollerini geri verir.',
  usage: '.unjail @kullanici',
  permissions: [PermissionFlagsBits.BanMembers],

  async execute(ctx, args) {
    let targetUser;

    // Hedef kullanıcıyı belirle
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetUser = ctx.options.getUser('kullanici');
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir kullanıcı etiketlemelisin. Örnek: `!unjail @kullanıcı`',
          flags: MessageFlags.Ephemeral
        });
      }

      // Kullanıcıyı bul
      const userMatch = args[0].match(/^<@!?(\d+)>$|^(\d+)$/);
      if (!userMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir kullanıcı etiketlemelisin.',
          flags: MessageFlags.Ephemeral
        });
      }

      const userId = userMatch[1] || userMatch[2];
      try {
        targetUser = await ctx.client.users.fetch(userId);
      } catch (error) {
        return ctx.reply({
          content: '❌ Kullanıcı bulunamadı.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (!targetUser) {
      return ctx.reply({
        content: '❌ Bir kullanıcı etiketlemelisin veya ID girmelisin.',
        flags: MessageFlags.Ephemeral
      });
    }

    // YETKİ KONTROLÜ
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return ctx.reply({
        content: '❌ Kullanıcı sunucuda bulunamadı.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Ayarlanan jail rolünü kontrol et
    const jailRoleId = getJailRole(ctx.guild.id);
    if (!jailRoleId) {
      return ctx.reply({
        content: '❌ **Jail rolü ayarlanmamış!** Önce bir yetkili `.jailrol @rol` komutu ile jail rolünü ayarlamalı.',
        flags: MessageFlags.Ephemeral
      });
    }

    const jailRole = ctx.guild.roles.cache.get(jailRoleId);
    if (!jailRole) {
      return ctx.reply({
        content: '❌ **Ayarlanmış jail rolü bulunamadı!** Rol silinmiş olabilir, yeniden `.jailrol` komutu ile ayarlayın.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Ayarlanan unjail rolünü kontrol et
    const unjailRoleId = getUnjailRole(ctx.guild.id);
    if (!unjailRoleId) {
      return ctx.reply({
        content: '❌ **Unjail rolü ayarlanmamış!** Önce bir yetkili `.unjailrol @rol` komutu ile unjail rolünü ayarlamalı.',
        flags: MessageFlags.Ephemeral
      });
    }

    const unjailRole = ctx.guild.roles.cache.get(unjailRoleId);
    if (!unjailRole) {
      return ctx.reply({
        content: '❌ **Ayarlanmış unjail rolü bulunamadı!** Rol silinmiş olabilir, yeniden `.unjailrol` komutu ile ayarlayın.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!member.roles.cache.has(jailRole.id)) {
      return ctx.reply({
        content: '❌ Bu kullanıcı zaten jail\'de değil.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Jail verilerini al (sadece log için)
      const jailData = global.jailedUsers?.get(targetUser.id);
      
      // Jail rolünü kaldır ve unjail rolünü ver (eski rolleri GERİ VERMİYORUZ!)
      await member.roles.set([unjailRole.id], `Unjail: ${executor.user.tag} tarafından unjail rolü verildi`);
      
      // Jail verilerini temizle
      if (global.jailedUsers) {
        global.jailedUsers.delete(targetUser.id);
      }

      console.log(`✅ ${targetUser.username} jail'den çıkarıldı ve ${unjailRole.name} rolü verildi`);

      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔓 Kullanıcı Jail\'den Çıkarıldı')
        .setDescription(`**${targetUser.tag}** başarıyla jail\'den çıkarıldı ve **${unjailRole.name}** rolü verildi.`)
        .addFields(
          {
            name: '👮 Yetkili',
            value: `${executor.user.tag}`,
            inline: true
          },
          {
            name: '🎭 Verilen Rol',
            value: `${unjailRole.name}`,
            inline: true
          },
          {
            name: '⏰ İşlem Zamanı',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false
          },
          {
            name: '📋 Bilgi',
            value: '**Eski roller geri verilmedi.** Sadece unjail rolü verildi.',
            inline: false
          }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await ctx.reply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral
      });

      // Log mesajı - DETAYLI UNJAIL LOG SİSTEMİ
      const unjailLogChannelId = getUnjailLogChannel(ctx.guild.id);
      if (unjailLogChannelId) {
        const unjailLogChannel = ctx.guild.channels.cache.get(unjailLogChannelId);
        if (unjailLogChannel) {
          const unjailTime = new Date();
          const unjailTimeTimestamp = Math.floor(unjailTime.getTime() / 1000);
          
          const logEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔓 UNJAIL İŞLEMİ GERÇEKLEŞTİRİLDİ')
            .setDescription('Bir kullanıcı jail\'den çıkarıldı. İşlem detayları aşağıda yer almaktadır.')
            .addFields(
              {
                name: '👤 Jail\'den Çıkarılan Kullanıcı',
                value: `**İsim:** ${targetUser.username}\n**Tag:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\`\n**Mention:** <@${targetUser.id}>`,
                inline: true
              },
              {
                name: '👮 İşlemi Gerçekleştiren Yetkili',
                value: `**İsim:** ${executor.user.username}\n**Tag:** ${executor.user.tag}\n**ID:** \`${executor.user.id}\`\n**Mention:** <@${executor.user.id}>`,
                inline: true
              },
              {
                name: '📋 İşlem Detayları',
                value: `**İşlem Türü:** Manuel Unjail\n**Verilen Rol:** ${unjailRole.name}\n**Durum:** Eski roller geri verilmedi`,
                inline: false
              },
              {
                name: '🕐 Jail\'den Çıkarılma Saati',
                value: `**Tam Tarih:** ${unjailTime.toLocaleString('tr-TR', { 
                  timeZone: 'Europe/Istanbul',
                  year: 'numeric',
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}\n**Discord Timestamp:** <t:${unjailTimeTimestamp}:F>\n**Relatif Zaman:** <t:${unjailTimeTimestamp}:R>`,
                inline: true
              },
              {
                name: '🎭 Rol Durumu',
                value: `✅ **${unjailRole.name}** rolü verildi\n❌ Eski roller geri verilmedi`,
                inline: true
              }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
              text: `Unjail Log Sistemi • Sunucu: ${ctx.guild.name}`,
              iconURL: ctx.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();
          
          // Jail verilerini kontrol et ve ekle
          if (jailData) {
            const jailDuration = unjailTimeTimestamp - Math.floor(jailData.jailTime / 1000);
            const hours = Math.floor(jailDuration / 3600);
            const minutes = Math.floor((jailDuration % 3600) / 60);
            
            logEmbed.addFields({
              name: '📊 Jail İstatistikleri',
              value: `**Orijinal Sebep:** ${jailData.reason || 'Bilinmiyor'}\n**Jail\'de Geçirilen Süre:** ${hours} saat, ${minutes} dakika\n**Planlanan Süre:** ${jailData.duration === 0 ? 'Kalıcı' : `${jailData.duration} dakika`}`,
              inline: false
            });
          }
          
          // Sunucu bilgilerini ekle
          logEmbed.addFields({
            name: '🏠 Sunucu Bilgileri',
            value: `**Sunucu:** ${ctx.guild.name}\n**Sunucu ID:** \`${ctx.guild.id}\`\n**Üye Sayısı:** ${ctx.guild.memberCount}`,
            inline: false
          });

          await unjailLogChannel.send({ embeds: [logEmbed] });
          console.log(`📝 Unjail log mesajı gönderildi: ${targetUser.tag} jail'den çıkarıldı`);
        } else {
          console.log('⚠️ Unjail log kanalı bulunamadı, log gönderilemedi');
        }
      } else {
        console.log('⚠️ Bu sunucu için unjail log kanalı ayarlanmamış');
      }

    } catch (error) {
      console.error('Unjail hatası:', error);
      return ctx.reply({
        content: '❌ Kullanıcı jail\'den çıkarılırken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};