const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getJailRoleInfo, getUnjailRole, getJailLogChannel, getUnjailLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jaildurumu')
    .setDescription('Jail sistemi ayarlarını ve durumunu gösterir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',
  description: 'Jail sistemi ayarlarını ve durumunu gösterir.',
  usage: '.jaildurumu',
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(ctx, args) {
    // YETKİ KONTROLÜ
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Rolleri Yönet" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const jailInfo = getJailRoleInfo(ctx.guild.id);
      const unjailRoleId = getUnjailRole(ctx.guild.id);
      const jailLogChannelId = getJailLogChannel(ctx.guild.id);
      const unjailLogChannelId = getUnjailLogChannel(ctx.guild.id);
      
      if (!jailInfo || !jailInfo.jailRoleId) {
        const noConfigEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Jail Sistemi Yapılandırılmamış')
          .setDescription('Bu sunucuda jail sistemi henüz yapılandırılmamış.')
          .addFields({
            name: '⚙️ Nasıl Yapılandırırım?',
            value: '• `.jailrol @rol` komutu ile jail için kullanılacak rolü ayarlayın.\n• `.unjailrol @rol` komutu ile unjail için kullanılacak rolü ayarlayın.\n• `.jaillogkanal #kanal` komutu ile jail log kanalını ayarlayın.\n• `.unjaillogkanal #kanal` komutu ile unjail log kanalını ayarlayın.',
            inline: false
          })
          .setFooter({ text: 'Jail sistemi yönetimi' })
          .setTimestamp();

        return ctx.reply({
          embeds: [noConfigEmbed],
          flags: MessageFlags.Ephemeral
        });
      }

      const jailRole = ctx.guild.roles.cache.get(jailInfo.jailRoleId);
      const unjailRole = unjailRoleId ? ctx.guild.roles.cache.get(unjailRoleId) : null;
      const jailLogChannel = jailLogChannelId ? ctx.guild.channels.cache.get(jailLogChannelId) : null;
      const unjailLogChannel = unjailLogChannelId ? ctx.guild.channels.cache.get(unjailLogChannelId) : null;
      const setByUser = await ctx.client.users.fetch(jailInfo.setBy).catch(() => null);
      
      // Jail'de olan kullanıcıları say
      let jailedCount = 0;
      if (jailRole) {
        jailedCount = jailRole.members.size;
      }

      // Global jail verilerini kontrol et
      let activeJails = 0;
      if (global.jailedUsers) {
        for (const [userId, data] of global.jailedUsers) {
          if (data.guild === ctx.guild.id) {
            activeJails++;
          }
        }
      }

      const statusEmbed = new EmbedBuilder()
        .setColor(jailRole && unjailRole && jailLogChannel && unjailLogChannel ? '#57F287' : '#FFA500')
        .setTitle('🔒 Jail Sistemi Durumu')
        .setDescription(`**${ctx.guild.name}** sunucusunun jail sistemi bilgileri`)
        .addFields(
          {
            name: '🎭 Jail Rolü',
            value: jailRole 
              ? `✅ **${jailRole.name}**\n\`${jailRole.id}\`\nPozisyon: ${jailRole.position}\nRenk: ${jailRole.hexColor}`
              : `❌ **Rol Bulunamadı!**\n\`${jailInfo.jailRoleId}\`\n⚠️ Rol silinmiş olabilir`,
            inline: true
          },
          {
            name: '🔓 Unjail Rolü',
            value: unjailRole 
              ? `✅ **${unjailRole.name}**\n\`${unjailRole.id}\`\nPozisyon: ${unjailRole.position}\nRenk: ${unjailRole.hexColor}`
              : unjailRoleId 
                ? `❌ **Rol Bulunamadı!**\n\`${unjailRoleId}\`\n⚠️ Rol silinmiş olabilir`
                : `⚠️ **Ayarlanmamış**\n\`Henüz ayarlanmamış\`\n📝 .unjailrol komutu ile ayarlayın`,
            inline: true
          },
          {
            name: '👮 Ayarlayan Yetkili',
            value: setByUser 
              ? `${setByUser.tag}\n\`${setByUser.id}\``
              : `Bilinmiyor\n\`${jailInfo.setBy}\``,
            inline: true
          },
          {
            name: '📝 Jail Log Kanalı',
            value: jailLogChannel 
              ? `✅ **#${jailLogChannel.name}**\n\`${jailLogChannel.id}\`\n🔒 Jail logları burada`
              : jailLogChannelId 
                ? `❌ **Kanal Bulunamadı!**\n\`${jailLogChannelId}\`\n⚠️ Kanal silinmiş olabilir`
                : `⚠️ **Ayarlanmamış**\n\`Henüz ayarlanmamış\`\n📝 .jaillogkanal komutu ile ayarlayın`,
            inline: true
          },
          {
            name: '📝 Unjail Log Kanalı',
            value: unjailLogChannel 
              ? `✅ **#${unjailLogChannel.name}**\n\`${unjailLogChannel.id}\`\n🔓 Unjail logları burada`
              : unjailLogChannelId 
                ? `❌ **Kanal Bulunamadı!**\n\`${unjailLogChannelId}\`\n⚠️ Kanal silinmiş olabilir`
                : `⚠️ **Ayarlanmamış**\n\`Henüz ayarlanmamış\`\n📝 .unjaillogkanal komutu ile ayarlayın`,
            inline: true
          },
          {
            name: '📅 Ayarlanma Tarihi',
            value: `<t:${Math.floor(jailInfo.setAt / 1000)}:F>\n<t:${Math.floor(jailInfo.setAt / 1000)}:R>`,
            inline: true
          },
          {
            name: '📊 İstatistikler',
            value: `**Jail'deki Kullanıcı Sayısı:** ${jailedCount}\n**Aktif Jail Kayıtları:** ${activeJails}\n**Toplam Sunucu Üyesi:** ${ctx.guild.memberCount}`,
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ 
          text: `Jail sistemi ${jailRole && unjailRole && jailLogChannel && unjailLogChannel ? 'tam yapılandırılmış' : jailRole || unjailRole || jailLogChannel || unjailLogChannel ? 'kısmen yapılandırılmış' : 'yapılandırılmamış'} • ${ctx.guild.name}`,
          iconURL: ctx.client.user.displayAvatarURL()
        })
        .setTimestamp();

      // Eğer jail rolü yoksa uyarı ekle
      if (!jailRole) {
        statusEmbed.addFields({
          name: '⚠️ Jail Rolü Sorunu',
          value: 'Jail rolü bulunamadı! Lütfen `.jailrol @rol` komutu ile yeni bir rol ayarlayın.',
          inline: false
        });
      }

      // Eğer unjail rolü yoksa uyarı ekle
      if (!unjailRole && unjailRoleId) {
        statusEmbed.addFields({
          name: '⚠️ Unjail Rolü Sorunu',
          value: 'Unjail rolü bulunamadı! Lütfen `.unjailrol @rol` komutu ile yeni bir rol ayarlayın.',
          inline: false
        });
      } else if (!unjailRoleId) {
        statusEmbed.addFields({
          name: '📝 Yapılandırma Önerisi',
          value: 'Unjail rolü ayarlanmamış. `.unjailrol @rol` komutu ile unjail için kullanılacak rolü ayarlayabilirsiniz.',
          inline: false
        });
      }

      // Eğer jail log kanalı yoksa uyarı ekle
      if (!jailLogChannel && jailLogChannelId) {
        statusEmbed.addFields({
          name: '⚠️ Jail Log Kanalı Sorunu',
          value: 'Jail log kanalı bulunamadı! Lütfen `.jaillogkanal #kanal` komutu ile yeni bir kanal ayarlayın.',
          inline: false
        });
      } else if (!jailLogChannelId) {
        statusEmbed.addFields({
          name: '📝 Log Kanalı Önerisi',
          value: 'Jail log kanalı ayarlanmamış. `.jaillogkanal #kanal` komutu ile jail logları için kanal ayarlayabilirsiniz.',
          inline: false
        });
      }

      // Eğer unjail log kanalı yoksa uyarı ekle
      if (!unjailLogChannel && unjailLogChannelId) {
        statusEmbed.addFields({
          name: '⚠️ Unjail Log Kanalı Sorunu',
          value: 'Unjail log kanalı bulunamadı! Lütfen `.unjaillogkanal #kanal` komutu ile yeni bir kanal ayarlayın.',
          inline: false
        });
      } else if (!unjailLogChannelId) {
        statusEmbed.addFields({
          name: '📝 Log Kanalı Önerisi',
          value: 'Unjail log kanalı ayarlanmamış. `.unjaillogkanal #kanal` komutu ile unjail logları için kanal ayarlayabilirsiniz.',
          inline: false
        });
      }

      // Jail'deki kullanıcıları listele (eğer varsa ve 10'dan azsa)
      if (jailRole && jailedCount > 0 && jailedCount <= 10) {
        const jailedMembers = jailRole.members.map(member => `• ${member.user.tag} (\`${member.user.id}\`)`).join('\n');
        statusEmbed.addFields({
          name: '👥 Jail\'deki Kullanıcılar',
          value: jailedMembers || 'Bilgi alınamadı',
          inline: false
        });
      } else if (jailedCount > 10) {
        statusEmbed.addFields({
          name: '👥 Jail\'deki Kullanıcılar',
          value: `${jailedCount} kullanıcı jail'de (liste çok uzun olduğu için gösterilmiyor)`,
          inline: false
        });
      }

      await ctx.reply({
        embeds: [statusEmbed],
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Jail durumu kontrolü hatası:', error);
      return ctx.reply({
        content: '❌ Jail durumu kontrol edilirken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};