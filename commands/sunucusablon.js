const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const https = require('https');

async function getTemplateData(templateCode) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://discord.com/api/v10/guilds/templates/${templateCode}`, {
      headers: {
        'User-Agent': 'DiscordBot (https://discord.js.org, 1.0.0)'
      }
    });

    req.on('response', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Şablon bulunamadı veya erişilemedi.'));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Template kodu çıkart
function extractTemplateCode(link) {
  if (!link) return null;
  const templateRegex = /discord\.(?:com|new)\/template\/([a-zA-Z0-9]+)/;
  const match = link.match(templateRegex);
  return match ? match[1] : null;
}

// Mesaj gönderme yardımcı fonksiyonu 
async function sendMessage(interaction, content, isEphemeral = true) {
  try {
    // Eğer slash komut ise ve henüz cevap verilmemişse
    if (interaction.isChatInputCommand) {
      // Eğer defer edilmişse, editReply kullan
      if (interaction.deferred) {
        return await interaction.editReply({ content });
      }
      // Eğer zaten cevap verilmişse, followUp kullan
      if (interaction.replied) {
        return await interaction.followUp({ content, ephemeral: isEphemeral });
      }
      // İlk cevap ise normal reply kullan
      return await interaction.reply({ content, ephemeral: isEphemeral });
    }
    
    // Legacy komut ise
    if (interaction.author && interaction.channel) {
      return await interaction.channel.send(content);
    }
  } catch (err) {
    console.error('Mesaj gönderme hatası:', err);
  }
}

// Rol temizleme
async function deleteExistingRoles(guild, interaction) {
  await guild.roles.fetch();
  const roles = guild.roles.cache.filter(r => r.name !== '@everyone');
  const botMember = guild.members.me;
  const botRole = botMember ? botMember.roles.highest : null;

  const deletableRoles = [];
  const undeletableRoles = [];

  for (const role of roles.values()) {
    let reason = '';
    if (role.managed) {
      reason = 'Discord tarafından yönetilen (managed/integration) rol';
    } else if (botRole && role.position > botRole.position) {
      reason = 'Botun rolü bu rolden aşağıda';
    } else if (!role.editable) {
      reason = 'Botun rolü bu rolü düzenleyemiyor';
    }

    if (reason) {
      undeletableRoles.push({ name: role.name, id: role.id, reason });
    } else {
      deletableRoles.push(role);
    }
  }

  if (deletableRoles.length === 0) {
    if (undeletableRoles.length > 0) {
      const undeletableArr = undeletableRoles.map(r => `${r.name} (ID: ${r.id}) - ${r.reason}`);
      await sendMessage(interaction, `❌ Silinemeyen roller:\n${undeletableArr.join('\n')}`, false);
    } else {
      await sendMessage(interaction, 'Tüm roller temizlendi!', false);
    }
    return;
  }

  await sendMessage(interaction, `${deletableRoles.length} rol siliniyor...`, false);

  for (const role of deletableRoles) {
    try {
      await role.delete('Toplu silme işlemi');
      console.log(`${role.name} silindi`);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit için 1 sn bekle
    } catch (err) {
      if (err.message && err.message.includes('Unknown Role')) {
        // Discord'da rol zaten silinmiş, kullanıcıya tekrar bildirme
        console.warn(`Rol zaten silinmiş: ${role.name} (ID: ${role.id})`);
      } else {
        console.error(`Rol silme hatası (${role.name} - ID: ${role.id}):`, err);
        await sendMessage(interaction, `❌ ${role.name} silinemedi: ${err.message}`, false);
      }
    }
  }

  if (undeletableRoles.length > 0) {
    const undeletableArr = undeletableRoles.map(r => `${r.name} (ID: ${r.id}) - ${r.reason}`);
    await sendMessage(interaction, `⚠ Bazı roller silinemedi:\n${undeletableArr.join('\n')}`, false);
  }

  await sendMessage(interaction, '✅ İşlem tamamlandı.', false);
}

// Yeni rol oluşturma
async function createNewRoles(guild, templateRoles, interaction) {
  const roleMap = new Map();
  // Discord'da roller en üstten alta doğru sıralanır, bu yüzden ters sırada oluşturulmalı
  const rolesToCreate = Object.values(templateRoles)
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => (a.position || 0) - (b.position || 0)); // Küçükten büyüğe (en üstteki en son)

  let createdCount = 0;
  const totalRoles = rolesToCreate.length;
  const failedRoles = [];
  const createdRoles = [];

  for (const role of rolesToCreate) {
    try {
      console.log(`[ROL OLUŞTURMA] Sıradaki rol: ${role.name}`);
      await guild.roles.fetch();
      if (guild.roles.cache.size >= 250) {
        throw new Error(`Maksimum rol sayısına ulaşıldı! (${createdCount}/${totalRoles} rol oluşturuldu)`);
      }

      const roleData = {
        name: role.name,
        hoist: role.hoist || false,
        permissions: BigInt(role.permissions || 0),
        mentionable: role.mentionable || false
      };
      if (
        typeof role.color === 'number' &&
        !isNaN(role.color) &&
        isFinite(role.color)
      ) {
        roleData.color = role.color;
      }

      // 10 saniye timeout ile rol oluşturma
      const newRole = await Promise.race([
        guild.roles.create(roleData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Rol oluşturma 10 saniyeden uzun sürdü (timeout)')), 10000))
      ]);

      roleMap.set(role.id, newRole.id);
      createdRoles.push({ newRole, position: role.position });
      createdCount++;
      console.log(`[ROL OLUŞTURMA] Başarılı: ${role.name} (${createdCount}/${totalRoles})`);
      if (createdCount % 5 === 0 || createdCount === totalRoles) {
        await sendMessage(interaction, `${createdCount}/${totalRoles} rol oluşturuldu...`, false);
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[ROL OLUŞTURMA HATASI] ${role.name}:`, err);
      failedRoles.push({ name: role.name, reason: err.message });
      await sendMessage(interaction, `❌ ${role.name} rolü oluşturulamadı: ${err.message}`, false);
      // Devam et, döngüyü kırma
    }
  }

  // Roller oluşturulduktan sonra pozisyonları ayarla (en üstten alta doğru)
  try {
    // Sadece yeni oluşturulan rollerin pozisyonunu ayarla
    const sorted = createdRoles.sort((a, b) => (b.position || 0) - (a.position || 0));
    let pos = guild.roles.cache.get(guild.roles.everyone.id).position + 1;
    for (const { newRole, position } of sorted) {
      await newRole.setPosition(pos);
      pos++;
    }
  } catch (e) {
    console.error('Rol pozisyonları ayarlanırken hata:', e);
  }

  if (failedRoles.length > 0) {
    const failedList = failedRoles.map(r => `${r.name} - ${r.reason}`).join('\n');
    await sendMessage(interaction, `⚠ Oluşturulamayan roller:\n${failedList}`, false);
  }

  await sendMessage(interaction, `✅ Rol oluşturma tamamlandı. Başarılı: ${createdCount}, Hatalı: ${failedRoles.length}`, false);
  return roleMap;
}

// Kanal silme
async function deleteChannels(guild, currentChannelId, interaction) {
  const channels = guild.channels.cache
    .filter(channel => channel.deletable && channel.id !== currentChannelId);
  
  for (const channel of channels.values()) {
    try {
      await channel.delete();
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Kanal silme hatası (${channel.name}):`, err);
    }
  }
  
  await new Promise(r => setTimeout(r, 3000));
}

// Kanal oluşturma
async function createChannels(guild, templateData, roleMap, interaction) {
  // Önce kategorileri oluştur
  const categories = templateData.channels
    .filter(channel => channel.type === 4)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  
  const categoryMap = new Map();
  
  for (const category of categories) {
    try {
      const newCategory = await guild.channels.create({
        name: category.name,
        type: category.type,
        position: category.position || 0,
        permissionOverwrites: category.permission_overwrites?.map(overwrite => ({
          id: overwrite.type === 0 ? roleMap.get(overwrite.id) || guild.roles.everyone.id : overwrite.id,
          type: overwrite.type,
          allow: BigInt(overwrite.allow || 0),
          deny: BigInt(overwrite.deny || 0)
        })) || []
      });
      
      categoryMap.set(category.id, newCategory.id);
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`Kategori oluşturma hatası (${category.name}):`, err);
    }
  }
  
  // Sonra diğer kanalları oluştur
  const channels = templateData.channels
    .filter(channel => channel.type !== 4)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  
  for (const channel of channels) {
    try {
      await guild.channels.create({
        name: channel.name,
        type: channel.type,
        position: channel.position || 0,
        parent: channel.parent_id ? categoryMap.get(channel.parent_id) : null,
        topic: channel.topic,
        nsfw: channel.nsfw || false,
        rateLimitPerUser: channel.rate_limit_per_user || 0,
        permissionOverwrites: channel.permission_overwrites?.map(overwrite => ({
          id: overwrite.type === 0 ? roleMap.get(overwrite.id) || guild.roles.everyone.id : overwrite.id,
          type: overwrite.type,
          allow: BigInt(overwrite.allow || 0),
          deny: BigInt(overwrite.deny || 0)
        })) || []
      });
      
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`Kanal oluşturma hatası (${channel.name}):`, err);
    }
  }
}

// Ana modül
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sunucusablon')
    .setDescription('Sunucu şablonunu uygular')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Uygulanacak şablonun linki')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  async execute(interactionOrMessage, args) {
    try {
      if (!interactionOrMessage.guild) {
        return await sendMessage(interactionOrMessage, 'Bu komut sadece sunucularda kullanılabilir!', true);
      }

      const guild = await interactionOrMessage.guild.fetch();
      const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

      if (guild.ownerId !== userId) {
        return await sendMessage(interactionOrMessage, 'Bu komutu sadece sunucu sahibi kullanabilir!', true);
      }

      const link = interactionOrMessage.isChatInputCommand ? 
        interactionOrMessage.options.getString('link') : 
        (Array.isArray(args) ? args[0] : null);

      if (!link) {
        return await sendMessage(interactionOrMessage, 'Lütfen bir şablon linki girin!', true);
      }

      const templateCode = extractTemplateCode(link);
      if (!templateCode) {
        return await sendMessage(interactionOrMessage, 'Geçersiz şablon linki!', true);
      }

      if (interactionOrMessage.isChatInputCommand) {
        await interactionOrMessage.deferReply();
      }
      await sendMessage(interactionOrMessage, 'Sunucu temizleniyor: Tüm kanallar ve roller siliniyor...', false);

      // 1. AŞAMA: Tüm kanalları sil
      await deleteChannels(guild, interactionOrMessage.channel.id, interactionOrMessage);
      await sendMessage(interactionOrMessage, 'Tüm kanallar silindi, roller siliniyor...', false);

      // 2. AŞAMA: Tüm rolleri sil

      try {
        await deleteExistingRoles(guild, interactionOrMessage);
        await sendMessage(interactionOrMessage, 'Tüm roller silindi, şablon uygulanıyor...', false);
      } catch (err) {
        await sendMessage(interactionOrMessage, `❌ Roller silinemedi: ${err.message}`, false);
        return;
      }

      // 3. AŞAMA: Şablonu kontrol et
      await sendMessage(interactionOrMessage, 'Şablon kontrol ediliyor...', false);
      const templateData = await getTemplateData(templateCode);

      if (!templateData || !templateData.serialized_source_guild) {
        throw new Error('Şablon verisi geçersiz veya eksik!');
      }

      // 4. AŞAMA: Yeni rolleri oluştur
      await sendMessage(interactionOrMessage, 'Yeni roller oluşturuluyor...', false);
      const roleMap = await createNewRoles(guild, templateData.serialized_source_guild.roles, interactionOrMessage);
      await new Promise(r => setTimeout(r, 3000));

      // 5. AŞAMA: Yeni kanalları oluştur
      await sendMessage(interactionOrMessage, 'Yeni kanallar oluşturuluyor...', false);
      await createChannels(guild, templateData.serialized_source_guild, roleMap, interactionOrMessage);

      await sendMessage(interactionOrMessage, ' > ✅ Şablon başarıyla uygulandı! ', false);

    } catch (err) {
      console.error('Şablon uygulama hatası:', err);
      await sendMessage(interactionOrMessage, `❌ Hata: ${err.message}`, false);
    }
  }
};
