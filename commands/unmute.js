const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Bir kullanıcının susturmasını kaldırır.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Susturması kaldırılacak kullanıcı').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Susturma kaldırma sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  category: 'moderation',
  description: 'Bir kullanıcının susturmasını kaldırır.',
  usage: '.unmute @kullanici [sebep]',
  permissions: [PermissionFlagsBits.MuteMembers],

  async execute(ctx, args) {
    let targetUser;
    let reason = 'Sebep belirtilmedi';

    // Hedef kullanıcıyı ve sebebi belirle
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetUser = ctx.options.getUser('kullanici');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi';
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir kullanıcı etiketlemelisin. Örnek: `!unmute @kullanıcı [sebep]`',
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

      // Sebep (opsiyonel)
      reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Sustur" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!targetUser) {
      return ctx.reply({
        content: '❌ Bir kullanıcı etiketlemelisin veya ID girmelisin.',
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

    // ROL HİYERAŞİSİ KONTROLÜ - GÜVENLİK
    const executorHighestRole = executor.roles.highest;
    const targetHighestRole = member.roles.highest;
    
    if (targetHighestRole.position >= executorHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ İHLALİ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) seninkinden (\`${executorHighestRole.name}\`) yüksek veya eşit. Kendinden üst roldeki birisinin unmute işlemini yapamazsın!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Mute rolünü kontrol et
    const muteRole = ctx.guild.roles.cache.find(role => role.name === 'Muted');
    if (!muteRole || !member.roles.cache.has(muteRole.id)) {
      return ctx.reply({
        content: '❌ Bu kullanıcı zaten susturulmamış.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Mute rolünü kaldır
      await member.roles.remove(muteRole, reason);
      
      // Eğer kullanıcı voice kanalındaysa voice mute'ı da kaldır
      if (member.voice.channel) {
        try {
          await member.voice.setMute(false, `Unmute işlemi: ${reason}`);
          console.log(`🔊 ${targetUser.username} voice kanalında da unmute edildi`);
        } catch (voiceError) {
          console.error(`❌ Voice unmute hatası: ${voiceError.message}`);
        }
      }
      
      // Başarı embed'i
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔊 Susturma Kaldırıldı')
        .setDescription(`**${targetUser.tag}** kullanıcısının susturması kaldırıldı.`)
        .addFields(
          {
            name: '📝 Sebep',
            value: reason,
            inline: false
          },
          {
            name: '👮‍♂️ Moderatör',
            value: `${(ctx.author || ctx.user).tag}`,
            inline: true
          },
          {
            name: '⏰ Tarih',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      
      await ctx.reply({ embeds: [successEmbed] });
      
      // Log
      const logChannelId = getAutoLogChannel(ctx.guild.id);
      if (logChannelId) {
        const logChannel = ctx.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const unmuteEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔊 Susturma Kaldırıldı')
            .addFields(
              {
                name: '👤 Kullanıcı',
                value: `${targetUser.tag} (\`${targetUser.id}\`)`,
                inline: true
              },
              {
                name: '👮‍♂️ Moderatör',
                value: `${(ctx.author || ctx.user).tag} (\`${(ctx.author || ctx.user).id}\`)`,
                inline: true
              },
              {
                name: '📝 Sebep',
                value: `\`${reason}\``,
                inline: false
              }
            )
            .setTimestamp();
          
          logChannel.send({ embeds: [unmuteEmbed] });
        }
      }
    } catch (error) {
      console.error('Unmute hatası:', error);
      await ctx.reply({
        content: '❌ Kullanıcının susturması kaldırılırken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
