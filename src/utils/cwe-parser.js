export function parseCweResults(rawData, requestedCwes, customRules, projectPath) {
  let parsed = {};
  try {
    parsed = JSON.parse(rawData);
  } catch (err) {
    console.error('[scan:cwe-locate] raw OpenGrep JSON=', rawData.slice(0, 2000));
    throw new Error(`Failed to parse OpenGrep JSON: ${err.message}`);
  }

  const extractCweInfo = (hit) => {
    const cweInfo = new Map();
    const visit = (item, source) => {
      if (item == null) return;
      if (Array.isArray(item)) {
        item.forEach(i => visit(i, source));
        return;
      }
      if (typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => visit(value, `${source}.${key}`));
        return;
      }
      const matches = String(item).match(/CWE[-_:\s]*\d+/gi) || [];
      matches.forEach(match => {
        const number = match.replace(/\D/g, '');
        const cweId = `CWE-${number}`;
        const confidence = source.includes('metadata.cwe') ? 'HIGH' : 
                          source.includes('check_id') ? 'MEDIUM' : 'LOW';
        if (!cweInfo.has(cweId) || confidence === 'HIGH') {
          cweInfo.set(cweId, { confidence, source });
        }
      });
    };
    
    visit({
      check_id: hit.check_id,
      message: hit.message,
      metadata: hit.extra?.metadata,
      description: hit.extra?.description,
      category: hit.extra?.metadata?.category,
    }, 'root');
    
    return cweInfo;
  };

  const resultsByCwe = Object.fromEntries(requestedCwes.map(cwe => [cwe, []]));
  const allHits = Array.isArray(parsed.results) ? parsed.results : [];
  console.log('[scan:cwe-locate] total OpenGrep hits=', allHits.length);

  allHits.forEach(hit => {
    const cweInfo = extractCweInfo(hit);
    
    if (cweInfo.size === 0) return;

    requestedCwes.forEach(requestedCwe => {
      if (cweInfo.has(requestedCwe)) {
        const info = cweInfo.get(requestedCwe);
        resultsByCwe[requestedCwe].push({
          file: hit.path || hit.file || hit.filename || null,
          line: hit.start?.line || hit.line || hit.lineno || null,
          column: hit.start?.col || hit.col || null,
          message: hit.extra?.message || hit.message || hit.check_id || null,
          ruleId: hit.check_id || hit.ruleId || hit.id || null,
          severity: hit.extra?.severity || hit.severity || 'UNKNOWN',
          confidence: info.confidence,
          source: info.source,
          metadata: {
            category: hit.extra?.metadata?.category || 'security',
            cwe: requestedCwe,
            language: hit.extra?.metadata?.language || 'unknown',
            owasp: hit.extra?.metadata?.owasp || 'unknown',
          }
        });
      }
    });
  });

  const summary = {
    totalHits: allHits.length,
    cwesFound: Object.entries(resultsByCwe).filter(([, hits]) => hits.length > 0).length,
    cwesNotFound: Object.entries(resultsByCwe).filter(([, hits]) => hits.length === 0).length,
    highConfidence: Object.values(resultsByCwe).flat().filter(h => h.confidence === 'HIGH').length,
    mediumConfidence: Object.values(resultsByCwe).flat().filter(h => h.confidence === 'MEDIUM').length,
    customRulesUsed: customRules.length,
    scanTimestamp: new Date().toISOString(),
  };

  console.log('[scan:cwe-locate] Summary:', summary);
  console.log('[scan:cwe-locate] Results by CWE:', Object.fromEntries(
    Object.entries(resultsByCwe).map(([id, hits]) => [id, hits.length])
  ));

  return {
    results: resultsByCwe,
    summary,
    metadata: {
      projectPath,
      requestedCwes,
      customRulesGenerated: customRules.length > 0,
    }
  };
}