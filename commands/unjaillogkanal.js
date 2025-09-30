const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unjaillogkanal')
    .setDescription('Unjail işlemleri için log kanalını ayarlar.')
    .addChannelOption(option =>
      option.setName('kanal').setDescription('Unjail log kanalı olarak ayarlanacak kanal').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'moderation',
  description: 'Unjail işlemleri için log kanalını belirler.',
  usage: '.unjaillogkanal #kanal',
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

    let targetChannel;

    // Hedef kanalı belirle
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetChannel = ctx.options.getChannel('kanal');
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir kanal etiketlemelisin. Örnek: `!unjaillogkanal #unjail-log`',
          flags: MessageFlags.Ephemeral
        });
      }

      // Kanalı bul
      const channelMatch = args[0].match(/^<#(\d+)>$|^(\d+)$/);
      if (!channelMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir kanal etiketlemelisin.',
          flags: MessageFlags.Ephemeral
        });
      }

      const channelId = channelMatch[1] || channelMatch[2];
      targetChannel = ctx.guild.channels.cache.get(channelId);
      if (!targetChannel) {
        return ctx.reply({
          content: '❌ Kanal bulunamadı.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (!targetChannel) {
      return ctx.reply({
        content: '❌ Bir kanal etiketlemelisin veya ID girmelisin.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Kanal tipi kontrolü
    if (!targetChannel.isTextBased()) {
      return ctx.reply({
        content: '❌ Sadece metin kanalları unjail log kanalı olarak ayarlanabilir.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Bot kanalı görebilir mi kontrol et
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    const permissions = targetChannel.permissionsFor(botMember);
    
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
      return ctx.reply({
        content: `❌ **YETKİ HATASI!** Bot ${targetChannel.name} kanalında mesaj gönderemez. Gerekli izinler: Kanalı Görüntüle, Mesaj Gönder, Bağlantı Yerleştir.`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Unjail log kanal ayarını kaydet
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
      
      config[ctx.guild.id].unjailLogChannelId = targetChannel.id;
      config[ctx.guild.id].unjailLogChannelName = targetChannel.name;
      config[ctx.guild.id].unjailLogSetBy = executor.user.id;
      config[ctx.guild.id].unjailLogSetAt = Date.now();
      
      // Config'i kaydet
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log(`✅ Unjail log kanalı ayarlandı: ${ctx.guild.name} -> #${targetChannel.name}`);

      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Unjail Log Kanalı Ayarlandı')
        .setDescription(`**#${targetChannel.name}** kanalı unjail log sistemi için başarıyla ayarlandı.`)
        .addFields(
          {
            name: '📝 Ayarlanan Kanal',
            value: `#${targetChannel.name} (\`${targetChannel.id}\`)`,
            inline: true
          },
          {
            name: '👮 Ayarlayan Yetkili',
            value: `${executor.user.tag}`,
            inline: true
          },
          {
            name: '⚙️ Kullanım',
            value: 'Artık tüm unjail işlemleri bu kanala loglanacak.',
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setTimestamp();

      await ctx.reply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral
      });

      // Test mesajı gönder
      try {
        const testEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🔓 Unjail Log Sistemi Aktif')
          .setDescription('Bu kanal artık unjail işlemleri için log kanalı olarak ayarlandı.')
          .addFields({
            name: '📋 Loglanacak İşlemler',
            value: '• Kullanıcıların jail\'den çıkarılması\n• Manuel ve otomatik unjail işlemleri\n• Verilen roller ve yetkili bilgileri\n• Detaylı işlem zamanları',
            inline: false
          })
          .setFooter({ 
            text: `Ayarlayan: ${executor.user.tag}`,
            iconURL: executor.user.displayAvatarURL()
          })
          .setTimestamp();

        await targetChannel.send({ embeds: [testEmbed] });
      } catch (testError) {
        console.log('⚠️ Test mesajı gönderilemedi:', testError.message);
      }

    } catch (error) {
      console.error('Unjail log kanalı ayarlama hatası:', error);
      return ctx.reply({
        content: '❌ Unjail log kanalı ayarlanırken bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};