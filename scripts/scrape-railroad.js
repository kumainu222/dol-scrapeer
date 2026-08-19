const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');

const TARGET_URL = 'http://gvo.gamedb.info/wiki/?TranscontinentalRailroad';
const SOURCE_ANCHOR = TARGET_URL + '#schedule';

async function fetchPage(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return cheerio.load(iconv.decode(res.data, 'EUC-JP'));
}

// colspan/rowspanを考慮してテーブルを正規化する
function normalizeTable($, $table) {
  const grid = [];
  const rowSpans = {}; // colIndex -> { remaining, text }

  $table.find('tbody > tr').each((rowIndex, tr) => {
    const rowData = [];
    let colIndex = 0;

    const fillPending = () => {
      while (rowSpans[colIndex] && rowSpans[colIndex].remaining > 0) {
        rowData[colIndex] = rowSpans[colIndex].text;
        rowSpans[colIndex].remaining--;
        colIndex++;
      }
    };

    fillPending();
    $(tr).find('td').each((_, td) => {
      fillPending();
      const $td = $(td);
      const text = $td.text().trim();
      const colspan = parseInt($td.attr('colspan') || '1', 10);
      const rowspan = parseInt($td.attr('rowspan') || '1', 10);
      for (let c = 0; c < colspan; c++) {
        rowData[colIndex] = text;
        if (rowspan > 1) {
          rowSpans[colIndex] = { remaining: rowspan - 1, text };
        }
        colIndex++;
      }
    });
    grid.push(rowData);
  });

  return grid;
}

function extractDate(text) {
  const m = (text || '').match(/\d{4}\/\d{2}\/\d{2}/);
  return m ? m[0] : null;
}

async function main() {
  const $ = await fetchPage(TARGET_URL);

  // 「南蛮品到来は...ランダムで選ばれる。」を含むaタグから、
  // その親ul(スケジュール説明)の直後にあるテーブルを取得
  const $anchor = $('a:contains("南蛮品到来は南蛮貿易の港固有の追加貿易品からランダムで選ばれる")');
  const $table = $anchor.closest('ul').next('div.ie5').find('table');

  const grid = normalizeTable($, $table);

  const rows = grid.map((cells) => {
    const eventName = cells[0] || '';
    const location = cells[1] && cells[1] !== eventName ? cells[1] : null;
    const detailCells = cells.slice(2, 9).filter((c) => c);
    const uniqueDetails = new Set(detailCells);

    let description = null;
    let details = null;
    if (uniqueDetails.size <= 1) {
      description = cells[2] || null;
    } else {
      details = {
        treasureItem: cells[2] || null,
        treasurePrice: cells[3] || null,
        consumable: cells[4] || null,
        consumablePrice: cells[5] || null,
        equipmentName: cells[6] || null,
        equipmentEffect: cells[7] || null,
        equipmentPrice: cells[8] || null,
      };
    }

    return {
      eventName,
      location,
      description,
      details,
      astraios: cells[9] || null,
      eos: cells[10] || null,
    };
  }).filter((r) => r.eventName);

  // ワールド別にカレンダーエントリへ展開
  const entries = [];
  for (const row of rows) {
    for (const [server, rawDate] of [['Astraios', row.astraios], ['Eos', row.eos]]) {
      if (!rawDate) continue;
      const sortDate = extractDate(rawDate);
      if (!sortDate) continue; // 日付が特定できない行はカレンダーに出さない
      entries.push({
        server,
        date: rawDate,
        sortDate,
        eventName: row.eventName,
        location: row.location,
        description: row.description,
        details: row.details,
        sourceUrl: SOURCE_ANCHOR,
      });
    }
  }

  entries.sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1)); // 降順

    // --- 大海戦期間予定 ---
    const $gnbTable = $('a#GrandNavalBattle').closest('h4').next('div.ie5').find('table');
    const gnbGrid = normalizeTable($, $gnbTable);

    const gnbRows = gnbGrid.map((cells) => ({
        historicalEvent: (cells[0] || '').replace(/\s+/g, ' ').trim(),
        calm: { astraios: cells[1] || null, eos: cells[2] || null },
        executed: { astraios: cells[3] || null, eos: cells[4] || null },
        result: {
        astraios: cells[5] || null,
        astraiosNote: cells[6] || null,
        eos: cells[7] || null,
        eosNote: cells[8] || null,
        },
    })).filter((r) => r.historicalEvent);

    const hasData = (r) =>
        r.calm.astraios || r.calm.eos || r.executed.astraios || r.executed.eos ||
        r.result.astraios || r.result.eos;

    const gnbWithData = gnbRows.filter(hasData);
    const gnbLatest = gnbWithData[gnbWithData.length - 1] || null;
    const gnbHistory = gnbWithData.slice(0, -1).reverse(); // 新しい順

    const output = {
        updatedAt: new Date().toISOString(),
        entries,
        grandNavalBattle: {
        sourceUrl: TARGET_URL + '#GrandNavalBattle',
        latest: gnbLatest,
        history: gnbHistory,
        },
    };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/railroad.json', JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});