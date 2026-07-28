/**
 * Recent projects component
 */
import { getRecentProjects } from '../utils/storage';
import { openWorkspace } from '../services/workspace-service';

export function renderRecentProjects() {
  const recents = getRecentProjects();
  const listEl = document.getElementById('recent-projects-list');
  const sectionEl = document.getElementById('recent-section');

  if (recents.length === 0) {
    if (sectionEl) sectionEl.style.display = 'none';
    return;
  }

  if (sectionEl) sectionEl.style.display = 'block';

  listEl.innerHTML = recents.map(r => `
    <div class="recent-item" data-path="${r.path}">
      <span class="recent-item-name">${r.name}</span>
      <span class="recent-item-path" title="${r.path}">${r.path}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.getAttribute('data-path');
      const name = item.querySelector('.recent-item-name').innerText;
      openWorkspace(path, name);
    });
  });
}