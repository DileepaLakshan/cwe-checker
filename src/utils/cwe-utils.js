/**
 * CWE-related utility functions
 */
export function collectCweIds(metadata = {}, fallbackId = '') {
  const ids = new Set();
  const values = [metadata.cwe, metadata.cwe_id, metadata.cwe_ids, metadata.CWE, metadata.CweID, fallbackId];

  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(visit);
      return;
    }

    const matches = String(value).match(/CWE[-_:\s]*\d+/gi) || [];
    matches.forEach(match => {
      const number = match.replace(/\D/g, '');
      if (number) ids.add(`CWE-${number}`);
    });
  };

  values.forEach(visit);
  return [...ids];
}

export function getUniqueCweIds(vulnerabilities) {
  return [...new Set(vulnerabilities.map(v => v.CweID).filter(Boolean))];
}