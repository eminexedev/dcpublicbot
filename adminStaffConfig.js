const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'adminStaffConfig.json');

// Config dosyasını yükle
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('adminStaffConfig.json yüklenirken hata:', error);
        return {};
    }
}

// Config dosyasını kaydet
function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('adminStaffConfig.json kaydedilirken hata:', error);
        return false;
    }
}

// Sunucu için yetkili rolleri al
function getStaffRoles(guildId) {
    const config = loadConfig();
    return config[guildId]?.staffRoles || [];
}

// Sunucu için yetkili rolleri ayarla
function setStaffRoles(guildId, roleIds) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {};
    }
    config[guildId].staffRoles = roleIds;
    return saveConfig(config);
}

// Sunucu için yetkili rol ekle
function addStaffRole(guildId, roleId) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {};
    }
    if (!config[guildId].staffRoles) {
        config[guildId].staffRoles = [];
    }
    
    // Zaten varsa ekleme
    if (!config[guildId].staffRoles.includes(roleId)) {
        config[guildId].staffRoles.push(roleId);
        return saveConfig(config);
    }
    return true;
}

// Sunucu için yetkili rol kaldır
function removeStaffRole(guildId, roleId) {
    const config = loadConfig();
    if (!config[guildId] || !config[guildId].staffRoles) {
        return true;
    }
    
    config[guildId].staffRoles = config[guildId].staffRoles.filter(id => id !== roleId);
    return saveConfig(config);
}

// Kullanıcının yetkili olup olmadığını kontrol et
function isUserStaff(member) {
    const guildId = member.guild.id;
    const staffRoles = getStaffRoles(guildId);
    
    return member.roles.cache.some(role => staffRoles.includes(role.id));
}

module.exports = {
    getStaffRoles,
    setStaffRoles,
    addStaffRole,
    removeStaffRole,
    isUserStaff
};