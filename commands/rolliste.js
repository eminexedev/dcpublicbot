const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const https = require('https');

async function fetchTemplate(templateUrl) {
  try {
    const url = new URL(templateUrl);
    if (!url.protocol.startsWith('https')) {
      throw new Error('Sadece HTTPS URL\'leri kabul edilir.');
    }
  } catch (error) {
    throw new Error('Geçersiz URL formatı.');
  }

  return new Promise((resolve, reject) => {
    const request = https.get(templateUrl, {
      headers: {
        'User-Agent': 'Discord-Bot'
      },
      timeout: 5000
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Sunucu yanıt kodu: ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          // Veriyi parse etmeden önce kontrol
          if (!data || data.trim().length === 0) {
            return reject(new Error('Sunucudan boş yanıt alındı.'));
          }

          let parsedData;
          try {
            parsedData = JSON.parse(data);
          } catch (e) {
            console.error('Ham veri:', data.substring(0, 100)); // İlk 100 karakteri logla
            return reject(new Error('JSON ayrıştırma hatası. Sunucudan gelen yanıt JSON formatında değil.'));
          }

          if (!parsedData.roles || !Array.isArray(parsedData.roles)) {
            return reject(new Error('Geçersiz şablon yapısı. Şablonda "roles" dizisi bulunamadı.'));
          }

          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Veri işleme hatası: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Bağlantı hatası: ${error.message}`));
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Bağlantı zaman aşımına uğradı (5 saniye).'));
    });
  });
}

async function compareRoles(guild, template) {
  // Şablon rolleri (position değerine göre büyükten küçüğe sırala)
  const templateRoles = template.roles.sort((a, b) => b.position - a.position);
  
  // Sunucudaki roller (pozisyona göre büyükten küçüğe)
  const guildRoles = Array.from(guild.roles.cache.values())
    .sort((a, b) => b.position - a.position);

  const templateEmbed = new EmbedBuilder()
    .setTitle('📋 Şablon Rolleri (Yukarıdan Aşağıya)')
    .setDescription(templateRoles.map((role, index) => 
      `${index + 1}. ${role.name} (Pozisyon: ${role.position})`
    ).join('\n'))
    .setColor('Blue');

  const guildEmbed = new EmbedBuilder()
    .setTitle('🎭 Sunucu Rolleri (Yukarıdan Aşağıya)')
    .setDescription(guildRoles.map((role, index) => 
      `${index + 1}. ${role.name} (Pozisyon: ${role.position})`
    ).join('\n'))
    .setColor('Green');

  return { templateEmbed, guildEmbed };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolliste')
    .setDescription('Şablon ve sunucudaki rolleri sıralarıyla listeler.')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('JSON şablon dosyasının URL\'si')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(ctx) {
    let url, guild, reply;
    if (ctx.options && ctx.options.getString) {
      url = ctx.options.getString('url');
      guild = ctx.guild;
      reply = async (embeds) => ctx.reply({ embeds, ephemeral: true });
    } else if (ctx.message) {
      if (!ctx.args[0]) return ctx.channel.send('Kullanım: .rolliste [şablon JSON URL]');
      url = ctx.args[0];
      guild = ctx.guild;
      reply = async (embeds) => ctx.channel.send({ embeds });
    } else {
      return;
    }

    try {
      const template = await fetchTemplate(url);
      const { templateEmbed, guildEmbed } = await compareRoles(guild, template);

      // Sıralama uyarısı
      const warningEmbed = new EmbedBuilder()
        .setTitle('⚠️ Sıralama Bilgisi')
        .setDescription(
          'Not: Şablon uygulanırken roller yukarıdan aşağıya doğru oluşturulmalı.\n' +
          'Yüksek pozisyonlu roller önce oluşturulmazsa, sıralama hatalı olabilir.\n' +
          'Örnek sıra: Admin > Moderatör > Üye'
        )
        .setColor('Yellow');

      await reply([templateEmbed, guildEmbed, warningEmbed]);
    } catch (err) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Hata')
        .setDescription(err.message)
        .setColor('Red');
      
      await reply([errorEmbed]);
    }
  }
};