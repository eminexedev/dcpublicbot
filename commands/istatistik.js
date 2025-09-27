const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require('discord.js');
const os = require('os');
const { version: nodeVersion } = require('process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Botun detaylı istatistiklerini gösterir.'),
    async execute(ctx) {
        const client = ctx.client || ctx.message?.client;
        if (!client) return;

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
        const wsping = Math.round(client.ws.ping);
        const apiPing = Date.now() - ctx.createdTimestamp;

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
                        `> **Bot Pingi:** ${apiPing}ms`,
                        `> **WebSocket Pingi:** ${wsping}ms`,
                        `> **Veritabanı Pingi:** ${Date.now() - ctx.createdTimestamp}ms`
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

        await (ctx.reply ? ctx.reply({ embeds: [embed] }) : ctx.message.reply({ embeds: [embed] }));
    }
};
