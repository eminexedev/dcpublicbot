const fs = require('fs');
const path = require('path');

const templatesPath = path.join(__dirname, 'serverTemplates.json');

// Sunucu şablonlarını yükle
function loadServerTemplates() {
  try {
    if (fs.existsSync(templatesPath)) {
      const data = fs.readFileSync(templatesPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Sunucu şablonları yüklenirken hata:', error);
    return {};
  }
}

// Sunucu şablonlarını kaydet
function saveServerTemplates(templates) {
  try {
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
    return true;
  } catch (error) {
    console.error('Sunucu şablonları kaydedilirken hata:', error);
    return false;
  }
}

// Sunucu şablonu kaydet
function saveServerTemplate(guildId, templateData) {
  const templates = loadServerTemplates();
  
  templates[guildId] = {
    ...templateData,
    createdAt: Date.now(),
    lastUpdated: Date.now()
  };
  
  return saveServerTemplates(templates);
}

// Sunucu şablonunu al
function getServerTemplate(guildId) {
  const templates = loadServerTemplates();
  return templates[guildId] || null;
}

// Tüm şablonları al
function getAllTemplates() {
  return loadServerTemplates();
}

// Şablonu sil
function deleteServerTemplate(guildId) {
  const templates = loadServerTemplates();
  if (templates[guildId]) {
    delete templates[guildId];
    return saveServerTemplates(templates);
  }
  return false;
}

// Kanal yapısını analiz et
function analyzeChannelStructure(guild) {
  const channels = [];
  const categories = [];
  
  guild.channels.cache.forEach(channel => {
    if (channel.type === 4) { // CategoryChannel
      categories.push({
        id: channel.id,
        name: channel.name,
        position: channel.position,
        permissions: channel.permissionOverwrites.cache.size > 10 ? 
          `${channel.permissionOverwrites.cache.size} özel izin` :
          channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
          }))
      });
    } else {
      channels.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parentId: channel.parentId,
        topic: channel.topic || null,
        nsfw: channel.nsfw || false,
        bitrate: channel.bitrate || null,
        userLimit: channel.userLimit || null,
        rateLimitPerUser: channel.rateLimitPerUser || null,
        permissions: channel.permissionOverwrites.cache.size > 5 ? 
          `${channel.permissionOverwrites.cache.size} özel izin` :
          channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
          }))
      });
    }
  });
  
  return { channels, categories };
}

// Rol yapısını analiz et
function analyzeRoleStructure(guild) {
  const roles = [];
  
  guild.roles.cache.forEach(role => {
    if (role.name !== '@everyone') { // @everyone rolünü dahil etme
      roles.push({
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable,
        managed: role.managed
      });
    }
  });
  
  return roles.sort((a, b) => b.position - a.position);
}

// Şablon kaydetme fonksiyonu
function saveServerTemplate(guildId, templateData) {
  try {
    // Data klasörünü oluştur
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Benzersiz ID oluştur
    templateData.id = Date.now().toString();
    templateData.createdAt = new Date().toISOString();
    
    // Mevcut şablonları yükle
    const templates = loadServerTemplates(guildId) || [];
    templates.push(templateData);
    
    // Dosyaya kaydet
    const filePath = path.join(dataDir, `serverTemplates_${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(templates, null, 2));
    
    return true;
  } catch (error) {
    console.error('Şablon kaydetme hatası:', error);
    return false;
  }
}

// Şablonları yükleme fonksiyonu
function loadServerTemplates(guildId) {
  try {
    const filePath = path.join(__dirname, 'data', `serverTemplates_${guildId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Şablon yükleme hatası:', error);
    return [];
  }
}

// Tek şablon getirme fonksiyonu
function getServerTemplate(guildId, templateId) {
  try {
    const templates = loadServerTemplates(guildId);
    return templates.find(t => t.id === templateId) || null;
  } catch (error) {
    console.error('Şablon getirme hatası:', error);
    return null;
  }
}

// Şablon silme fonksiyonu
function deleteServerTemplate(guildId, templateId) {
  try {
    const templates = loadServerTemplates(guildId) || [];
    const templateIndex = templates.findIndex(t => t.id === templateId);
    
    if (templateIndex === -1) {
      return false;
    }

    templates.splice(templateIndex, 1);
    
    const filePath = path.join(__dirname, 'data', `serverTemplates_${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(templates, null, 2));
    
    return true;
  } catch (error) {
    console.error('Şablon silme hatası:', error);
    return false;
  }
}

// Şablon güncelleme fonksiyonu
function updateServerTemplate(guildId, templateId, updates) {
  try {
    const templates = loadServerTemplates(guildId) || [];
    const templateIndex = templates.findIndex(t => t.id === templateId);
    
    if (templateIndex === -1) {
      return false;
    }

    // Güncelleme verilerini uygula
    templates[templateIndex] = {
      ...templates[templateIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const filePath = path.join(__dirname, 'data', `serverTemplates_${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(templates, null, 2));
    
    return true;
  } catch (error) {
    console.error('Şablon güncelleme hatası:', error);
    return false;
  }
}

// Tüm şablonları getir (eski fonksiyon adı uyumluluğu için)
function getAllTemplates(guildId) {
  return loadServerTemplates(guildId);
}

module.exports = {
  saveServerTemplate,
  loadServerTemplates,
  getServerTemplate,
  getAllTemplates,
  deleteServerTemplate,
  updateServerTemplate,
  analyzeChannelStructure,
  analyzeRoleStructure
};