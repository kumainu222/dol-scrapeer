const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');

const TARGET_URL = 'http://gvo.gamedb.info/wiki/?TradeItem%2FRare';

async function fetchPage(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer', // EUC-JPなのでバイナリで受け取る
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = iconv.decode(res.data, 'EUC-JP');
  return cheerio.load(html);
}

async function main() {
  const $ = await fetchPage(TARGET_URL);

  // 「2026年の相場情報」見出し(id=content_4_0)の直後にあるテーブルを狙う
  const $table = $('h4#content_4_0').next('div.ie5').find('table');

  const rows = [];
  $table.find('tbody tr').each((i, el) => {
    const cells = $(el).find('td');
    // 0:変動日 1:変動時刻 2:ワールド 3-12:品目1〜10
    const row = {
      date: $(cells[0]).text().trim(),
      time: $(cells[1]).text().trim(),
      world: $(cells[2]).text().trim(),
    };
    for (let n = 0; n < 10; n++) {
      row[`item${n + 1}`] = $(cells[3 + n]).text().trim();
    }
    rows.push(row);
  });

  // ワールドごとにグループ化(テーブルは新しい順に並んでいる前提)
  const worlds = {};
  for (const row of rows) {
    if (!worlds[row.world]) {
      worlds[row.world] = { latest: null, history: [] };
    }
    const entry = { date: row.date, time: row.time };
    for (let n = 1; n <= 10; n++) entry[`item${n}`] = row[`item${n}`];

    worlds[row.world].history.push(entry);
    if (!worlds[row.world].latest) {
      worlds[row.world].latest = entry; // 最初に出てきたもの=最新
    }
  }

  const output = {
    updatedAt: new Date().toISOString(),
    worlds,
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/latest.json', JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});