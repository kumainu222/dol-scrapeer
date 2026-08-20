const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');

const PAGES = [
    { url: 'http://gvo.gamedb.info/wiki/?Quest%2FMerchant%2FEurope', region: 'Europe' },
    { url: 'http://gvo.gamedb.info/wiki/?Quest%2FMerchant%2FOthers', region: 'Others' },
];

async function fetchPage(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return cheerio.load(iconv.decode(res.data, 'EUC-JP'));
}

function cellText($, $td) {
    $td.find('br').replaceWith(' ');
    return $td.text().replace(/\s+/g, ' ').trim();
}

function extractQuests($, sourceUrl, region) {
    const rows = [];

    $('#body table.style_table').each((_, table) => {
        $(table).find('tbody tr').each((_, tr) => {
            const $tds = $(tr).find('td');
            if ($tds.length < 12) return;

            const guild = cellText($, $($tds[0]));
            if (!guild) return; // 空の区切り行はスキップ

            const city = cellText($, $($tds[1]));

            const $questTd = $($tds[2]);
            const $link = $questTd.find('a').first();
            const questName = cellText($, $questTd);
            const questUrl = $link.length ? $link.attr('href') : null;

            const destinationRaw = cellText($, $($tds[3]));
            const { destination, bonusQuestDay, chronoQuest } = parseDestination(destinationRaw);
            const item = cellText($, $($tds[4]));
            const deadline = cellText($, $($tds[5]));
            const reward = cellText($, $($tds[6]));
            const rank = cellText($, $($tds[7]));
            const exp = cellText($, $($tds[8]));
            const fame = cellText($, $($tds[9]));
            const category = cellText($, $($tds[10]));
            const sheetsRaw = cellText($, $($tds[11]));
            const sheets = /^[xX]+$/.test(sheetsRaw) ? null : (sheetsRaw || null);


            rows.push({
                guild, city, questName, questUrl,
                destination, bonusQuestDay, chronoQuest,
                item, deadline, reward, rank, exp, fame, category, sheets,
                region, sourceUrl,
            });
        });
    });

    return rows;
}

const BQ_DAY_RE = /\(BQ([月火水木金土日])\)/;
const CQ_RE = /CQ([^\s()]+)/;

function normalizeParens(str) {
    return str.replace(/（/g, '(').replace(/）/g, ')');
  }
  
  function parseDestination(raw) {
    let s = normalizeParens(raw);
    let bonusQuestDay = null;
    let chronoQuest = null;
  
    // BQ(曜日) を除去
    const bqMatch = s.match(/\(BQ([月火水木金土日])\)/);
    if (bqMatch) {
      bonusQuestDay = bqMatch[1];
      s = s.replace(bqMatch[0], '');
    }
  
    // CQ表記: まずカッコ付き「(CQ...)」を優先的に丸ごと除去
    let cqMatch = s.match(/\(CQ([^)]*)\)/);
    if (cqMatch) {
      chronoQuest = cqMatch[1].trim();
      s = s.replace(cqMatch[0], '');
    } else {
      // カッコなしの「CQ18-3」のような表記
      cqMatch = s.match(/CQ([^\s()]+)/);
      if (cqMatch) {
        chronoQuest = cqMatch[1];
        s = s.replace(cqMatch[0], '');
      }
    }
  
    const cleaned = s.replace(/\s+/g, ' ').trim();
  
    return { destination: cleaned, bonusQuestDay, chronoQuest };
  }

async function main() {
    let allQuests = [];
    for (const page of PAGES) {
        const $ = await fetchPage(page.url);
        allQuests = allQuests.concat(extractQuests($, page.url, page.region));
    }

    const output = {
        updatedAt: new Date().toISOString(),
        quests: allQuests,
    };

    fs.mkdirSync('data', { recursive: true });
    fs.writeFileSync('data/quests.json', JSON.stringify(output, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});