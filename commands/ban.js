const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
  async execute(ctx) {
    // Slash komut mu yoksa prefix komut mu?
    let user, reason, guild, member, replyUser, reply, logChannelId, logChannel;
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
      // .ban @kullanici [sebep]
      if (!ctx.args[0]) return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      // Kullanıcıyı etiket veya ID ile bul
      const idMatch = ctx.args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (!userId) return ctx.message.reply('Geçerli bir kullanıcı etiketlemelisin veya ID girmelisin.');
      user = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
      reason = ctx.args.slice(1).join(' ') || 'Sebep belirtilmedi.';
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!user) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    if (!member.bannable) return reply({ content: 'Bu kullanıcı banlanamıyor.', ephemeral: true });
    // Yetki kontrolleri
    const botMember = guild.members.cache.get(ctx.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: 'Botun ban yetkisi yok! \n Lütfen "Üyeleri Yasakla" yetkisini verin.', ephemeral: true });
    }

    // Komutu kullanan kişinin yetkisini kontrol et
    const executorMember = guild.members.cache.get(replyUser.id);
    if (!executorMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: 'Ban yetkisine sahip değilsiniz!', ephemeral: true });
    }

    // Hedef kullanıcının rolünü kontrol et
    if (member.roles.highest.position >= executorMember.roles.highest.position) {
      return reply({ content: 'Bu kullanıcıyı banlayamazsınız çünkü rolleri sizden yüksek veya eşit.', ephemeral: true });
    }

    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return reply({ content: 'Bu kullanıcıyı banlayamam çünkü rolleri benden yüksek veya eşit.', ephemeral: true });
    }

    try {
      await member.ban({ reason });
      await reply({ content: `${user.tag} başarıyla banlandı. Sebep: ${reason}` });
      // Log
      logChannelId = getAutoLogChannel(guild.id);
      if (logChannelId) {
        logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          logChannel.send({ content: `:no_entry: ${user.tag} banlandı. Yetkili: ${replyUser.tag} | Sebep: ${reason}` });
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
