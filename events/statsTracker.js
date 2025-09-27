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
	if (!stats[guildId]) stats[guildId] = { channels: {}, users: {}, voiceChannels: {}, voiceUsers: {} };
}

module.exports = (client) => {
	const userLastMessage = new Map();

	client.on('messageCreate', (msg) => {
		if (!msg.guild || msg.author.bot) return;

		const now = Date.now();
		const last = userLastMessage.get(msg.author.id);

		// 1. Spam süresi kontrolü (ör: 30 saniye)
		if (last && now - last.time < 30000) return;

		// 2. Aynı içerik kontrolü
		if (last && last.content === msg.content) return;

		// 3. Minimum uzunluk kontrolü
		if (msg.content.length < 3) return;

		// Geçtiyse kaydet
		userLastMessage.set(msg.author.id, { time: now, content: msg.content });

		const stats = loadStats();
		ensureGuild(stats, msg.guild.id);

		// Kanal mesaj sayısı
		stats[msg.guild.id].channels[msg.channel.id] = (stats[msg.guild.id].channels[msg.channel.id] || 0) + 1;
		// Kullanıcı mesaj sayısı
		stats[msg.guild.id].users[msg.author.id] = (stats[msg.guild.id].users[msg.author.id] || 0) + 1;

		saveStats(stats);
	});

	client.on('voiceStateUpdate', (oldState, newState) => {
		const user = newState.member || oldState.member;
		if (!user || !user.guild) return;
		const stats = loadStats(user.guild.id);
		ensureGuild(stats, user.guild.id);

		// Sadece gerçek kullanıcılar için
		if (user.user.bot) return;

		// AFK kanal ID'sini al
		const afkChannelId = user.guild.afkChannelId;

		// Kullanıcı bir kanala giriyorsa
		if (!oldState.channelId && newState.channelId) {
			user._joinVoice = Date.now();
			user._joinVoiceChannel = newState.channelId;
		}

		// Kullanıcı kanal değiştiriyorsa
		if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
			if (user._joinVoice && user._joinVoiceChannel) {
				const duration = Math.floor((Date.now() - user._joinVoice) / 1000);
				// Eski kanal AFK ise ayrı kaydet
				if (afkChannelId && oldState.channelId === afkChannelId) {
					stats.afkVoiceChannels = stats.afkVoiceChannels || {};
					stats.afkVoiceUsers = stats.afkVoiceUsers || {};
					stats.afkVoiceChannels[afkChannelId] = (stats.afkVoiceChannels[afkChannelId] || 0) + duration;
					stats.afkVoiceUsers[user.id] = (stats.afkVoiceUsers[user.id] || 0) + duration;
				} else {
					stats.voiceChannels[oldState.channelId] = (stats.voiceChannels[oldState.channelId] || 0) + duration;
					stats.voiceUsers[user.id] = (stats.voiceUsers[user.id] || 0) + duration;
				}
				saveStats(stats);
			}
			user._joinVoice = Date.now();
			user._joinVoiceChannel = newState.channelId;
		}

		// Kullanıcı kanaldan çıkıyorsa
		if (oldState.channelId && !newState.channelId && user._joinVoice && user._joinVoiceChannel) {
			const duration = Math.floor((Date.now() - user._joinVoice) / 1000);
			if (afkChannelId && oldState.channelId === afkChannelId) {
				stats.afkVoiceChannels = stats.afkVoiceChannels || {};
				stats.afkVoiceUsers = stats.afkVoiceUsers || {};
				stats.afkVoiceChannels[afkChannelId] = (stats.afkVoiceChannels[afkChannelId] || 0) + duration;
				stats.afkVoiceUsers[user.id] = (stats.afkVoiceUsers[user.id] || 0) + duration;
			} else {
				stats.voiceChannels[oldState.channelId] = (stats.voiceChannels[oldState.channelId] || 0) + duration;
				stats.voiceUsers[user.id] = (stats.voiceUsers[user.id] || 0) + duration;
			}
			saveStats(stats);
			user._joinVoice = null;
			user._joinVoiceChannel = null;
		}
	});
};
