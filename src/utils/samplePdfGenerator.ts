import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Helper to draw a spider illustration on a canvas and return PNG data URL
function generateSpiderPng(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  // Subtle parchment card background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 400, 300);

  // Border badge
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 380, 280);

  // Decorative inner border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, 368, 268);

  // Web background subtle lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  const cx = 200, cy = 140;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
    ctx.stroke();
  }
  for (let r = 30; r <= 110; r += 28) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spider Body (Cephalothorax and Abdomen)
  ctx.fillStyle = '#1e293b';
  // Abdomen (larger back)
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 34, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cephalothorax (head/mid)
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 25, 24, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spider glowing eyes
  ctx.fillStyle = '#ef4444';
  const eyePositions = [
    [-6, -32], [6, -32],
    [-12, -26], [12, -26],
    [-4, -22], [4, -22]
  ];
  for (const [ox, oy] of eyePositions) {
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spider 8 jointed Legs
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legDefs = [
    // Left legs
    [[cx - 15, cy - 30], [cx - 65, cy - 65], [cx - 110, cy - 40]],
    [[cx - 20, cy - 20], [cx - 85, cy - 35], [cx - 125, cy + 5]],
    [[cx - 20, cy + 5],  [cx - 85, cy + 25], [cx - 120, cy + 70]],
    [[cx - 15, cy + 25], [cx - 65, cy + 75], [cx - 95, cy + 115]],
    // Right legs
    [[cx + 15, cy - 30], [cx + 65, cy - 65], [cx + 110, cy - 40]],
    [[cx + 20, cy - 20], [cx + 85, cy - 35], [cx + 125, cy + 5]],
    [[cx + 20, cy + 5],  [cx + 85, cy + 25], [cx + 120, cy + 70]],
    [[cx + 15, cy + 25], [cx + 65, cy + 75], [cx + 95, cy + 115]],
  ];

  for (const leg of legDefs) {
    ctx.beginPath();
    ctx.moveTo(leg[0][0], leg[0][1]);
    ctx.lineTo(leg[1][0], leg[1][1]);
    ctx.lineTo(leg[2][0], leg[2][1]);
    ctx.stroke();
  }

  // Caption banner at bottom
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ILUSTRAÇÃO: ARANHA GIGANTE DAS CAVERNAS', 200, 275);

  return canvas.toDataURL('image/png');
}

// Generate an alternative replacement illustration (Wolf Crest) ready to swap in
export function generateWolfCrestPng(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  // Parchment card
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 400, 300);

  // Border
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 380, 280);

  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, 368, 268);

  // Shield Crest
  ctx.fillStyle = '#312e81';
  ctx.beginPath();
  ctx.moveTo(200, 45);
  ctx.lineTo(290, 85);
  ctx.lineTo(260, 195);
  ctx.lineTo(200, 235);
  ctx.lineTo(140, 195);
  ctx.lineTo(110, 85);
  ctx.closePath();
  ctx.fill();

  // Shield inner highlight
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Wolf head silhouette
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(200, 80);
  ctx.lineTo(225, 115);
  ctx.lineTo(245, 105);
  ctx.lineTo(235, 140);
  ctx.lineTo(250, 160);
  ctx.lineTo(220, 165);
  ctx.lineTo(200, 190);
  ctx.lineTo(180, 165);
  ctx.lineTo(150, 160);
  ctx.lineTo(165, 140);
  ctx.lineTo(155, 105);
  ctx.lineTo(175, 115);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4338ca';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BRASÃO DO LOBO DOS MONTES NEVADOS', 200, 275);

  return canvas.toDataURL('image/png');
}

export async function createSampleRpgPdf(): Promise<{ bytes: Uint8Array; dataUri: string }> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Helper for colors
  const primaryColor = rgb(0.12, 0.16, 0.28); // Slate 900
  const accentColor = rgb(0.31, 0.27, 0.76); // Indigo 600
  const textColor = rgb(0.2, 0.25, 0.33); // Slate 700
  const lightBg = rgb(0.96, 0.97, 0.99); // Slate 50
  const borderColor = rgb(0.82, 0.86, 0.91);

  // PAGE 1: COVER & TABLE OF CONTENTS (Índice)
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header Banner
  page1.drawRectangle({
    x: 40,
    y: height - 120,
    width: width - 80,
    height: 75,
    color: primaryColor,
  });

  page1.drawText('CRÔNICAS DE ELDORIA', {
    x: 60,
    y: height - 85,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Livro Básico de Regras do Aventureiro (RPG - Edição Clássica)', {
    x: 60,
    y: height - 108,
    size: 11,
    font: fontRegular,
    color: rgb(0.85, 0.89, 0.95),
  });

  // Table of Contents Section Box
  page1.drawRectangle({
    x: 40,
    y: height - 420,
    width: width - 80,
    height: 275,
    color: lightBg,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page1.drawText('ÍNDICE GERAL & SUMÁRIO', {
    x: 60,
    y: height - 170,
    size: 15,
    font: fontBold,
    color: accentColor,
  });

  page1.drawLine({
    start: { x: 60, y: height - 180 },
    end: { x: width - 60, y: height - 180 },
    color: borderColor,
    thickness: 1,
  });

  const tocEntries = [
    { title: 'Capítulo 1: Introdução & Regras Básicas', page: 'Página 2', desc: 'Conceito do jogo, testes de atributos e rolagens de d20' },
    { title: 'Capítulo 2: Criação de Personagens', page: 'Página 3', desc: 'Raças, classes (Guerreiro, Mago, Ladino) e modificadores' },
    { title: 'Capítulo 3: Equipamentos & Armas', page: 'Página 4', desc: 'Tabela de armas, armaduras, escudos e itens de viagem' },
    { title: 'Capítulo 4: Bestiário & Perigos das Masmorras', page: 'Página 5', desc: 'Monstros, criaturas cavernosas e aranha gigante' },
  ];

  let currentY = height - 215;
  tocEntries.forEach((entry, idx) => {
    // Number badge
    page1.drawRectangle({
      x: 60,
      y: currentY - 5,
      width: 22,
      height: 22,
      color: accentColor,
    });
    page1.drawText(`${idx + 1}`, {
      x: 68,
      y: currentY + 1,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page1.drawText(entry.title, {
      x: 95,
      y: currentY + 2,
      size: 12,
      font: fontBold,
      color: primaryColor,
    });

    page1.drawText(entry.page, {
      x: width - 120,
      y: currentY + 2,
      size: 11,
      font: fontBold,
      color: accentColor,
    });

    page1.drawText(entry.desc, {
      x: 95,
      y: currentY - 14,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });

    currentY -= 52;
  });

  // Editorial Callout on Page 1
  page1.drawRectangle({
    x: 40,
    y: 80,
    width: width - 80,
    height: 180,
    color: rgb(0.95, 0.98, 1.0),
    borderColor: rgb(0.68, 0.8, 0.95),
    borderWidth: 1.5,
  });

  page1.drawText('DICA DO EDITOR IA & ESTÚDIO:', {
    x: 60,
    y: 235,
    size: 12,
    font: fontBold,
    color: accentColor,
  });

  page1.drawText(
    'Este documento foi estruturado para demonstrar todo o poder de edição do PDF Studio Master:',
    { x: 60, y: 215, size: 10, font: fontRegular, color: textColor }
  );
  page1.drawText(
    '1. Use o painel Documento para navegar pelos capítulos do livro.',
    { x: 75, y: 195, size: 9.5, font: fontRegular, color: textColor }
  );
  page1.drawText(
    '2. Edite os textos dos capítulos preservando o alinhamento e enquadramento visual.',
    { x: 75, y: 175, size: 9.5, font: fontRegular, color: textColor }
  );
  page1.drawText(
    '3. Vá até a Página 5 e use a ferramenta "Remover Imagem" para remover a Aranha indesejada!',
    { x: 75, y: 155, size: 9.5, font: fontBold, color: primaryColor }
  );
  page1.drawText(
    '4. Substitua a arte da aranha pelo Brasão do Lobo ou gere uma nova ilustração com IA.',
    { x: 75, y: 135, size: 9.5, font: fontRegular, color: textColor }
  );
  page1.drawText(
    '5. Teste o movimento de pinçar (pinch-to-zoom) no celular ou o zoom fluido na barra.',
    { x: 75, y: 115, size: 9.5, font: fontRegular, color: textColor }
  );

  // Footer
  page1.drawText('Página 1 de 5 • PDF Studio Master', {
    x: width / 2 - 80,
    y: 35,
    size: 9,
    font: fontRegular,
    color: textColor,
  });

  // PAGE 2: CAPÍTULO 1 - REGRAS BÁSICAS
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('CAPÍTULO 1: INTRODUÇÃO & REGRAS BÁSICAS', {
    x: 40,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: accentColor,
  });
  page2.drawLine({
    start: { x: 40, y: height - 70 },
    end: { x: width - 40, y: height - 70 },
    color: borderColor,
    thickness: 1,
  });

  const p2Text1 =
    'O RPG de mesa é um jogo narrativo onde os participantes assumem o papel de heróis em um mundo repleto de mistérios, magia e perigos ancestrais. Um jogador assume o papel de Mestre da Masmorra (Narrador), descrevendo os cenários, personagens secundários e desafios.';

  page2.drawText(p2Text1, {
    x: 40,
    y: height - 105,
    size: 10.5,
    maxWidth: width - 80,
    lineHeight: 16,
    font: fontRegular,
    color: textColor,
  });

  // Rule Box
  page2.drawRectangle({
    x: 40,
    y: height - 320,
    width: width - 80,
    height: 160,
    color: lightBg,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page2.drawText('A REGRA DO D20 (DADO DE VINTE FACES)', {
    x: 60,
    y: height - 185,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });

  const ruleBullets = [
    '• Teste de Habilidade: D20 + Modificador de Atributo >= Classe de Dificuldade (CD).',
    '• Sucesso Crítico: Tirar um resultado natural 20 sempre resulta em sucesso espetacular.',
    '• Falha Crítica: Tirar um 1 natural indica uma complicação narrativa imediata.',
    '• Vantagem e Desvantagem: Role dois d20 e escolha o maior (vantagem) ou menor (desvantagem).',
  ];

  let rY = height - 215;
  ruleBullets.forEach((b) => {
    page2.drawText(b, {
      x: 60,
      y: rY,
      size: 10,
      font: fontRegular,
      color: textColor,
    });
    rY -= 24;
  });

  // Second paragraph with an intentional small typo for AI correction demo!
  page2.drawText('DIAGRAMAÇÃO E ENQUADRAMENTO DAS AVENTURAS', {
    x: 40,
    y: height - 365,
    size: 13,
    font: fontBold,
    color: accentColor,
  });

  const typoText =
    'Ao planejar um combate nas masmorras subterraneas, o mestre deve manter a claresa das distâncias e posicionamentos dos personagems. Cada rodada representa 6 segundos de tempo fictício.';

  page2.drawText(typoText, {
    x: 40,
    y: height - 395,
    size: 10.5,
    maxWidth: width - 80,
    lineHeight: 16,
    font: fontRegular,
    color: textColor,
  });

  page2.drawText('Página 2 de 5 • Capítulo 1', {
    x: width / 2 - 60,
    y: 35,
    size: 9,
    font: fontRegular,
    color: textColor,
  });

  // PAGE 3: CAPÍTULO 2 - CRIAÇÃO DE PERSONAGENS
  const page3 = pdfDoc.addPage([595.28, 841.89]);
  page3.drawText('CAPÍTULO 2: CRIAÇÃO DE PERSONAGENS', {
    x: 40,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: accentColor,
  });
  page3.drawLine({
    start: { x: 40, y: height - 70 },
    end: { x: width - 40, y: height - 70 },
    color: borderColor,
    thickness: 1,
  });

  // Columns for 3 Classes
  const colWidth = (width - 100) / 3;
  const classes = [
    { name: 'GUERREIRO', hitDice: 'd10', primary: 'Força & Constituição', desc: 'Mestres do combate marcial com espadas e armaduras pesadas.' },
    { name: 'MAGO', hitDice: 'd6', primary: 'Inteligência', desc: 'Eruditos das artes arcanas capazes de conjurar bolas de fogo e feitiços.' },
    { name: 'LADINO', hitDice: 'd8', primary: 'Destreza', desc: 'Especialistas em furtividade, desarmar armadilhas e ataques furtivos.' },
  ];

  classes.forEach((cls, i) => {
    const colX = 40 + i * (colWidth + 10);
    page3.drawRectangle({
      x: colX,
      y: height - 280,
      width: colWidth,
      height: 190,
      color: lightBg,
      borderColor: borderColor,
      borderWidth: 1,
    });

    page3.drawRectangle({
      x: colX,
      y: height - 120,
      width: colWidth,
      height: 30,
      color: accentColor,
    });

    page3.drawText(cls.name, {
      x: colX + 15,
      y: height - 102,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page3.drawText(`Dado de Vida: ${cls.hitDice}`, {
      x: colX + 10,
      y: height - 145,
      size: 9.5,
      font: fontBold,
      color: primaryColor,
    });

    page3.drawText(`Foco: ${cls.primary}`, {
      x: colX + 10,
      y: height - 165,
      size: 9,
      font: fontRegular,
      color: textColor,
    });

    page3.drawText(cls.desc, {
      x: colX + 10,
      y: height - 195,
      size: 9,
      maxWidth: colWidth - 20,
      lineHeight: 14,
      font: fontRegular,
      color: textColor,
    });
  });

  page3.drawText('ATRIBUTOS PRINCIPAIS DO PERSONAGEM', {
    x: 40,
    y: height - 325,
    size: 13,
    font: fontBold,
    color: primaryColor,
  });

  const attributes = [
    '• Força (FOR): Potência física, levantamento e bônus de dano corpo a corpo.',
    '• Destreza (DES): Agilidade, reflexos, iniciativa e ataques à distância.',
    '• Constituição (CON): Vigor, pontos de vida e resistência a venenos e cansaço.',
    '• Inteligência (INT): Memória, raciocínio lógico e conhecimento arcano.',
    '• Sabedoria (SAB): Percepção, intuição aguçada e força de vontade.',
    '• Carisma (CAR): Liderança, persuasão e força de personalidade magnética.',
  ];

  let attY = height - 355;
  attributes.forEach((attr) => {
    page3.drawText(attr, {
      x: 40,
      y: attY,
      size: 9.5,
      font: fontRegular,
      color: textColor,
    });
    attY -= 20;
  });

  page3.drawText('Página 3 de 5 • Capítulo 2', {
    x: width / 2 - 60,
    y: 35,
    size: 9,
    font: fontRegular,
    color: textColor,
  });

  // PAGE 4: CAPÍTULO 3 - EQUIPAMENTOS & ARMAS
  const page4 = pdfDoc.addPage([595.28, 841.89]);
  page4.drawText('CAPÍTULO 3: EQUIPAMENTOS & ARMAS', {
    x: 40,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: accentColor,
  });
  page4.drawLine({
    start: { x: 40, y: height - 70 },
    end: { x: width - 40, y: height - 70 },
    color: borderColor,
    thickness: 1,
  });

  // Equipment Table Header
  const tableTop = height - 110;
  page4.drawRectangle({
    x: 40,
    y: tableTop - 25,
    width: width - 80,
    height: 25,
    color: primaryColor,
  });

  page4.drawText('ITEM / ARMA', { x: 50, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page4.drawText('DANO / EFEITO', { x: 230, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page4.drawText('PREÇO (PO)', { x: 380, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page4.drawText('PESO (KG)', { x: 480, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });

  const tableRows = [
    { item: 'Espada Longa de Aço', stat: '1d8 cortante (versátil 1d10)', price: '15 PO', weight: '1.5 kg' },
    { item: 'Arco Curto de Caça', stat: '1d6 perfurante (alcance 24m)', price: '25 PO', weight: '1.0 kg' },
    { item: 'Escudo de Carvalho Reforçado', stat: '+2 na Classe de Armadura', price: '10 PO', weight: '3.0 kg' },
    { item: 'Cota de Malha Élfica', stat: 'CA 16 (sem bônus de Des)', price: '75 PO', weight: '20 kg' },
    { item: 'Poção de Cura Menor', stat: 'Restaura 2d4 + 2 Pontos de Vida', price: '50 PO', weight: '0.2 kg' },
    { item: 'Kit de Aventureiro', stat: 'Mochila, tochas, corda, ração 5d', price: '12 PO', weight: '8.0 kg' },
  ];

  let rowY = tableTop - 50;
  tableRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      page4.drawRectangle({
        x: 40,
        y: rowY - 5,
        width: width - 80,
        height: 22,
        color: rgb(0.97, 0.98, 1.0),
      });
    }
    page4.drawText(row.item, { x: 50, y: rowY, size: 9.5, font: fontBold, color: primaryColor });
    page4.drawText(row.stat, { x: 230, y: rowY, size: 9, font: fontRegular, color: textColor });
    page4.drawText(row.price, { x: 380, y: rowY, size: 9, font: fontBold, color: accentColor });
    page4.drawText(row.weight, { x: 480, y: rowY, size: 9, font: fontRegular, color: textColor });
    rowY -= 26;
  });

  page4.drawText('Página 4 de 5 • Capítulo 3', {
    x: width / 2 - 60,
    y: 35,
    size: 9,
    font: fontRegular,
    color: textColor,
  });

  // PAGE 5: CAPÍTULO 4 - BESTIÁRIO (CONTAINS THE SPIDER IMAGE TO REMOVE!)
  const page5 = pdfDoc.addPage([595.28, 841.89]);
  page5.drawText('CAPÍTULO 4: BESTIÁRIO & PERIGOS', {
    x: 40,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: accentColor,
  });
  page5.drawLine({
    start: { x: 40, y: height - 70 },
    end: { x: width - 40, y: height - 70 },
    color: borderColor,
    thickness: 1,
  });

  page5.drawText('ARANHA GIGANTE DAS CAVERNAS PROFUNDAS', {
    x: 40,
    y: height - 95,
    size: 14,
    font: fontBold,
    color: rgb(0.85, 0.15, 0.15),
  });

  const spiderText =
    'Criaturas aracnídeas monstruosas que habitam fendas úmidas e ruínas esquecidas. Elas atacam descendo do teto silenciosamente, envolvendo presas desavisadas em teias viscosas antes de injetar seu veneno paralisante.';

  page5.drawText(spiderText, {
    x: 40,
    y: height - 125,
    size: 10,
    maxWidth: width - 80,
    lineHeight: 15,
    font: fontRegular,
    color: textColor,
  });

  // Stats Box
  page5.drawRectangle({
    x: 40,
    y: height - 265,
    width: width - 80,
    height: 120,
    color: rgb(1.0, 0.97, 0.97),
    borderColor: rgb(0.9, 0.7, 0.7),
    borderWidth: 1,
  });

  page5.drawText('FICHA DE AMEAÇA: ARANHA GIGANTE (DESAFIO 1)', {
    x: 55,
    y: height - 165,
    size: 10.5,
    font: fontBold,
    color: rgb(0.7, 0.1, 0.1),
  });

  const spiderStats = [
    '• Pontos de Vida: 26 (4d10 + 4) | Classe de Armadura: 14 (carapaça quitinosa)',
    '• Sentidos: Percepção às Cegas 9m, Sentido da Teia 18m, Percepção Passiva 12',
    '• Ataque de Mordida: +5 para acertar, dano 1d8+3 perfurante + 2d8 de dano de veneno.',
    '• Lançar Teia (Recarga 5-6): Alcance 18m, alvo fica Restrito até passar em teste de FOR CD 12.',
  ];

  let spY = height - 190;
  spiderStats.forEach((st) => {
    page5.drawText(st, { x: 55, y: spY, size: 9, font: fontRegular, color: textColor });
    spY -= 20;
  });

  // Embed the Spider PNG directly into the PDF!
  const spiderDataUrl = generateSpiderPng();
  const spiderBase64 = spiderDataUrl.split(',')[1];
  const spiderImageBytes = Uint8Array.from(atob(spiderBase64), (c) => c.charCodeAt(0));
  const embeddedSpiderImage = await pdfDoc.embedPng(spiderImageBytes);

  // Position the spider illustration clearly on page 5
  const spiderImgWidth = 360;
  const spiderImgHeight = 270;
  const spiderImgX = (width - spiderImgWidth) / 2;
  const spiderImgY = height - 570;

  page5.drawImage(embeddedSpiderImage, {
    x: spiderImgX,
    y: spiderImgY,
    width: spiderImgWidth,
    height: spiderImgHeight,
  });

  // Notice annotation note below spider
  page5.drawRectangle({
    x: 40,
    y: 80,
    width: width - 80,
    height: 75,
    color: rgb(0.98, 0.98, 0.88),
    borderColor: rgb(0.85, 0.8, 0.4),
    borderWidth: 1,
  });

  page5.drawText('ÁREA DE TESTE DE REMOÇÃO / SUBSTITUIÇÃO DE IMAGEM:', {
    x: 55,
    y: 135,
    size: 10,
    font: fontBold,
    color: rgb(0.5, 0.4, 0.1),
  });
  page5.drawText(
    'Se você não deseja ver a imagem da aranha, utilize o botão "Remover Imagem / Ocultar" na barra superior.',
    { x: 55, y: 115, size: 9, font: fontRegular, color: textColor }
  );
  page5.drawText(
    'Você também pode substituí-la pelo "Brasão do Lobo" ou qualquer outra arte sem quebrar a diagramação do texto!',
    { x: 55, y: 98, size: 9, font: fontBold, color: primaryColor }
  );

  page5.drawText('Página 5 de 5 • Capítulo 4', {
    x: width / 2 - 60,
    y: 35,
    size: 9,
    font: fontRegular,
    color: textColor,
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const dataUri = URL.createObjectURL(blob);

  return { bytes: pdfBytes, dataUri };
}
