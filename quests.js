const BQ_COLORS = {
    '日': '#e74c3c', '月': '#3498db', '火': '#e67e22',
    '水': '#1abc9c', '木': '#27ae60', '金': '#f1c40f', '土': '#9b59b6',
  };
  
  let allQuests = [];
  
  fetch('./data/quests.json')
    .then((res) => res.json())
    .then((data) => {
      document.getElementById('updated').textContent =
        `最終更新: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`;
      allQuests = data.quests;
  
      populateSelect('filter-guild', uniqueSorted(allQuests.map((q) => q.guild)));
      populateSelect('filter-destination', uniqueSorted(allQuests.map((q) => q.destination)));
      populateSelect('filter-category', uniqueSorted(allQuests.map((q) => q.category)));
  
      render();
    });
  
  function uniqueSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
  }
  
  function populateSelect(id, values) {
    const select = document.getElementById(id);
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }
  
  function getFilters() {
    return {
      text: document.getElementById('search-text').value.trim().toLowerCase(),
      guild: document.getElementById('filter-guild').value,
      destination: document.getElementById('filter-destination').value,
      category: document.getElementById('filter-category').value,
    };
  }
  
  function matchesFilters(q, f) {
    if (f.guild && q.guild !== f.guild) return false;
    if (f.destination && q.destination !== f.destination) return false;
    if (f.category && q.category !== f.category) return false;
    if (f.text) {
      const hay = `${q.questName} ${q.item}`.toLowerCase();
      if (!hay.includes(f.text)) return false;
    }
    return true;
  }
  
  function bqBadge(day) {
    if (!day) return '';
    const color = BQ_COLORS[day] || '#999';
    return `<span class="bq-badge" style="background:${color}">${day}</span>`;
  }
  
  function cqBadge(cq) {
    if (!cq) return '';
    return `<span class="cq-badge" title="時代限定クエスト: ${cq}">⏳${cq}</span>`;
  }
  
  function render() {
    const f = getFilters();
    const filtered = allQuests.filter((q) => matchesFilters(q, f));
  
    document.getElementById('result-count').textContent = `${filtered.length}件`;
  
    const container = document.getElementById('quest-list');
    container.innerHTML = '';
  
    filtered.forEach((q) => {
      const item = document.createElement('details');
      item.className = 'quest-entry';
  
      const summary = document.createElement('summary');
      summary.innerHTML = `
        <span class="quest-guild">${q.guild}</span>
        <span class="quest-city">${q.city}</span>
        <a class="quest-name" href="${q.questUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${q.questName}</a>
        <span class="quest-dest">→ ${q.destination}${bqBadge(q.bonusQuestDay)}${cqBadge(q.chronoQuest)}</span>
        <span class="quest-category">${q.category}</span>
        <span class="quest-sheets">${q.sheets ? q.sheets + '枚' : '枚数不明'}</span>
      `;
      item.appendChild(summary);
  
      const body = document.createElement('div');
      body.className = 'quest-body';
      body.innerHTML = `
        <div class="detail-grid">
          <div><span class="detail-label">品物</span>${q.item || '-'}</div>
          <div><span class="detail-label">期限</span>${q.deadline || '-'}</div>
          <div><span class="detail-label">報酬</span>${q.reward || '-'}</div>
          <div><span class="detail-label">ランク</span>${q.rank || '-'}</div>
          <div><span class="detail-label">経験</span>${q.exp || '-'}</div>
          <div><span class="detail-label">名声</span>${q.fame || '-'}</div>
        </div>
      `;
      item.appendChild(body);
  
      container.appendChild(item);
    });
  }
  
  ['search-text'].forEach((id) =>
    document.getElementById(id).addEventListener('input', render)
  );
  ['filter-guild', 'filter-destination', 'filter-category'].forEach((id) =>
    document.getElementById(id).addEventListener('change', render)
  );
  document.getElementById('reset-filters').addEventListener('click', () => {
    document.getElementById('search-text').value = '';
    document.getElementById('filter-guild').value = '';
    document.getElementById('filter-destination').value = '';
    document.getElementById('filter-category').value = '';
    render();
  });