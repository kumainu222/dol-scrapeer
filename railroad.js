function getTodayJST() {
    return new Date()
        .toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        .replace(/-/g, '/');
}

fetch('./data/railroad.json')
    .then((res) => res.json())
    .then((data) => {
        document.getElementById('updated').textContent =
            `最終更新: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`;

        renderGnb(data.grandNavalBattle);
        renderEntries(data.entries);
    });

// ---------- 鉄道イベントスケジュール ----------
function renderEntries(entries) {
    const today = getTodayJST();
    const container = document.getElementById('railroad-list');

    entries.forEach((entry) => {
        const ongoing = isOngoingToday(entry.date, today);
        const { headline, note } = formatScheduleText(entry.date);

        const item = document.createElement('details');
        item.className = 'railroad-entry' + (ongoing ? ' today' : '');
        item.open = ongoing;

        const summary = document.createElement('summary');
        summary.innerHTML = `
        <span class="entry-date">${headline}${ongoing ? ' <span class="badge">開催中</span>' : ''}</span>
        <span class="entry-server server-${entry.server}">${entry.server}</span>
        <span class="entry-name">${entry.eventName}</span>
        ${entry.location ? `<span class="entry-location">${entry.location}</span>` : ''}
      `;
        item.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'entry-body';

        if (note) {
            body.innerHTML += `<p class="entry-date-note">${note}</p>`;
        }
        if (entry.description) {
            body.innerHTML += `<p>${entry.description}</p>`;
        }
        if (entry.details) {
            const d = entry.details;
            body.innerHTML += `
          <div class="detail-grid">
            ${d.treasureItem ? `<div><span class="detail-label">謎の掘り出し物</span>${d.treasureItem}${d.treasurePrice ? `(${d.treasurePrice})` : ''}</div>` : ''}
            ${d.consumable ? `<div><span class="detail-label">消費アイテム</span>${d.consumable}${d.consumablePrice ? `(${d.consumablePrice})` : ''}</div>` : ''}
            ${d.equipmentName ? `<div><span class="detail-label">装備</span>${d.equipmentName}${d.equipmentEffect ? ` / ${d.equipmentEffect}` : ''}${d.equipmentPrice ? `(${d.equipmentPrice})` : ''}</div>` : ''}
          </div>
        `;
        }
        body.innerHTML += `<a class="source-link" href="${entry.sourceUrl}" target="_blank" rel="noopener noreferrer">元ページで見る</a>`;

        item.appendChild(body);
        container.appendChild(item);
    });
}

// ---------- 大海戦期間予定 ----------
function renderGnb(gnb) {
    if (!gnb) return;

    document.getElementById('gnb-latest').innerHTML = gnb.latest
        ? renderGnbCard(gnb.latest, true)
        : '<p>データがありません</p>';

    document.getElementById('gnb-history-summary').textContent =
        `過去の履歴 (${gnb.history.length}件)`;
    document.getElementById('gnb-history').innerHTML = gnb.history
        .map((entry) => renderGnbCard(entry, false))
        .join('');
}

// 今日がテキスト中の日付(単日 or 範囲)に含まれているか判定
function isOngoingToday(raw, today) {
    const dates = raw.match(/\d{4}\/\d{2}\/\d{2}/g);
    if (!dates || dates.length === 0) return false;
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    return today >= min && today <= max;
}

// 日付範囲(または単日)のテキストを「見出し用の日付」と「補足説明」に分離
function formatScheduleText(raw) {
    if (!raw) return { headline: '', note: '' };
    const allRanges = [...raw.matchAll(/\d{4}\/\d{2}\/\d{2}\s*[~～]\s*\d{4}\/\d{2}\/\d{2}/g)];
    const allSingles = [...raw.matchAll(/\d{4}\/\d{2}\/\d{2}/g)];

    let headline;
    if (allRanges.length) {
        headline = allRanges[allRanges.length - 1][0]; // 最後(=確定的な方)の範囲を採用
    } else if (allSingles.length) {
        headline = allSingles[allSingles.length - 1][0];
    } else {
        return { headline: raw, note: '' };
    }

    const note = raw.replace(headline, '').replace(/\s+/g, ' ').trim();
    return { headline, note };
}

function renderGnbCard(entry, isLatest) {
    const rows = [
        ['静観の場合', entry.calm.astraios, entry.calm.eos],
        ['実施の場合', entry.executed.astraios, entry.executed.eos],
        ['結果', entry.result.astraios, entry.result.eos],
    ];

    const rowsHtml = rows
        .filter(([, a, e]) => a || e)
        .map(
            ([label, a, e]) => `
          <div class="gnb-row">
            <span class="gnb-row-label">${label}</span>
            <span class="gnb-row-value">A: ${a || '-'}</span>
            <span class="gnb-row-value">E: ${e || '-'}</span>
          </div>
        `
        )
        .join('');

    const notes = [entry.result.astraiosNote, entry.result.eosNote]
        .filter((n) => n)
        .join(' / ');

    return `
      <div class="gnb-card ${isLatest ? 'gnb-latest' : ''}">
        <div class="gnb-date">${entry.historicalEvent}</div>
        ${rowsHtml}
        ${notes ? `<div class="gnb-note">${notes}</div>` : ''}
      </div>
    `;
}