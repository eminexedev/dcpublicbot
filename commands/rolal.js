const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolal')
    .setDescription('Bir kullanıcıdan rol alır.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Rolü alınacak kullanıcı')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Alınacak rol')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Rol alma sebebi')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  
  async execute(ctx, args) {
    let targetUser, role, reason, guild, member, replyUser, reply;
    
    if (ctx.options) {
      // Slash komut
      guild = ctx.guild;
      member = ctx.member;
      replyUser = ctx.user;
      targetUser = ctx.options.getUser('kullanici');
      role = ctx.options.getRole('rol');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi';
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut (index.js'den - obje halinde)
      const message = ctx.message;
      const messageArgs = ctx.args;
      
      guild = ctx.guild;
      member = ctx.member;
      replyUser = ctx.author;
      
      // .rolal @kullanici @rol [sebep]
      if (!messageArgs[0]) return message.reply('Bir kullanıcı etiketlemelisin.');
      if (!messageArgs[1]) return message.reply('Bir rol etiketlemelisin.');
      
      // Kullanıcıyı bul
      const userMatch = messageArgs[0].match(/(\d{17,})/);
      const userId = userMatch ? userMatch[1] : null;
      if (!userId) return message.reply('Geçerli bir kullanıcı etiketlemelisin.');
      targetUser = await message.client.users.fetch(userId).catch(() => null);
      if (!targetUser) return message.reply('Kullanıcı bulunamadı.');
      
      // Rolü bul
      const roleMatch = messageArgs[1].match(/(\d{17,})/);
      const roleId = roleMatch ? roleMatch[1] : null;
      if (!roleId) return message.reply('Geçerli bir rol etiketlemelisin.');
      role = guild.roles.cache.get(roleId);
      if (!role) return message.reply('Rol bulunamadı.');
      
      reason = messageArgs.slice(2).join(' ') || 'Sebep belirtilmedi';
      reply = (msg) => message.reply(msg);
    } else if (ctx.guild) {
      // Prefix komut (commandHandler.js'den - direkt message)
      const message = ctx;
      const messageArgs = args; // İkinci parametre
      
      guild = message.guild;
      member = message.member;
      replyUser = message.author;
      
      // .rolal @kullanici @rol [sebep]
      if (!messageArgs[0]) return message.reply('Bir kullanıcı etiketlemelisin.');
      if (!messageArgs[1]) return message.reply('Bir rol etiketlemelisin.');
      
      // Kullanıcıyı bul
      const userMatch = messageArgs[0].match(/(\d{17,})/);
      const userId = userMatch ? userMatch[1] : null;
      if (!userId) return message.reply('Geçerli bir kullanıcı etiketlemelisin.');
      targetUser = await message.client.users.fetch(userId).catch(() => null);
      if (!targetUser) return message.reply('Kullanıcı bulunamadı.');
      
      // Rolü bul
      const roleMatch = messageArgs[1].match(/(\d{17,})/);
      const roleId = roleMatch ? roleMatch[1] : null;
      if (!roleId) return message.reply('Geçerli bir rol etiketlemelisin.');
      role = guild.roles.cache.get(roleId);
      if (!role) return message.reply('Rol bulunamadı.');
      
      reason = messageArgs.slice(2).join(' ') || 'Sebep belirtilmedi';
      reply = (msg) => message.reply(msg);
    }
    
    // Hedef üyeyi bul
    const targetMember = guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Kullanıcı Bulunamadı')
        .setDescription(`**${targetUser.tag}** bu sunucuda değil.`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Aranan Kullanıcı',
            value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${guild.name} • Kullanıcı sunucuda olmalı`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Kullanıcıda bu rol var mı kontrol et
    if (!targetMember.roles.cache.has(role.id)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Rol Zaten Yok')
        .setDescription(`**${targetUser.tag}** kullanıcısında **${role.name}** rolü zaten yok.`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Kullanıcı',
            value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\``,
            inline: true
          },
          {
            name: '🎭 Rol',
            value: `**${role.name}**\n\`ID: ${role.id}\``,
            inline: true
          }
        )
        .setFooter({ 
          text: `${guild.name} • Rol zaten yok`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Bot yetkilerini kontrol et
    const botMember = guild.members.cache.get(ctx.options ? ctx.client.user.id : ctx.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Bot Yetkisi Yetersiz')
        .setDescription('Bot **Rolleri Yönet** yetkisine sahip değil.')
        .addFields(
          {
            name: '🔧 Çözüm',
            value: 'Bot rolüne **Rolleri Yönet** yetkisini verin.',
            inline: false
          }
        )
        .setFooter({ text: 'Yetki hatası' })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Rol hiyerarşisi kontrolü
    if (role.position >= botMember.roles.highest.position) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Rol Hiyerarşisi Hatası')
        .setDescription('Bu rol bot rolünden yüksek veya eşit pozisyonda.')
        .setThumbnail(role.iconURL({ dynamic: true }) || guild.iconURL({ dynamic: true }))
        .addFields(
          {
            name: '🎭 Hedef Rol',
            value: `**${role.name}**\n\`Pozisyon: ${role.position}\``,
            inline: true
          },
          {
            name: '🤖 Bot Rolü',
            value: `**${botMember.roles.highest.name}**\n\`Pozisyon: ${botMember.roles.highest.position}\``,
            inline: true
          },
          {
            name: '🔧 Çözüm',
            value: 'Bot rolünü hedef rolden daha yüksek pozisyona taşıyın.',
            inline: false
          }
        )
        .setFooter({ 
          text: `${guild.name} • Rol hiyerarşisi`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Moderatör yetki kontrolü (kullanıcı hedef rolü alabilir mi?)
    if (role.position >= member.roles.highest.position && member.id !== guild.ownerId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Yetkisiz İşlem')
        .setDescription('Bu rol sizin en yüksek rolünüzden yüksek veya eşit pozisyonda.')
        .setThumbnail(replyUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '🎭 Hedef Rol',
            value: `**${role.name}**\n\`Pozisyon: ${role.position}\``,
            inline: true
          },
          {
            name: '👤 Sizin En Yüksek Rol',
            value: `**${member.roles.highest.name}**\n\`Pozisyon: ${member.roles.highest.position}\``,
            inline: true
          }
        )
        .setFooter({ 
          text: `${guild.name} • Yetki kontrolü`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      // Rolü al
      await targetMember.roles.remove(role, reason);
      
      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor(0xFF4500) // Turuncu renk (rol alma için)
        .setTitle('✅ Rol Başarıyla Alındı')
        .setDescription(`**${targetUser.tag}** kullanıcısından **${role.name}** rolü alındı.`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Kullanıcı',
            value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\``,
            inline: true
          },
          {
            name: '🎭 Alınan Rol',
            value: `**${role.name}**\n\`ID: ${role.id}\``,
            inline: true
          },
          {
            name: '👮‍♂️ İşlemi Yapan',
            value: `**${replyUser.tag}**\n\`ID: ${replyUser.id}\``,
            inline: false
          },
          {
            name: '📝 Sebep',
            value: `\`\`\`${reason}\`\`\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${guild.name} • Rol alma işlemi`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      await reply({ embeds: [successEmbed] });
      
      // Log sistemine gönder
      await sendRoleRemoveLog(guild, targetUser, replyUser, role, reason);
      
    } catch (err) {
      console.error('[ROLE REMOVE ERROR]', err);
      
      let errorMessage = '❌ Rol alma işlemi sırasında bir hata oluştu.';
      let errorDetails = 'Bilinmeyen hata';
      
      // Discord API hata kodlarına göre spesifik mesajlar
      switch (err.code) {
        case 50013:
          errorMessage = '❌ Yetkisiz işlem!';
          errorDetails = 'Bot bu rolü alma yetkisine sahip değil.';
          break;
        case 50001:
          errorMessage = '❌ Erişim reddedildi!';
          errorDetails = 'Bot bu kullanıcıya veya role erişemiyor.';
          break;
        case 10011:
          errorMessage = '❌ Rol bulunamadı!';
          errorDetails = 'Belirtilen rol artık mevcut değil.';
          break;
        default:
          errorDetails = err.message || 'Detay bulunamadı';
      }
      
      const errorEmbed = new EmbedBuilder()
        .setTitle(errorMessage)
        .setColor(0xFF0000)
        .setDescription(errorDetails)
        .addFields(
          {
            name: '🔍 Teknik Bilgi',
            value: `Hata Kodu: \`${err.code || 'Bilinmiyor'}\`\nHTTP Durum: \`${err.httpStatus || 'Bilinmiyor'}\``,
            inline: false
          },
          {
            name: '💡 Öneriler',
            value: '• Bot yetkilerini kontrol edin\n• Rol hiyerarşisini kontrol edin\n• Rolün hala var olduğunu kontrol edin',
            inline: false
          }
        )
        .setTimestamp();
      
      await reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

// Rol alma log gönderen fonksiyon
async function sendRoleRemoveLog(guild, targetUser, moderator, role, reason) {
  // Log kanalını bul (öncelik sırasıyla)
  const logChannelId = findAnyLogChannel(guild.id, 'general');
  
  if (!logChannelId) {
    console.log(`[ROLE REMOVE] Log kanalı bulunamadı - Guild ID: ${guild.id}`);
    return; // Log kanalı ayarlanmamışsa çık
  }
  
  console.log(`[ROLE REMOVE] Log kanalı bulundu - Channel ID: ${logChannelId}`);
  
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) {
    console.log(`[ROLE REMOVE] Log kanalına erişilemedi - Channel ID: ${logChannelId}`);
    return; // Log kanalı bulunamazsa çık
  }
  
  console.log(`[ROLE REMOVE] Log kanalına erişim başarılı - Kanal: ${logChannel.name}`);

  // Rol alma log embed'i oluştur
  const roleRemoveEmbed = new EmbedBuilder()
    .setTitle('🗑️ Rol Alındı')
    .setColor(0xFF4500) // Turuncu renk
    .setDescription(`**${targetUser.tag}** kullanıcısından **${role.name}** rolü alındı.`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: '👤 Kullanıcı',
        value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\`\n<@${targetUser.id}>`,
        inline: true
      },
      {
        name: '🎭 Alınan Rol',
        value: `**${role.name}**\n\`ID: ${role.id}\`\n~~<@&${role.id}>~~`,
        inline: true
      },
      {
        name: '👮‍♂️ Moderatör',
        value: `**${moderator.tag}**\n\`ID: ${moderator.id}\`\n<@${moderator.id}>`,
        inline: false
      },
      {
        name: '📝 Sebep',
        value: `\`\`\`${reason}\`\`\``,
        inline: false
      },
      {
        name: '🕐 Zaman',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true
      },
      {
        name: '🆔 İşlem ID',
        value: `\`${Date.now()}\``,
        inline: true
      }
    )
    .setFooter({ 
      text: `${guild.name} • Rol Yönetimi`, 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    })
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [roleRemoveEmbed] });
    console.log(`[ROLE REMOVE] Log başarıyla gönderildi - ${targetUser.tag} -> ${role.name}`);
  } catch (error) {
    console.error(`[ROLE REMOVE] Log gönderme hatası:`, error);
  }
}
