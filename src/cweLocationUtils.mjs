export function normalizeLocateResults(resultsByCwe) {
  if (!resultsByCwe) return {};

  if (resultsByCwe.results && typeof resultsByCwe.results === 'object' && !Array.isArray(resultsByCwe.results)) {
    return Object.fromEntries(
      Object.entries(resultsByCwe.results).map(([cweId, hits]) => [cweId, Array.isArray(hits) ? hits : []])
    );
  }

  if (typeof resultsByCwe === 'object' && !Array.isArray(resultsByCwe)) {
    return Object.fromEntries(
      Object.entries(resultsByCwe).map(([cweId, hits]) => [cweId, Array.isArray(hits) ? hits : []])
    );
  }

  return {};
}

export function renderCweLocationResults(resultsByCwe) {
  const normalized = normalizeLocateResults(resultsByCwe);
  const entries = Object.entries(normalized);

  if (entries.length === 0) {
    return '<div class="no-issues">No CWE source locations were found.</div>';
  }

  return entries.map(([cweId, hits]) => {
    if (!Array.isArray(hits) || hits.length === 0) {
      return `
        <div class="result-card cwe-location-card">
          <div class="card-header">
            <span class="vuln-id">${cweId}</span>
          </div>
          <div class="no-issues">No matching source locations were found for ${cweId}.</div>
        </div>
      `;
    }

    return `
      <div class="result-card cwe-location-card">
        <div class="card-header">
          <span class="vuln-id">${cweId}</span>
          <span class="severity info">${hits.length} matches</span>
        </div>
        ${hits.map(hit => `
          <div class="cwe-location-hit" role="button" tabindex="0" data-file="${hit.file || ''}" data-line="${hit.line || ''}">
            <p class="file-path"><b>${hit.file || 'Unknown file'}</b>${hit.line ? `:${hit.line}` : ''}</p>
            <p class="vuln-desc">${hit.message || hit.ruleId || 'No details available'}</p>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}
