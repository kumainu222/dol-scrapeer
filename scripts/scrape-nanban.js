const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');

const TARGET_URL = 'http://gvo.gamedb.info/wiki/?NanbanTrade';

const REGIONS = [
  '北欧', 'ドイツ', 'フランドル', 'ブリテン島', '北仏', 'イベリア',
  'イタリア・南仏', 'バルカン', '近東', '北アフリカ', 'トルコ', 'カリブ',
  '西アフリカ', '東アフリカ', 'アラブ', 'ペルシャ', 'インド',
  '東南アジア', 'インドシナ', '中南米西岸', '中南米東岸', 'オセアニア',
];

const VALID_SYMBOLS = new Set(['●', '◎', '▲', '○', '▽', '×']);

const AREAS = [
  { anchorId: 'Japan', label: '日本' },
  { anchorId: 'Taiwan', label: '台湾' },
  { anchorId: 'Korea', label: '朝鮮' },
  { anchorId: 'SouthChina', label: '華南' },
];

async function fetchPage(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return cheerio.load(iconv.decode(res.data, 'EUC-JP'));
}

function cellText($, $td) {
  return $td.text().replace(/\s+/g, '').trim();
}

function extractAreaTable($, area) {
  const $anchor = $(`a#${area.anchorId}`);
  const $h4 = $anchor.closest('h4');
  const $table = $h4.nextAll('div.ie5').first().find('table');

  const items = [];

  $table.find('tbody tr').each((_, tr) => {
    const $tds = $(tr).find('td');
    if ($tds.length < 25) return;

    const name = cellText($, $($tds[0]));
    if (!name) return; // 空の区切り行はスキップ

    const category = cellText($, $($tds[1]));

    const marks = {};
    // 前半12地域: td index 2〜13
    for (let i = 0; i < 12; i++) {
      const symbol = cellText($, $($tds[2 + i]));
      if (VALID_SYMBOLS.has(symbol)) marks[REGIONS[i]] = symbol;
    }
    // 後半10地域: td index 15〜24
    for (let i = 0; i < 10; i++) {
      const symbol = cellText($, $($tds[15 + i]));
      if (VALID_SYMBOLS.has(symbol)) marks[REGIONS[12 + i]] = symbol;
    }

    items.push({ area: area.label, name, category, marks });
  });

  return items;
}

async function main() {
  const $ = await fetchPage(TARGET_URL);

  let allItems = [];
  for (const area of AREAS) {
    allItems = allItems.concat(extractAreaTable($, area));
  }

  const output = {
    updatedAt: new Date().toISOString(),
    regions: REGIONS,
    symbolLegend: {
      '●': '売却価格43k付近',
      '◎': '売却価格38k付近',
      '▲': '売却価格28k付近',
      '○': 'その地域で特に高価格',
      '▽': 'その地域で特に低価格',
      '×': '取引不可',
    },
    items: allItems,
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/nanban.json', JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});