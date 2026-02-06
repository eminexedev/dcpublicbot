const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { setLeaveAuthorizedRole, removeLeaveAuthorizedRole, getLeaveAuthorizedRoles } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('izinli-yetkili-rol')
    .setDescription('İzin alabilecek yetkili rollerini ayarlar.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ekle')
        .setDescription('İzin alabilecek yetkili rolü ekler')
        .addRoleOption(option =>
          option.setName('rol').setDescription('İzin alabilecek yetkili rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kaldir')
        .setDescription('İzin alabilecek yetkili rolünü kaldırır')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Kaldırılacak yetkili rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('liste')
        .setDescription('İzin alabilecek yetkili rollerini listeler')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'İzin sistemi için yetkili rollerini ayarlar. Bu rollere sahip kişiler izin alabilir.',
  usage: '.izinli-yetkili-rol ekle @rol / .izinli-yetkili-rol kaldir @rol / .izinli-yetkili-rol liste',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    // Slash mı prefix mi kontrol
    let isSlash = false;
    try {
      if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) {
        isSlash = true;
      }
    } catch {}

    const guild = ctx.guild;
    if (!guild) {
      const msg = '❌ Bu komut sadece sunucularda kullanılabilir.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Yetki kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
      const msg = '❌ Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Slash komut için subcommand kontrolü
    if (isSlash) {
      const subcommand = ctx.options.getSubcommand();
      
      if (subcommand === 'ekle') {
        const role = ctx.options.getRole('rol');
        return await handleAdd(ctx, guild, role, isSlash);
      } else if (subcommand === 'kaldir') {
        const role = ctx.options.getRole('rol');
        return await handleRemove(ctx, guild, role, isSlash);
      } else if (subcommand === 'liste') {
        return await handleList(ctx, guild, isSlash);
      }
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply('❌ Kullanım: `.izinli-yetkili-rol ekle @rol` veya `.izinli-yetkili-rol kaldir @rol` veya `.izinli-yetkili-rol liste`');
      }

      const action = args[0].toLowerCase();
      
      if (action === 'ekle') {
        if (!args[1]) {
          return ctx.reply('❌ Bir rol etiketlemelisin. Örnek: `.izinli-yetkili-rol ekle @YetkiliRol`');
        }
        
        const roleMatch = args[1].match(/^<@&(\d+)>$|^(\d+)$/);
        if (!roleMatch) {
          return ctx.reply('❌ Geçerli bir rol etiketlemelisin.');
        }
        
        const roleId = roleMatch[1] || roleMatch[2];
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          return ctx.reply('❌ Rol bulunamadı.');
        }
        
        return await handleAdd(ctx, guild, role, isSlash);
      } else if (action === 'kaldir' || action === 'kaldır') {
        if (!args[1]) {
          return ctx.reply('❌ Bir rol etiketlemelisin. Örnek: `.izinli-yetkili-rol kaldir @YetkiliRol`');
        }
        
        const roleMatch = args[1].match(/^<@&(\d+)>$|^(\d+)$/);
        if (!roleMatch) {
          return ctx.reply('❌ Geçerli bir rol etiketlemelisin.');
        }
        
        const roleId = roleMatch[1] || roleMatch[2];
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          return ctx.reply('❌ Rol bulunamadı.');
        }
        
        return await handleRemove(ctx, guild, role, isSlash);
      } else if (action === 'liste') {
        return await handleList(ctx, guild, isSlash);
      } else {
        return ctx.reply('❌ Geçersiz işlem. Kullanım: `.izinli-yetkili-rol ekle @rol` veya `.izinli-yetkili-rol kaldir @rol` veya `.izinli-yetkili-rol liste`');
      }
    }
  }
};

async function handleAdd(ctx, guild, role, isSlash) {
  // @everyone rolü kontrolü
  if (role.id === guild.id) {
    const msg = '❌ @everyone rolünü yetkili rolü olarak ayarlayamazsın!';
    if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
    return ctx.reply(msg);
  }

  try {
    const roles = setLeaveAuthorizedRole(guild.id, role.id, role.name);
    
    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Yetkili Rolü Eklendi')
      .setDescription(`**${role.name}** rolü izin alabilecek yetkili rolleri arasına eklendi.`)
      .addFields(
        {
          name: '📋 Mevcut Yetkili Rolleri',
          value: roles.map(r => `<@&${r.id}>`).join(', ') || 'Hiç rol yok',
          inline: false
        }
      )
      .setTimestamp();

    if (isSlash) return ctx.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    return ctx.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Yetkili rol ekleme hatası:', error);
    const msg = '❌ Rol eklenirken bir hata oluştu.';
    if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
    return ctx.reply(msg);
  }
}

async function handleRemove(ctx, guild, role, isSlash) {
  try {
    const roles = removeLeaveAuthorizedRole(guild.id, role.id);
    
    const successEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Yetkili Rolü Kaldırıldı')
      .setDescription(`**${role.name}** rolü izin alabilecek yetkili rolleri arasından kaldırıldı.`)
      .addFields(
        {
          name: '📋 Mevcut Yetkili Rolleri',
          value: roles.length > 0 ? roles.map(r => `<@&${r.id}>`).join(', ') : 'Hiç rol kalmadı',
          inline: false
        }
      )
      .setTimestamp();

    if (isSlash) return ctx.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    return ctx.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Yetkili rol kaldırma hatası:', error);
    const msg = '❌ Rol kaldırılırken bir hata oluştu.';
    if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
    return ctx.reply(msg);
  }
}

async function handleList(ctx, guild, isSlash) {
  const roles = getLeaveAuthorizedRoles(guild.id);
  
  const listEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📋 İzin Alabilecek Yetkili Rolleri')
    .setDescription(
      roles.length > 0 
        ? roles.map((r, i) => `**${i + 1}.** <@&${r.id}> (\`${r.name}\`)`).join('\n')
        : '❌ Henüz hiçbir yetkili rolü tanımlanmamış.\n\n`.izinli-yetkili-rol ekle @rol` komutu ile ekleyebilirsin.'
    )
    .setFooter({ text: `Toplam ${roles.length} yetkili rolü` })
    .setTimestamp();

  if (isSlash) return ctx.reply({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
  return ctx.reply({ embeds: [listEmbed] });
}
