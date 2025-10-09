const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
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

// Kullanıcının ses sıralamasını hesapla
function getUserVoiceRank(stats, userId) {
	if (!stats || !stats.voiceUsers || !stats.voiceUsers[userId]) {
		return 'Veri yok';
	}

	// Ses verilerine göre kullanıcıları sırala
	const sortedUsers = Object.entries(stats.voiceUsers)
		.sort((a, b) => b[1] - a[1]);
	
	// Kullanıcının sırasını bul
	const userRank = sortedUsers.findIndex(entry => entry[0] === userId) + 1;
	const totalUsers = sortedUsers.length;
	
	if (userRank === 0) return 'Veri yok';
	
	return `${userRank}/${totalUsers} (${getRankEmoji(userRank)})`;
}

// Sıralamaya göre emoji döndür
function getRankEmoji(rank) {
	if (rank === 1) return '🥇 Birinci';
	if (rank === 2) return '🥈 İkinci';
	if (rank === 3) return '🥉 Üçüncü';
	if (rank <= 10) return '🏆 İlk 10';
	if (rank <= 50) return '⭐ İlk 50';
	return '🔹 Normal';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Sunucu istatistiklerini embed olarak gösterir.')
		.addUserOption(o => o.setName('kullanıcı').setDescription('İstatistiğini görmek istediğin kullanıcı').setRequired(false)),
	async execute(ctx, args = []) {
		let guild, invokingUser, reply, isSlash = false;
		if (ctx.isChatInputCommand && ctx.isChatInputCommand()) {
			guild = ctx.guild;
			invokingUser = ctx.user;
			reply = (data) => ctx.reply(data);
			isSlash = true;
		} else if (ctx.message) {
			guild = ctx.guild;
			invokingUser = ctx.message.author;
			reply = (data) => ctx.message.reply(data);
		} else {
			return;
		}

		// Hedef kullanıcı belirleme (prefix: .stat [@etiket|id]) (slash: optional user)
		let targetUser = invokingUser;
		if (isSlash) {
			try {
				const opt = ctx.options.getUser('kullanıcı');
				if (opt) targetUser = opt;
			} catch {}
		} else {
			if (args && args.length > 0) {
				const first = args[0];
				let id = null;
				const mentionMatch = first.match(/^<@!?([0-9]{17,20})>$/);
				if (mentionMatch) id = mentionMatch[1];
				else if (/^[0-9]{17,20}$/.test(first)) id = first;
				if (id) {
					const fetched = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
					if (!fetched) return reply('❌ Belirttiğin kullanıcı bulunamadı.');
					targetUser = fetched.user;
					// Eğer parametre kullanıcıyı temsil ediyorsa args.shift() yap (gerçek komut içinde başka arg yok ama ilerisi için)
					args.shift();
				}
			}
		}

		try {
			await guild.channels.fetch();
			await guild.members.fetch();
		} catch (e) {}

		const stats = loadStats(guild.id);
		if (!stats) return reply('İstatistik verisi bulunamadı.');

		const member = guild.members.cache.get(targetUser.id);
		const username = member ? member.displayName : targetUser.username;
		
		// Avatar URL'sini gelişmiş seçeneklerle alma
		const avatarURL = targetUser.displayAvatarURL({ 
			extension: 'png',  // PNG formatında
			size: 128,         // 128x128 boyut
			dynamic: true,     // Animasyonlu avatar varsa kullan
			forceStatic: false // Animasyonu zorla statik yapma
		});

		// Kullanıcıya özel mesaj ve ses verileri
		const userMsgCount = stats.users?.[targetUser.id] || 0;
		let userVoiceSec = stats.voiceUsers?.[targetUser.id] || 0; // Kayıtlı (flush edilmiş) süre

		// Aktif oturum delta'sı: sadece embed'de gösterilecek, userVoiceSec'e direkt eklemiyoruz (aksi halde kanal bazlı eklemede double count olur)
		let liveSessionExtra = 0;
		const client = ctx.client || guild.client;
		if (client && client.activeVoiceStates) {
			const activeKey = `${guild.id}-${targetUser.id}`;
			const state = client.activeVoiceStates.get(activeKey);
			if (state && state.joinTime) {
				const elapsed = Math.floor((Date.now() - state.joinTime) / 1000);
				const flushed = state._flushed || 0;
				liveSessionExtra = Math.max(0, elapsed - flushed);
			}
		}

		// En çok mesaj atılan kanal
		const topMsgChannelEntry = Object.entries(stats.channels || {}).sort((a, b) => b[1] - a[1])[0];
		const topMsgChannelId = topMsgChannelEntry?.[0];
		const topMsgChannel = topMsgChannelId ? guild.channels.cache.get(topMsgChannelId) : null;
		const topMsgChannelName = topMsgChannel ? `#${topMsgChannel.name}` : (topMsgChannelId ? `#silinmiş-kanal (${topMsgChannelId})` : 'Veri yok');
		const topMsgChannelCount = topMsgChannelEntry?.[1] || 0;

		// Kullanıcı bazlı mesaj kanal dökümü
		let messageChannelsList = 'Veri yok';
		if (stats.userChannelMessages && stats.userChannelMessages[targetUser.id]) {
			const userMsgChannels = stats.userChannelMessages[targetUser.id];
			const sortedMsgChannels = Object.entries(userMsgChannels)
				.sort((a,b) => b[1]-a[1])
				.slice(0,25);
			const lines = [];
			for (const [cid,count] of sortedMsgChannels) {
				const ch = guild.channels.cache.get(cid);
				if (!ch) continue;
				const line = `<#${cid}> — **${count}** mesaj`;
				if ((lines.join('\n') + '\n' + line).length > 1024) break;
				lines.push(line);
			}
			if (lines.length) messageChannelsList = lines.join('\n');
			if (messageChannelsList.length > 1024) messageChannelsList = messageChannelsList.slice(0,1000)+'...';
		}

		// (Global en aktif ses kanalı yerine) kullanıcı bazlı en aktif ses kanalı daha sonra userVoiceChannels oluşturulduktan sonra hesaplanacak
		let topVoiceChannelName = 'Veri yok';
		let topVoiceChannelSec = 0;

		// Kullanıcının anlık ses durumunu kontrol et
		const currentVoiceState = guild.members.cache.get(targetUser.id)?.voice;
		let currentVoiceStatus = '🔴 Ses kanalında değil';
		let currentChannel = null;
		let isCurrentlyAFK = false;
		
		// AFK kanalında geçirilen süre (kullanıcıya özel)
		let userAfkSec = 0;
		let afkChannelName = 'Yok';
		const afkChannelId = guild.afkChannelId;
		
		if (currentVoiceState && currentVoiceState.channelId) {
			currentChannel = guild.channels.cache.get(currentVoiceState.channelId);
			isCurrentlyAFK = currentVoiceState.channelId === afkChannelId;
		}
		
		// Kayıtlı AFK süresi
		if (afkChannelId) {
			const afkChannel = guild.channels.cache.get(afkChannelId);
			// AFK kanalı da diğer ses kanalları gibi mention formatında gösterilsin
			afkChannelName = afkChannel ? `<#${afkChannel.id}>` : `silinmiş-kanal (${afkChannelId})`;
			if (stats.afkVoiceUsers && typeof stats.afkVoiceUsers[targetUser.id] === 'number') {
				userAfkSec = stats.afkVoiceUsers[targetUser.id];
			}
			
			// Kullanıcı şu anda AFK kanalındaysa, aktif süreyi ekle
			const client2 = ctx.client || ctx.guild.client;
			if (isCurrentlyAFK && client2 && client2.activeVoiceStates && client2.activeVoiceStates.has(`${guild.id}-${targetUser.id}`)) {
				const joinTime = client2.activeVoiceStates.get(`${guild.id}-${targetUser.id}`).joinTime;
				const currentAfkSessionTime = Math.floor((Date.now() - joinTime) / 1000);
				userAfkSec += currentAfkSessionTime;
			}
		}
		
		if (currentVoiceState && currentVoiceState.channelId) {
			// Ses kanalı durumları
			const isDeaf = currentVoiceState.deaf ? '🔇 Sağır' : '';
			const isMute = currentVoiceState.mute ? '🔈 Susturulmuş' : '';
			const isSelfDeaf = currentVoiceState.selfDeaf ? '🎧 Kendini Sağırlaştırmış' : '';
			const isSelfMute = currentVoiceState.selfMute ? '🎤 Kendini Susturmuş' : '';
			const isStreaming = currentVoiceState.streaming ? '📺 Yayın Yapıyor' : '';
			const isVideo = currentVoiceState.selfVideo ? '🎥 Kamera Açık' : '';
			
			const statusEffects = [isDeaf, isMute, isSelfDeaf, isSelfMute, isStreaming, isVideo].filter(Boolean).join(', ');
			
			// İkon ve rengi duruma göre ayarla
			let statusIcon = '🟢'; // Normal ses kanalı
			if (isCurrentlyAFK) {
				statusIcon = '🔕'; // AFK
			} else if (currentVoiceState.streaming) {
				statusIcon = '🟣'; // Yayın
			} else if (currentVoiceState.selfVideo) {
				statusIcon = '🔵'; // Video
			}
			
			currentVoiceStatus = `${statusIcon} ${currentChannel ? currentChannel.name : 'Bilinmeyen Kanal'}${isCurrentlyAFK ? ' (AFK)' : ''}${statusEffects ? ` - ${statusEffects}` : ''}`;
		}

		// Kullanıcının ses kanalı sırasını bulma
		const userVoiceRank = getUserVoiceRank(stats, targetUser.id);
		
		// Kullanıcının ses kanalında ne kadar süredir olduğunu hesaplama
		let currentSessionDuration = 'Bağlı değil';
		if (currentChannel && stats.voiceSessions && stats.voiceSessions[targetUser.id]) {
			const userSessions = stats.voiceSessions[targetUser.id];
			const currentSession = userSessions.find(s => s.channelId === currentChannel.id && !s.endTime);
			if (currentSession) {
				const sessionDuration = Math.floor((Date.now() - currentSession.startTime) / 1000);
				currentSessionDuration = formatTime(sessionDuration);
			}
		}

		// Kullanıcının tüm konuştuğu kanalları topla
		let voiceChannelsList = '';
		let voiceChannelsCount = 0;
		
		// Ses kanalı kayıtlarını kullanarak kanal listesi oluştur
		const userVoiceChannels = new Map();
		
		// Kullanıcı bazlı ses verilerini kontrol et (güncel veri yapısı)
		if (stats.userVoiceData && stats.userVoiceData[targetUser.id]) {
			// Kullanıcının kanal verilerini al
			const userChannels = stats.userVoiceData[targetUser.id];
			for (const [channelId, duration] of Object.entries(userChannels)) {
				const channel = guild.channels.cache.get(channelId);
				if (channel) {
					userVoiceChannels.set(channelId, {
						name: channel.name,
						duration: duration,
						id: channelId,
						type: channel.type,
						accurate: true
					});
				} else {
					// Silinmiş kanal
					userVoiceChannels.set(channelId, {
						name: `Silinmiş Kanal`,
						duration: duration,
						id: channelId,
						type: null,
						accurate: true,
						deleted: true
					});
				}
			}
		} 
		// Eğer kullanıcı bazlı veri yoksa, genel ses verilerinden tahmin et
		else if (stats.voiceChannels) {
			// Sunucudaki tüm ses kanallarını gez
			const totalServerVoice = Object.values(stats.voiceChannels).reduce((a, b) => a + b, 0);
			
			for (const [channelId, totalDuration] of Object.entries(stats.voiceChannels)) {
				const channel = guild.channels.cache.get(channelId);
				if (channel && totalServerVoice > 0 && userVoiceSec > 0) {
					// Kullanıcının ses süresinin toplama oranı
					const ratio = userVoiceSec / totalServerVoice;
					// Tahmin edilen kanal süresi
					const estimatedDuration = Math.floor(totalDuration * ratio);
					
					if (estimatedDuration > 0) {
						userVoiceChannels.set(channelId, {
							name: channel.name,
							duration: estimatedDuration,
							id: channelId,
							type: channel.type,
							estimated: true
						});
					}
				}
			}
		}
		
		// Kullanıcının aktif ses oturumu varsa ekle
		if (currentChannel && currentVoiceState) {
			const client3 = ctx.client || ctx.guild.client;
			if (client3 && client3.activeVoiceStates && client3.activeVoiceStates.has(`${guild.id}-${targetUser.id}`)) {
				const joinTime = client3.activeVoiceStates.get(`${guild.id}-${targetUser.id}`).joinTime;
				const state = client3.activeVoiceStates.get(`${guild.id}-${targetUser.id}`);
				const elapsed = Math.floor((Date.now() - joinTime) / 1000);
				const flushed = state._flushed || 0;
				const currentSessionTime = Math.max(0, elapsed - flushed);
				
				// Mevcut kanalı haritaya ekle ya da güncelle
				if (userVoiceChannels.has(currentChannel.id)) {
					const existing = userVoiceChannels.get(currentChannel.id);
					existing.duration += currentSessionTime;
					existing.current = true;
				} else {
					userVoiceChannels.set(currentChannel.id, {
						name: currentChannel.name,
						duration: currentSessionTime,
						id: currentChannel.id,
						type: currentChannel.type,
						current: true
					});
				}
			}
		}
		
		// Haritayı süreye göre sıralanmış bir diziye dönüştür
		const sortedChannels = [...userVoiceChannels.values()]
			.filter(channel => channel.duration > 0)
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 25); // Ham listede maksimum 25 (sonra 1024 sınırına göre keseceğiz)

		// Kullanıcı bazlı en aktif ses kanalı (ilk eleman)
		if (sortedChannels.length > 0) {
			const ch = sortedChannels[0];
			topVoiceChannelName = `${ch.name}`;
			topVoiceChannelSec = ch.duration;
		}

		// Satırları önce diziye koy, sonra 1024 sınırına göre birleştir
		const channelLines = [];
		for (const channel of sortedChannels) {
			const currentIndicator = channel.current ? ' • canlı' : '';
			const tag = channel.estimated ? '*(tahmini)*' : '';
			channelLines.push(`<#${channel.id}>${currentIndicator} — **${formatTime(channel.duration)}** ${tag}`.trim());
		}

		if (userVoiceChannels.size > sortedChannels.length) {
			channelLines.push(`*...ve ${userVoiceChannels.size - sortedChannels.length} kanal daha*`);
		}

		// 1024 karakter sınırını aşmadan satırları ekle
		let assembled = '';
		for (const line of channelLines) {
			if ((assembled + line + '\n').length > 1024) break;
			assembled += line + '\n';
			voiceChannelsCount++;
		}

		voiceChannelsList = assembled.trim();
		if (!voiceChannelsList) voiceChannelsList = 'Henüz ses kanallarında vakit geçirmemiş.';

		// Son güvenlik: yine de 1024 üzeriyse brute force kes
		if (voiceChannelsList.length > 1024) {
			voiceChannelsList = voiceChannelsList.slice(0, 1000) + '...';
		}

		// Genel alan truncate helper
		const safeField = (val) => {
			if (!val) return 'Veri yok';
			return val.length <= 1024 ? val : (val.slice(0, 1000) + '...');
		};

		const totalVoiceDisplay = formatTime(userVoiceSec + liveSessionExtra);
		const embed = new EmbedBuilder()
			.setAuthor({ name: `${username} (${targetUser.id}) üyesinin istatistikleri`, iconURL: avatarURL })
			.setColor('#5865F2')
			.addFields(
				{
					name: 'Mesaj Bilgileri',
					value: safeField(
						`Toplam Mesaj: **${userMsgCount}**\n` +
						`En Aktif Kanal: ${topMsgChannelName} (${topMsgChannelCount ? topMsgChannelCount + ' mesaj' : 'Veri yok'})`
					)
				},
				{
					name: 'Mesaj Kanalları',
					value: messageChannelsList
				},
				{
					name: 'Ses Bilgileri',
					value: safeField(
						`Toplam Ses: **${totalVoiceDisplay}**${liveSessionExtra ? ' *(canlı)*' : ''}\n` +
						`En Aktif Ses Kanalı: ${topVoiceChannelName} (${topVoiceChannelSec ? formatTime(topVoiceChannelSec) : 'Veri yok'})\n` +
						`Ses Sıralaması: ${userVoiceRank}`
					)
				},
				{
					name: 'Ses Kanalları',
					value: voiceChannelsList
				},
				{
					name: 'AFK Bilgileri',
					value: safeField(`${afkChannelName} (AFK)\nAFK Süresi: ${userAfkSec ? formatTime(userAfkSec) : 'Veri yok'}`)
				}
			)

		await reply({ embeds: [embed] });
	}
};
