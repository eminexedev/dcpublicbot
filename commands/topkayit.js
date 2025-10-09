const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getRegistrationStats, getTopRegistrars, getRecentRegistrations } = require('../registrationStats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topkayıt')
    .setDescription('Sunucudaki kayıt istatistiklerini gösterir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',
  description: 'Sunucudaki kayıt istatistiklerini gösterir. Erkek/kadın kayıt sayıları ve en çok kayıt yapan yetkililer.',
  usage: '/topkayıt',
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(ctx, args) {
    try {
      // Kayıt istatistiklerini al
      const stats = getRegistrationStats(ctx.guild.id);
      const topRegistrars = getTopRegistrars(ctx.guild.id, 10);
      const recentRegistrations = getRecentRegistrations(ctx.guild.id, 10);

      // Eğer hiç kayıt yoksa
      if (stats.totalRegistrations === 0) {
        const noStatsEmbed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('📊 Kayıt İstatistikleri')
          .setDescription('Bu sunucuda henüz hiç kayıt işlemi yapılmamış.')
          .addFields({
            name: '💡 Bilgi',
            value: 'Kayıt işlemleri yapıldıkça burada istatistikler görünecek.',
            inline: false
          })
          .setTimestamp();

        return ctx.reply({ embeds: [noStatsEmbed] });
      }

      // Top kayıtçılar listesi oluştur
      let topRegistrarsText = '';
      if (topRegistrars.length > 0) {
        for (let i = 0; i < Math.min(10, topRegistrars.length); i++) {
          const registrar = topRegistrars[i];
          const member = await ctx.guild.members.fetch(registrar.userId).catch(() => null);
          const name = member ? member.displayName : 'Bilinmeyen Üye';
          
          let medal = '';
          if (i === 0) medal = '🥇';
          else if (i === 1) medal = '🥈';
          else if (i === 2) medal = '🥉';
          else medal = `**${i + 1}.**`;
          
          topRegistrarsText += `${medal} **${name}** - ${registrar.count} kayıt\n`;
        }
      } else {
        topRegistrarsText = 'Henüz veri yok';
      }

      // Son kayıt edilen üyeler listesi oluştur
      let recentMembersText = '';
      if (recentRegistrations.length > 0) {
        for (let i = 0; i < Math.min(10, recentRegistrations.length); i++) {
          const member = recentRegistrations[i];
          const genderEmoji = member.gender === 'erkek' ? '👨' : '👩';
          const registrar = await ctx.guild.members.fetch(member.registrarId).catch(() => null);
          const registrarName = registrar ? registrar.displayName : 'Bilinmeyen';
          
          const timeAgo = Math.floor((Date.now() - member.timestamp) / (1000 * 60)); // dakika cinsinden
          let timeText = '';
          if (timeAgo < 1) timeText = 'Az önce';
          else if (timeAgo < 60) timeText = `${timeAgo} dk önce`;
          else if (timeAgo < 1440) timeText = `${Math.floor(timeAgo / 60)} sa önce`;
          else timeText = `${Math.floor(timeAgo / 1440)} gün önce`;
          
          recentMembersText += `${genderEmoji} **${member.userName}** - ${registrarName} tarafından (${timeText})\n`;
        }
      } else {
        recentMembersText = 'Henüz veri yok';
      }

      // Son güncelleme zamanını formatla
      const lastUpdated = new Date(stats.lastUpdated);
      const lastUpdatedText = lastUpdated.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Ana embed oluştur
      const statsEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('📊 Kayıt İstatistikleri')
        .setDescription(`**${ctx.guild.name}** sunucusunun kayıt verileri`)
        .addFields(
          {
            name: '📈 Genel İstatistikler',
            value: `**Toplam Kayıt:** ${stats.totalRegistrations}\n**Erkek Kayıtları:** ${stats.maleRegistrations} (${stats.totalRegistrations > 0 ? Math.round((stats.maleRegistrations / stats.totalRegistrations) * 100) : 0}%)\n**Kadın Kayıtları:** ${stats.femaleRegistrations} (${stats.totalRegistrations > 0 ? Math.round((stats.femaleRegistrations / stats.totalRegistrations) * 100) : 0}%)`,
            inline: false
          },
          {
            name: '🏆 En Çok Kayıt Yapan Yetkililer',
            value: topRegistrarsText || 'Henüz veri yok',
            inline: false
          },
          {
            name: '👥 Son Kayıt Edilen Üyeler',
            value: recentMembersText || 'Henüz veri yok',
            inline: false
          },
          {
            name: '📊 Detaylar',
            value: `**Aktif Yetkili Sayısı:** ${Object.keys(stats.registrarStats).length}\n**Son Güncelleme:** ${lastUpdatedText}`,
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'İstatistikler bot yeniden başlatıldığında sıfırlanmaz' })
        .setTimestamp();

      await ctx.reply({ embeds: [statsEmbed] });

    } catch (error) {
      console.error('Topkayıt komutu hatası:', error);
      await ctx.reply({
        content: '❌ İstatistikler alınırken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};