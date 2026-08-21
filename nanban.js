const RANK = { '●': 4, '◎': 3, '▲': 2, '○': 1 };
const SYMBOL_LABEL = {
  '●': '43k付近', '◎': '38k付近', '▲': '28k付近',
  '○': '地域内で高価格', '▽': '地域内で低価格', '×': '取引不可',
};

let data = null;
let selected = new Set(); // "area::name"

fetch('./data/nanban.json')
  .then((res) => res.json())
  .then((json) => {
    data = json;
    document.getElementById('updated').textContent =
      `最終更新: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`;

    const legend = document.getElementById('legend-list');
    Object.entries(data.symbolLegend).forEach(([symbol, desc]) => {
      const li = document.createElement('li');
      li.textContent = `${symbol} … ${desc}`;
      legend.appendChild(li);
    });

    populateCategorySelect();
    renderChecklist();
    renderResults();
  });

function itemKey(item) {
  return `${item.area}::${item.name}`;
}

function populateCategorySelect() {
  const categories = [...new Set(data.items.map((item) => item.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ja'));
  const select = document.getElementById('filter-category');
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

function getFilteredItems() {
  const text = document.getElementById('search-text').value.trim().toLowerCase();
  const area = document.getElementById('filter-area').value;
  const category = document.getElementById('filter-category').value;
  return data.items.filter((item) => {
    if (area && item.area !== area) return false;
    if (category && item.category !== category) return false;
    if (text && !item.name.toLowerCase().includes(text)) return false;
    return true;
  });
}

function getItemTier(item) {
  const symbols = Object.values(item.marks);
  if (symbols.includes('●')) return 'premium'; // 特選
  if (symbols.includes('◎')) return 'recommended'; // 推奨
  return null;
}

const TIER_LABEL = { premium: '特選', recommended: '推奨' };
const AREA_ORDER = ['日本', '台湾', '朝鮮', '華南'];
const TIER_RANK = { premium: 2, recommended: 1 };

function renderChecklist() {
  const container = document.getElementById('item-checklist');
  container.innerHTML = '';
  const items = getFilteredItems();

  const sorted = [...items].sort((a, b) => {
    const areaDiff = AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area);
    if (areaDiff !== 0) return areaDiff;

    const tierDiff = (TIER_RANK[getItemTier(b)] || 0) - (TIER_RANK[getItemTier(a)] || 0);
    if (tierDiff !== 0) return tierDiff;

    return a.name.localeCompare(b.name, 'ja');
  });

  sorted.forEach((item) => {
    const key = itemKey(item);
    const tier = getItemTier(item);
    const tierClass = tier ? ` item-check-${tier}` : '';
    const badge = tier === 'premium' ? '<span class="tier-badge">🏅</span>' : '';

    const row = document.createElement('label');
    row.className = 'item-check-row' + tierClass;
    row.innerHTML = `
      <input type="checkbox" value="${key}" ${selected.has(key) ? 'checked' : ''} />
      ${badge}
      <span class="item-area-badge">${item.area}</span>
      <span class="item-check-name">${item.name}</span>
      <span class="item-check-category">${item.category}</span>
      ${tier ? `<span class="tier-label">${TIER_LABEL[tier]}</span>` : ''}
    `;
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) selected.add(key);
      else selected.delete(key);
      renderResults();
    });
    container.appendChild(row);
  });
}

const MARK_DISPLAY = {
  '●': '🏅',
  '◎': '◎',
  '▲': '▲',
  '○': '○',
};

function renderResults() {
  const resultList = document.getElementById('result-list');
  const summaryBox = document.getElementById('combined-summary');
  resultList.innerHTML = '';
  summaryBox.innerHTML = '';

  const selectedItems = data.items.filter((item) => selected.has(itemKey(item)));

  if (selectedItems.length === 0) {
    resultList.innerHTML = '<p class="empty-hint">左のリストから持出し交易品を選んでください。</p>';
    return;
  }

  selectedItems.forEach((item) => {
    const goodMarks = Object.entries(item.marks)
      .filter(([, symbol]) => symbol in RANK)
      .sort((a, b) => RANK[b[1]] - RANK[a[1]]);
    const avoidMarks = Object.entries(item.marks)
      .filter(([, symbol]) => symbol === '×' || symbol === '▽');

    const card = document.createElement('div');
    card.className = 'nanban-item-card';

    const chips = goodMarks.length
      ? goodMarks.map(([region, symbol]) =>
          `<span class="mark-chip mark-${symbol}">${MARK_DISPLAY[symbol]} ${region}</span>`
        ).join('')
      : '<span class="empty-hint">高値情報なし</span>';

    const avoidChips = avoidMarks.length
      ? avoidMarks.map(([region, symbol]) =>
          `<span class="mark-chip mark-avoid">${symbol} ${region}</span>`
        ).join('')
      : '';

    card.innerHTML = `
      <div class="nanban-item-header">
        <span class="item-area-badge">${item.area}</span>
        <strong>${item.name}</strong>
        <span class="item-check-category">${item.category}</span>
      </div>
      <div class="mark-chip-list">${chips}</div>
      ${avoidChips ? `<details class="avoid-details"><summary>避けたほうがよい地域</summary><div class="mark-chip-list">${avoidChips}</div></details>` : ''}
    `;
    resultList.appendChild(card);
  });

  if (selectedItems.length > 1) {
    const scoreByRegion = {};
    selectedItems.forEach((item) => {
      Object.entries(item.marks).forEach(([region, symbol]) => {
        if (!(symbol in RANK)) return;
        scoreByRegion[region] = (scoreByRegion[region] || 0) + RANK[symbol];
      });
    });
    const ranked = Object.entries(scoreByRegion).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (ranked.length) {
      summaryBox.innerHTML = `
        <div class="combined-box">
          <strong>まとめて売るなら(合計スコア上位)</strong>
          <div class="mark-chip-list">
            ${ranked.map(([region, score]) =>
              `<span class="mark-chip mark-combined">${region} (${score})</span>`
            ).join('')}
          </div>
        </div>
      `;
    }
  }
}
document.getElementById('filter-category').addEventListener('change', renderChecklist);
document.getElementById('search-text').addEventListener('input', renderChecklist);
document.getElementById('filter-area').addEventListener('change', renderChecklist);
document.getElementById('clear-selection').addEventListener('click', () => {
  selected.clear();
  renderChecklist();
  renderResults();
});