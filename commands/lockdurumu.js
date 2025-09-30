const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getLockConfig } = require('./lockrol');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdurumu')
    .setDescription('Lock sistemi ayarlarını ve durumunu görüntüler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Lock sistemi ayarlarını ve durumunu görüntüler.',
  usage: '.lockdurumu',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(ctx) {
    try {
      console.log(`🔒 [LOCKDURUMU DEBUG] Lock durumu kontrolü başlatıldı`);
      
      const lockConfig = getLockConfig(ctx.guild.id);
      console.log(`🔒 [LOCKDURUMU DEBUG] Lock config: ${JSON.stringify(lockConfig)}`);
      
      const defaultLockRoleId = lockConfig.defaultLockRoleId;
      const setBy = lockConfig.setBy;
      const setAt = lockConfig.setAt;

      let defaultLockRole = null;
      let setByUser = null;

      // Varsayılan lock rolünü al
      if (defaultLockRoleId) {
        defaultLockRole = ctx.guild.roles.cache.get(defaultLockRoleId);
        console.log(`🔒 [LOCKDURUMU DEBUG] Default lock role: ${defaultLockRole ? defaultLockRole.name : 'not found'}`);
      }

      // Ayarlayan kullanıcıyı al
      if (setBy) {
        try {
          setByUser = await ctx.client.users.fetch(setBy);
          console.log(`🔒 [LOCKDURUMU DEBUG] Set by user: ${setByUser.tag}`);
        } catch (error) {
          console.log(`🔒 [LOCKDURUMU DEBUG] Set by user bulunamadı: ${setBy}`);
        }
      }

      // Durum embed'i oluştur
      const statusEmbed = new EmbedBuilder()
        .setColor(defaultLockRole ? '#57F287' : '#FFA500')
        .setTitle('🔒 Lock Sistemi Durumu')
        .setDescription(`**${ctx.guild.name}** sunucusunun lock sistemi bilgileri`)
        .addFields(
          {
            name: '🎭 Varsayılan Lock Rolü',
            value: defaultLockRole 
              ? `✅ **${defaultLockRole.name}**\n\`${defaultLockRole.id}\`\nPozisyon: ${defaultLockRole.position}\nRenk: ${defaultLockRole.hexColor}`
              : defaultLockRoleId 
                ? `❌ **Rol Bulunamadı!**\n\`${defaultLockRoleId}\`\n⚠️ Rol silinmiş olabilir`
                : `⚠️ **Ayarlanmamış**\n\`Henüz ayarlanmamış\`\n📝 .lockrol komutu ile ayarlayın`,
            inline: true
          },
          {
            name: '👮 Ayarlayan Yetkili',
            value: setByUser 
              ? `${setByUser.tag}\n\`${setByUser.id}\``
              : setBy 
                ? `Bilinmiyor\n\`${setBy}\``
                : `Henüz ayarlanmamış`,
            inline: true
          },
          {
            name: '📅 Ayarlanma Tarihi',
            value: setAt 
              ? `<t:${Math.floor(setAt / 1000)}:F>\n<t:${Math.floor(setAt / 1000)}:R>`
              : 'Henüz ayarlanmamış',
            inline: true
          },
          {
            name: '📝 Lock Sistemi Nasıl Çalışır?',
            value: defaultLockRole 
              ? `✅ \`.lock\` → **${defaultLockRole.name}** rolü otomatik istisna olur\n✅ \`.lock @başka-rol\` → Geçici olarak farklı rol istisna\n✅ \`.unlock\` → Tüm kısıtlamaları kaldırır`
              : `❌ Varsayılan rol ayarlanmamış\n📝 \`.lockrol @rol\` ile varsayılan rol ayarlayın\n📝 \`.lock @rol\` ile geçici rol belirtin`,
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ 
          text: `Lock sistemi ${defaultLockRole ? 'yapılandırılmış' : 'yapılandırılmamış'} • ${ctx.guild.name}`,
          iconURL: ctx.client.user.displayAvatarURL()
        })
        .setTimestamp();

      // Eğer varsayılan rol yoksa kurulum rehberi ekle
      if (!defaultLockRole) {
        statusEmbed.addFields({
          name: '⚙️ Kurulum Rehberi',
          value: `**Lock Sistemi Kurulumu:**\n` +
            `1️⃣ \`.lockrol @YetkiliRol\` - Varsayılan yetkili rol ayarlayın\n` +
            `2️⃣ \`.lock\` - Kanalı kilitleyin (yetkili rol istisna)\n` +
            `3️⃣ \`.unlock\` - Kanal kilidini açın\n\n` +
            `**Geçici Kullanım:**\n` +
            `🔒 \`.lock @FarklıRol\` - Geçici olarak farklı rol istisna\n` +
            `🔓 \`.unlock\` - Tüm kısıtlamaları kaldır`,
          inline: false
        });
      }

      await ctx.reply({
        embeds: [statusEmbed],
        flags: MessageFlags.Ephemeral
      });

      console.log(`🔒 [LOCKDURUMU DEBUG] Durum mesajı gönderildi`);

    } catch (error) {
      console.error('🔒 [LOCKDURUMU ERROR] Lock durumu kontrolü hatası:', error);
      return ctx.reply({
        content: '❌ Lock durumu kontrol edilirken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};