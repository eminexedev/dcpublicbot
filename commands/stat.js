const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../statsData.json');

function loadStats(guildId) {
	if (!fs.existsSync(statsPath)) return null;
	const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
	return stats[guildId] || null;
}

function getTop(obj, mapFn, limit = 5) {
	return Object.entries(obj || {})
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(mapFn);
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Sunucu istatistiklerini görsel olarak gösterir.'),
	async execute(ctx) {
		let guild, reply, memberFetcher, user, targetUser;
		let mentionId = null;

		// Slash Command veya Message Command kontrolü
		if (ctx.type === 2 || ctx.commandType === 'CHAT_INPUT') { // Slash Command
			guild = ctx.guild;
			user = ctx.user;
			reply = (data) => ctx.reply(data);
			memberFetcher = (id) => guild.members.cache.get(id);
			targetUser = user;
		} else if (ctx.message) { // Message Command
			guild = ctx.guild;
			user = ctx.message.author;
			reply = (data) => ctx.message.reply(data);
			memberFetcher = (id) => guild.members.cache.get(id);

			// Güvenli args kontrolü
			const args = ctx.args || [];
			if (args.length > 0) {
				const mention = ctx.message.mentions.users.first();
				if (mention) {
					targetUser = mention;
				} else {
					// ID ile de destekle
					const possibleId = ctx.args[0].replace(/[<@!>]/g, '');
					const member = guild.members.cache.get(possibleId);
					if (member) {
						targetUser = member.user;
					} else {
						// Kullanıcıyı fetch ile getir (sunucuda değilse)
						try {
							const fetchedUser = await ctx.client.users.fetch(possibleId);
							if (fetchedUser) targetUser = fetchedUser;
						} catch {}
					}
				}
			}
			if (!targetUser) targetUser = user;
		} else {
			return;
		}

		try {
			await guild.channels.fetch();
			await guild.members.fetch();
		} catch (e) {}

		const stats = loadStats(guild.id);
		if (!stats) return reply('İstatistik verisi bulunamadı.');

		const member = guild.members.cache.get(targetUser.id);
		const username = member ? member.displayName : targetUser.username;
		// Avatar URL'sini düzelttik
		const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 128 }); // Parametreler güncellendi

		// --- İstatistik verileri hesaplama ---

		// AFK kanalında geçirilen süre (kullanıcıya özel)
		let userAfkSec = 0;
		let afkChannelName = 'Yok';
		const afkChannelId = guild.afkChannelId;
		if (afkChannelId) {
			const afkChannel = guild.channels.cache.get(afkChannelId);
			afkChannelName = afkChannel ? `🔕 ${afkChannel.name}` : `🔕 silinmiş-kanal (${afkChannelId})`;
			if (stats.afkVoiceUsers && typeof stats.afkVoiceUsers[targetUser.id] === 'number') {
				userAfkSec = stats.afkVoiceUsers[targetUser.id];
			}
		}

		// Mesaj verileri
		const userMsgCount = stats.users?.[targetUser.id] || 0;
		const totalMsgCount = Object.values(stats.users || {}).reduce((a, b) => a + b, 0);
		const msgRank = Object.entries(stats.users || {})
			.sort((a, b) => b[1] - a[1])
			.findIndex(([id]) => id === targetUser.id) + 1;

		// Ses verileri
		let userVoiceSec = 0;
		if (stats.voiceUsers && Object.prototype.hasOwnProperty.call(stats.voiceUsers, targetUser.id)) {
			const val = stats.voiceUsers[targetUser.id];
			userVoiceSec = typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
		}
		const totalVoiceSec = Object.values(stats.voiceUsers || {}).reduce((a, b) => (typeof b === 'number' && isFinite(b) ? a + b : a), 0);
		const voiceRank = Object.entries(stats.voiceUsers || {})
			.filter(([_, v]) => typeof v === 'number' && isFinite(v))
			.sort((a, b) => b[1] - a[1])
			.findIndex(([id]) => id === targetUser.id) + 1;

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

		// Mesaj arkadaşı (en çok mesaj atan diğer kullanıcı)
		const msgFriends = Object.entries(stats.users || {})
			.filter(([id]) => id !== targetUser.id)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);  // İlk 3 arkadaşı al

		// Ses arkadaşı (en çok sesde kalan diğer kullanıcı)
		const voiceFriends = Object.entries(stats.voiceUsers || {})
			.filter(([id]) => id !== targetUser.id)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);  // İlk 3 arkadaşı al

		// Yardımcı fonksiyonlar
		function formatTime(sec) {
			if (!sec) return '0 saniye';
			const h = Math.floor(sec / 3600);
			const m = Math.floor((sec % 3600) / 60);
			const s = sec % 60;
			let str = '';
			if (h) str += `${h} saat `;
			if (m) str += `${m} dakika `;
			if (s || (!h && !m)) str += `${s} saniye`;
			return str.trim();
		}

		const canvas = createCanvas(1152, 585);
		const ctx2 = canvas.getContext('2d');

		// Arka plan
		ctx2.fillStyle = '#18191C';
		ctx2.fillRect(0, 0, canvas.width, canvas.height);

		// Profil kutusu
		ctx2.save();
		drawRoundedRect(ctx2, 20, 20, 320, 70, 24);
		ctx2.fillStyle = '#232428';
		ctx2.globalAlpha = 0.95;
		ctx2.fill(); // drawRoundedRect sonrası fill çağrılıyor
		ctx2.restore();

		// Profil avatarı
		const avatar = await loadImage(avatarURL);
		ctx2.save();
		ctx2.beginPath();
		ctx2.arc(60, 55, 35, 0, Math.PI * 2, true);
		ctx2.closePath();
		ctx2.clip();
		ctx2.drawImage(avatar, 25, 20, 70, 70);
		ctx2.restore();

		// Kullanıcı adı
		ctx2.font = 'bold 32px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText(username, 110, 65);

		// "70 günlük veri" kutusu
		ctx2.save();
		ctx2.globalAlpha = 1;
		ctx2.strokeStyle = '#A259FF';
		ctx2.lineWidth = 2;
		drawRoundedRect(ctx2, 900, 30, 210, 40, 16);
		ctx2.stroke();
		ctx2.font = 'bold 22px sans-serif';
		ctx2.fillStyle = '#A259FF';
		ctx2.fillText('70 günlük veri', 930, 60);
		ctx2.restore();

		// SIRALAMA BİLGİLERİ kutusu
		ctx2.save();
		ctx2.globalAlpha = 0.95;
		ctx2.fillStyle = '#232428';
		drawRoundedRect(ctx2, 20, 110, 250, 180, 18);
		ctx2.fill();
		ctx2.restore();
		ctx2.font = 'bold 20px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText('SIRALAMA BİLGİLERİ', 40, 140);

		// MESAJ BİLGİLERİ kutusu
		ctx2.save();
		ctx2.globalAlpha = 0.95;
		ctx2.fillStyle = '#232428';
		drawRoundedRect(ctx2, 290, 110, 270, 180, 18);
		ctx2.fill();
		ctx2.restore();
		ctx2.font = 'bold 20px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText('MESAJ BİLGİLERİ', 310, 140);

		// SES BİLGİLERİ kutusu
		ctx2.save();
		ctx2.globalAlpha = 0.95;
		ctx2.fillStyle = '#232428';
		drawRoundedRect(ctx2, 570, 110, 270, 180, 18);
		ctx2.fill();
		ctx2.restore();
		ctx2.font = 'bold 20px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText('SES BİLGİLERİ', 590, 140);

		// EN AKTİF OLDUĞU KANALLAR kutusu
		ctx2.save();
		ctx2.globalAlpha = 0.95;
		ctx2.fillStyle = '#232428';
		drawRoundedRect(ctx2, 20, 310, 540, 180, 18);
		ctx2.fill();
		ctx2.restore();
		ctx2.font = 'bold 20px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText('EN AKTİF OLDUĞU KANALLAR', 40, 340);

		// ARKADAŞ BİLGİLERİ kutusu
		ctx2.save();
		ctx2.globalAlpha = 0.95;
		ctx2.fillStyle = '#232428';
		drawRoundedRect(ctx2, 580, 310, 400, 180, 18);
		ctx2.fill();
		ctx2.restore();
		ctx2.font = 'bold 20px sans-serif';
		ctx2.fillStyle = '#fff';
		ctx2.fillText('ARKADAŞ BİLGİLERİ', 600, 340);

		// Örnek veri yerleşimi (sahte veriler, kendi istatistiklerinizi buraya yerleştirin)
		ctx2.font = '18px sans-serif';
		ctx2.fillStyle = '#bbb';
		// Sıralama Bilgileri
		ctx2.fillText(`SES      ${voiceRank || '-'}. sırada`, 40, 175);
		ctx2.fillStyle = '#FFA500';
		ctx2.fillText(`MESAJ    ${msgRank || '-'}. sırada`, 40, 205);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText('YAYIN    -', 40, 235);
		ctx2.fillText('KAMERA   -', 40, 265);

		// Mesaj Bilgileri
		ctx2.fillStyle = '#fff';
		ctx2.fillText('TOPLAM', 310, 175);
		ctx2.fillText('BUGÜN', 310, 205);
		ctx2.fillText('BU HAFTA', 310, 235);
		ctx2.fillText('BU AY', 310, 265);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText(`${userMsgCount} mesaj`, 410, 175);
		ctx2.fillText('-', 410, 205); // Günlük/haftalık/aylık için veri yoksa '-' yaz
		ctx2.fillText('-', 410, 235);
		ctx2.fillText('-', 410, 265);

		// Ses Bilgileri
		ctx2.fillStyle = '#fff';
		ctx2.fillText('TOPLAM', 590, 175);
		ctx2.fillText('BUGÜN', 590, 205);
		ctx2.fillText('BU HAFTA', 590, 235);
		ctx2.fillText('BU AY', 590, 265);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText(formatTime(userVoiceSec), 690, 175);
		ctx2.fillText('-', 690, 205);
		ctx2.fillText('-', 690, 235);
		ctx2.fillText('-', 690, 265);

		// En Aktif Olduğu Kanallar
		ctx2.fillStyle = '#fff';
		ctx2.fillText(topMsgChannelName, 40, 380);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText(topMsgChannelCount ? `${topMsgChannelCount} mesaj` : 'Veri yok', 200, 380);
		ctx2.fillStyle = '#fff';
		ctx2.fillText(topVoiceChannelName, 40, 410);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText(topVoiceChannelSec ? formatTime(topVoiceChannelSec) : 'Veri yok', 200, 410);

		// AFK kanalında geçirilen süre (kullanıcıya özel)
		ctx2.fillStyle = '#fff';
		ctx2.fillText(afkChannelName + ' (AFK)', 40, 440);
		ctx2.fillStyle = '#bbb';
		ctx2.fillText(userAfkSec ? formatTime(userAfkSec) : 'Veri yok', 200, 440);

		// Mesaj arkadaşı (en çok mesaj atan diğer kullanıcı)
		ctx2.fillStyle = '#fff';
		ctx2.fillText('MESAJ ARKADAŞLARI', 600, 380);
		ctx2.fillStyle = '#bbb';
		msgFriends.forEach((friend, index) => {
			const [id, count] = friend;
			const friendMember = guild.members.cache.get(id);
			const friendName = friendMember ? friendMember.displayName : 'Bilinmeyen Kullanıcı';
			ctx2.fillText(`${friendName}: ${count} mesaj`, 600, 410 + (index * 25));
		});

		ctx2.fillStyle = '#fff';
		ctx2.fillText('SES ARKADAŞLARI', 600, 470);
		ctx2.fillStyle = '#bbb';
		voiceFriends.forEach((friend, index) => {
			const [id, duration] = friend;
			const friendMember = guild.members.cache.get(id);
			const friendName = friendMember ? friendMember.displayName : 'Bilinmeyen Kullanıcı';
			ctx2.fillText(`${friendName}: ${formatTime(duration)}`, 600, 500 + (index * 25));
		});

		const buffer = canvas.toBuffer();
		const attachment = new AttachmentBuilder(buffer, { name: 'stat.png' });
		await reply({ files: [attachment] });
	}
};
