const fs = require('fs');
const path = require('path');
const statsPath = path.join(__dirname, '../statsData.json');

// Aktif ses verilerini tutacak Map (client üzerinden erişim için)

function loadStats() {
    if (!fs.existsSync(statsPath)) {
        const defaultStats = {};
        fs.writeFileSync(statsPath, JSON.stringify(defaultStats, null, 2));
        return defaultStats;
    }
    return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

function saveStats(stats) {
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

function ensureGuildStats(stats, guildId) {
    if (!stats[guildId]) {
        stats[guildId] = {
            voiceChannels: {},
            voiceUsers: {},
            afkVoiceUsers: {}
        };
    }
    // Eksik alanları kontrol et
    if (!stats[guildId].voiceChannels) stats[guildId].voiceChannels = {};
    if (!stats[guildId].voiceUsers) stats[guildId].voiceUsers = {};
    if (!stats[guildId].afkVoiceUsers) stats[guildId].afkVoiceUsers = {};
}

// Aktif ses süresini hesapla
function getActiveVoiceTime(userId) {
    const state = activeVoiceStates.get(userId);
    if (!state || !state.joinTime) return 0;
    
    return Math.floor((Date.now() - state.joinTime) / 1000);
}

module.exports = (client) => {
    // Client üzerinde activeVoiceStates mapini oluşturuyoruz ki diğer dosyalardan erişilebilinsin
    client.activeVoiceStates = new Map();
    
    console.log('[Voice Stats] Module loaded and listening for voice events');
    
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!oldState.guild || !newState.guild) return;
        const user = newState.member;
        if (!user || user.user.bot) return;

        console.log(`[Voice] ${user.displayName || user.user.username} (${user.id}) voice state updated`);

        const guildId = newState.guild.id;
        const userId = user.id;
        const mapKey = `${guildId}-${userId}`;  // Benzersiz key kullanımı
        const stats = loadStats();
        ensureGuildStats(stats, guildId);

        // Ses kanalından ayrılma
        if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
            console.log(`[Voice] ${user.displayName || user.user.username} left channel ${oldState.channel?.name || oldState.channelId}`);
            
            const state = client.activeVoiceStates.get(mapKey);
            if (state && state.joinTime) {
                const totalDuration = Math.floor((Date.now() - state.joinTime) / 1000);
                // Daha önce periyodik flush ile kaydedilen kısmı çıkar
                const alreadyFlushed = state._flushed || 0;
                const duration = Math.max(0, totalDuration - alreadyFlushed);
                console.log(`[Voice] Duration in channel: ${duration} seconds`);
                
                if (oldState.channelId === oldState.guild.afkChannelId) {
                    // AFK kanalıysa afkVoiceUsers'a ekle
                    stats[guildId].afkVoiceUsers[userId] = (stats[guildId].afkVoiceUsers[userId] || 0) + duration;
                    console.log(`[Voice] Updated AFK time for ${user.displayName}: ${stats[guildId].afkVoiceUsers[userId]} seconds`);
                    
                    // AFK kanalını voiceChannels istatistiklerine ekle (varsa)
                    if (stats[guildId].afkVoiceData) {
                        stats[guildId].afkVoiceData[oldState.channelId] = (stats[guildId].afkVoiceData[oldState.channelId] || 0) + duration;
                    } else {
                        stats[guildId].afkVoiceData = {};
                        stats[guildId].afkVoiceData[oldState.channelId] = duration;
                    }
                } else {
                    // Normal ses kanalı verilerini güncelle
                    stats[guildId].voiceUsers[userId] = (stats[guildId].voiceUsers[userId] || 0) + duration;
                    stats[guildId].voiceChannels[oldState.channelId] = (stats[guildId].voiceChannels[oldState.channelId] || 0) + duration;
                    
                    console.log(`[Voice] Updated voice time for ${user.displayName}: ${stats[guildId].voiceUsers[userId]} seconds`);
                    console.log(`[Voice] Updated channel ${oldState.channel?.name || oldState.channelId}: ${stats[guildId].voiceChannels[oldState.channelId]} seconds`);
                    
                    // voiceData yapısını oluştur veya güncelle - tüm ses verilerini tutar
                    if (!stats[guildId].voiceData) {
                        stats[guildId].voiceData = {};
                    }
                    
                    // Kullanıcı bazlı ses kanal verileri
                    if (!stats[guildId].userVoiceData) {
                        stats[guildId].userVoiceData = {};
                    }
                    
                    if (!stats[guildId].userVoiceData[userId]) {
                        stats[guildId].userVoiceData[userId] = {};
                    }
                    
                    // Kullanıcı için kanal süresini güncelle
                    stats[guildId].userVoiceData[userId][oldState.channelId] = (stats[guildId].userVoiceData[userId][oldState.channelId] || 0) + duration;
                    
                    console.log(`[Voice] User ${user.displayName} in channel ${oldState.channel?.name || oldState.channelId}: ${stats[guildId].userVoiceData[userId][oldState.channelId]} seconds`);
                    
                    // Genel ses verileri
                    stats[guildId].voiceData[oldState.channelId] = (stats[guildId].voiceData[oldState.channelId] || 0) + duration;
                }
                
                // Değişiklikleri kaydet
                console.log('[Voice] Saving stats to file');
                saveStats(stats);
                client.activeVoiceStates.delete(mapKey);
            }
        }

        // Ses kanalına girme
        if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
            console.log(`[Voice] ${user.displayName || user.user.username} joined channel ${newState.channel?.name || newState.channelId}`);
            console.log(`[Voice] AFK status: ${newState.channelId === newState.guild.afkChannelId}`);
            
            client.activeVoiceStates.set(mapKey, {
                joinTime: Date.now(),
                channelId: newState.channelId,
                guildId: guildId,
                isAFK: newState.channelId === newState.guild.afkChannelId
            });
            
            // voiceSessions veri yapısı - kullanıcıların mevcut ses oturumlarını kaydet
            if (!stats[guildId].voiceSessions) {
                stats[guildId].voiceSessions = {};
            }
            
            if (!stats[guildId].voiceSessions[userId]) {
                stats[guildId].voiceSessions[userId] = [];
            }
            
            // Yeni oturum bilgisini ekle
            stats[guildId].voiceSessions[userId].push({
                channelId: newState.channelId,
                startTime: Date.now(),
                isAFK: newState.channelId === newState.guild.afkChannelId
            });
            
            // Değişiklikleri kaydet
            saveStats(stats);
            console.log(`[Voice] Session started for ${user.displayName || user.user.username}`);
        }
    });

    // Bot kapanırken aktif ses verilerini kaydet
    process.on('SIGINT', () => {
        const stats = loadStats();
        for (const [mapKey, state] of client.activeVoiceStates) {
            if (state.joinTime) {
                const duration = Math.floor((Date.now() - state.joinTime) / 1000);
                const guild = client.guilds.cache.get(state.guildId);
                if (guild) {
                    ensureGuildStats(stats, state.guildId);
                    const userId = mapKey.split('-')[1]; // guildId-userId formatından userId'yi al
                    
                    if (state.isAFK || state.channelId === guild.afkChannelId) {
                        // AFK kanalıysa afkVoiceUsers'a ekle
                        stats[state.guildId].afkVoiceUsers[userId] = (stats[state.guildId].afkVoiceUsers[userId] || 0) + duration;
                        
                        // AFK kanalını afkVoiceData'ya ekle (varsa)
                        if (!stats[state.guildId].afkVoiceData) stats[state.guildId].afkVoiceData = {};
                        stats[state.guildId].afkVoiceData[state.channelId] = (stats[state.guildId].afkVoiceData[state.channelId] || 0) + duration;
                    } else {
                        // Normal ses kanalı verileri
                        stats[state.guildId].voiceUsers[userId] = (stats[state.guildId].voiceUsers[userId] || 0) + duration;
                        stats[state.guildId].voiceChannels[state.channelId] = (stats[state.guildId].voiceChannels[state.channelId] || 0) + duration;
                        
                        // voiceData yapısını oluştur veya güncelle
                        if (!stats[state.guildId].voiceData) stats[state.guildId].voiceData = {};
                        stats[state.guildId].voiceData[state.channelId] = (stats[state.guildId].voiceData[state.channelId] || 0) + duration;
                    }
                }
            }
        }
        saveStats(stats);
        process.exit(0);
    });

    // Periyodik flush: aktif oturumları her 60 sn'de bir geçici olarak dosyaya yansıt
    setInterval(() => {
        const stats = loadStats();
        let changed = false;
        for (const [mapKey, state] of client.activeVoiceStates) {
            if (!state.joinTime) continue;
            const guildId = state.guildId;
            ensureGuildStats(stats, guildId);
            const userId = mapKey.split('-')[1];
            const duration = Math.floor((Date.now() - state.joinTime) / 1000);
            if (duration <= 0) continue;
            if (state.isAFK) {
                stats[guildId].afkVoiceUsers[userId] = (stats[guildId].afkVoiceUsers[userId] || 0) + duration - (state._flushed || 0);
            } else {
                stats[guildId].voiceUsers[userId] = (stats[guildId].voiceUsers[userId] || 0) + duration - (state._flushed || 0);
                stats[guildId].voiceChannels[state.channelId] = (stats[guildId].voiceChannels[state.channelId] || 0) + duration - (state._flushed || 0);
                // Kullanıcı bazlı kanal
                if (!stats[guildId].userVoiceData) stats[guildId].userVoiceData = {};
                if (!stats[guildId].userVoiceData[userId]) stats[guildId].userVoiceData[userId] = {};
                stats[guildId].userVoiceData[userId][state.channelId] = (stats[guildId].userVoiceData[userId][state.channelId] || 0) + duration - (state._flushed || 0);
            }
            state._flushed = duration; // Son flush'a kadar olan süreyi işaretle
            changed = true;
        }
        if (changed) {
            saveStats(stats);
            console.log('[Voice Flush] Aktif oturumlar periyodik güncellendi.');
        }
    }, 60 * 1000);
};
