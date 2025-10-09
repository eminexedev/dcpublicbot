
# 🤖 DC Public Bot

Gelişmiş moderasyon ve etkileşimli özellikler içeren Discord botu.

## ✨ Özellikler

### 🛡️ Moderasyon Sistemi

- **Ban/Unban**: Gelişmiş yasaklama sistemi
- **Kick**: Kullanıcı atma
- **Mute/Unmute**: İnteraktif susturma sistemi  
- **Jail/Unjail**: İnteraktif hapishane sistemi (rol tabanlı)
- **Lock/Unlock**: Kanal kilitleme (yetkili rol istisna sistemi)

### 👥 Kullanıcı Sistemi

- **Kayıt**: İnteraktif kayıt sistemi (cinsiyet seçimi, yaş modal)
- **Rol Yönetimi**: Rol verme/alma komutları
- **İstatistikler**: Sunucu ve kullanıcı istatistikleri

### 📝 Log Sistemi

- **Çoklu Log Desteği**: Farklı işlemler için ayrı kanallar
- **Detaylı Raporlama**: Timestamp'li ve embed formatında loglar
- **Konfigürasyon**: Her sunucu için özelleştirilebilir

### 🎮 Eğlence

- **Çekiliş**: Giveaway sistemi
- **Emoji**: Emoji yönetimi
- **Avatar**: Kullanıcı avatar görüntüleme

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+ 
- pnpm (önerilen paket yöneticisi)

### Kurulum Adımları

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/eminexedev/dcpublicbot.git
cd dcpublicbot
```

2. **Bağımlılıkları yükleyin**
```bash
pnpm install
```

3. **Çevresel değişkenleri ayarlayın**
```bash
cp .env.example .env
# .env dosyasını düzenleyin ve bot tokenınızı ekleyin
```

4. **Bot'u başlatın**
```bash
pnpm start
```

## ⚙️ Konfigürasyon

### .env Dosyası
```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

### Bot İzinleri
Bot için gerekli izinler:
- Manage Channels
- Manage Roles  
- Ban Members
- Kick Members
- Manage Messages
- Send Messages
- Use Slash Commands
- Embed Links

## 📋 Komut Listesi

### Moderasyon

- `!ban @kullanici [sebep]` - Kullanıcıyı yasaklar
- `!unban <kullanici_id>` - Yasağı kaldırır
- `!kick @kullanici [sebep]` - Kullanıcıyı atar
- `!mute @kullanici` - İnteraktif susturma (sebep seçimi)
- `!unmute @kullanici` - Susturmayı kaldırır
- `!jail @kullanici` - İnteraktif hapishane (sebep seçimi)
- `!unjail @kullanici` - Hapishaneden çıkarır
- `!lock [@yetkili-rol]` - Kanalı kilitler
- `!unlock` - Kanal kilidini açar

### Sistem Kurulumu

- `!jailrol @rol` - Jail rolünü ayarlar
- `!unjailrol @rol` - Unjail rolünü ayarlar
- `!lockrol @rol` - Varsayılan lock rolünü ayarlar
- `!jaillogkanal #kanal` - Jail log kanalını ayarlar
- `!unjaillogkanal #kanal` - Unjail log kanalını ayarlar

### Durum Kontrolleri
- `!jaildurumu` - Jail sistemi durumunu gösterir
- `!lockdurumu` - Lock sistemi durumunu gösterir

### Kullanıcı Yönetimi  
- `!kayıt @kullanici` - İnteraktif kayıt sistemi
- `!rolal @kullanici @rol` - Rol verir
- `!rolver @kullanici @rol` - Rol alır

### Log Sistemi
- `!logkanal #kanal` - Log kanalını ayarlar
- `!banlogkanal #kanal` - Ban log kanalını ayarlar

## 🏗️ Mimari

### Dosya Yapısı
```
├── commands/          # Komut dosyaları
│   ├── moderation/    # Moderasyon komutları
│   ├── user/          # Kullanıcı komutları
│   └── utility/       # Yardımcı komutları
├── events/           # Event handler'lar
├── config/           # Konfigürasyon dosyaları
├── *.js             # Ana sistem dosyaları
└── package.json      # Proje bağımlılıkları
```

### Özellikler
- **Dual Command System**: Hem slash (/) hem prefix (!) komutları
- **Anti-Duplicate Protection**: Komut klonlanma koruması
- **Interactive Components**: Dropdown menüler ve modaller
- **JSON-based Configuration**: Sunucu başı ayarlar
- **Comprehensive Logging**: Detaylı işlem kayıtları

## 🛠️ Geliştirme

### Development Mode
```bash
pnpm dev
```

### Lint Kontrolü
```bash
pnpm lint
```

### Test
```bash
pnpm test
```

## 📦 NPM'den PNPM'e Geçiş

Bu proje artık **pnpm** kullanıyor. Avantajları:
- ⚡ Daha hızlı kurulum
- 💾 Disk tasarrufu
- 🔒 Daha güvenli bağımlılık yönetimi

### Eski npm komutları → Yeni pnpm komutları:
```bash
npm install     →  pnpm install
npm start       →  pnpm start  
npm run dev     →  pnpm dev
npm run build   →  pnpm build
```

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 Destek

Sorularınız için:
- GitHub Issues kullanın
- Discord sunucumuza katılın

---

**Not**: Bu bot sürekli geliştirilmektedir. Yeni özellikler ve iyileştirmeler düzenli olarak eklenmektedir.

