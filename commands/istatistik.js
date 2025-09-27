const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require('discord.js');
const os = require('os');
const { version: nodeVersion } = require('process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Botun detaylı istatistiklerini gösterir.'),
    async execute(ctx) {
        // Prefix veya Slash komut kontrolü
        if (!ctx.isChatInputCommand && !ctx.message) return;

        const client = ctx.client || ctx.message?.client;
        if (!client) return;

        const isPrefix = Boolean(ctx.message);
        
        if (isPrefix && ctx.commandName === 'istatistik') return;

        // Bot başlangıç zamanını hesapla
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);

        // RAM kullanımı
        const used = process.memoryUsage();
        const ram = (used.heapUsed / 1024 / 1024).toFixed(2);

        // Ping detayları
        const wsping = Math.abs(Math.round(client.ws.ping)) || 0;
        const startTime = Date.now();
        const botPing = Math.abs(isPrefix ? 
            startTime - ctx.message.createdTimestamp : 
            startTime - ctx.createdTimestamp);
        const apiPing = Math.abs(Math.round(client.ws.ping)) || 0;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ 
                name: 'Bot İstatistikleri', 
                iconURL: client.user.displayAvatarURL() 
            })
            .addFields(
                { 
                    name: '🤖 Bot Bilgileri',
                    value: [
                        `> **Sunucu Sayısı:** ${client.guilds.cache.size}`,
                        `> **Kullanıcı Sayısı:** ${client.users.cache.size}`,
                        `> **Kanal Sayısı:** ${client.channels.cache.size}`,
                        `> **Çalışma Süresi:** ${days}g ${hours}s ${minutes}d ${seconds}s`,
                        `> **RAM Kullanımı:** ${ram} MB`,
                        `> **Node.js:** ${nodeVersion}`,
                        `> **Discord.js:** v${discordJsVersion}`
                    ].join('\n')
                },
                {
                    name: '📊 Ping Detayları',
                    value: [
                        `> **Bot Pingi:** ${botPing}ms`,
                        `> **WebSocket Pingi:** ${wsping}ms`,
                        `> **API Gecikmesi:** ${apiPing}ms`
                    ].join('\n')
                },
                {
                    name: '💻 Sistem Bilgileri',
                    value: [
                        `> **İşletim Sistemi:** ${os.type()} ${os.release()}`,
                        `> **CPU:** ${os.cpus()[0].model}`,
                        `> **CPU Kullanımı:** ${(process.cpuUsage().user / 1024 / 1024).toFixed(2)}%`,
                        `> **Toplam RAM:** ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                        `> **Boş RAM:** ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
                    ].join('\n')
                }
            )
            .setFooter({ text: 'Bot istatistikleri anlık olarak güncellenir.' })
            .setTimestamp();

        await (isPrefix ? ctx.message.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] }));
    }
};
