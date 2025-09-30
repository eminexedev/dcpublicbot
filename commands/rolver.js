const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolver')
    .setDescription('Bir kullanıcıya rol verir.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Rol verilecek kullanıcı')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Verilecek rol')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Rol verme sebebi')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  
  async execute(ctx, args) {
    // Parametreleri al
    let targetUser, role, reason;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetUser = ctx.options.getUser('kullanici');
      role = ctx.options.getRole('rol');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi';
    } else {
      // Prefix komut
      if (!args[0]) return ctx.reply('Bir kullanıcı etiketlemelisin.');
      if (!args[1]) return ctx.reply('Bir rol etiketlemelisin.');
      
      // Kullanıcıyı bul
      const userMatch = args[0].match(/^<@!?(\d+)>$|^(\d+)$/);
      if (!userMatch) return ctx.reply('Geçerli bir kullanıcı etiketlemelisin.');
      
      const userId = userMatch[1] || userMatch[2];
      try {
        targetUser = await ctx.client.users.fetch(userId);
      } catch (error) {
        return ctx.reply('Kullanıcı bulunamadı.');
      }
      
      // Rolü bul
      const roleMatch = args[1].match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) return ctx.reply('Geçerli bir rol etiketlemelisin.');
      
      const roleId = roleMatch[1] || roleMatch[2];
      role = ctx.guild.roles.cache.get(roleId);
      if (!role) return ctx.reply('Rol bulunamadı.');
      
      reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
    }
    
    // Hedef üyeyi bul
    const targetMember = ctx.guild.members.cache.get(targetUser.id);
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
          text: `${ctx.guild.name} • Kullanıcı sunucuda olmalı`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Kullanıcıda zaten bu rol var mı kontrol et
    if (targetMember.roles.cache.has(role.id)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Rol Zaten Mevcut')
        .setDescription(`**${targetUser.tag}** kullanıcısında **${role.name}** rolü zaten var.`)
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
          text: `${ctx.guild.name} • Rol zaten atanmış`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Bot yetkilerini kontrol et
    if (!ctx.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
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
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Rol hiyerarşisi kontrolü
    const botMember = ctx.guild.members.me;
    const userMember = ctx.member;
    
    // Bot rolü kontrolü
    if (role.position >= botMember.roles.highest.position) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Rol Hiyerarşisi Hatası')
        .setDescription('Bu rol bot rolünden yüksek veya eşit pozisyonda.')
        .setThumbnail(role.iconURL({ dynamic: true }) || ctx.guild.iconURL({ dynamic: true }))
        .addFields(
          {
            name: '🔧 Çözüm',
            value: 'Bot rolünü bu rolün üstüne taşıyın veya daha düşük bir rol seçin.',
            inline: false
          }
        )
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Kullanıcı rolü kontrolü (owner değilse)
    if (ctx.guild.ownerId !== userMember.id && role.position >= userMember.roles.highest.position) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Rol Hiyerarşisi Hatası')
        .setDescription('Bu rol sizin en yüksek rolünüzden yüksek veya eşit pozisyonda.')
        .setThumbnail(role.iconURL({ dynamic: true }) || ctx.guild.iconURL({ dynamic: true }))
        .addFields(
          {
            name: '🎭 Hedef Rol',
            value: `**${role.name}**\n\`Pozisyon: ${role.position}\``,
            inline: true
          },
          {
            name: '👤 Sizin En Yüksek Rol',
            value: `**${userMember.roles.highest.name}**\n\`Pozisyon: ${userMember.roles.highest.position}\``,
            inline: true
          },
          {
            name: '🔧 Çözüm',
            value: 'Daha yüksek bir role sahip bir moderatörden yardım isteyin.',
            inline: false
          }
        )
        .setFooter({ 
          text: `${ctx.guild.name} • Rol hiyerarşisi`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
      // Rolü ver
      await targetMember.roles.add(role, reason);
      
      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Rol Başarıyla Verildi')
        .setDescription(`**${targetUser.tag}** kullanıcısına **${role.name}** rolü verildi.`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Kullanıcı',
            value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\``,
            inline: true
          },
          {
            name: '🎭 Verilen Rol',
            value: `**${role.name}**\n\`ID: ${role.id}\``,
            inline: true
          },
          {
            name: '👮‍♂️ İşlemi Yapan',
            value: `**${(ctx.author || ctx.user).tag}**\n\`ID: ${(ctx.author || ctx.user).id}\``,
            inline: false
          },
          {
            name: '📝 Sebep',
            value: `\`\`\`${reason}\`\`\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${ctx.guild.name} • Rol verme işlemi`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      await ctx.reply({ embeds: [successEmbed] });
      
      // Log sistemine gönder
      await sendRoleAddLog(ctx.guild, targetUser, (ctx.author || ctx.user), role, reason);
      
    } catch (err) {
      console.error('[ROLE ADD ERROR]', err);
      
      let errorMessage = '❌ Rol verme işlemi sırasında bir hata oluştu.';
      let errorDetails = 'Bilinmeyen hata';
      
      // Discord API hata kodlarına göre spesifik mesajlar
      switch (err.code) {
        case 50013:
          errorMessage = '❌ Yetkisiz işlem!';
          errorDetails = 'Bot bu rolü verme yetkisine sahip değil.';
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
      
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

// Rol verme log gönderen fonksiyon
async function sendRoleAddLog(guild, targetUser, moderator, role, reason) {
  // Log kanalını bul (öncelik sırasıyla)
  const logChannelId = findAnyLogChannel(guild.id, 'general');
  
  if (!logChannelId) {
    console.log(`[ROLE ADD] Log kanalı bulunamadı - Guild ID: ${guild.id}`);
    return; // Log kanalı ayarlanmamışsa çık
  }
  
  console.log(`[ROLE ADD] Log kanalı bulundu - Channel ID: ${logChannelId}`);
  
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) {
    console.log(`[ROLE ADD] Log kanalına erişilemedi - Channel ID: ${logChannelId}`);
    return; // Log kanalı bulunamazsa çık
  }
  
  console.log(`[ROLE ADD] Log kanalına erişim başarılı - Kanal: ${logChannel.name}`);

  // Rol verme log embed'i oluştur
  const roleAddEmbed = new EmbedBuilder()
    .setTitle('🎭 Rol Verildi')
    .setColor(role.color || 0x00FF00) // Rolün rengini kullan, yoksa yeşil
    .setDescription(`**${targetUser.tag}** kullanıcısına **${role.name}** rolü verildi.`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: '👤 Kullanıcı',
        value: `**${targetUser.tag}**\n\`ID: ${targetUser.id}\`\n<@${targetUser.id}>`,
        inline: true
      },
      {
        name: '🎭 Verilen Rol',
        value: `**${role.name}**\n\`ID: ${role.id}\`\n<@&${role.id}>`,
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
    await logChannel.send({ embeds: [roleAddEmbed] });
    console.log(`[ROLE ADD] Log başarıyla gönderildi - ${targetUser.tag} -> ${role.name}`);
  } catch (error) {
    console.error(`[ROLE ADD] Log gönderme hatası:`, error);
  }
}
