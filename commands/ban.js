const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getAutoLogChannel } = require('../autoLogConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan banlar.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Ban sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(ctx, args) {
    // Slash komut mu yoksa prefix komut mu?
    let user, reason, guild, replyUser, reply;
    
    if (ctx.options) {
      // Slash komut
      user = ctx.options.getUser('kullanici');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
      guild = ctx.guild;
      replyUser = ctx.user;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      guild = ctx.guild;
      replyUser = ctx.author;
      
      if (!args || args.length === 0) {
        return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      }
      
      // Kullanıcıyı etiket veya ID ile bul
      const idMatch = args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (!userId) return ctx.message.reply('Geçerli bir kullanıcı etiketlemelisin veya ID girmelisin.');
      
      user = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
      reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!user) {
      return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    }
    
    // Member fetch et (sunucuda olmayabilir)
    let member = null;
    try {
      if (guild?.members?.fetch) {
        member = await guild.members.fetch(user.id);
      }
    } catch (error) {
      // Kullanıcı sunucuda değilse bile ban edilebilir
      console.log(`[BAN] User not in server, will ban by ID: ${user.id}`);
    }

    // Yetki kontrolleri
    const botMember = guild?.members?.cache?.get(guild.members.me.id);
    if (!botMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: 'Botun ban yetkisi yok! \nLütfen "Üyeleri Yasakla" yetkisini verin.', ephemeral: true });
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorMember = guild?.members?.cache?.get(replyUser?.id);
    if (!executorMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısın.', ephemeral: true });
    }

    // Eğer member sunucudaysa rol kontrolü yap
    if (member) {
      if (!member.bannable) {
        return reply({ content: 'Bu kullanıcı banlanamıyor.', ephemeral: true });
      }

      // Hedef kullanıcının rolünü kontrol et
      if (member.roles?.highest?.position >= executorMember.roles?.highest?.position) {
        return reply({ content: 'Bu kullanıcıyı banlayamazsınız çünkü rolleri sizden yüksek veya eşit.', ephemeral: true });
      }

      if (member.roles?.highest?.position >= botMember.roles?.highest?.position) {
        return reply({ content: 'Bu kullanıcıyı banlayamam çünkü rolleri benden yüksek veya eşit.', ephemeral: true });
      }
    }

    try {
      // Ban işlemini gerçekleştir
      if (member) {
        await member.ban({ reason });
      } else {
        // Kullanıcı sunucuda değilse ID ile ban et
        await guild.members.ban(user.id, { reason });
      }

      // Başarı mesajı
      const successMessage = `✅ ${user.tag || user.username} başarıyla banlandı!\n📝 Sebep: ${reason}`;
      await reply({ content: successMessage, ephemeral: true });

      // Ban Log sistemi
      const logChannelId = getAutoLogChannel(guild.id);
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          // Detaylı log embed'i
          const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔨 Kullanıcı Banlandı')
            .setDescription(`**${user.tag || user.username}** sunucudan banlandı.`)
            .addFields(
              {
                name: '👤 Banlanan Kullanıcı',
                value: `${user.tag || user.username}\n\`ID: ${user.id}\``,
                inline: true
              },
              {
                name: '👮 Yetkili',
                value: `${replyUser.tag}\n\`ID: ${replyUser.id}\``,
                inline: true
              },
              {
                name: '📝 Sebep',
                value: reason,
                inline: false
              },
              {
                name: '⏰ Tarih',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
              }
            )
            .setThumbnail(user.displayAvatarURL && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ 
              text: `Sunucu: ${guild.name}`, 
              iconURL: guild.iconURL() || undefined 
            })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }
    } catch (err) {
      console.error('Ban hatası:', err);
      await reply({ 
        content: 'Ban işlemi sırasında bir hata oluştu. Lütfen bot ve kullanıcı yetkilerini kontrol edin.', 
        ephemeral: true 
      });
    }
  }
};
