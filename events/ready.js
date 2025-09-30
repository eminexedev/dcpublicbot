module.exports = (client, getPrefix) => {
	// Her sunucu için ayrı status takibi
	const guildStatuses = new Map();
	
	// Her sunucu için status'ları oluşturan fonksiyon
	const createGuildStatuses = (guild) => {
		return [
			() => `${guild.name} - Üye sayısı: ${guild.memberCount}`,
			() => `${guild.name} sunucusunu izliyorum`,
			() => {
				const prefix = getPrefix(guild.id);
				return `Komutlar: ${prefix}yardım`;
			}
		];
	};

	// Tüm sunucular için status'ları başlat
	client.guilds.cache.forEach(guild => {
		guildStatuses.set(guild.id, {
			statuses: createGuildStatuses(guild),
			index: 0
		});
	});

	let currentGuildIndex = 0;
	const guildIds = Array.from(client.guilds.cache.keys());
	
	const updateStatus = () => {
		if (guildIds.length === 0) return;
		
		// Şu anki sunucuyu al
		const currentGuildId = guildIds[currentGuildIndex];
		const guild = client.guilds.cache.get(currentGuildId);
		
		if (!guild) {
			// Sunucu bulunamazsa bir sonrakine geç
			currentGuildIndex = (currentGuildIndex + 1) % guildIds.length;
			return;
		}
		
		// Bu sunucu için status bilgisini al veya oluştur
		let guildStatus = guildStatuses.get(currentGuildId);
		if (!guildStatus) {
			guildStatus = {
				statuses: createGuildStatuses(guild),
				index: 0
			};
			guildStatuses.set(currentGuildId, guildStatus);
		}
		
		// Status'u güncelle
		const status = guildStatus.statuses[guildStatus.index % guildStatus.statuses.length]();
		client.user?.setPresence({
			activities: [{ name: status, type: 3 }], // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
			status: 'online'
		});
		
		// Bir sonraki status'a geç
		guildStatus.index++;
		
		// 3 status'tan sonra bir sonraki sunucuya geç
		if (guildStatus.index % 3 === 0) {
			currentGuildIndex = (currentGuildIndex + 1) % guildIds.length;
		}
	};

	//StatusUpdate (30)
	setInterval(updateStatus, 30000);

	// Yeni sunucu katıldığında status'ları güncelle
	client.on('guildCreate', (guild) => {
		guildStatuses.set(guild.id, {
			statuses: createGuildStatuses(guild),
			index: 0
		});
		// Guild ID listesini yeniden oluştur
		guildIds.length = 0;
		guildIds.push(...Array.from(client.guilds.cache.keys()));
	});

	// Sunucudan ayrıldığında status'ları temizle
	client.on('guildDelete', (guild) => {
		guildStatuses.delete(guild.id);
		// Guild ID listesini yeniden oluştur
		guildIds.length = 0;
		guildIds.push(...Array.from(client.guilds.cache.keys()));
		currentGuildIndex = 0; // Index'i sıfırla
	});

/*
Discord Ratelimit yememek için
30 saniye olarak yeniden güncelledim.
Artık her sunucuya özel üye sayısı gösteriyor.
-yunus.
*/

	console.log(`Bot aktif: ${client.user.tag}`);
};
