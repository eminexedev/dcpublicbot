const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

function pickComment(p) {
  if (p < 10) return 'Hiç olmamış!';
  if (p < 30) return 'Biraz zorlanıyorlar!';
  if (p < 50) return 'Umut var ama zor!';
  if (p < 70) return 'Fena değil, ilerleyebilir!';
  if (p < 90) return 'Çok uyumlu görünüyorlar!';
  return 'Mükemmel eşleşme!';
}

async function createShipImage(leftAvatar, rightAvatar, percent, leftLabel, rightLabel) {
  const width = 900;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#a06cd5');
  bgGrad.addColorStop(0.5, '#b185db');
  bgGrad.addColorStop(1, '#cdb4db');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 12; i++) {
    const r = Math.random() * 120 + 30;
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const cardX = 25;
  const cardY = 25;
  const cardW = width - 50;
  const cardH = height - 50;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  const r = 24;
  ctx.moveTo(cardX + r, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, r);
  ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, r);
  ctx.arcTo(cardX, cardY + cardH, cardX, cardY, r);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, r);
  ctx.closePath();
  ctx.fill();
  const leftSize = 150;
  const rightSize = 150;
  const leftX = cardX + 80;
  const leftY = cardY + cardH / 2 - leftSize / 2;
  const rightX = cardX + cardW - 80 - rightSize;
  const rightY = cardY + cardH / 2 - rightSize / 2;
  try {
    const lImg = await loadImage(leftAvatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(leftX + leftSize / 2, leftY + leftSize / 2, leftSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(lImg, leftX, leftY, leftSize, leftSize);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(leftX + leftSize / 2, leftY + leftSize / 2, leftSize / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
  } catch {}
  try {
    const rImg = await loadImage(rightAvatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(rightX + rightSize / 2, rightY + rightSize / 2, rightSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(rImg, rightX, rightY, rightSize, rightSize);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(rightX + rightSize / 2, rightY + rightSize / 2, rightSize / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
  } catch {}
  const heartX = cardX + cardW / 2;
  const heartY = cardY + cardH / 2 - 50;
  const heartW = 140;
  const heartH = 120;
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  const topCurveHeight = heartH * 0.3;
  ctx.moveTo(heartX, heartY + topCurveHeight);
  ctx.bezierCurveTo(
    heartX, heartY,
    heartX - heartW / 2, heartY,
    heartX - heartW / 2, heartY + topCurveHeight
  );
  ctx.bezierCurveTo(
    heartX - heartW / 2, heartY + (heartH + topCurveHeight) / 2,
    heartX, heartY + (heartH + topCurveHeight) / 2,
    heartX, heartY + heartH
  );
  ctx.bezierCurveTo(
    heartX, heartY + (heartH + topCurveHeight) / 2,
    heartX + heartW / 2, heartY + (heartH + topCurveHeight) / 2,
    heartX + heartW / 2, heartY + topCurveHeight
  );
  ctx.bezierCurveTo(
    heartX + heartW / 2, heartY,
    heartX, heartY,
    heartX, heartY + topCurveHeight
  );
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 42px Arial';
  ctx.fillStyle = '#ffffff';
  const pctText = `${percent}`;
  const tw = ctx.measureText(pctText).width;
  ctx.fillText(pctText, heartX - tw / 2, heartY + heartH / 2 + 10);
  const barW = cardW - 220;
  const barH = 26;
  const barX = cardX + (cardW - barW) / 2;
  const barY = cardY + cardH - 95;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  const rr = barH / 2;
  ctx.moveTo(barX + rr, barY);
  ctx.arcTo(barX + barW, barY, barX + barW, barY + barH, rr);
  ctx.arcTo(barX + barW, barY + barH, barX, barY + barH, rr);
  ctx.arcTo(barX, barY + barH, barX, barY, rr);
  ctx.arcTo(barX, barY, barX + barW, barY, rr);
  ctx.closePath();
  ctx.fill();
  const fillW = Math.max(rr * 2, Math.floor(barW * (percent / 100)));
  const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  grad.addColorStop(0, '#ff4d6d');
  grad.addColorStop(1, '#ff8fa3');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(barX + rr, barY);
  ctx.arcTo(barX + fillW, barY, barX + fillW, barY + barH, rr);
  ctx.arcTo(barX + fillW, barY + barH, barX, barY + barH, rr);
  ctx.arcTo(barX, barY + barH, barX, barY, rr);
  ctx.arcTo(barX, barY, barX + fillW, barY, rr);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#ffffff';
  const pctBarText = `${percent}%`;
  const t2w = ctx.measureText(pctBarText).width;
  ctx.fillText(pctBarText, barX + barW / 2 - t2w / 2, barY + barH - 6);
  const comment = pickComment(percent);
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#ffffff';
  const cw = ctx.measureText(comment).width;
  ctx.fillText(comment, cardX + cardW / 2 - cw / 2, barY + barH + 40);
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffffff';
  const namesText = `${leftLabel}  <3  ${rightLabel}`;
  const nw = ctx.measureText(namesText).width;
  ctx.fillText(namesText, cardX + cardW / 2 - nw / 2, cardY + 60);
  return canvas.toBuffer('image/png');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('İki kullanıcı için aşk oranı görseli oluşturur')
    .addUserOption(o => o.setName('birinci').setDescription('Birinci kullanıcı').setRequired(false))
    .addUserOption(o => o.setName('ikinci').setDescription('İkinci kullanıcı').setRequired(false)),
  category: 'fun',
  description: 'İki kullanıcı arasında rastgele aşk oranı ve yorum üretir.',
  usage: '.ship @kullanıcı1 @kullanıcı2 | /ship',
  permissions: [],
  async execute(ctx, args) {
    let u1, u2;
    if (ctx.isCommand && ctx.isCommand()) {
      u1 = ctx.options.getUser('birinci') || (ctx.user || ctx.author);
      u2 = ctx.options.getUser('ikinci') || (ctx.user || ctx.author);
      if (u2.id === u1.id) {
        const cache = ctx.guild.members.cache;
        const filtered = cache.filter(m => !m.user.bot && m.id !== u1.id);
        let pick = filtered.size ? filtered.random() : null;
        if (!pick) {
          try {
            const owner = await ctx.guild.fetchOwner();
            pick = owner && owner.id !== u1.id && !owner.user.bot ? owner : null;
          } catch {}
        }
        u2 = pick ? pick.user : u1;
      }
    } else {
      const mentions = args.filter(a => /^<@!?\d+>$|\d+$/.test(a));
      if (mentions.length >= 2) {
        const id1 = mentions[0].replace(/\D/g, '');
        const id2 = mentions[1].replace(/\D/g, '');
        u1 = await ctx.client.users.fetch(id1).catch(() => null);
        u2 = await ctx.client.users.fetch(id2).catch(() => null);
      } else if (mentions.length === 1) {
        const id1 = mentions[0].replace(/\D/g, '');
        u1 = await ctx.client.users.fetch(id1).catch(() => null);
        u2 = ctx.author || ctx.user;
      } else {
        u1 = ctx.author || ctx.user;
        const cache = ctx.guild.members.cache;
        const filtered = cache.filter(m => !m.user.bot && m.id !== u1.id);
        let pick = filtered.size ? filtered.random() : null;
        if (!pick) {
          try {
            const owner = await ctx.guild.fetchOwner();
            pick = owner && owner.id !== u1.id && !owner.user.bot ? owner : null;
          } catch {}
        }
        u2 = pick ? pick.user : u1;
      }
    }
    if (!u1 || !u2) {
      return ctx.reply({ content: 'Kullanıcılar bulunamadı.', flags: MessageFlags.Ephemeral });
    }
    const p = Math.floor(Math.random() * 101);
    const leftAvatar = u1.displayAvatarURL({ extension: 'png', size: 512 });
    const rightAvatar = u2.displayAvatarURL({ extension: 'png', size: 512 });
    const buffer = await createShipImage(leftAvatar, rightAvatar, p, u1.username, u2.username);
    const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' });
    const embed = new EmbedBuilder()
      .setColor('#ff4d6d')
      .setTitle(`[ ${u1.username} ] ile [ ${u2.username} ] Arasındaki İlişki`)
      .setDescription(`Oran: %${p}\n${pickComment(p)}`)
      .setImage('attachment://ship.png');
    return ctx.reply({ embeds: [embed], files: [attachment] });
  }
};
