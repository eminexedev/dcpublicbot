const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir kullanıcıyı sunucudan atar.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Atılma sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  category: 'moderation',
  description: 'Bir kullanıcıyı sunucudan atar. Kullanım: .kick @kullanici [sebep]',
  usage: '.kick @kullanici [sebep]',
  permissions: [PermissionFlagsBits.KickMembers],

  async execute(ctx, args) {
    let user, reason, guild, reply;

    // Slash komut mu yoksa prefix komut mu?
    if (ctx.options) {
      // Slash komut
      user = ctx.options.getUser('kullanici');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
      guild = ctx.guild;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      guild = ctx.guild;
      reply = (msg) => ctx.message.reply(msg);
      
      if (!args || args.length === 0) {
        return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      }
      
      // Kullanıcıyı etiket veya ID ile bul
      const idMatch = args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (!userId) return ctx.message.reply('Geçerli bir kullanıcı etiketlemelisin veya ID girmelisin.');
      
      user = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
      reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
    } else {
      return;
    }

    if (!user) {
      return ctx.reply({
        content: 'Bir kullanıcı etiketlemelisin veya ID girmelisin.',
        flags: MessageFlags.Ephemeral
      });
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri At" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return ctx.reply({
        content: 'Kullanıcı bulunamadı.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!member.kickable) {
      return ctx.reply({
        content: 'Bu kullanıcı atılamıyor.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ROL HİYERAŞİSİ KONTROLÜ - GÜVENLİK
    const executorHighestRole = executor.roles.highest;
    const targetHighestRole = member.roles.highest;
    
    if (targetHighestRole.position >= executorHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ İHLALİ!** ${user.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) seninkinden (\`${executorHighestRole.name}\`) yüksek veya eşit. Kendinden üst roldeki birini atamazsın!`,
        flags: MessageFlags.Ephemeral
      });
    }

    console.log(`🔒 [ROL KONTROLÜ] ${executor.user.tag} (${executorHighestRole.name}) -> ${user.tag} (${targetHighestRole.name}) - KICK İZİN VERİLDİ`);

    try {
      await member.kick(reason);
      await ctx.reply({ content: `✅ ${user.tag} başarıyla atıldı.\n📝 Sebep: ${reason}` });
      
      // Log
      const logChannelId = getAutoLogChannel(ctx.guild.id);
      if (logChannelId) {
        const logChannel = ctx.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const kickEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('👢 Kullanıcı Atıldı')
            .addFields(
              {
                name: '👤 Atılan Kullanıcı',
                value: `${user.tag} (\`${user.id}\`)`,
                inline: true
              },
              {
                name: '👮‍♂️ Moderatör',
                value: `${ctx.user.tag} (\`${ctx.user.id}\`)`,
                inline: true
              },
              {
                name: '📝 Sebep',
                value: `\`${reason}\``,
                inline: false
              }
            )
            .setTimestamp();
          
          logChannel.send({ embeds: [kickEmbed] });
        }
      }
    } catch (error) {
      console.error('Kick hatası:', error);
      await ctx.reply({
        content: '❌ Kullanıcı atılırken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
