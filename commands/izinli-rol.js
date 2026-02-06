const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { setLeaveRole, getLeaveRole } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('izinli-rol')
    .setDescription('İzinli olan yetkililere verilecek rolü ayarlar.')
    .addRoleOption(option =>
      option.setName('rol').setDescription('İzinli rolü olarak ayarlanacak rol').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'İzinli olan yetkililere verilecek rolü belirler. İzin alan kişinin yetkili rolleri alınıp bu rol verilir.',
  usage: '.izinli-rol @rol',
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

    let targetRole;

    if (isSlash) {
      targetRole = ctx.options.getRole('rol');
    } else {
      // Prefix komut
      if (!args[0]) {
        // Eğer argüman yoksa mevcut ayarı göster
        const currentRoleId = getLeaveRole(guild.id);
        if (currentRoleId) {
          const currentRole = guild.roles.cache.get(currentRoleId);
          const infoEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Mevcut İzinli Rolü')
            .setDescription(currentRole ? `<@&${currentRole.id}> (\`${currentRole.name}\`)` : `Rol silinmiş (ID: ${currentRoleId})`)
            .setFooter({ text: 'Değiştirmek için: .izinli-rol @yeniRol' })
            .setTimestamp();
          return ctx.reply({ embeds: [infoEmbed] });
        }
        return ctx.reply('❌ Bir rol etiketlemelisin. Örnek: `.izinli-rol @İzinliRol`');
      }

      const roleMatch = args[0].match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply('❌ Geçerli bir rol etiketlemelisin.');
      }

      const roleId = roleMatch[1] || roleMatch[2];
      targetRole = guild.roles.cache.get(roleId);
      if (!targetRole) {
        return ctx.reply('❌ Rol bulunamadı.');
      }
    }

    if (!targetRole) {
      const msg = '❌ Bir rol etiketlemelisin veya ID girmelisin.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // @everyone rolü kontrolü
    if (targetRole.id === guild.id) {
      const msg = '❌ @everyone rolünü izinli rolü olarak ayarlayamazsın!';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Bot rol pozisyon kontrolü
    const botMember = await guild.members.fetch(ctx.client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    if (targetRole.position >= botHighestRole.position) {
      const msg = `❌ **ROL HİYERARŞİSİ HATASI!** ${targetRole.name} rolü botun en yüksek rolünden (\`${botHighestRole.name}\`) yüksek veya eşit konumda. Bot bu rolü veremez!`;
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    try {
      setLeaveRole(guild.id, targetRole.id, targetRole.name);

      console.log(`✅ İzinli rolü ayarlandı: ${guild.name} -> ${targetRole.name}`);

      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ İzinli Rolü Ayarlandı')
        .setDescription(`**${targetRole.name}** rolü izinli sistemi için başarıyla ayarlandı.`)
        .addFields(
          {
            name: '🎭 İzinli Rolü',
            value: `<@&${targetRole.id}>`,
            inline: true
          },
          {
            name: '📋 Bilgi',
            value: 'İzin alan yetkililerin yetkili rolleri alınıp bu rol verilecek.',
            inline: false
          }
        )
        .setTimestamp();

      if (isSlash) return ctx.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      return ctx.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('İzinli rol ayarlama hatası:', error);
      const msg = '❌ Rol ayarlanırken bir hata oluştu.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }
  }
};
