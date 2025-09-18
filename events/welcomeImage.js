const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Eğer özel font kullanmak isterseniz:
// registerFont(path.join(__dirname, 'fonts', 'font.ttf'), { family: 'CustomFont' });

async function createWelcomeImage(username, memberCount, avatarURL, type = 'giris') {
  const canvas = createCanvas(700, 250);
  const ctx = canvas.getContext('2d');

  // Arka plan
  ctx.fillStyle = type === 'giris' ? '#43b581' : '#f04747';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Kullanıcı avatarı
  const avatar = await loadImage(avatarURL);
  ctx.save();
  ctx.beginPath();
  ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 25, 25, 200, 200);
  ctx.restore();

  // Yazılar
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(type === 'giris' ? 'Sunucuya Hoş Geldin!' : 'Güle Güle!', 250, 80);
  ctx.font = '28px sans-serif';
  ctx.fillText(username, 250, 140);
  ctx.font = '22px sans-serif';
  ctx.fillText(`Toplam üye: ${memberCount}`, 250, 190);

  return canvas.toBuffer();
}

module.exports = { createWelcomeImage };
