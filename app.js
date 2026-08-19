const ITEM_LABELS = ['品目1', '品目2', '品目3', '品目4', '品目5', '品目6', '品目7', '品目8', '品目9', '品目10'];

fetch('./data/latest.json')
  .then((res) => res.json())
  .then((data) => {
    document.getElementById('updated').textContent =
      `最終更新: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`;

    const container = document.getElementById('worlds');

    Object.entries(data.worlds).forEach(([worldName, worldData]) => {
      const card = document.createElement('section');
      card.className = 'world-card';

      const title = document.createElement('h2');
      title.textContent = worldName;
      card.appendChild(title);

      // 最新情報
      card.appendChild(renderEntry(worldData.latest, true));

      // 過去履歴(折りたたみ)
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `過去の履歴 (${worldData.history.length - 1}件)`;
      details.appendChild(summary);

      worldData.history.slice(1).forEach((entry) => {
        details.appendChild(renderEntry(entry, false));
      });
      card.appendChild(details);

      container.appendChild(card);
    });
  });

function renderEntry(entry, isLatest) {
  const box = document.createElement('div');
  box.className = isLatest ? 'entry latest' : 'entry';

  const dateLine = document.createElement('div');
  dateLine.className = 'entry-date';
  dateLine.textContent = `${entry.date} ${entry.time}`;
  box.appendChild(dateLine);

  const grid = document.createElement('div');
  grid.className = 'item-grid';
  ITEM_LABELS.forEach((label, i) => {
    const cell = document.createElement('div');
    cell.className = 'item-cell';
    cell.innerHTML = `<span class="item-label">${label}</span><span class="item-value">${entry[`item${i + 1}`] || '-'}</span>`;
    grid.appendChild(cell);
  });
  box.appendChild(grid);

  return box;
}