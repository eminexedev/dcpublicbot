const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getAutoLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vmute')
    .setDescription('Bir kullanıcıyı bulunduğu ses kanalında susturur (voice mute).')
    .addUserOption(o => o.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  category: 'moderation',
  description: 'Kullanıcıyı ses kanalında susturur (voice mute).',
  usage: '.vmute @kullanici',
  permissions: [PermissionFlagsBits.MuteMembers],

  async execute(ctx, args) {
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : false;
    const guild = ctx.guild || ctx.message?.guild;
    const client = ctx.client;
    if (!guild) return ctx.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: isSlash });

    // Yetki kontrolü
    const invokerId = isSlash ? ctx.user.id : ctx.author.id;
    const invoker = await guild.members.fetch(invokerId).catch(() => null);
    if (!invoker || !invoker.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return ctx.reply({ content: '❌ Bu komutu kullanmak için "Üyeleri Sustur" yetkisine sahip olmalısın.', ephemeral: isSlash });
    }

    // Hedef kullanıcıyı al
    let targetUser = null;
    if (isSlash) {
      targetUser = ctx.options.getUser('kullanici');
    } else {
      const mention = ctx.message.mentions.users.first();
      if (mention) targetUser = mention;
      else if (args[0]) {
        const id = args[0].replace(/[^0-9]/g, '');
        if (id) targetUser = await client.users.fetch(id).catch(() => null);
      }
    }
    if (!targetUser) {
      return ctx.reply({ content: 'Kullanım: (prefix)vmute @kullanıcı | /vmute kullanici:@kullanıcı', ephemeral: isSlash });
    }

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) return ctx.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: isSlash });

    // Rol hiyerarşisi kontrolü
    const invokerHighest = invoker.roles.highest;
    const targetHighest = member.roles.highest;
    if (targetHighest.position >= invokerHighest.position && guild.ownerId !== invoker.id) {
      return ctx.reply({ content: '❌ Rol hiyerarşisi nedeniyle bu kullanıcıyı susturamazsın.', ephemeral: isSlash });
    }
    const botMember = await guild.members.fetch(client.user.id);
    if (targetHighest.position >= botMember.roles.highest.position) {
      return ctx.reply({ content: '❌ Botun rolü bu kullanıcıyı susturmaya yetmiyor.', ephemeral: isSlash });
    }
    if (!botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return ctx.reply({ content: '❌ Botun "Üyeleri Sustur" yetkisi yok.', ephemeral: isSlash });
    }

    // Ses kanalı kontrolü
    if (!member.voice || !member.voice.channel) {
      return ctx.reply({ content: '❌ Kullanıcı herhangi bir ses kanalında değil.', ephemeral: isSlash });
    }

    // Zaten susturulmuş mu?
    if (member.voice.serverMute) {
      return ctx.reply({ content: 'ℹ️ Kullanıcı zaten ses kanalında susturulmuş.', ephemeral: isSlash });
    }

    // Mute işlemi
    try {
      await member.voice.setMute(true, `Voice mute by ${invoker.user?.tag || invoker.id}`);
    } catch (e) {
      return ctx.reply({ content: `❌ Voice mute başarısız: ${e.message}`, ephemeral: isSlash });
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔇 Voice Mute Uygulandı')
      .addFields(
        { name: 'Kullanıcı', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Moderatör', value: `${invoker} (\`${invoker.id}\`)`, inline: true },
        { name: 'Kanal', value: `<#${member.voice.channel.id}>`, inline: true }
      )
      .setTimestamp();

    // Log kanalı
    const logChannelId = getAutoLogChannel(guild.id);
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) logChannel.send({ embeds: [embed] });
    }

    return ctx.reply({ embeds: [embed] });
  }
};
