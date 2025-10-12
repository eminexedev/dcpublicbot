const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { getSecurityConfig, setSecurityConfig } = require('../config');
const { getJailRole } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('güvenlik-kurulum')
    .setDescription('Güvenlik sistemi için detaylı kurulum rehberi ve otomatik yapılandırma')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'admin',
  description: 'Güvenlik koruma sistemini adım adım kurar.',
  usage: '/güvenlik-kurulum',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    try {
      // Yetki kontrolü
      const executorId = ctx.user?.id || ctx.author?.id;
      const executor = await ctx.guild.members.fetch(executorId);
      if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
        return ctx.reply({
          content: '❌ Bu komutu kullanmak için "Yönetici" yetkisine sahip olmalısın.',
          ephemeral: true
        });
      }

      // Mevcut güvenlik ayarlarını kontrol et
  let config = getSecurityConfig(ctx.guild.id) || {};
  // Güvenli normalizasyon (undefined -> [])
  config.whitelistedRoles = Array.isArray(config.whitelistedRoles) ? config.whitelistedRoles : [];
  config.exemptUsers = Array.isArray(config.exemptUsers) ? config.exemptUsers : [];
  if (typeof config.enabled !== 'boolean') config.enabled = false;
  if (typeof config.banThreshold !== 'number') config.banThreshold = 3;
  if (!config.punishment) config.punishment = 'jail';
      const jailRoleId = getJailRole(ctx.guild.id);

      // Kurulum durumu analizi
      const setupStatus = {
        jailRole: !!jailRoleId,
        logChannel: !!config.logChannel,
        systemEnabled: config.enabled,
        hasWhitelist: (config.whitelistedRoles.length > 0) || (config.exemptUsers.length > 0)
      };

      // Ana kurulum embed'i
      const setupEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('🛡️ Güvenlik Sistemi Kurulum Rehberi')
        .setDescription('Yetkili kötüye kullanımını engelleyen güvenlik sistemini kurmak için aşağıdaki adımları takip edin.')
        .addFields(
          {
            name: '📋 Kurulum Aşamaları',
            value: `${setupStatus.jailRole ? '✅' : '❌'} **1. Jail Rolü** ${setupStatus.jailRole ? '(Ayarlanmış)' : '(Gerekli)'}\n` +
                   `${setupStatus.logChannel ? '✅' : '❌'} **2. Log Kanalı** ${setupStatus.logChannel ? '(Ayarlanmış)' : '(Önerilen)'}\n` +
                   `${setupStatus.hasWhitelist ? '✅' : '⚠️'} **3. Muaf Roller** ${setupStatus.hasWhitelist ? '(Ayarlanmış)' : '(Önerilen)'}\n` +
                   `${setupStatus.systemEnabled ? '✅' : '❌'} **4. Sistem Aktivasyonu** ${setupStatus.systemEnabled ? '(Aktif)' : '(Kapalı)'}`,
            inline: false
          },
          {
            name: '⚙️ Mevcut Ayarlar',
            value: `**İhlal Eşiği:** ${config.banThreshold} (24 saatte)\n` +
                   `**Ceza Türü:** ${config.punishment === 'jail' ? 'Jail' : config.punishment === 'roleRemove' ? 'Rol Alma' : 'Jail + Rol Alma'}\n` +
                   `**Durum:** ${config.enabled ? '🟢 Aktif' : '🔴 Kapalı'}`,
            inline: true
          },
          {
            name: '🔍 Sistem Kontrolü',
            value: `**Jail Rolü:** ${jailRoleId ? `<@&${jailRoleId}>` : '❌ Ayarlanmamış'}\n` +
                   `**Log Kanalı:** ${config.logChannel ? `<#${config.logChannel}>` : '❌ Ayarlanmamış'}\n` +
                   `**Muaf Roller:** ${config.whitelistedRoles.length} adet`,
            inline: true
          }
        )
        .setFooter({ text: 'Otomatik kurulum için aşağıdaki butonları kullanın' })
        .setTimestamp();

      // Kurulum butonları
      const setupButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('security_setup_jail')
            .setLabel('🔒 Jail Rolü Ayarla')
            .setStyle(setupStatus.jailRole ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(setupStatus.jailRole),
          new ButtonBuilder()
            .setCustomId('security_setup_log')
            .setLabel('📊 Log Kanalı Ayarla')
            .setStyle(setupStatus.logChannel ? ButtonStyle.Success : ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('security_setup_whitelist')
            .setLabel('🛡️ Muaf Roller')
            .setStyle(ButtonStyle.Secondary)
        );

      const controlButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('security_quick_setup')
            .setLabel('⚡ Hızlı Kurulum')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('security_test_system')
            .setLabel('🧪 Sistemi Test Et')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!setupStatus.jailRole),
          new ButtonBuilder()
            .setCustomId('security_full_guide')
            .setLabel('📖 Detaylı Rehber')
            .setStyle(ButtonStyle.Secondary)
        );

      await ctx.reply({
        embeds: [setupEmbed],
        components: [setupButtons, controlButtons]
      });

    } catch (error) {
      console.error('Güvenlik kurulum komutu hatası:', error);
      await ctx.reply({
        content: '❌ Kurulum menüsü açılırken hata oluştu.',
        ephemeral: true
      });
    }
  }
};

// Kurulum helper fonksiyonları burada tanımlanacak (interaction handler'da kullanılacak)