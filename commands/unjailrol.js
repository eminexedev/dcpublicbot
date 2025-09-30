const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unjailrol')
    .setDescription('Unjail sistemi için kullanılacak rolü ayarlar.')
    .addRoleOption(option =>
      option.setName('rol').setDescription('Unjail rolü olarak ayarlanacak rol').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'moderation',
  description: 'Unjail sistemi için kullanılacak rolü belirler.',
  usage: '.unjailrol @rol',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    // YETKİ KONTROLÜ
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Yönetici" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    let targetRole;

    // Hedef rolü belirle
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetRole = ctx.options.getRole('rol');
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir rol etiketlemelisin. Örnek: `!unjailrol @UyeRol`',
          flags: MessageFlags.Ephemeral
        });
      }

      // Rolü bul
      const roleMatch = args[0].match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir rol etiketlemelisin.',
          flags: MessageFlags.Ephemeral
        });
      }

      const roleId = roleMatch[1] || roleMatch[2];
      targetRole = ctx.guild.roles.cache.get(roleId);
      if (!targetRole) {
        return ctx.reply({
          content: '❌ Rol bulunamadı.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (!targetRole) {
      return ctx.reply({
        content: '❌ Bir rol etiketlemelisin veya ID girmelisin.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ROL POZİSYON KONTROLÜ
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    if (targetRole.position >= botHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ HATASI!** ${targetRole.name} rolü botun en yüksek rolünden (\`${botHighestRole.name}\`) yüksek veya eşit konumda. Bot bu rolü veremez!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // @everyone rolü kontrolü
    if (targetRole.id === ctx.guild.id) {
      return ctx.reply({
        content: '❌ @everyone rolünü unjail rolü olarak ayarlayamazsın!',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Unjail rol ayarını kaydet
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.join(__dirname, '..', 'jailConfig.json');
      let config = {};
      
      // Mevcut config'i oku
      try {
        if (fs.existsSync(configPath)) {
          const data = fs.readFileSync(configPath, 'utf8');
          config = JSON.parse(data);
        }
      } catch (error) {
        console.log('⚠️ Jail config dosyası okunamadı, yeni oluşturuluyor');
        config = {};
      }
      
      // Sunucu ayarını güncelle
      if (!config[ctx.guild.id]) {
        config[ctx.guild.id] = {};
      }
      
      config[ctx.guild.id].unjailRoleId = targetRole.id;
      config[ctx.guild.id].unjailRoleName = targetRole.name;
      config[ctx.guild.id].unjailSetBy = executor.user.id;
      config[ctx.guild.id].unjailSetAt = Date.now();
      
      // Config'i kaydet
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log(`✅ Unjail rolü ayarlandı: ${ctx.guild.name} -> ${targetRole.name}`);

      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Unjail Rolü Ayarlandı')
        .setDescription(`**${targetRole.name}** rolü unjail sistemi için başarıyla ayarlandı.`)
        .addFields(
          {
            name: '🎭 Ayarlanan Rol',
            value: `${targetRole.name} (\`${targetRole.id}\`)`,
            inline: true
          },
          {
            name: '👮 Ayarlayan Yetkili',
            value: `${executor.user.tag}`,
            inline: true
          },
          {
            name: '📊 Rol Bilgileri',
            value: `**Pozisyon:** ${targetRole.position}\n**Renk:** ${targetRole.hexColor}\n**Üye Sayısı:** ${targetRole.members.size}`,
            inline: false
          },
          {
            name: '⚙️ Kullanım',
            value: 'Artık `.unjail` komutu jail\'den çıkarılan kullanıcılara bu rolü verecek.\n(Eski rolleri geri verilmeyecek)',
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setTimestamp();

      await ctx.reply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Unjail rol ayarlama hatası:', error);
      return ctx.reply({
        content: '❌ Unjail rolü ayarlanırken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};