const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getRegistrationConfig } = require('../registrationConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kayıtsız')
    .setDescription('Belirtilen üyeyi kayıtsız yapar')
    .addUserOption(o =>
      o.setName('uye')
        .setDescription('Kayıtsız yapılacak kullanıcı')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  name: 'kayıtsız',
  description: 'Belirtilen üyeyi kayıtsız yapar: ismi “Kayıtsız” yapılır, tüm roller alınır ve kayıtsız rolü verilir.',
  usage: '<prefix>kayıtsız @üye | <prefix>kayıtsız <userId>',
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(ctx, args) {
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : false;
    const reply = (payload) => ctx.reply ? ctx.reply(payload) : ctx.message.reply(payload);
    const guild = ctx.guild || (ctx.message && ctx.message.guild);
    const author = ctx.user || (ctx.message && ctx.message.author);
    const memberInvoker = ctx.member || (ctx.message && ctx.message.member);
    if (!guild || !memberInvoker) return;

    let targetId = null;
    if (isSlash) {
      try {
        targetId = ctx.options?.getUser('uye')?.id || null;
      } catch { targetId = null; }
      if (!targetId) return reply({ content: '❌ Bir kullanıcı seçmelisin.', ephemeral: true });
    } else {
      const firstArg = args && args[0];
      if (!firstArg) return reply(`❌ Kullanım: \`(prefix)kayıtsız @üye\` veya \`(prefix)kayıtsız <userId>\``);
      const mentionMatch = firstArg.match(/^<@!?(\d{17,20})>$/);
      if (mentionMatch) targetId = mentionMatch[1];
      else if (/^\d{17,20}$/.test(firstArg)) targetId = firstArg;
      if (!targetId) return reply(`❌ Geçerli bir kullanıcı belirtmelisin. Örnek: \`(prefix)kayıtsız @Üye\` veya \`(prefix)kayıtsız 123456789012345678\``);
    }

    const regConf = getRegistrationConfig(guild.id);
    const authRoles = Array.isArray(regConf.authorizedRoleIds) ? regConf.authorizedRoleIds : [];
    let allowed = false;
    if (authRoles.length > 0) {
      allowed = memberInvoker.roles.cache.some(r => authRoles.includes(r.id));
    } else {
      allowed = memberInvoker.permissions.has(PermissionFlagsBits.ManageRoles);
    }
    if (!allowed) {
      return reply('❌ Bu işlemi yapmak için kayıt yetkili rolüne sahip olmalısın.');
    }

    const reg = getRegistrationConfig(guild.id);
    const unregisteredRoleId = reg.unregisteredRoleId;
    if (!unregisteredRoleId) {
      return reply('❌ Kayıtsız rolü ayarlanmamış. Önce `/kayıt-ayar kayıtsız-rol` ile kayıtsız rolünü belirleyin.');
    }

    const targetMember = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
      return reply('❌ Belirtilen kullanıcı bulunamadı.');
    }

    const botMember = guild.members.me;
    if (!botMember) {
      return reply('❌ Bot üye bilgisi alınamadı.');
    }
    if (targetMember.roles.highest.position >= memberInvoker.roles.highest.position) {
      return reply('❌ Bu kullanıcı üzerinde işlem yapamazsın (rol hiyerarşisi senden yüksek veya eşit).');
    }
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return reply('❌ Bot, bu kullanıcı üzerinde işlem yapamıyor (rol hiyerarşisi botdan yüksek veya eşit).');
    }

    const unregisteredRole = guild.roles.cache.get(unregisteredRoleId);
    if (!unregisteredRole) {
      return reply('❌ Kayıtsız rolü artık mevcut değil. Lütfen kayıt ayarlarını güncelleyin.');
    }
    if (unregisteredRole.position >= botMember.roles.highest.position) {
      return reply('❌ Bot, kayıtsız rolünü veremiyor (rol hiyerarşisinde botun en yüksek rolünün altında olmalı).');
    }

    try {
      if (isSlash && !ctx.deferred && !ctx.replied) {
        try { await ctx.deferReply({ ephemeral: true }); } catch {}
      }
      try { await targetMember.setNickname('Kayıtsız', `Kayıtsız komutu - ${author?.tag || 'unknown'}`); } catch {}

      const removableRoles = targetMember.roles.cache.filter(r =>
        !r.managed &&
        r.id !== guild.id &&
        r.position < botMember.roles.highest.position
      );
      for (const [, role] of removableRoles) {
        try { await targetMember.roles.remove(role, `Kayıtsız komutu - ${author?.tag || 'unknown'}`); } catch {}
      }

      await targetMember.roles.add(unregisteredRole, `Kayıtsız komutu - ${author?.tag || 'unknown'}`);

      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('✅ Kayıtsız İşlemi Tamamlandı')
        .setDescription(`**${targetMember.user.username}** kayıtsız yapıldı.`)
        .addFields(
          { name: '🏷️ Yeni Nick', value: targetMember.displayName || 'Kayıtsız', inline: true },
          { name: '🎭 Verilen Rol', value: unregisteredRole.toString(), inline: true }
        )
        .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      const logChannelId = reg.unregisteredLogChannelId || reg.logChannelId;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Kayıtsız Üye İşlemi')
            .addFields(
              { name: '👮‍♂️ Yetkili', value: `${author}`, inline: true },
              { name: '👤 Üye', value: `${targetMember}`, inline: true },
              { name: '🏷️ Yeni İsim', value: targetMember.displayName || 'Kayıtsız', inline: true },
              { name: '🎭 Verilen Rol', value: `${unregisteredRole.name} (${unregisteredRole.id})`, inline: true },
              { name: '🗑️ Kaldırılan Roller', value: `${removableRoles.size} rol`, inline: true },
              { name: '📊 Toplam Üye', value: `${guild.memberCount}`, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(()=>{});
        }
      }

      if (isSlash) {
        return ctx.reply({ embeds: [embed], ephemeral: true });
      } else {
        return reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[UNREGISTERED COMMAND ERROR]', error);
      if (isSlash) {
        return ctx.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
      }
      return reply('❌ İşlem sırasında bir hata oluştu.');
    }
  }
};
