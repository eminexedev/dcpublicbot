const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Kullanıcının profil resmini gösterir.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Avatar\'ını görüntülemek istediğiniz kullanıcı')
        .setRequired(false)
    ),

  category: 'utility',
  description: 'Kullanıcının profil resmini gösterir. Kullanım: .avatar [@kullanıcı veya ID]',
  usage: '.avatar [@kullanıcı veya ID]',
  permissions: [],

  async execute(ctx, args) {
    let targetUser;

    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetUser = ctx.options.getUser('kullanıcı') || ctx.user;
    } else {
      // Prefix komut
      targetUser = ctx.author; // Varsayılan olarak kendisi

      if (args && args[0]) {
        // Mention kontrolü
        const mention = ctx.message?.mentions?.users?.first();
        if (mention) {
          targetUser = mention;
        } else {
          // ID ile kontrolü
          const userId = args[0].replace(/[<@!>]/g, '');
          if (/^\d{17,19}$/.test(userId)) {
            try {
              const fetchedUser = await ctx.client.users.fetch(userId);
              if (fetchedUser) targetUser = fetchedUser;
            } catch (error) {
              return ctx.reply({
                content: '❌ Kullanıcı bulunamadı. Geçerli bir kullanıcı ID\'si veya mention kullanın.',
                ephemeral: true
              });
            }
          } else {
            return ctx.reply({
              content: '❌ Geçerli bir kullanıcı etiketleyin veya ID girin.',
              ephemeral: true
            });
          }
        }
      }
    }

    // Guild member kontrolü (sunucuda mı?)
    const member = ctx.guild?.members?.cache?.get(targetUser.id);
    const displayName = member?.displayName || targetUser.globalName || targetUser.username;
    
    // Avatar URL'lerini al
    const avatarURL = targetUser.displayAvatarURL({ 
      dynamic: true, 
      size: 4096 
    });
    
    const globalAvatarURL = targetUser.avatarURL({ 
      dynamic: true, 
      size: 4096 
    });
    
    const guildAvatarURL = member?.avatarURL({ 
      dynamic: true, 
      size: 4096 
    });

    // Embed oluştur
    const avatarEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${displayName} - Profil Resmi`)
      .setImage(avatarURL)
      .addFields(
        {
          name: '👤 Kullanıcı Bilgileri',
          value: `**İsim:** ${targetUser.username}\n` +
                 `**Görünen İsim:** ${displayName}\n` +
                 `**ID:** \`${targetUser.id}\`\n` +
                 `**Hesap Oluşturma:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`,
          inline: false
        }
      );

    // Avatar linklerini ekle
    let avatarLinks = `[**Yüksek Kalite**](${avatarURL})`;
    
    if (globalAvatarURL && globalAvatarURL !== avatarURL) {
      avatarLinks += ` • [**Global Avatar**](${globalAvatarURL})`;
    }
    
    if (guildAvatarURL && guildAvatarURL !== avatarURL && guildAvatarURL !== globalAvatarURL) {
      avatarLinks += ` • [**Sunucu Avatarı**](${guildAvatarURL})`;
    }

    avatarEmbed.addFields({
      name: '🔗 Avatar Linkleri',
      value: avatarLinks,
      inline: false
    });

    // Sunucu üyesi ise ek bilgiler
    if (member) {
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
      avatarEmbed.addFields({
        name: '🏠 Sunucu Bilgileri',
        value: `**Katılma Tarihi:** <t:${joinedTimestamp}:F>\n` +
               `**En Yüksek Rol:** ${member.roles.highest.name}\n` +
               `**Roller:** ${member.roles.cache.size - 1} rol`,
        inline: false
      });
    }

    // Thumbnail ekle (farklı avatar varsa)
    if (guildAvatarURL && guildAvatarURL !== avatarURL) {
      avatarEmbed.setThumbnail(guildAvatarURL);
    }

    avatarEmbed
      .setFooter({ 
        text: `Avatar komutu • ${ctx.guild?.name || 'DM'}`, 
        iconURL: ctx.guild?.iconURL({ dynamic: true }) || undefined 
      })
      .setTimestamp();

    await ctx.reply({ embeds: [avatarEmbed] });
  }
};