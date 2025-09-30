const fs = require('fs');
const path = require('path');
const statsPath = path.join(__dirname, '../statsData.json');

// Aktif ses verilerini tutacak Map
const activeVoiceStates = new Map();

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
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!oldState.guild || !newState.guild) return;
        const user = newState.member;
        if (!user || user.user.bot) return;

        const guildId = newState.guild.id;
        const userId = user.id;
        const stats = loadStats();
        ensureGuildStats(stats, guildId);

        // Ses kanalından ayrılma
        if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
            const state = activeVoiceStates.get(userId);
            if (state && state.joinTime) {
                const duration = Math.floor((Date.now() - state.joinTime) / 1000);
                
                if (oldState.channelId === oldState.guild.afkChannelId) {
                    stats[guildId].afkVoiceUsers[userId] = (stats[guildId].afkVoiceUsers[userId] || 0) + duration;
                } else {
                    stats[guildId].voiceUsers[userId] = (stats[guildId].voiceUsers[userId] || 0) + duration;
                    stats[guildId].voiceChannels[oldState.channelId] = (stats[guildId].voiceChannels[oldState.channelId] || 0) + duration;
                }
                saveStats(stats);
                activeVoiceStates.delete(userId);
            }
        }

        // Ses kanalına girme
        if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
            activeVoiceStates.set(userId, {
                joinTime: Date.now(),
                channelId: newState.channelId,
                guildId: guildId
            });
        }
    });

    // Bot kapanırken aktif ses verilerini kaydet
    process.on('SIGINT', () => {
        const stats = loadStats();
        for (const [userId, state] of activeVoiceStates) {
            if (state.joinTime) {
                const duration = Math.floor((Date.now() - state.joinTime) / 1000);
                const guild = client.guilds.cache.get(state.guildId);
                if (guild) {
                    ensureGuildStats(stats, state.guildId);
                    if (state.channelId === guild.afkChannelId) {
                        stats[state.guildId].afkVoiceUsers[userId] = (stats[state.guildId].afkVoiceUsers[userId] || 0) + duration;
                    } else {
                        stats[state.guildId].voiceUsers[userId] = (stats[state.guildId].voiceUsers[userId] || 0) + duration;
                        stats[state.guildId].voiceChannels[state.channelId] = (stats[state.guildId].voiceChannels[state.channelId] || 0) + duration;
                    }
                }
            }
        }
        saveStats(stats);
        process.exit(0);
    });
};
