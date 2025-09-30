const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../statsData.json');

function loadStats(guildId) {
	if (!fs.existsSync(statsPath)) return null;
	const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
	return stats[guildId] || null;
}

function formatTime(sec) {
	if (!sec) return '0 saniye';
	const d = Math.floor(sec / 86400);
	const h = Math.floor((sec % 86400) / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	let str = '';
	if (d) str += `${d} gün `;
	if (h) str += `${h} saat `;
	if (m) str += `${m} dakika `;
	if (s && !d && !h) str += `${s} saniye`;
	return str.trim();
}

function formatMsg(val) {
	return val ? `${val} mesaj` : 'Veri yok';
}

function formatVoice(val) {
	return val ? formatTime(val) : 'Veri yok';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('statembed')
		.setDescription('Sunucu istatistiklerini embed olarak gösterir.'),
	async execute(ctx) {
		let guild, user, reply;
		if (ctx.isChatInputCommand && ctx.isChatInputCommand()) {
			guild = ctx.guild;
			user = ctx.user;
			reply = (data) => ctx.reply(data);
		} else if (ctx.message) {
			guild = ctx.guild;
			user = ctx.message.author;
			reply = (data) => ctx.message.reply(data);
		} else {
			return;
		}

		try {
			await guild.channels.fetch();
			await guild.members.fetch();
		} catch (e) {}

		const stats = loadStats(guild.id);
		if (!stats) return reply('İstatistik verisi bulunamadı.');

		const member = guild.members.cache.get(user.id);
		const username = member ? member.displayName : user.username;
		const avatarURL = user.displayAvatarURL({ extension: 'png', size: 128 });

		// Kullanıcıya özel mesaj ve ses verileri
		const userMsgCount = stats.users?.[user.id] || 0;
		const userVoiceSec = stats.voiceUsers?.[user.id] || 0;

		// En çok mesaj atılan kanal
		const topMsgChannelEntry = Object.entries(stats.channels || {}).sort((a, b) => b[1] - a[1])[0];
		const topMsgChannelId = topMsgChannelEntry?.[0];
		const topMsgChannel = topMsgChannelId ? guild.channels.cache.get(topMsgChannelId) : null;
		const topMsgChannelName = topMsgChannel ? `#${topMsgChannel.name}` : (topMsgChannelId ? `#silinmiş-kanal (${topMsgChannelId})` : 'Veri yok');
		const topMsgChannelCount = topMsgChannelEntry?.[1] || 0;

		// En çok sesde kalınan kanal
		const topVoiceChannelEntry = Object.entries(stats.voiceChannels || {}).sort((a, b) => b[1] - a[1])[0];
		const topVoiceChannelId = topVoiceChannelEntry?.[0];
		const topVoiceChannel = topVoiceChannelId ? guild.channels.cache.get(topVoiceChannelId) : null;
		const topVoiceChannelName = topVoiceChannel ? `🔊 ${topVoiceChannel.name}` : (topVoiceChannelId ? `🔊 silinmiş-kanal (${topVoiceChannelId})` : 'Veri yok');
		const topVoiceChannelSec = topVoiceChannelEntry?.[1] || 0;

		// AFK kanalında geçirilen süre (kullanıcıya özel)
		let userAfkSec = 0;
		let afkChannelName = 'Yok';
		const afkChannelId = guild.afkChannelId;
		if (afkChannelId) {
			const afkChannel = guild.channels.cache.get(afkChannelId);
			afkChannelName = afkChannel ? `🔕 ${afkChannel.name}` : `🔕 silinmiş-kanal (${afkChannelId})`;
			if (stats.afkVoiceUsers && typeof stats.afkVoiceUsers[user.id] === 'number') {
				userAfkSec = stats.afkVoiceUsers[user.id];
			}
		}

		const embed = new EmbedBuilder()
			.setAuthor({ name: `${username} (${user.id}) üyesinin istatistikleri`, iconURL: avatarURL })
			.setColor('#5865F2')
			.addFields(
				{
					name: 'Mesaj Bilgileri',
					value:
						`Toplam Mesaj: **${userMsgCount}**\n` +
						`En Aktif Kanal: ${topMsgChannelName} (${topMsgChannelCount ? topMsgChannelCount + ' mesaj' : 'Veri yok'})`
				},
				{
					name: 'Ses Bilgileri',
					value:
						`Toplam Ses: **${formatTime(userVoiceSec)}**\n` +
						`En Aktif Ses Kanalı: ${topVoiceChannelName} (${topVoiceChannelSec ? formatTime(topVoiceChannelSec) : 'Veri yok'})`
				},
				{
					name: 'AFK Kanalı',
					value: `${afkChannelName} (AFK)\nKullanıcı AFK Süresi: ${userAfkSec ? formatTime(userAfkSec) : 'Veri yok'}`
				}
			)
			.setFooter({ text: 'Detaylı istatistik için .stat yazınız.' });

		await reply({ embeds: [embed] });
	}
};
