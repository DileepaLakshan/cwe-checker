/**
 * CWE location results rendering component
 */
export function renderCweLocationResults(resultsByCwe) {
  console.log('[renderer] renderCweLocationResults called', resultsByCwe);
  
  if (!resultsByCwe || Object.keys(resultsByCwe).length === 0) {
    console.log('[renderer] renderCweLocationResults: no resultsByCwe or empty object');
    return '<div class="no-issues">No CWE source locations were found.</div>';
  }

  return Object.entries(resultsByCwe).map(([cweId, hits]) => {
    if (!hits || hits.length === 0) {
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
        ${hits.map(hit => renderCWELocationHit(hit)).join('')}
      </div>
    `;
  }).join('');
}

function renderCWELocationHit(hit) {
  return `
    <div class="cwe-location-hit" role="button" tabindex="0" data-file="${hit.file || ''}" data-line="${hit.line || ''}">
      <p class="file-path"><b>${hit.file || 'Unknown file'}</b>${hit.line ? `:${hit.line}` : ''}</p>
      <p class="vuln-desc">${hit.message || hit.ruleId || 'No details available'}</p>
    </div>
  `;
}