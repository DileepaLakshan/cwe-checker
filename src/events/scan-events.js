/**
 * Scan-related event handlers and processing
 */
import { getDOM } from '../utils/dom-references';
import { setCurrentProjectPath } from '../state/ide-state';
import { collectCweIds, getUniqueCweIds } from '../utils/cwe-utils';
import { openFileInEditor } from '../services/editor-service';
import { renderCweLocationResults } from '../components/cwe-location-results';

export function initScanButton() {
  const { scanBtn } = getDOM();
  scanBtn.addEventListener('click', handleScan);
}

async function handleScan() {
  const dom = getDOM();
  const { 
    scanBtn, welcomeScreen, resultsPanel, sastContainer, 
    scaContainer, summaryContainer, cweLocationContainer 
  } = dom;

  try {
    console.log('[renderer] scanBtn clicked');
    
    // 1. Ask the user which folder to scan
    const projectFolder = await window.scannerAPI.selectProject();
    console.log('[renderer] selected projectFolder=', projectFolder);
    
    if (!projectFolder) {
      console.log("User cancelled folder selection.");
      return;
    }

    setCurrentProjectPath(projectFolder);

    // 2. Update UI to Loading State
    const originalText = scanBtn.innerText;
    scanBtn.innerText = "Scanning... (This may take a minute)";
    scanBtn.disabled = true;
    scanBtn.style.opacity = "0.7";

    // 3. Run both scans simultaneously
    const [sastResults, scaResults] = await Promise.all([
      window.scannerAPI.runSAST(projectFolder),
      window.scannerAPI.runSCA(projectFolder)
    ]);

    // 4. Parse and display SAST results
    displaySASTResults(sastContainer, sastResults);

    // 5. Parse and display SCA results
    const cweHits = displaySCAResults(scaContainer, scaResults);

    // 6. Handle CWE location results
    await displayCWELocationResults(cweLocationContainer, cweHits, projectFolder);

    // 7. Update Summary & Switch Views
    updateSummary(summaryContainer, sastResults, cweHits);

    // Hide welcome screen and show results
    welcomeScreen.style.display = 'none';
    resultsPanel.style.display = 'block';

    // Initialize close results button
    initCloseResultsButton();

  } catch (error) {
    console.error("Scanning failed:", error);
    alert("Scan failed. Check the developer console for details.");
  } finally {
    // Reset button state
    scanBtn.innerText = "Select Project & Scan";
    scanBtn.disabled = false;
    scanBtn.style.opacity = "1";
  }
}

function displaySASTResults(container, sastResults) {
  const sastHits = sastResults.results || [];
  const sastCweHits = sastHits.flatMap(hit => {
    const cweIds = collectCweIds(hit.extra?.metadata, hit.check_id);
    const idsToShow = cweIds.length > 0 ? cweIds : ['CWE not mapped'];
    return idsToShow.map(cweId => ({ ...hit, CweID: cweId }));
  });

  container.innerHTML = sastCweHits.length === 0 
    ? '<div class="no-issues">No source code CWE findings found!</div>' 
    : sastCweHits.map(hit => `
        <div class="result-card sast-card">
          <div class="card-header">
            <span class="severity warning">Warning</span>
            <span class="vuln-id">${hit.CweID}</span>
          </div>
          <p class="file-path">File: ${hit.path} (Line: ${hit.start?.line || 'unknown'})</p>
          <p class="vuln-desc"><b>Reason:</b> ${hit.extra?.message || 'No reason provided by the OpenGrep rule.'}</p>
          <p class="vuln-desc"><b>Rule:</b> ${hit.check_id}</p>
        </div>
      `).join('');
}

function displaySCAResults(container, scaResults) {
  let trivyVulnerabilities = [];
  if (scaResults.Results) {
    scaResults.Results.forEach(target => {
      if (target.Vulnerabilities) {
        trivyVulnerabilities = trivyVulnerabilities.concat(target.Vulnerabilities);
      }
    });
  }

  const cweHits = trivyVulnerabilities.flatMap(vuln => {
    const cweIds = Array.isArray(vuln.CweIDs) ? vuln.CweIDs.filter(Boolean) : [];
    const normalizedIds = cweIds.map(id => String(id).trim()).filter(Boolean);
    return normalizedIds.map(cweId => ({ ...vuln, CweID: cweId }));
  });

  container.innerHTML = cweHits.length === 0 
    ? `<div class="no-issues">${
        trivyVulnerabilities.length === 0
          ? 'No dependency CWE issues found!'
          : `Trivy found ${trivyVulnerabilities.length} dependency vulnerabilities, but no CWE mappings were included.`
      }</div>` 
    : cweHits.map(vuln => `
        <div class="result-card sca-card">
          <div class="card-header">
            <span class="severity ${vuln.Severity.toLowerCase()}">${vuln.Severity}</span>
            <span class="vuln-id">${vuln.CweID}</span>
          </div>
          <p class="file-path">Package: <b>${vuln.PkgName}</b> (Installed: ${vuln.InstalledVersion})</p>
          <p class="vuln-desc"><b>Reason:</b> ${vuln.Title || vuln.Description || 'No reason provided by Trivy.'}</p>
          <p class="vuln-desc"><b>Fixed version:</b> ${vuln.FixedVersion || 'Not available'}</p>
          <p class="vuln-desc"><b>Source vulnerability:</b> ${vuln.VulnerabilityID || 'Not available'}</p>
        </div>
      `).join('');

  return cweHits;
}

async function displayCWELocationResults(container, cweHits, projectFolder) {
  const uniqueCweIds = getUniqueCweIds(cweHits);
  
  if (!container) {
    console.error('[renderer] missing cwe-location-results-container element');
    return;
  }

  if (uniqueCweIds.length === 0) {
    container.innerHTML = '<div class="no-issues">No CWE IDs were extracted from Trivy results to locate in source code.</div>';
    return;
  }

  container.innerHTML = '<div class="scan-loading">Locating CWE matches in source code...</div>';
  
  try {
    const locateResults = await window.scannerAPI.locateCweFindings(projectFolder, uniqueCweIds);
    container.innerHTML = renderCweLocationResults(locateResults);

    // Bind click handlers to CWE location hits
    container.querySelectorAll('.cwe-location-hit').forEach(item => {
      item.addEventListener('click', () => {
        const file = item.getAttribute('data-file');
        const line = Number(item.getAttribute('data-line')) || null;
        if (file) {
          openFileInEditor(file, line);
        }
      });
    });
  } catch (locateError) {
    console.error('[renderer] CWE locate failed:', locateError);
    container.innerHTML = `<div class="no-issues">Unable to locate CWE findings: ${locateError?.message || locateError}</div>`;
  }
}

function updateSummary(container, sastResults, cweHits) {
  const sastHits = sastResults.results || [];
  container.innerHTML = `
    <span class="badge">OpenGrep CWE Findings: ${sastHits.length}</span>
    <span class="badge">Trivy CWE Issues: ${cweHits.length}</span>
  `;
}

function initCloseResultsButton() {
  const { btnCloseResults, resultsPanel, welcomeScreen } = getDOM();
  btnCloseResults?.addEventListener('click', () => {
    resultsPanel.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });
}