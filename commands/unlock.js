const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Bulunduğunuz metin kanalının kilidini açar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Bulunduğunuz metin kanalının kilidini açar. Kullanım: .unlock',
  usage: '.unlock',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(ctx, args) {
    if (ctx.channel.type !== 0 && ctx.channel.type !== ChannelType.GuildText) {
      return ctx.reply({ 
        content: 'Bu komut sadece metin kanallarında kullanılabilir.', 
        ephemeral: true 
      });
    }

    try {
      // Tüm SendMessages permission overwrites'larını temizle
      const everyoneOverwrite = ctx.channel.permissionOverwrites.cache.get(ctx.guild.roles.everyone.id);
      const allOverwrites = ctx.channel.permissionOverwrites.cache;
      
      let removedPermissions = [];

      // @everyone rolündeki SendMessages yasağını kaldır
      if (everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.SendMessages)) {
        await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone.id, { 
          SendMessages: null 
        });
        removedPermissions.push('@everyone');
      }

      // Diğer rollerdeki SendMessages izinlerini de temizle
      for (const [id, overwrite] of allOverwrites) {
        if (id !== ctx.guild.roles.everyone.id) {
          if (overwrite.allow.has(PermissionFlagsBits.SendMessages) || overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
            const role = ctx.guild.roles.cache.get(id) || await ctx.guild.roles.fetch(id).catch(() => null);
            if (role) {
              await ctx.channel.permissionOverwrites.edit(id, { 
                SendMessages: null 
              });
              removedPermissions.push(role.name);
            }
          }
        }
      }
      
      // Başarı mesajı gönder
      const unlockEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔓 Kanal Kilidi Açıldı')
        .setDescription(`Bu kanalın kilidi ${ctx.user?.tag || ctx.author?.tag} tarafından açıldı.`)
        .addFields(
          {
            name: '📝 Temizlenen İzinler',
            value: removedPermissions.length > 0 
              ? `**Temizlenen roller:** ${removedPermissions.join(', ')}\n**Durum:** Artık herkes bu kanala mesaj gönderebilir.`
              : 'Kanal zaten kilitli değildi, herhangi bir izin temizlenmedi.',
            inline: false
          },
          {
            name: '🔒 Tekrar Kilitleme',
            value: 'Kanalı tekrar kilitlemek için `.lock` komutunu kullanın.',
            inline: false
          }
        )
        .setTimestamp();

      await ctx.reply({ embeds: [unlockEmbed] });

      // Log sistemine kayıt gönder
      await sendUnlockLog(ctx.guild, ctx.channel, ctx.member || ctx.user, removedPermissions);
    } catch (error) {
      console.error('Unlock hatası:', error);
      await ctx.reply({
        content: '❌ Kanal kilidi açılırken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};

// Log gönderen fonksiyon
async function sendUnlockLog(guild, unlockedChannel, moderator, removedPermissions = []) {
  // Log kanalını bul (öncelik sırasıyla)
  const logChannelId = findAnyLogChannel(guild.id, 'general');
  
  if (!logChannelId) {
    console.log(`[UNLOCK] Log kanalı bulunamadı - Guild ID: ${guild.id}`);
    return; // Log kanalı ayarlanmamışsa çık
  }
  
  console.log(`[UNLOCK] Log kanalı bulundu - Channel ID: ${logChannelId}`);
  
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) {
    console.log(`[UNLOCK] Log kanalına erişilemedi - Channel ID: ${logChannelId}`);
    return; // Log kanalı bulunamazsa çık
  }
  
  console.log(`[UNLOCK] Log kanalına erişim başarılı - Kanal: ${logChannel.name}`);

  // Log embed'i oluştur
  const unlockEmbed = new EmbedBuilder()
    .setColor(0x00FF00) // Green color for unlock action
    .setTitle('🔓 Kanal Erişimi Restore Edildi')
    .setDescription('**Kanal kilidi açılma işlemi tamamlandı.**\n\n*Artık tüm üyeler yeniden mesaj gönderebilir.*')
    .addFields(
      {
        name: '📢 Serbest Bırakılan Kanal',
        value: `${unlockedChannel}\n\`${unlockedChannel.name}\``,
        inline: true
      },
      {
        name: '👮‍♂️ İşlemi Yapan',
        value: `${moderator.user ? moderator.user : moderator}\n\`${moderator.user?.tag || moderator.tag}\``,
        inline: true
      },
      {
        name: '🔓 Unlock Türü',
        value: removedPermissions.length > 0 
          ? `**Tam Unlock**\n${removedPermissions.length} rol temizlendi`
          : '**Zaten Açık**\nHerhangi bir kısıtlama yoktu',
        inline: true
      },
      {
        name: '🕐 İşlem Zamanı',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true
      },
      {
        name: '📋 Temizlenen İzinler',
        value: removedPermissions.length > 0 
          ? `**Kaldırılan roller:** ${removedPermissions.join(', ')}`
          : 'Hiçbir izin kısıtlaması bulunamadı',
        inline: true
      },
      {
        name: '✅ Yeni Durum',
        value: 'Tüm kullanıcılar mesaj gönderebilir',
        inline: true
      },
      {
        name: '📋 Güvenlik Detayları',
        value: `\`\`\`yaml\nKanal ID: ${unlockedChannel.id}\nModeratör ID: ${moderator.user?.id || moderator.id}\nTemizlenen Roller: ${removedPermissions.length}\nİşlem: Kanal Unlock\n\`\`\``,
        inline: false
      }
    )
    .setFooter({ 
      text: `${guild.name} • Moderasyon sistemi`, 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    })
    .setTimestamp();

  try {
    console.log(`[UNLOCK] Log embed gönderiliyor...`);
    await logChannel.send({ embeds: [unlockEmbed] });
    console.log(`[UNLOCK] Log başarıyla gönderildi!`);
  } catch (error) {
    console.error('[UNLOCK] Log gönderilirken hata:', error);
  }
}
