const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { setLogChannel, setMaleRole, setFemaleRole, setMemberRole, setUnregisteredRole, getRegistrationConfig, resetRegistrationConfig } = require('../registrationConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kayıt-ayar')
    .setDescription('Kayıt sistemini yapılandırır.')
    .addSubcommand(subcommand =>
      subcommand.setName('log-kanal')
        .setDescription('Kayıt log kanalını ayarlar')
        .addChannelOption(option =>
          option.setName('kanal').setDescription('Log kanalı').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('erkek-rol')
        .setDescription('Erkek rolünü ayarlar')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Erkek rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('kadın-rol')
        .setDescription('Kadın rolünü ayarlar')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Kadın rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('üye-rol')
        .setDescription('Üye rolünü ayarlar')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Üye rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('kayıtsız-rol')
        .setDescription('Kayıtsız rolünü ayarlar')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Kayıtsız rolü').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('durum')
        .setDescription('Kayıt sistemi yapılandırma durumunu gösterir')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('sıfırla')
        .setDescription('Kayıt sistemi ayarlarını sıfırlar')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  description: 'Kayıt sistemini yapılandırır. Log kanalı, cinsiyet rolleri, üye rolü ve kayıtsız rolü ayarlanmalıdır.',
  usage: '/kayıt-ayar <alt-komut>',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(ctx, args) {
    // Slash komut mu prefix komut mu kontrol et
    let subcommand;
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      subcommand = ctx.options?.getSubcommand();
    } else {
      // Prefix komut - ilk argüman subcommand
      subcommand = args[0]?.toLowerCase();
    }
    
    // Yetki kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Sunucuyu Yönet" yetkisine sahip olmalısın.',
        ephemeral: true
      });
    }

    try {
      switch (subcommand) {
        case 'log-kanal':
          await this.handleLogChannel(ctx, args);
          break;
        case 'erkek-rol':
          await this.handleMaleRole(ctx, args);
          break;
        case 'kadın-rol':
          await this.handleFemaleRole(ctx, args);
          break;
        case 'üye-rol':
          await this.handleMemberRole(ctx, args);
          break;
        case 'kayıtsız-rol':
          await this.handleUnregisteredRole(ctx, args);
          break;
        case 'durum':
          await this.handleStatus(ctx, args);
          break;
        case 'sıfırla':
          await this.handleReset(ctx, args);
          break;
        default:
          await ctx.reply({
            content: '❌ Geçersiz alt komut.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('[REGISTRATION CONFIG ERROR]', error);
      await ctx.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleLogChannel(ctx, args) {
    let channel;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      channel = ctx.options.getChannel('kanal');
    } else {
      // Prefix komut - channel mention veya ID
      const channelArg = args[1];
      if (!channelArg) {
        return ctx.reply({
          content: '❌ Bir kanal etiketlemelisin. Örnek: `!kayıt-ayar log-kanal #genel`',
          ephemeral: true
        });
      }
      
      const channelMatch = channelArg.match(/^<#(\d+)>$|^(\d+)$/);
      if (!channelMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir kanal etiketlemelisin.',
          ephemeral: true
        });
      }
      
      const channelId = channelMatch[1] || channelMatch[2];
      channel = ctx.guild.channels.cache.get(channelId);
      if (!channel) {
        return ctx.reply({
          content: '❌ Kanal bulunamadı.',
          ephemeral: true
        });
      }
    }
    
    if (channel.type !== ChannelType.GuildText) {
      return ctx.reply({
        content: '❌ Sadece metin kanalları seçilebilir.',
        ephemeral: true
      });
    }

    const result = setLogChannel(ctx.guild.id, channel.id);
    if (result) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Log Kanalı Ayarlandı')
        .setDescription(`Kayıt log kanalı ${channel} olarak ayarlandı.`)
        .addFields({
          name: '📊 Yapılandırma Durumu',
          value: result.isConfigured ? '✅ Tamamlandı' : '⚠️ Diğer ayarlar eksik',
          inline: true
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Log kanalı ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleMaleRole(ctx, args) {
    let role;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      role = ctx.options.getRole('rol');
    } else {
      // Prefix komut - role mention veya ID
      const roleArg = args[1];
      if (!roleArg) {
        return ctx.reply({
          content: '❌ Bir rol etiketlemelisin. Örnek: `!kayıt-ayar erkek-rol @Erkek`',
          ephemeral: true
        });
      }
      
      const roleMatch = roleArg.match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir rol etiketlemelisin.',
          ephemeral: true
        });
      }
      
      const roleId = roleMatch[1] || roleMatch[2];
      role = ctx.guild.roles.cache.get(roleId);
      if (!role) {
        return ctx.reply({
          content: '❌ Rol bulunamadı.',
          ephemeral: true
        });
      }
    }
    
    // Rol hiyerarşisi kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    
    if (role.position >= executor.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamazsın çünkü bu rol senin en yüksek rolünden yüksek veya eşit.',
        ephemeral: true
      });
    }
    
    if (role.position >= botMember.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamam çünkü bu rol benim en yüksek rolümden yüksek veya eşit.',
        ephemeral: true
      });
    }

    const result = setMaleRole(ctx.guild.id, role.id);
    if (result) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('👨 Erkek Rolü Ayarlandı')
        .setDescription(`Erkek kayıt rolü ${role} olarak ayarlandı.`)
        .addFields({
          name: '📊 Yapılandırma Durumu',
          value: result.isConfigured ? '✅ Tamamlandı' : '⚠️ Diğer ayarlar eksik',
          inline: true
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Erkek rolü ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleFemaleRole(ctx, args) {
    let role;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      role = ctx.options.getRole('rol');
    } else {
      // Prefix komut - role mention veya ID
      const roleArg = args[1];
      if (!roleArg) {
        return ctx.reply({
          content: '❌ Bir rol etiketlemelisin. Örnek: `!kayıt-ayar kadın-rol @Kadın`',
          ephemeral: true
        });
      }
      
      const roleMatch = roleArg.match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir rol etiketlemelisin.',
          ephemeral: true
        });
      }
      
      const roleId = roleMatch[1] || roleMatch[2];
      role = ctx.guild.roles.cache.get(roleId);
      if (!role) {
        return ctx.reply({
          content: '❌ Rol bulunamadı.',
          ephemeral: true
        });
      }
    }
    
    // Rol hiyerarşisi kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    
    if (role.position >= executor.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamazsın çünkü bu rol senin en yüksek rolünden yüksek veya eşit.',
        ephemeral: true
      });
    }
    
    if (role.position >= botMember.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamam çünkü bu rol benim en yüksek rolümden yüksek veya eşit.',
        ephemeral: true
      });
    }

    const result = setFemaleRole(ctx.guild.id, role.id);
    if (result) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('👩 Kadın Rolü Ayarlandı')
        .setDescription(`Kadın kayıt rolü ${role} olarak ayarlandı.`)
        .addFields({
          name: '📊 Yapılandırma Durumu',
          value: result.isConfigured ? '✅ Tamamlandı' : '⚠️ Diğer ayarlar eksik',
          inline: true
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Kadın rolü ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleMemberRole(ctx, args) {
    let role;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      role = ctx.options.getRole('rol');
    } else {
      // Prefix komut - role mention veya ID
      const roleArg = args[1];
      if (!roleArg) {
        return ctx.reply({
          content: '❌ Bir rol etiketlemelisin. Örnek: `!kayıt-ayar üye-rol @Üye`',
          ephemeral: true
        });
      }
      
      const roleMatch = roleArg.match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir rol etiketlemelisin.',
          ephemeral: true
        });
      }
      
      const roleId = roleMatch[1] || roleMatch[2];
      role = ctx.guild.roles.cache.get(roleId);
      if (!role) {
        return ctx.reply({
          content: '❌ Rol bulunamadı.',
          ephemeral: true
        });
      }
    }
    
    // Rol hiyerarşisi kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    
    if (role.position >= executor.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamazsın çünkü bu rol senin en yüksek rolünden yüksek veya eşit.',
        ephemeral: true
      });
    }
    
    if (role.position >= botMember.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamam çünkü bu rol benim en yüksek rolümden yüksek veya eşit.',
        ephemeral: true
      });
    }

    const result = setMemberRole(ctx.guild.id, role.id);
    if (result) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('👥 Üye Rolü Ayarlandı')
        .setDescription(`Üye rolü ${role} olarak ayarlandı.`)
        .addFields({
          name: '📊 Yapılandırma Durumu',
          value: result.isConfigured ? '✅ Tamamlandı' : '⚠️ Diğer ayarlar eksik',
          inline: true
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Üye rolü ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleUnregisteredRole(ctx, args) {
    let role;
    
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      role = ctx.options.getRole('rol');
    } else {
      // Prefix komut - role mention veya ID
      const roleArg = args[1];
      if (!roleArg) {
        return ctx.reply({
          content: '❌ Bir rol etiketlemelisin. Örnek: `!kayıt-ayar kayıtsız-rol @Kayıtsız`',
          ephemeral: true
        });
      }
      
      const roleMatch = roleArg.match(/^<@&(\d+)>$|^(\d+)$/);
      if (!roleMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir rol etiketlemelisin.',
          ephemeral: true
        });
      }
      
      const roleId = roleMatch[1] || roleMatch[2];
      role = ctx.guild.roles.cache.get(roleId);
      if (!role) {
        return ctx.reply({
          content: '❌ Rol bulunamadı.',
          ephemeral: true
        });
      }
    }
    
    // Rol hiyerarşisi kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    
    if (role.position >= executor.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamazsın çünkü bu rol senin en yüksek rolünden yüksek veya eşit.',
        ephemeral: true
      });
    }
    
    if (role.position >= botMember.roles.highest.position) {
      return ctx.reply({
        content: '❌ Bu rolü ayarlayamam çünkü bu rol benim en yüksek rolümden yüksek veya eşit.',
        ephemeral: true
      });
    }

    const result = setUnregisteredRole(ctx.guild.id, role.id);
    if (result) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔸 Kayıtsız Rolü Ayarlandı')
        .setDescription(`Kayıtsız rolü ${role} olarak ayarlandı.`)
        .addFields({
          name: '📊 Yapılandırma Durumu',
          value: result.isConfigured ? '✅ Tamamlandı' : '⚠️ Diğer ayarlar eksik',
          inline: true
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Kayıtsız rolü ayarlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  async handleStatus(ctx, args) {
    const config = getRegistrationConfig(ctx.guild.id);
    
    const logChannel = config.logChannelId ? ctx.guild.channels.cache.get(config.logChannelId) : null;
    const maleRole = config.maleRoleId ? ctx.guild.roles.cache.get(config.maleRoleId) : null;
    const femaleRole = config.femaleRoleId ? ctx.guild.roles.cache.get(config.femaleRoleId) : null;
    const memberRole = config.memberRoleId ? ctx.guild.roles.cache.get(config.memberRoleId) : null;
    const unregisteredRole = config.unregisteredRoleId ? ctx.guild.roles.cache.get(config.unregisteredRoleId) : null;
    
    const embed = new EmbedBuilder()
      .setColor(config.isConfigured ? '#57F287' : '#FEE75C')
      .setTitle('📊 Kayıt Sistemi Yapılandırma Durumu')
      .setDescription(config.isConfigured ? 
        '✅ Kayıt sistemi tamamen yapılandırılmış.' : 
        '⚠️ Kayıt sistemi eksik ayarlara sahip.'
      )
      .addFields(
        {
          name: '📝 Log Kanalı',
          value: logChannel ? `${logChannel} ✅` : '❌ Ayarlanmamış',
          inline: true
        },
        {
          name: '👨 Erkek Rolü',
          value: maleRole ? `${maleRole} ✅` : '❌ Ayarlanmamış',
          inline: true
        },
        {
          name: '👩 Kadın Rolü',
          value: femaleRole ? `${femaleRole} ✅` : '❌ Ayarlanmamış',
          inline: true
        },
        {
          name: '👥 Üye Rolü',
          value: memberRole ? `${memberRole} ✅` : '❌ Ayarlanmamış',
          inline: true
        },
        {
          name: '🔸 Kayıtsız Rolü',
          value: unregisteredRole ? `${unregisteredRole} ✅` : '❌ Ayarlanmamış',
          inline: true
        },
        {
          name: '🎯 Durum',
          value: config.isConfigured ? '✅ Kayıt sistemi kullanıma hazır' : '❌ Tüm ayarları tamamlayın',
          inline: false
        }
      )
      .setFooter({
        text: 'Eksik ayarları tamamlamak için /kayıt-ayar komutunu kullanın'
      })
      .setTimestamp();

    await ctx.reply({ embeds: [embed], ephemeral: true });
  },

  async handleReset(ctx, args) {
    const success = resetRegistrationConfig(ctx.guild.id);
    
    if (success) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🗑️ Kayıt Ayarları Sıfırlandı')
        .setDescription('Tüm kayıt sistemi ayarları başarıyla sıfırlandı.')
        .addFields({
          name: '⚠️ Uyarı',
          value: 'Kayıt sistemi artık kullanılamaz. Yeniden yapılandırmanız gerekiyor.',
          inline: false
        })
        .setTimestamp();

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({
        content: '❌ Ayarlar sıfırlanırken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};