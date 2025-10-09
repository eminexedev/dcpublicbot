const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require('discord.js');
const os = require('os');
const { version: nodeVersion } = require('process');

// Basit global ping geçmişi (son 30 ölçüm). Process restart olunca sıfırlanır.
if (!global.__PING_HISTORY__) {
    global.__PING_HISTORY__ = [];
}
function pushPingSample(value) {
    if (!Number.isFinite(value)) return;
    global.__PING_HISTORY__.push(value);
    if (global.__PING_HISTORY__.length > 30) global.__PING_HISTORY__.shift();
}
function buildPingGraph() {
    const data = global.__PING_HISTORY__;
    if (!data.length) return 'Veri yok';
    const slice = data.slice(-30); // daha fazla bağlam
    const max = Math.max(...slice);
    const min = Math.min(...slice);
    const avg = slice.reduce((a,b)=>a+b,0)/slice.length;
    const last = slice[slice.length-1];
    const span = (max - min) || 1;
    // Yükseklik ve genişlik
    const height = 6;
    const widthSlice = slice.slice(-24); // en son 24 nokta
    // Unicode blok yerine çok seviyeli çizgi: yüksekten alçağa ▇▆▅▄▃▂▁
    const levels = ['▁','▂','▃','▄','▅','▆','▇'];
    function levelChar(v){
        const norm = (v - min)/span; // 0..1
        const idx = Math.min(levels.length-1, Math.max(0, Math.round(norm*(levels.length-1))));
        return levels[idx];
    }
    const barLine = widthSlice.map(v=>levelChar(v)).join('');
    // Yatay eksen (basit)
    // Min / Avg / Max göstergesi
    const labelLine = `min ${min}ms | avg ${avg.toFixed(0)}ms | max ${max}ms | son ${last}ms`;
    // Trend okları: son değer ortalamaya göre
    const trend = last > avg ? '↗' : (last < avg ? '↘' : '→');
    // Basit threshold çizgileri (avg ve max için)
    // ASCII grafikte alt satır: barLine; üst satır: trend & etiket
    return [
        labelLine,
        `trend ${trend}`,
        barLine
    ].join('\n');
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Botun detaylı istatistiklerini gösterir.'),

    category: 'general',
    description: 'Botun detaylı istatistiklerini gösterir. Kullanım: .istatistik',
    usage: '.istatistik',
    permissions: [],

    async execute(ctx) {
        // Hibrit: slash veya prefix
        const isSlash = typeof ctx.isChatInputCommand === 'function' ? ctx.isChatInputCommand() : !!ctx.applicationId;
        const client = ctx.client || (ctx.message ? ctx.message.client : null);
        if (!client) return;

        const reply = async (content) => {
            if (isSlash) {
                if (ctx.replied || ctx.deferred) return ctx.followUp(content);
                return ctx.reply(content);
            } else {
                if (ctx.reply) return ctx.reply(content);
                if (ctx.message) return ctx.message.reply(content);
            }
        };

        // Uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        // RAM
        const used = process.memoryUsage();
        const ram = (used.heapUsed / 1024 / 1024).toFixed(2);

        // WS Ping
        let wsPingRaw = client.ws?.ping;
        if (!Number.isFinite(wsPingRaw) || wsPingRaw < 0) wsPingRaw = 0;
    const wsPing = Math.round(wsPingRaw);

        // Bot (mesaj) ping referans timestamp
        const referenceTs = (isSlash ? ctx.createdTimestamp : ctx.message?.createdTimestamp) || Date.now();
        let botPing = Date.now() - referenceTs;
        if (!Number.isFinite(botPing) || botPing < 0) botPing = 0;

    const apiPing = wsPing; // Ayrı ölçüm yoksa WS ping yansıt

    // Örnekleri kaydet (WS ping). 0 ise çok anlamsız olabilir ama yine de trend için ekleyebiliriz.
    pushPingSample(wsPing);
    const graph = buildPingGraph();

        const formatUptime = () => {
            const parts = [];
            if (days) parts.push(`${days}g`);
            if (hours) parts.push(`${hours}saat`);
            if (minutes) parts.push(`${minutes}dk`);
            parts.push(`${seconds}sn`);
            return parts.join(' ');
        };

        const safeMs = (v) => Number.isFinite(v) ? `${v}ms` : 'N/A';

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
                        `> **Çalışma Süresi:** ${formatUptime()}`,
                        `> **RAM Kullanımı:** ${ram} MB`,
                        `> **Node.js:** ${nodeVersion}`,
                        `> **Discord.js:** v${discordJsVersion}`
                    ].join('\n')
                },
                {
                    name: '📊 Ping Detayları',
                    value: [
                        `> **Bot Pingi:** ${safeMs(botPing)}`,
                        `> **WebSocket Pingi:** ${safeMs(wsPing)}`,
                        `> **API Gecikmesi:** ${safeMs(apiPing)}`,
                        '```txt',
                        graph,
                        '```'
                    ].join('\n')
                },
                {
                    name: '💻 Sistem Bilgileri',
                    value: [
                        `> **İşletim Sistemi:** ${os.type()} ${os.release()}`,
                        `> **CPU:** ${os.cpus()[0].model}`,
                        `> **CPU Çekirdek Sayısı:** ${os.cpus().length}`,
                        `> **Toplam RAM:** ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                        `> **Boş RAM:** ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
                    ].join('\n')
                }
            )
            .setTimestamp();

        await reply({ embeds: [embed] });
    }
};
