module.exports = (client, getPrefix) => {
	const statuses = [
		() => `Anlık üye sayısı: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} `,
		() => 'Sunucuyu',
		() => {
			const guild = client.guilds.cache.first();
			const prefix = guild ? getPrefix(guild.id) : '.';
			return `Komutlar için: ${prefix}yardım`;
		}
	];

	let i = 0;
	const updateStatus = () => {
		const status = statuses[i % statuses.length]();
		client.user?.setPresence({
			activities: [{ name: status, type: 3 }], // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
			status: 'online'
		});
		i++;
	};

	// İlk başta hemen ayarla
	updateStatus();
	// Sonra her 10 saniyede bir güncelle
	setInterval(updateStatus, 10000);

	console.log(`Bot aktif: ${client.user.tag}`);
};
