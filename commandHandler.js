const fs = require('fs');
const path = require('path');
const { Collection, Events, AuditLogEvent, MessageFlags } = require('discord.js');

module.exports = (client) => {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);
      
      // Universal handler komutları için kontrol
      if (command && typeof command === 'object' && command.data && command.data.name) {
        // Sadece slash komut adı ile ekle (tek kayıt)
        client.commands.set(command.data.name, command);
        console.log(`✅ Komut yüklendi: ${command.data.name}`);
      } else if (command && typeof command === 'function') {
        // Eski tip komutlar (fonksiyon olarak export edilen)
        console.warn(`[WARNING] Eski format komut atlandı: ${file}`);
      } else {
        console.warn(`[WARNING] Komut yüklenemedi: ${file} - Geçersiz yapı`);
      }
    } catch (error) {
      console.error(`[ERROR] Komut yüklenirken hata (${file}):`, error.message);
    }
  }

  // const { getPrefix } = require('../prefixConfig');
  const { getPrefix } = require('./config');
  // getPrefix fonksiyonunuz şöyle olmalı:
  // function getPrefix(guildId) {
  //   try {
  //     const config = require('./prefixConfig.json');
  //     return config[guildId]?.prefix || '.';
  //   } catch {
  //     return '.';
  //   }
  // }

  // Log kanalını almak için merkezi config fonksiyonlarını kullan
  // Öncelik: Ayarlanmış genel log (logConfig.json) -> prefixConfig (legacy) -> autoLog
  const { getLogChannel: _getGeneralLog, getAutoLogChannel: _getAutoLog } = require('./config');
  function getLogChannelId(guildId) {
    if (!guildId) return null;
    // 1. Genel log kanalı (logkanal komutu ile kaydedilen)
    const general = _getGeneralLog(guildId);
    if (general) return general;
    // 2. Legacy prefixConfig.json (geriye dönük uyumluluk)
    try {
      const legacy = require('./prefixConfig.json');
      if (legacy[guildId]?.logChannelId) return legacy[guildId].logChannelId;
    } catch {}
    // 3. Otomatik oluşturulan log kanalı
    const auto = _getAutoLog(guildId);
    if (auto) return auto;
    return null;
  }

  client.on(Events.InteractionCreate, async interaction => {
    // Tüm Interaction yanıtlarında `ephemeral` alanını otomatik olarak `flags: Ephemeral`'e dönüştür
    const normalizeEphemeral = (payload) => {
      if (!payload || typeof payload !== 'object') return payload;
      // Kopya oluştur, orijinali değiştirmeyelim
      const copy = { ...payload };
      if (Object.prototype.hasOwnProperty.call(copy, 'ephemeral')) {
        if (copy.ephemeral) {
          // Mevcut flags varsa üzerine Ephemeral bitini ekle
          copy.flags = (copy.flags || 0) | MessageFlags.Ephemeral;
        }
        delete copy.ephemeral;
      }
      return copy;
    };
    try {
      // reply/followUp/deferReply metodlarını sar
      if (interaction && typeof interaction.reply === 'function' && !interaction._ephemeralPatched) {
        const origReply = interaction.reply.bind(interaction);
        interaction.reply = (options) => origReply(normalizeEphemeral(options));
        const origFollow = interaction.followUp?.bind(interaction);
        if (origFollow) interaction.followUp = (options) => origFollow(normalizeEphemeral(options));
        const origDefer = interaction.deferReply?.bind(interaction);
        if (origDefer) interaction.deferReply = (options) => origDefer(normalizeEphemeral(options));
        interaction._ephemeralPatched = true;
      }
    } catch (e) {
      console.warn('[EPHEMERAL PATCH WARN]', e?.message);
    }
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      // Prefix ipucu gönderimini komut çalıştıktan sonra yapacağız (replied/deferred durumuna göre reply/followUp seçeceğiz)
      
      // SÜPER GÜÇLÜ SLASH KOMUT EXECUTION KONTROLÜ
      if (!client._slashExecutions) client._slashExecutions = new Set();
      if (!client._lastSlashExecutionTime) client._lastSlashExecutionTime = new Map();
      
      const slashKey = `${interaction.user.id}_${interaction.commandName}`;
      const now = Date.now();
      const lastExecution = client._lastSlashExecutionTime.get(slashKey);
      
      // Eğer son 2 saniye içinde aynı komut çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 2000) {
        console.log(`🚫 [ANTI-SPAM] /${interaction.commandName} komutu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._slashExecutions.has(slashKey)) {
        console.log(`🚫 [ANTI-CLONE] /${interaction.commandName} komutu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._slashExecutions.add(slashKey);
      client._lastSlashExecutionTime.set(slashKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._slashExecutions.delete(slashKey);
      }, 5000);
      
      try {
        // Slash komut için ctx: Interaction örneğini koru (prototype yöntemleri kaybolmasın)
  const ctx = interaction;
        ctx.isCommand = () => true; // Bu slash komut
        ctx.author = interaction.user; // Prefix uyumluluğu için
        const origReply = interaction.reply.bind(interaction);
        ctx.reply = async (content) => {
          content = normalizeEphemeral(content);
          if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(content);
          } else {
            return await origReply(content);
          }
        };

        await command.execute(ctx, []);
        // Slash ile tetiklendiğinde, sunucuda bir prefix ayarlıysa kullanıcıya bilgilendirici uyarı göster (ephemeral)
        try {
          const { getPrefix } = require('./config');
          const px = getPrefix(interaction.guildId);
          if (px && px !== '/') {
            const tip = `ℹ️ Bu sunucuda prefix komutları da etkin: \n> Örn: \`${px}${interaction.commandName}\`\n> Prefix'i değiştirmek için: \`/prefix yeni:<yeniPrefix>\``;
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: tip, ephemeral: true }).catch(()=>{});
            } else {
              await interaction.reply({ content: tip, ephemeral: true }).catch(()=>{});
            }
          }
        } catch {}
      } catch (error) {
        console.error('[SLASH COMMAND ERROR]', error);
        const errorMsg = { content: 'Bir hata oluştu.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      }
    }
    // Çekiliş butonları
    if (interaction.isButton() && interaction.customId === 'join_giveaway') {
      const cekilis = client.commands.get('cekilis');
      if (cekilis && cekilis.handleButton) {
        await cekilis.handleButton(interaction);
      }
    }
    // Özel oda panel butonları
    if (interaction.isButton && typeof interaction.isButton === 'function' ? interaction.isButton() : interaction.isButton) {
      if (interaction.customId && interaction.customId.startsWith('pv:')) {
        const ozeloda = client.commands.get('ozeloda');
        if (ozeloda && ozeloda.handleButton) {
          try {
            await ozeloda.handleButton(interaction);
          } catch (e) {
            console.error('[OZELODA BUTTON ERROR]', e);
          }
        }
      }
    }
    // Yardım menüsü butonları
    if (interaction.isButton() && (interaction.customId === 'help_user' || interaction.customId === 'help_mod')) {
      const yardim = client.commands.get('yardım');
      if (yardim && yardim.handleButton) {
        try {
          await yardim.handleButton(interaction);
        } catch (error) {
          console.error('[HELP BUTTON ERROR]', error);
        }
      }
    }
    // rollog sayfalama butonları
    if (interaction.isButton && typeof interaction.isButton === 'function' ? interaction.isButton() : interaction.isButton) {
      if (interaction.customId && interaction.customId.startsWith('rollog:')) {
        const rollog = client.commands.get('rollog');
        if (rollog && rollog.handleButton) {
          try {
            await rollog.handleButton(interaction);
          } catch (e) {
            console.error('[ROLLOG BUTTON ERROR]', e);
          }
        }
      }
    }
    // Prefix seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId === 'prefix_select') ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId === 'prefix_select')
    ) {
      const prefix = client.commands.get('prefix');
      if (prefix && prefix.handleSelect) {
        await prefix.handleSelect(interaction);
      }
    }
    // Mute seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('mute_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('mute_'))
    ) {
      // SÜPER GÜÇLÜ SELECT MENU EXECUTION KONTROLÜ
      if (!client._selectMenuExecutions) client._selectMenuExecutions = new Set();
      if (!client._lastSelectExecutionTime) client._lastSelectExecutionTime = new Map();
      
      const selectKey = `${interaction.user.id}_${interaction.customId}`;
      const now = Date.now();
      const lastExecution = client._lastSelectExecutionTime.get(selectKey);
      
      // Eğer son 1 saniye içinde aynı select menu çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 1000) {
        console.log(`🚫 [ANTI-SPAM] Select menu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._selectMenuExecutions.has(selectKey)) {
        console.log(`🚫 [ANTI-CLONE] Select menu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._selectMenuExecutions.add(selectKey);
      client._lastSelectExecutionTime.set(selectKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._selectMenuExecutions.delete(selectKey);
      }, 5000);
      
      const mute = client.commands.get('mute');
      if (mute && mute.handleSelectMenu) {
        await mute.handleSelectMenu(interaction);
      }
    }

    // Ban seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('ban')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('ban'))
    ) {
      // Anti-spam/clone koruması (mute ile benzer)
      if (!client._selectMenuExecutions) client._selectMenuExecutions = new Set();
      if (!client._lastSelectExecutionTime) client._lastSelectExecutionTime = new Map();

      const selectKey = `${interaction.user.id}_${interaction.customId}`;
      const now = Date.now();
      const lastExecution = client._lastSelectExecutionTime.get(selectKey);
      if (lastExecution && (now - lastExecution) < 1000) {
        console.log(`🚫 [ANTI-SPAM] Ban select menu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      if (client._selectMenuExecutions.has(selectKey)) {
        console.log(`🚫 [ANTI-CLONE] Ban select menu hala işleniyor: ${interaction.user.tag}`);
        return;
      }
      client._selectMenuExecutions.add(selectKey);
      client._lastSelectExecutionTime.set(selectKey, now);
      setTimeout(() => {
        client._selectMenuExecutions.delete(selectKey);
      }, 5000);

      const ban = client.commands.get('ban');
      if (ban && ban.handleSelectMenu) {
        try { await ban.handleSelectMenu(interaction); } catch (e) { console.error('[BAN SELECT ERROR]', e); }
      }
    }
    
    // Jail seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('jail_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('jail_'))
    ) {
      // SÜPER GÜÇLÜ SELECT MENU EXECUTION KONTROLÜ
      if (!client._selectMenuExecutions) client._selectMenuExecutions = new Set();
      if (!client._lastSelectExecutionTime) client._lastSelectExecutionTime = new Map();
      
      const selectKey = `${interaction.user.id}_${interaction.customId}`;
      const now = Date.now();
      const lastExecution = client._lastSelectExecutionTime.get(selectKey);
      
      // Eğer son 1 saniye içinde aynı select menu çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 1000) {
        console.log(`🚫 [ANTI-SPAM] Jail select menu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._selectMenuExecutions.has(selectKey)) {
        console.log(`🚫 [ANTI-CLONE] Jail select menu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._selectMenuExecutions.add(selectKey);
      client._lastSelectExecutionTime.set(selectKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._selectMenuExecutions.delete(selectKey);
      }, 5000);
      
      const jail = client.commands.get('jail');
      if (jail && jail.handleSelectMenu) {
        await jail.handleSelectMenu(interaction);
      }
    }
    // Kayıt seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('kayit_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('kayit_'))
    ) {
      const kayit = client.commands.get('kayıt');
      if (kayit && kayit.handleSelectMenu) {
        await kayit.handleSelectMenu(interaction);
      }
    }
    // Modal işlemleri (kayıt modal'ı)
    if (interaction.isModalSubmit && interaction.customId && interaction.customId.startsWith('registration_')) {
      const kayit = client.commands.get('kayıt');
      if (kayit && kayit.handleModal) {
        await kayit.handleModal(interaction);
      }
    }
    // Özel oda rename modal
    if (interaction.isModalSubmit && interaction.customId === 'pv:modal:rename') {
      const ozeloda = client.commands.get('ozeloda');
      if (ozeloda && ozeloda.handleModal) {
        try { await ozeloda.handleModal(interaction); } catch (e) { console.error('[OZELODA MODAL ERROR]', e); }
      }
    }
  });

  // Universal Handler ile prefix komut sistemi
  client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    
    const prefix = getPrefix(message.guild.id) || '.';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    let commandName = args.shift()?.toLowerCase();

    // TR karakter normalizasyonu: ö->o, ü->u, ğ->g, ş->s, ç->c, ı->i
    const trNormalize = (s) => s
      .replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/ğ/g, 'g').replace(/ş/g, 's')
      .replace(/ç/g, 'c').replace(/ı/g, 'i');

    if (!commandName) return;

    // Komut arama: önce tam isim, sonra alternatif isimler
    let command = client.commands.get(commandName);
    if (!command) {
      const asciiName = trNormalize(commandName);
      if (asciiName !== commandName) {
        command = client.commands.get(asciiName);
        if (command) commandName = asciiName;
      }
    }
    if (!command) {
      // Alternatif komut isimleri için arama
      const alternativeNames = {
        'mesajsil': 'sil',
        'sil': 'sil',
        'clear': 'sil',
        'purge': 'sil',
        // Özel oda kurulum sihirbazı alias'ları
        'özeloda': 'ozeloda',
        'özel-oda': 'ozeloda',
        'ozel-oda': 'ozeloda',
        'öo': 'ozeloda',
        'oo': 'ozeloda',
        'privatevoice': 'ozeloda',
        'private-room': 'ozeloda',
        'çek': 'cek',
        'cek': 'cek',
        'rolbilgi': 'rolbilgi',
        'sleep': 'sleep',
        'rollog': 'rollog',
        'voicemute': 'vmute',
        'vmuted': 'vmute'
      };
      // Kısa yol aliasları
      if (!command && (commandName === 'n' || commandName === 'nerede')) {
        command = client.commands.get('nerede');
      }
      const altName = alternativeNames[commandName];
      if (altName) {
        command = client.commands.get(altName);
      }
    }
    if (!command) return;
    
    // MODERATION KOMUTLARI İÇİN EK GÜVENLİK KONTROLÜ
  const moderationCommands = ['mute', 'vmute', 'unmute', 'ban', 'unban', 'kick', 'kayıt', 'kayit'];
    if (moderationCommands.includes(commandName)) {
      console.log(`🛡️ [SECURITY] Moderation komut girişimi: ${commandName} - User: ${message.author.tag} (${message.author.id})`);
      
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        return message.reply('❌ Üye bilgisi alınamadı.');
      }
      
      // Yetki kontrol listesi
      const requiredPerms = {
        'mute': 'MuteMembers',
        'vmute': 'MuteMembers',
        'unmute': 'MuteMembers', 
        'ban': 'BanMembers',
        'unban': 'BanMembers',
        'kick': 'KickMembers',
        'kayıt': 'ManageRoles',
        'kayit': 'ManageRoles'
      };
      
      const requiredPerm = requiredPerms[commandName];
      if (requiredPerm && !member.permissions.has(requiredPerm)) {
        console.log(`🚫 [SECURITY] YETKİSİZ ERİŞİM ENGELLENDİ: ${message.author.tag} ${commandName} komutunu kullanmaya çalıştı`);
        return message.reply('❌ **GÜVENLİK: YETKİSİZ ERİŞİM!** Bu moderation komutunu kullanma yetkiniz yok.');
      }
    }
    
    // SÜPER GÜÇLÜ ÇİFT EXECUTION KONTROLÜ
    const executionKey = `${message.author.id}_${commandName}`;
    if (!client._prefixExecutions) client._prefixExecutions = new Set();
    if (!client._lastExecutionTime) client._lastExecutionTime = new Map();
    
    const now = Date.now();
    const lastExecution = client._lastExecutionTime.get(executionKey);
    
    // Eğer son 3 saniye içinde aynı komut çalıştırıldıysa engelle
    if (lastExecution && (now - lastExecution) < 3000) {
      console.log(`🚫 [ANTI-SPAM] ${commandName} komutu çok hızlı çalıştırılıyor: ${message.author.tag}`);
      return;
    }
    
    if (client._prefixExecutions.has(executionKey)) {
      console.log(`🚫 [ANTI-CLONE] ${commandName} komutu hala işleniyor: ${message.author.tag}`);
      return; // Zaten işleniyor
    }
    
    client._prefixExecutions.add(executionKey);
    client._lastExecutionTime.set(executionKey, now);
    
    // 5 saniye sonra temizle
    setTimeout(() => {
      client._prefixExecutions.delete(executionKey);
    }, 5000);

    try {
      // Context ve args'ı gönder
      const ctx = {
        message: message,
        args: args,
        guild: message.guild,
        member: message.member,
        author: message.author,
        channel: message.channel,
        client: client,
        isCommand: () => false, // Bu prefix komut, slash değil
        reply: async (content) => {
          // Message.reply ephemeral/flags desteklemez, güvenli temizle
          if (content && typeof content === 'object') {
            const copy = { ...content };
            if (Object.prototype.hasOwnProperty.call(copy, 'ephemeral')) delete copy.ephemeral;
            if (Object.prototype.hasOwnProperty.call(copy, 'flags')) delete copy.flags;
            return await message.reply(copy);
          }
          return await message.reply(content);
        }
      };
      
      await command.execute(ctx, args);
    } catch (error) {
      console.error('[COMMAND ERROR]', error);
      await message.reply('Bir hata oluştu.');
    }
  });

  // Mesaj silindiğinde logla
  client.on(Events.MessageDelete, async message => {
    if (!message.guild) return;
    // Debug: event geldi
    // console.debug('[LOG][MessageDelete] Event tetiklendi, id:', message.id, 'partial:', message.partial);
    // Mesaj eksikse fetch et
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        // fetch başarısız olursa devam et
      }
    }
    const wasBot = message.author?.bot === true;
    const logChannelId = getLogChannelId(message.guild.id);
    if (!logChannelId) {
      console.debug('[LOG][MessageDelete] Log kanalı tanımlı değil:', message.guild.id);
      return;
    }
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) {
      console.debug('[LOG][MessageDelete] Log kanalı bulunamadı veya cache dışı:', logChannelId);
      return;
    }
    // Temel alanları topla (audit log gecikmesini beklemek için henüz göndermiyoruz)
    const baseFields = [
      { name: 'Kullanıcı', value: message.author ? `${message.author} (${message.author.id})` : 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: message.channel ? `<#${message.channel.id}>` : 'Bilinmiyor', inline: true },
      { name: 'Mesaj', value: message.content ? message.content : '(Bilinmiyor veya embed/boş mesaj)' }
    ];
    if (wasBot) baseFields.push({ name: 'Not', value: 'Silinen mesaj bir bot tarafından gönderilmişti.', inline: false });

    // Sağ tık silmeler: audit log gecikebilir -> 2 aşamalı deneme (650ms + 650ms)
    const MAX_WINDOW_MS = 10000; // 10 sn pencere
    let sent = false;

    async function tryResolve(attempt) {
      let deleter = null;
      let auditTried = false;
      try {
        const fetchedLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 8 });
        const now = Date.now();
        const entries = [...fetchedLogs.entries.values()].filter(e => (now - e.createdTimestamp) < MAX_WINDOW_MS);
        auditTried = true;
        // Kanal filtresi (extra.channel.id mevcutsa)
        const channelFiltered = entries.filter(e => {
          const ch = e.extra?.channel;
          return ch && message.channel && ch.id === message.channel.id;
        });
        // Hedef kullanıcı ID eşleşmesi öncelik
        let candidates = channelFiltered.length ? channelFiltered : entries;
        if (message.author) {
          const exact = candidates
            .filter(e => e.target && e.target.id === message.author.id)
            .sort((a,b) => b.createdTimestamp - a.createdTimestamp)[0];
          if (exact) {
            deleter = exact.executor;
          } else {
            // Tek aday & count===1 ise varsayım
            const single = candidates
              .filter(e => e.extra && e.extra.count === 1 && e.target && e.target.id === message.author.id)
              .sort((a,b)=> b.createdTimestamp - a.createdTimestamp)[0];
            if (single) deleter = single.executor;
          }
        }
      } catch (e) {
        // yoksay
      }

      if (deleter || attempt === 2) {
        if (sent) return; // Güvenlik
        sent = true;
        const finalFields = [...baseFields];
        if (deleter) {
          finalFields.push({ name: 'Silen', value: `${deleter} (${deleter.id})`, inline: true });
        } else {
          // Audit denenmiş ve bulunamamışsa muhtemelen self-delete
          if (auditTried && message.author) {
            finalFields.push({ name: 'Silen', value: `${message.author} (${message.author.id}) (self)`, inline: true });
          } else {
            finalFields.push({ name: 'Silen', value: 'Belirlenemedi (muhtemelen self-delete veya audit gecikmesi)', inline: false });
          }
        }
        logChannel.send({
          embeds: [{
            title: 'Mesaj Silindi',
            color: 0xED4245,
            fields: finalFields,
            timestamp: new Date()
          }]
        });
      } else {
        // İkinci deneme için tekrar sırala
        setTimeout(() => tryResolve(2), 650);
      }
    }

    setTimeout(() => tryResolve(1), 650);
  });

  // Toplu mesaj silme (ör: purge) logu
  client.on(Events.MessageBulkDelete, async messages => {
    if (!messages || messages.size === 0) return;
    const sample = messages.first();
    if (!sample?.guild) return;
    const logChannelId = getLogChannelId(sample.guild.id);
    if (!logChannelId) return;
    const logChannel = sample.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Kaç farklı kullanıcı mesajı silindi
    const authors = new Set();
    messages.forEach(m => { if (m.author && !m.author.bot) authors.add(m.author.id); });

    logChannel.send({
      embeds: [{
        title: 'Toplu Mesaj Silme',
        color: 0xED4245,
        fields: [
          { name: 'Silinen Mesaj Sayısı', value: String(messages.size), inline: true },
          { name: 'Etkilenen Kullanıcı', value: authors.size > 0 ? String(authors.size) : 'Bilinmiyor', inline: true },
          { name: 'Kanal', value: `<#${sample.channel.id}>`, inline: true }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Mesaj düzenlendiğinde logla
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!oldMessage.guild) return;
    // Eski veya yeni mesaj eksikse fetch et
    if (oldMessage.partial) { try { await oldMessage.fetch(); } catch {} }
    if (newMessage.partial) { try { await newMessage.fetch(); } catch {} }
    if (oldMessage.author?.bot) return;

    const oldContent = oldMessage.content || '';
    const newContent = newMessage.content || '';
    const attachmentsChanged = (oldMessage.attachments?.size || 0) !== (newMessage.attachments?.size || 0);
    // İçerik değişmediyse ve ek sayısı da değişmediyse loglama
    if (oldContent === newContent && !attachmentsChanged) return;

    const logChannelId = getLogChannelId(oldMessage.guild.id);
    if (!logChannelId) {
      console.debug('[LOG][MessageUpdate] Log kanalı tanımlı değil:', oldMessage.guild.id);
      return;
    }
    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) {
      console.debug('[LOG][MessageUpdate] Log kanalı bulunamadı veya cache dışı:', logChannelId);
      return;
    }

    // Uzun içerikleri kes (1024 embed field limiti güvenliği)
    const truncate = (txt) => {
      if (!txt) return '(Boş)';
      return txt.length > 900 ? txt.slice(0,900) + '... (kısaltıldı)' : txt;
    };

    const oldDisplay = truncate(oldContent) || '(Bilinmiyor veya embed/boş mesaj)';
    const newDisplay = truncate(newContent) || '(Bilinmiyor veya embed/boş mesaj)';

    // Ek listesi farkı
    const oldAtt = oldMessage.attachments?.map(a=>a.name).join(', ') || 'Yok';
    const newAtt = newMessage.attachments?.map(a=>a.name).join(', ') || 'Yok';
    const attFieldNeeded = oldAtt !== newAtt;

    const messageLink = `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id}`;

    const fields = [
      { name: 'Kullanıcı', value: oldMessage.author ? `${oldMessage.author} (${oldMessage.author.id})` : 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: 'Mesaj Linki', value: `[Git](${messageLink})`, inline: true },
      { name: 'Eski Mesaj', value: oldDisplay },
      { name: 'Yeni Mesaj', value: newDisplay }
    ];
    if (attFieldNeeded) {
      fields.push({ name: 'Ekler (Önce)', value: oldAtt, inline: false });
      fields.push({ name: 'Ekler (Sonra)', value: newAtt, inline: false });
    }

    logChannel.send({
      embeds: [{
        title: 'Mesaj Düzenlendi',
        color: 0xFEE75C,
        fields,
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı banlandığında logla
  client.on(Events.GuildBanAdd, async ban => {
    const logChannelId = getLogChannelId(ban.guild.id);
    if (!logChannelId) return;
    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Kullanıcı Banlandı',
        color: 0xED4245,
        fields: [
          { name: 'Kullanıcı', value: `${ban.user} (${ban.user.id})`, inline: true }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı banı kaldırıldığında logla
  client.on(Events.GuildBanRemove, async ban => {
    const logChannelId = getLogChannelId(ban.guild.id);
    if (!logChannelId) return;
    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Ban Kaldırıldı',
        color: 0x57F287,
        fields: [
          { name: 'Kullanıcı', value: `${ban.user} (${ban.user.id})`, inline: true }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı sunucudan atıldığında (kick) logla
  client.on(Events.GuildMemberRemove, async member => {
    // Kick mi yoksa ayrılma mı anlamak için audit log kontrolü yapılabilir
    const logChannelId = getLogChannelId(member.guild.id);
    if (!logChannelId) return;
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Audit log ile kick tespiti
    const fetchedLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
    const kickLog = fetchedLogs.entries.first();
    if (kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcı Kicklendi',
          color: 0xED4245,
          fields: [
            { name: 'Kullanıcı', value: `${member.user} (${member.user.id})`, inline: true },
            { name: 'Yetkili', value: `${kickLog.executor} (${kickLog.executor.id})`, inline: true },
            { name: 'Sebep', value: kickLog.reason || 'Belirtilmedi' }
          ],
          timestamp: new Date()
        }]
      });
    }
  });

  // Timeout (susturma) logu
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const logChannelId = getLogChannelId(newMember.guild.id);
    if (!logChannelId) return;
    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Timeout başlatıldıysa
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcı Susturuldu (Timeout)',
          color: 0xFEE75C,
          fields: [
            { name: 'Kullanıcı', value: `${newMember.user} (${newMember.user.id})`, inline: true },
            { name: 'Süre', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime()/1000)}:R>` }
          ],
          timestamp: new Date()
        }]
      });
    }
    // Timeout kaldırıldıysa
    if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcının Susturması Kaldırıldı',
          color: 0x57F287,
          fields: [
            { name: 'Kullanıcı', value: `${newMember.user} (${newMember.user.id})`, inline: true }
          ],
          timestamp: new Date()
        }]
      });
    }
  });
}
