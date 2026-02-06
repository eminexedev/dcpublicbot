const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getProfanityChannels } = require('../config');

const TURKISH_UPPER = 'A-ZÇĞİÖŞÜ';
const UPPER_RE = new RegExp(`[${TURKISH_UPPER}]`, 'g');

// Basit küfür listesi (TR) - ihtiyaca göre genişletilebilir
const BAD_WORDS = [
  'am','amcık', 'amcıklama', 'amcığa', 'amcıksın', 'amık', 'amına', 'amınakoyayım', 'amınakoyim', 'amın feryadı',
  'sik', 'sikik', 'sikiş', 'siktir', 'siktirgit', 'sokuk', 'sokayım', 'sokuyum', 'sikiym', 'sikem',
  'yarrak', 'yarak', 'yarağım', 'taşşak', 'daşşak', 'taşak', 'taşşaklarını', 
  'göt', 'götoş', 'götlek', 'götveren', 'götün', 'götüne','orospu', 'orospu çocuğu', 'oç', 'o.ç', 'kahpe', 'kahbe', 'yavşak','yavsak', 'puşt', 'gavat', 'kavat',
  'godoş', 'pezevenk', 'pezo', 'piç', 'ibne', 'ipne', 'top', 'dalyarak', 'am feryadı',
  'am biti', 'sik kırıntısı', 'sülalesini', 'ecdadını', 'bacısını', 'karısını','fuck', 'fucker', 'motherfucker', 'bitch', 'shit', 'asshole', 'dick', 'pussy', 'bastard', 
  'cunt', 'slut', 'whore', 'faggot', 'dickhead','aq', 'amk', 'amg', 'amq', 'götün', 'siktim', 'siktigim', 'soktuğum', 'soktugum'
];
const BAD_WORDS_RE = new RegExp(`\\b(${BAD_WORDS.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`, 'i');

// Leet/aksan normalize ve esnek yakalama
function normalizeText(raw) {
  let s = (raw || '').toLowerCase();
  s = s.normalize('NFKD');
  s = s.replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/i̇/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u');
  s = s.replace(/â|á|à|ä|ã/g,'a').replace(/é|è|ê|ë/g,'e').replace(/í|ì|î|ï/g,'i').replace(/ó|ò|ô|ö|õ/g,'o').replace(/ú|ù|û|ü/g,'u');
  s = s.replace(/[@4]/g,'a').replace(/[!1]/g,'i').replace(/3/g,'e').replace(/0/g,'o').replace(/[$5]/g,'s').replace(/7/g,'t').replace(/2/g,'z');
  return s;
}
function tokenize(ascii) {
  return ascii.split(/[^a-z0-9]+/).filter(Boolean);
}
function buildSeparatedRegex(word) {
  const letters = normalizeText(word).split('');
  const sep = '[^a-z0-9]{0,3}';
  const core = letters.map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(sep);
  const pattern = `(^|[^a-z0-9])(${core})([^a-z0-9]|$)`;
  return new RegExp(pattern, 'i');
}
const SHORT_EXACT = new Set(['amk','aq','oç','oc','sik','piç','pic','bok','göt','got','ibne','ipne','amq','amg']);
const BAD_FLEX = BAD_WORDS.filter(w => normalizeText(w).length >= 3).map(w => buildSeparatedRegex(w));

function isExcessiveUppercase(text) {
  if (!text) return false;
  const lettersOnly = (text.match(UPPER_RE) || []).length;
  if (lettersOnly > 15) return true;
  // Sürekli büyük harf serisi kontrolü
  let maxRun = 0, run = 0;
  for (const ch of text) {
    if (ch.match(UPPER_RE)) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  return maxRun > 15;
}

function containsBadWord(text) {
  if (!text) return false;
  const original = text.normalize('NFC');
  // 1) Doğrudan eşleşme (sınırlarla)
  const directHit = BAD_WORDS_RE.test(original);
  // 2) Normalize edip token bazlı kontrol ve skorlayıcı
  const ascii = normalizeText(text);
  const tokens = tokenize(ascii);
  const allowList = new Set(['selam','selamlar','selamunaleykum','selamun','aleykumselam','tamam','imam','hamam','program','kelam']);
  let score = 0;
  let reasons = [];
  if (directHit) { score += 3; reasons.push('direct'); }
  for (const t of tokens) {
    if (allowList.has(t)) continue;
    if (SHORT_EXACT.has(t)) { score += 2; reasons.push(`short:${t}`); }
    for (const base of BAD_WORDS) {
      const b = normalizeText(base);
      if (b.length >= 4 && t === b) { score += 3; reasons.push(`exact:${b}`); }
    }
  }
  // 3) Ayrılmış/obfuske yazımlar (s.i.k, s-i-k, boşluklu) - sadece kelime sınırlarında
  for (const re of BAD_FLEX) {
    if (re.test(ascii)) { score += 2; reasons.push('flex'); break; }
  }
  // 4) Uzatmalar ve tekrarlar
  if (/[a-z]{3,}\1{2,}/i.test(ascii)) { score += 1; reasons.push('repeat'); }
  // 5) Küfür kompozisyonları
  if (ascii.includes('orospu') && ascii.includes('cocuk')) { score += 2; reasons.push('phrase'); }
  return score >= 2;
}

module.exports = (client) => {
  client.on('messageCreate', async (msg) => {
    try {
      if (!msg.guild || msg.author.bot) return;
      if (msg.channel.type !== ChannelType.GuildText) return;
      const channels = getProfanityChannels(msg.guild.id);
      if (!channels.length || !channels.includes(msg.channel.id)) return;
      const content = msg.content || '';

      const hasBad = containsBadWord(content);
      const excessive = isExcessiveUppercase(content);
      if (!hasBad && !excessive) return;

      const canManage = msg.guild.members.me?.permissions.has(PermissionFlagsBits.ManageMessages);
      if (canManage) {
        await msg.delete().catch(()=>{});
      }
      const warn = await msg.channel.send({
        content: `${msg.author}, lütfen küfür ve aşırı büyük harf kullanma. Mesajın kaldırıldı.`
      }).catch(()=>null);
      if (warn) setTimeout(() => warn.delete().catch(()=>{}), 15000);
    } catch (e) {
      console.error('[ProfanityFilter] Hata:', e?.message || e);
    }
  });
};
