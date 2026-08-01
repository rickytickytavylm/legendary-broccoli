/**
 * Parse landing/leo → frontend/data/leo/*.json
 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../landing/leo');
const outDir = path.resolve(__dirname, '../data/leo');
const text = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clean(value) {
  return String(value || '')
    .replace(/^`+|`+$/g, '')
    .trim();
}

function sectionBetween(startRe, endRe) {
  const start = text.search(startRe);
  if (start < 0) return '';
  const rest = text.slice(start);
  const endMatch = rest.search(endRe);
  return endMatch < 0 ? rest : rest.slice(0, endMatch);
}

// ─── 1. Illusions ─────────────────────────────────────────
function parseIllusions() {
  const chunk = sectionBetween(/^# 1\. Иллюзии зависимого/m, /^# 2\. Тематический словарь/m);
  const cards = [];
  const blocks = chunk.split(/\n###\s+\d+\.\s+/).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const title = (lines[0] || '').trim();
    const get = (label) => {
      const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`);
      const m = block.match(re);
      return clean(m ? m[1] : '');
    };
    const fears = [];
    const fearBlock = block.match(/\*\*Страхи:\*\*\s*\n((?:\s*-\s+(?!\*\*)[^\n]+\n?)+)/);
    if (fearBlock) {
      fearBlock[1].split('\n').forEach((line) => {
        const m = line.match(/^\s*-\s+(.+)/);
        if (m) fears.push(clean(m[1]));
      });
    }
    cards.push({
      id: get('ID') || `illusion_${cards.length + 1}`,
      title,
      mechanism: get('Механизм'),
      mechanismDesc: get('Описание механизма'),
      addictionType: get('Тип зависимости'),
      meaning: get('Смысл'),
      fears,
      explanation: get('Пояснение'),
      color: get('Цвет') || '#BA68C8',
    });
  }
  return cards;
}

// ─── 2. Dictionary ────────────────────────────────────────
function parseDictionary() {
  const chunk = sectionBetween(/^# 2\. Тематический словарь/m, /^# 3\./m);
  const terms = [];
  const blocks = chunk.split(/\n###\s+\d+\.\s+/).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const title = (lines[0] || '').trim();
    const body = lines.slice(1).join('\n').trim();
    terms.push({ id: `dict_${terms.length + 1}`, title, body });
  }
  return terms;
}

// ─── 3. I-statements ──────────────────────────────────────
function parseIStatements() {
  const chunk = sectionBetween(/^# 3\./m, /^# 4\./m);
  const items = [];
  // Prefer #### numbered list with **Агрессивная:** / **Я-высказывание:**
  const blocks = chunk.split(/\n####\s+\d+\s*\n/).slice(1);
  if (blocks.length) {
    for (const block of blocks) {
      const aggressive = (block.match(/\*\*Агрессивная:\*\*\s*(.+)/) || [])[1] || '';
      const iStatement = (block.match(/\*\*Я-высказывание:\*\*\s*(.+)/) || [])[1] || '';
      if (aggressive || iStatement) {
        items.push({
          id: `i_${items.length + 1}`,
          aggressive: aggressive.trim(),
          iStatement: iStatement.trim(),
        });
      }
    }
  }
  // Fallback: markdown table rows
  if (!items.length) {
    const rows = chunk.match(/^\|\s*\d+\s*\|.+\|$/gm) || [];
    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        items.push({
          id: `i_${items.length + 1}`,
          aggressive: cells[1],
          iStatement: cells[2],
        });
      }
    }
  }
  return items;
}

// ─── 4. Emotional antivirus ───────────────────────────────
function parseAntivirus() {
  const chunk = sectionBetween(/^# 4\./m, /^# 5\./m);
  const items = [];
  const blocks = chunk.split(/\n####\s+\d+\s*\n/).slice(1);
  for (const block of blocks) {
    const virus = (block.match(/\*\*Мысль \(вирус\):\*\*\s*(.+)/) || [])[1] || '';
    const antivirus = (block.match(/\*\*Антивирус \(ответ\):\*\*\s*(.+)/) || [])[1] || '';
    if (virus || antivirus) {
      items.push({
        id: `av_${items.length + 1}`,
        virus: virus.trim(),
        antivirus: antivirus.trim(),
      });
    }
  }
  return items;
}

ensureDir(outDir);
const illusions = parseIllusions();
const dictionary = parseDictionary();
const iStatements = parseIStatements();
const antivirus = parseAntivirus();

fs.writeFileSync(path.join(outDir, 'illusions.json'), JSON.stringify(illusions, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'dictionary.json'), JSON.stringify(dictionary, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'i-statements.json'), JSON.stringify(iStatements, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'antivirus.json'), JSON.stringify(antivirus, null, 2), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'index.json'),
  JSON.stringify(
    {
      tools: [
        {
          id: 'illusions',
          title: 'Иллюзии зависимого',
          desc: 'Узнаваемые оправдания и защитные механизмы — переверни карточку и увидь, что стоит за фразой.',
          href: '/tools/illusions/',
          count: illusions.length,
        },
        {
          id: 'dictionary',
          title: 'Тематический словарь',
          desc: 'Короткие объяснения терминов зависимости и психологии без академической каши.',
          href: '/tools/dictionary/',
          count: dictionary.length,
        },
        {
          id: 'i-statements',
          title: 'Я-высказывания',
          desc: 'Из обвинения — в ясный разговор о своих чувствах и потребностях.',
          href: '/tools/i-statements/',
          count: iStatements.length,
        },
        {
          id: 'antivirus',
          title: 'Эмоциональный антивирус',
          desc: 'Негативная мысль → здоровая альтернатива. Нажми карточку, чтобы перевернуть.',
          href: '/tools/antivirus/',
          count: antivirus.length,
        },
      ],
    },
    null,
    2
  ),
  'utf8'
);

console.log({
  illusions: illusions.length,
  dictionary: dictionary.length,
  iStatements: iStatements.length,
  antivirus: antivirus.length,
});
