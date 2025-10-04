const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, 'registrationStats.json');

// Kayıt istatistiklerini yükle
function loadRegistrationStats() {
  try {
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Kayıt istatistikleri yüklenirken hata:', error);
    return {};
  }
}

// Kayıt istatistiklerini kaydet
function saveRegistrationStats(stats) {
  try {
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    return true;
  } catch (error) {
    console.error('Kayıt istatistikleri kaydedilirken hata:', error);
    return false;
  }
}

// Sunucu için kayıt istatistiklerini al
function getRegistrationStats(guildId) {
  const stats = loadRegistrationStats();
  return stats[guildId] || {
    totalRegistrations: 0,
    maleRegistrations: 0,
    femaleRegistrations: 0,
    registrarStats: {}, // { userId: count }
    registeredMembers: [], // { userId, userName, gender, registrarId, timestamp }
    lastUpdated: Date.now()
  };
}

// Kayıt yapıldığında istatistikleri güncelle
function addRegistration(guildId, registrarId, gender, userId, userName) {
  const allStats = loadRegistrationStats();
  
  if (!allStats[guildId]) {
    allStats[guildId] = {
      totalRegistrations: 0,
      maleRegistrations: 0,
      femaleRegistrations: 0,
      registrarStats: {},
      registeredMembers: [],
      lastUpdated: Date.now()
    };
  }
  
  const guildStats = allStats[guildId];
  
  // Toplam kayıt sayısını artır
  guildStats.totalRegistrations++;
  
  // Cinsiyet istatistiklerini güncelle
  if (gender === 'erkek') {
    guildStats.maleRegistrations++;
  } else if (gender === 'kadin') {
    guildStats.femaleRegistrations++;
  }
  
  // Yetkili istatistiklerini güncelle
  if (!guildStats.registrarStats[registrarId]) {
    guildStats.registrarStats[registrarId] = 0;
  }
  guildStats.registrarStats[registrarId]++;
  
  // Kayıt edilen üye verilerini ekle
  if (!guildStats.registeredMembers) {
    guildStats.registeredMembers = [];
  }
  
  guildStats.registeredMembers.push({
    userId: userId,
    userName: userName,
    gender: gender,
    registrarId: registrarId,
    timestamp: Date.now()
  });
  
  // Son 100 kayıt ile sınırla (performans için)
  if (guildStats.registeredMembers.length > 100) {
    guildStats.registeredMembers = guildStats.registeredMembers.slice(-100);
  }
  
  // Son güncelleme zamanını ayarla
  guildStats.lastUpdated = Date.now();
  
  return saveRegistrationStats(allStats);
}

// En çok kayıt yapan yetkililer listesi
function getTopRegistrars(guildId, limit = 10) {
  const stats = getRegistrationStats(guildId);
  const registrarArray = Object.entries(stats.registrarStats)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return registrarArray;
}

// Son kayıt edilen üyeler listesi
function getRecentRegistrations(guildId, limit = 10) {
  const stats = getRegistrationStats(guildId);
  if (!stats.registeredMembers || stats.registeredMembers.length === 0) {
    return [];
  }
  
  return stats.registeredMembers
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// İstatistikleri sıfırla
function resetRegistrationStats(guildId) {
  const allStats = loadRegistrationStats();
  if (allStats[guildId]) {
    delete allStats[guildId];
    return saveRegistrationStats(allStats);
  }
  return true;
}

module.exports = {
  getRegistrationStats,
  addRegistration,
  getTopRegistrars,
  getRecentRegistrations,
  resetRegistrationStats
};