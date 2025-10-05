const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../statsData.json');

function loadStats() {
	if (!fs.existsSync(statsPath)) return {};
	return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

function saveStats(data) {
	fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
}

function ensureGuild(stats, guildId) {
	if (!stats[guildId]) {
		stats[guildId] = {}; 
	}
	if (!stats[guildId].channels || typeof stats[guildId].channels !== 'object') stats[guildId].channels = {};
	if (!stats[guildId].users || typeof stats[guildId].users !== 'object') stats[guildId].users = {};
	if (!stats[guildId].voiceChannels || typeof stats[guildId].voiceChannels !== 'object') stats[guildId].voiceChannels = {};
	if (!stats[guildId].voiceUsers || typeof stats[guildId].voiceUsers !== 'object') stats[guildId].voiceUsers = {};
	if (!stats[guildId].userChannelMessages || typeof stats[guildId].userChannelMessages !== 'object') stats[guildId].userChannelMessages = {};
	return stats[guildId];
}

module.exports = (client) => {
	// SADECE MESAJ TAKİBİ BIRAKILDI. Voice istatistikleri artık events/voiceStats.js tarafından yönetiliyor.
	client.on('messageCreate', (msg) => {
		if (!msg.guild || msg.author.bot) return;
		if (msg.content.startsWith('!') || msg.content.startsWith('/') || msg.content.startsWith('.')) return;
		if (msg.content.trim().length === 0) return;

		let stats = loadStats();
		const gStats = ensureGuild(stats, msg.guild.id);
		// Koruma: beklenmedik tipte ise yeniden objeye çevir
		if (typeof gStats.channels !== 'object') gStats.channels = {};
		if (typeof gStats.users !== 'object') gStats.users = {};
		gStats.channels[msg.channel.id] = (gStats.channels[msg.channel.id] || 0) + 1;
		gStats.users[msg.author.id] = (gStats.users[msg.author.id] || 0) + 1;
		// Kullanıcı bazlı kanal mesaj sayacı
		if (!gStats.userChannelMessages[msg.author.id] || typeof gStats.userChannelMessages[msg.author.id] !== 'object') {
			gStats.userChannelMessages[msg.author.id] = {};
		}
		gStats.userChannelMessages[msg.author.id][msg.channel.id] = (gStats.userChannelMessages[msg.author.id][msg.channel.id] || 0) + 1;
		try {
			saveStats(stats);
		} catch (e) {
			console.error('[StatsTracker] saveStats hata:', e.message);
		}
	});
};
