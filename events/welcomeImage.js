const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Eğer özel font kullanmak isterseniz:
// registerFont(path.join(__dirname, 'fonts', 'font.ttf'), { family: 'CustomFont' });

async function createWelcomeImage(username, memberCount, avatarURL, type = 'giris') {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  // Arka plan gradient (turuncu tonları)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (type === 'giris') {
    gradient.addColorStop(0, '#FF6B35');
    gradient.addColorStop(0.5, '#FF8C42');
    gradient.addColorStop(1, '#FFA726');
  } else {
    gradient.addColorStop(0, '#FF5722');
    gradient.addColorStop(0.5, '#FF7043');
    gradient.addColorStop(1, '#FF8A65');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Bina silueti çizimi (basit geometrik şekiller)
  drawCityscape(ctx, canvas.width, canvas.height);

  // Hoş geldin kartı arka planı (semi-transparent)
  const cardX = 50;
  const cardY = 50;
  const cardWidth = 700;
  const cardHeight = 300;
  
  ctx.fillStyle = 'rgba(139, 69, 19, 0.8)'; // Kahverengi transparan
  ctx.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  }
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 20);
  ctx.fill();

  // Kullanıcı avatarı (daha büyük ve güzel çerçeve)
  const avatarSize = 120;
  const avatarX = cardX + 40;
  const avatarY = cardY + (cardHeight - avatarSize) / 2;

  try {
    const avatar = await loadImage(avatarURL);
    
    // Avatar çerçevesi
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (error) {
    console.log('Avatar yüklenirken hata:', error);
    // Avatar yüklenemezse varsayılan bir avatar çiz
    ctx.fillStyle = '#CCCCCC';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Yazılar (daha modern ve okunabilir)
  const textX = avatarX + avatarSize + 30;
  
  // Ana başlık
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  const mainText = type === 'giris' ? 'HOŞ GELDİN!' : 'GÜLE GÜLE!';
  ctx.fillText(mainText, textX, cardY + 80);

  // Kullanıcı adı
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillStyle = '#FFF8DC'; // Bej renk
  ctx.fillText(username, textX, cardY + 140);

  // Üye sayısı
  ctx.font = '24px Arial, sans-serif';
  ctx.fillStyle = '#F0E68C'; // Açık sarı
  ctx.fillText(`${memberCount}. üye olarak katıldı!`, textX, cardY + 180);

  // Sunucu mesajı
  ctx.font = 'italic 18px Arial, sans-serif';
  ctx.fillStyle = '#FFFACD';
  const welcomeMsg = type === 'giris' 
    ? 'Sunucumuzda keyifli vakit geçirmeni diliyoruz!' 
    : 'Aramızdan ayrıldın, yolun açık olsun :(';
  ctx.fillText(welcomeMsg, textX, cardY + 220);

  // Gölge efektini temizle
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Dekoratif elementler
  drawDecorations(ctx, cardX, cardY, cardWidth, cardHeight, type);

  return canvas.toBuffer();
}

// Şehir silüeti çizen fonksiyon
function drawCityscape(ctx, width, height) {
  // Binalar
  const buildings = [
    { x: 0, y: height - 150, w: 80, h: 150 },
    { x: 80, y: height - 200, w: 60, h: 200 },
    { x: 140, y: height - 120, w: 70, h: 120 },
    { x: 210, y: height - 180, w: 90, h: 180 },
    { x: 300, y: height - 160, w: 75, h: 160 },
    { x: 375, y: height - 220, w: 85, h: 220 },
    { x: 460, y: height - 140, w: 65, h: 140 },
    { x: 525, y: height - 190, w: 80, h: 190 },
    { x: 605, y: height - 170, w: 70, h: 170 },
    { x: 675, y: height - 130, w: 60, h: 130 },
    { x: 735, y: height - 100, w: 65, h: 100 }
  ];

  buildings.forEach(building => {
    // Bina gövdesi
    ctx.fillStyle = 'rgba(139, 69, 19, 0.6)'; // Kahverengi transparan
    ctx.fillRect(building.x, building.y, building.w, building.h);
    
    // Pencereler
    ctx.fillStyle = 'rgba(255, 204, 0, 0.8)'; // Sarı ışık
    for (let row = 0; row < Math.floor(building.h / 30); row++) {
      for (let col = 0; col < Math.floor(building.w / 20); col++) {
        if (Math.random() > 0.3) { // %70 ihtimalle pencere yanar
          const winX = building.x + 5 + col * 20;
          const winY = building.y + 10 + row * 30;
          ctx.fillRect(winX, winY, 10, 15);
        }
      }
    }
  });
}

// Dekoratif elementler çizen fonksiyon
function drawDecorations(ctx, cardX, cardY, cardWidth, cardHeight, type) {
  // Köşelerde küçük yıldızlar
  const stars = [
    { x: cardX + 20, y: cardY + 20 },
    { x: cardX + cardWidth - 30, y: cardY + 20 },
    { x: cardX + 20, y: cardY + cardHeight - 30 },
    { x: cardX + cardWidth - 30, y: cardY + cardHeight - 30 }
  ];

  stars.forEach(star => {
    drawStar(ctx, star.x, star.y, 5, 8, 4);
  });

  // Alt kısımda dekoratif çizgi
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 200, cardY + cardHeight - 40);
  ctx.lineTo(cardX + cardWidth - 50, cardY + cardHeight - 40);
  ctx.stroke();
}

// Yıldız çizen fonksiyon
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

module.exports = { createWelcomeImage };
