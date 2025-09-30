const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPrefix, setPrefix } = require('../config');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Sunucu prefix\'ini ayarlar veya görüntüler.')
    .addStringOption(option =>
      option.setName('yeni_prefix')
        .setDescription('Ayarlanacak yeni prefix (boş bırakırsanız mevcut prefix gösterilir)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(ctx, args) {
    const currentPrefix = getPrefix(ctx.guild.id);
    
    if (ctx.type === 'slash') {
      const newPrefix = ctx.getString('yeni_prefix');
      
      if (!newPrefix) {
        // Mevcut prefix'i göster
        const infoEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📝 Sunucu Prefix Bilgisi')
          .setDescription(`**${ctx.guild.name}** sunucusunun mevcut prefix\'i:`)
          .addFields(
            {
              name: '🔖 Mevcut Prefix',
              value: `\`${currentPrefix}\``,
              inline: true
            },
            {
              name: '📋 Kullanım Örneği',
              value: `\`${currentPrefix}yardim\``,
              inline: true
            },
            {
              name: '⚙️ Değiştirme',
              value: `\`/prefix yeni_prefix\` komutuyla değiştirebilirsiniz`,
              inline: false
            }
          )
          .setThumbnail(ctx.guild.iconURL({ dynamic: true }) || ctx.client.user.displayAvatarURL())
          .setFooter({ 
            text: `${ctx.guild.name} • Prefix Sistemi`, 
            iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
          })
          .setTimestamp();
        
        return ctx.reply({ embeds: [infoEmbed] });
      }
      
      // Prefix validasyonu
      if (newPrefix.length > 5) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Geçersiz Prefix')
          .setDescription('Prefix en fazla 5 karakter olabilir.')
          .addFields(
            {
              name: '📏 Uzunluk Sınırı',
              value: '**Maksimum:** 5 karakter\n**Girilen:** ' + newPrefix.length + ' karakter',
              inline: true
            },
            {
              name: '✅ Önerilen Prefix\'ler',
              value: '`!`, `?`, `+`, `-`, `>`, `.`',
              inline: true
            }
          )
          .setTimestamp();
        
        return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      }
      
      // Özel karakterler kontrolü
      const invalidChars = ['@', '#', '`', '\\\\', '/', '|'];
      if (invalidChars.some(char => newPrefix.includes(char))) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Geçersiz Karakter')
          .setDescription('Prefix yasaklı karakterler içeriyor.')
          .addFields(
            {
              name: '🚫 Yasaklı Karakterler',
              value: invalidChars.map(c => `\`${c}\``).join(', '),
              inline: false
            },
            {
              name: '✅ Önerilen Prefix\'ler',
              value: '`!`, `?`, `+`, `-`, `>`, `.`, `*`',
              inline: false
            }
          )
          .setTimestamp();
        
        return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      }
      
      // Prefix'i kaydet
      setPrefix(ctx.guild.id, newPrefix);
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Prefix Başarıyla Değiştirildi')
        .setDescription(`**${ctx.guild.name}** sunucusunun prefix\'i güncellendi!`)
        .addFields(
          {
            name: '📝 Eski Prefix',
            value: `\`${currentPrefix}\``,
            inline: true
          },
          {
            name: '🆕 Yeni Prefix',
            value: `\`${newPrefix}\``,
            inline: true
          },
          {
            name: '👮‍♂️ Değiştiren',
            value: `**${ctx.user.tag}**\n\`ID: ${ctx.user.id}\``,
            inline: false
          },
          {
            name: '📋 Test Et',
            value: `Yeni prefix'i test etmek için: \`${newPrefix}yardim\``,
            inline: false
          }
        )
        .setThumbnail(ctx.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ 
          text: `${ctx.guild.name} • Prefix Değiştirildi`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return ctx.reply({ embeds: [successEmbed] });
      
    } else if (ctx.type === 'prefix') {
      const newPrefix = ctx.getString(0);
      
      if (!newPrefix) {
        // Mevcut prefix'i göster
        return ctx.reply(`📝 **Mevcut Prefix:** \`${currentPrefix}\`\n📋 **Kullanım:** \`${currentPrefix}prefix yeni_prefix\``);
      }
      
      // Prefix validasyonu
      if (newPrefix.length > 5) {
        return ctx.reply(`❌ **Hata:** Prefix en fazla 5 karakter olabilir. (Girilen: ${newPrefix.length} karakter)`);
      }
      
      // Özel karakterler kontrolü
      const invalidChars = ['@', '#', '`', '\\\\', '/', '|'];
      if (invalidChars.some(char => newPrefix.includes(char))) {
        return ctx.reply(`❌ **Hata:** Prefix yasaklı karakterler içeriyor: ${invalidChars.join(', ')}`);
      }
      
      // Prefix'i kaydet
      setPrefix(ctx.guild.id, newPrefix);
      
      return ctx.reply(`✅ **Prefix Değiştirildi!**\n📝 **Eski:** \`${currentPrefix}\` → **Yeni:** \`${newPrefix}\`\n📋 **Test:** \`${newPrefix}yardim\``);
    }
  }
};
