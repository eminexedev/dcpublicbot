const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { findAnyLogChannel } = require('../config');
const { addInfraction } = require('../utils/infractions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan banlar.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(true)
    )
    // Eski davranışla uyumluluk için string sebep alanı tutuldu ancak işlem öncesi mutlaka menüden seçim istenir
    .addStringOption(option =>
      option.setName('sebep').setDescription('Ban sebebi (bilgilendirme amaçlı, işlem için menüden seçim yapmanız gerekir)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(ctx, args) {
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : !!ctx.options;
    const guild = ctx.guild || ctx.message?.guild;
    const invoker = isSlash ? ctx.user : ctx.author;
    const reply = (msg) => ctx.reply(msg);
    if (!guild) return reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: isSlash });

    // Hedef kullanıcıyı al
    let user = null;
    if (isSlash) {
      user = ctx.options.getUser('kullanici');
    } else {
      if (!args || args.length === 0) {
        return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      }
      const idMatch = args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (userId) {
        user = await guild.client.users.fetch(userId).catch(() => null);
      }
    }
    if (!user) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: isSlash });

    // Yetki kontrolleri
    const executorMember = await guild.members.fetch(invoker.id).catch(() => null);
    const botMember = guild.members.me || await guild.members.fetch(guild.client.user.id);
    if (!executorMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısın.', ephemeral: isSlash });
    }
    if (!botMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: '❌ Botun ban yetkisi yok! Lütfen "Üyeleri Yasakla" yetkisini verin.', ephemeral: isSlash });
    }

    // Sunucuda ise rol hiyerarşisi ve bannable kontrolü için member al
    let member = null;
    try { member = await guild.members.fetch(user.id); } catch {}
    if (member) {
      if (!member.bannable) {
        return reply({ content: '❌ Bu kullanıcı banlanamıyor.', ephemeral: isSlash });
      }
      if (member.roles?.highest?.position >= executorMember.roles?.highest?.position && guild.ownerId !== executorMember.id) {
        return reply({ content: '❌ Bu kullanıcıyı banlayamazsınız çünkü rolleri sizden yüksek veya eşit.', ephemeral: isSlash });
      }
      if (member.roles?.highest?.position >= botMember.roles?.highest?.position) {
        return reply({ content: '❌ Bu kullanıcıyı banlayamam çünkü rolleri bottan yüksek veya eşit.', ephemeral: isSlash });
      }
    }

    // İnteraktif sebep seçimi
    const ownerId = invoker.id;
    const customId = `ban:g=${guild.id};t=${user.id};o=${ownerId}`;
    const select = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Ban sebebini seçin...')
      .addOptions([
        { label: 'Spam / Reklam', value: 'spam', description: 'Topluluğu rahatsız eden reklam veya spam' },
        { label: 'Tehdit / Taciz', value: 'tehdit', description: 'Ciddi tehdit, taciz, nefret söylemi' },
        { label: 'Uygunsuz İçerik (NSFW)', value: 'nsfw', description: 'Topluluk kurallarına aykırı içerik paylaşımı' },
        { label: 'Kural İhlali', value: 'kural', description: 'Sunucu kurallarına uymama' },
        { label: 'Bot / Raid', value: 'raid', description: 'Bot hesabı ya da raid girişimi' }
      ]);

    const infoEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Ban İşlemi')
      .setDescription(`Ban uygulanmadan önce sebep seçmelisiniz.`)
      .addFields(
        { name: 'Kullanıcı', value: `${user} (\`${user.id}\`)`, inline: true },
        { name: 'Yetkili', value: `${invoker} (\`${invoker.id}\`)`, inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(select);
    return reply({ embeds: [infoEmbed], components: [row], flags: isSlash ? MessageFlags.Ephemeral : undefined });
  },

  // Ban sebep seçim menüsü
  async handleSelectMenu(interaction) {
    if (!(interaction.customId?.startsWith('ban_') || interaction.customId?.startsWith('ban:'))) return;

    // Güvenlik: sadece komut sahibi
    const get = (k) => {
      const m = interaction.customId.match(new RegExp(`${k}=([^;]+)`));
      return m ? m[1] : null;
    };
    const ownerId = get('o');
    const guildId = get('g');
    const targetId = get('t');
    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ Bu menüyü sadece komutu kullanan kişi kullanabilir.', ephemeral: true });
    }
    if (guildId && interaction.guild?.id !== guildId) {
      return interaction.reply({ content: 'Geçersiz bağlam.', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch {}

    const reasonMap = {
      spam: 'Spam / Reklam',
      tehdit: 'Tehdit / Taciz',
      nsfw: 'Uygunsuz İçerik (NSFW)',
      kural: 'Kural İhlali',
      raid: 'Bot / Raid'
    };
    const val = interaction.values?.[0];
    const reasonLabel = reasonMap[val] || 'Belirtilmedi';

    const guild = interaction.guild;
    const user = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!user) {
      return interaction.editReply({ content: '❌ Kullanıcı alınamadı.' });
    }

    const executorMember = await guild.members.fetch(interaction.user.id).catch(() => null);
    const botMember = guild.members.me || await guild.members.fetch(guild.client.user.id);
    if (!executorMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({ content: '❌ Bu işlemi yapmaya yetkiniz yok.' });
    }
    if (!botMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({ content: '❌ Botun ban yetkisi yok.' });
    }

    // Sunucudaysa tekrar hiyerarşi kontrolü
    let member = null;
    try { member = await guild.members.fetch(user.id); } catch {}
    if (member) {
      if (!member.bannable) {
        return interaction.editReply({ content: '❌ Bu kullanıcı banlanamıyor.' });
      }
      if (member.roles?.highest?.position >= executorMember.roles?.highest?.position && guild.ownerId !== executorMember.id) {
        return interaction.editReply({ content: '❌ Rol hiyerarşisi nedeniyle banlayamazsınız.' });
      }
      if (member.roles?.highest?.position >= botMember.roles?.highest?.position) {
        return interaction.editReply({ content: '❌ Botun rolü bu kullanıcıyı banlamaya yetmiyor.' });
      }
    }

    // Ban uygula
    try {
      if (member) await member.ban({ reason: reasonLabel });
      else await guild.members.ban(user.id, { reason: reasonLabel });

      const success = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('✅ Ban Uygulandı')
        .addFields(
          { name: 'Kullanıcı', value: `${user} (\`${user.id}\`)`, inline: true },
          { name: 'Yetkili', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'Sebep', value: reasonLabel, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [success] });

      // Orijinal mesajdaki menüyü devre dışı bırakmayı dene
      try {
        const original = interaction.message;
        if (original && original.components?.length) {
          const rows = original.components.map(r => {
            const row = ActionRowBuilder.from(r);
            row.components = row.components.map(c => {
              if (c.data?.custom_id?.startsWith('ban') || c.customId?.startsWith?.('ban')) {
                const menu = new StringSelectMenuBuilder()
                  .setCustomId(c.data?.custom_id || c.customId)
                  .setPlaceholder(c.data?.placeholder || c.placeholder || 'Seçim')
                  .setDisabled(true);
                const opts = (c.data?.options || c.options || []).map(o => ({
                  label: o.label, value: o.value, description: o.description, emoji: o.emoji
                }));
                if (opts.length) menu.addOptions(opts);
                row.components = [menu];
                return menu;
              }
              return c;
            });
            return row;
          });
          await original.edit({ components: rows });
        }
      } catch {}

      // Log
      const logChannelId = findAnyLogChannel(guild.id);
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔨 Kullanıcı Banlandı')
            .setDescription(`**${user.tag || user.username}** sunucudan banlandı.`)
            .addFields(
              { name: '👤 Banlanan', value: `${user} (\`${user.id}\`)`, inline: true },
              { name: '👮 Yetkili', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
              { name: '📝 Sebep', value: reasonLabel, inline: false },
              { name: '⏰ Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setThumbnail(user.displayAvatarURL && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ text: `Sunucu: ${guild.name}`, iconURL: guild.iconURL() || undefined })
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
      // Sicil: ban kaydı
      try {
        addInfraction(guild.id, user.id, {
          t: Date.now(),
          type: 'ban',
          reason: reasonLabel,
          executorId: interaction.user.id
        });
      } catch {}
    } catch (err) {
      console.error('Ban hatası:', err);
      return interaction.editReply({ content: '❌ Ban işlemi sırasında bir hata oluştu. Yetkileri ve hiyerarşiyi kontrol edin.' });
    }
  }
};
