/**
 * Scan Service - Handles scan operations
 */
import { ScanResultsPanel } from '../components/scan-results/scan-results-panel.js';
import { MlResultsPanel } from '../components/ml-results/ml-results-panel.js';
import { WelcomeScreen } from '../components/welcome-screen/welcome-screen.js';
import { StatusBar } from '../components/status-bar/status-bar.js';
import { collectCweIds, getUniqueCweIds } from '../utils/cwe-utils.js';
import { getCurrentWorkspace, addTab, setActiveTab, setLastScanResult, updateLastScanResult } from '../state/ide-state.js';
import { renderTabs } from '../components/tabs.js';
import { openWorkspace } from './workspace-service.js';
import { openScanResultsTab } from './editor-service.js';

export async function performScan() {
  try {
    let projectFolder = null;
    const workspace = getCurrentWorkspace();
    
    if (workspace && workspace.path) {
      projectFolder = workspace.path;
    } else {
      projectFolder = await window.scannerAPI.selectProject();
      if (!projectFolder) return;
      
      const dirName = projectFolder.split(/[\\/]/).pop();
      await openWorkspace(projectFolder, dirName);
    }

    StatusBar.updateMode('Scanning...');
    openScanResultsTab();
    ScanResultsPanel.showLoading();

    const [sastResults, scaResults] = await Promise.all([
      window.scannerAPI.runSAST(projectFolder).catch(e => {
        console.error("SAST Scanner Failed:", e);
        StatusBar.updateMode("SAST Failed", true);
        return { results: [] };
      }),
      window.scannerAPI.runSCA(projectFolder).catch(e => {
        console.error("SCA Scanner Failed:", e);
        StatusBar.updateMode("SCA Failed", true);
        return { Results: [] };
      })
    ]);

    // Process SAST results
    const sastIssuesArray = sastResults?.results || [];
    const sastCweIssuesArray = sastIssuesArray.flatMap(hit => {
      const cweIds = collectCweIds(hit.extra?.metadata, hit.check_id);
      const idsToShow = cweIds.length > 0 ? cweIds : ['CWE not mapped'];
      return idsToShow.map(cweId => ({ ...hit, CweID: cweId }));
    });

    // Process SCA results
    let trivyVulnerabilities = [];
    if (scaResults?.Results && Array.isArray(scaResults.Results)) {
      scaResults.Results.forEach(target => {
        if (target.Vulnerabilities) {
          trivyVulnerabilities = trivyVulnerabilities.concat(target.Vulnerabilities);
        }
      });
    }

    const cweIssuesArray = trivyVulnerabilities.flatMap(vuln => {
      const cweIds = Array.isArray(vuln.CweIDs) ? vuln.CweIDs.filter(Boolean) : [];
      return cweIds.map(cweId => ({ ...vuln, CweID: cweId }));
    });

    // Render results
    ScanResultsPanel.hideLoading();
    ScanResultsPanel.renderSASTResults(sastCweIssuesArray);
    ScanResultsPanel.renderSCAResults(cweIssuesArray, trivyVulnerabilities.length);
    ScanResultsPanel.updateSummary(sastCweIssuesArray.length, cweIssuesArray.length);

    setLastScanResult({
      projectPath: projectFolder,
      projectName: projectFolder.split(/[\\/]/).pop(),
      timestamp: Date.now(),
      sastFindings: sastCweIssuesArray,
      scaFindings: cweIssuesArray,
      mlPredictions: null
    });

    // Handle CWE location
    await handleCWELocation(projectFolder, cweIssuesArray);

    StatusBar.updateMode('Scan complete');

    // Calculate and log CWE values for ML integration
    calculateCweValues(sastCweIssuesArray, cweIssuesArray);
  } catch (error) {
    console.error("Scanning failed:", error);
    ScanResultsPanel.hideLoading();
    StatusBar.updateMode('Scan failed', true);
  }
}

function calculateCweValues(sastIssues, scaIssues) {
  const cweStats = {};

  const initCwe = (cwe) => {
    if (!cweStats[cwe]) {
      cweStats[cwe] = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    }
  };

  // Process SAST
  sastIssues.forEach(hit => {
    if (!hit.CweID || hit.CweID === 'CWE not mapped' || hit.CweID === 'N/A') return;
    initCwe(hit.CweID);
    
    // Map OpenGrep severity to standard severities
    const sev = (hit.extra?.severity || 'WARNING').toUpperCase();
    if (sev === 'ERROR') cweStats[hit.CweID].HIGH++;
    else if (sev === 'WARNING') cweStats[hit.CweID].MEDIUM++;
    else if (sev === 'INFO') cweStats[hit.CweID].LOW++;
    else if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
      cweStats[hit.CweID][sev]++;
    } else {
      cweStats[hit.CweID].LOW++;
    }
  });

  // Process SCA
  scaIssues.forEach(vuln => {
    if (!vuln.CweID || vuln.CweID === 'CWE not mapped' || vuln.CweID === 'N/A') return;
    initCwe(vuln.CweID);
    
    const sev = (vuln.Severity || 'LOW').toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
      cweStats[vuln.CweID][sev]++;
    } else {
      cweStats[vuln.CweID].LOW++;
    }
  });

  const calculateValue = (x, L, C) => {
    if (x === 0) return 0.0;
    const k = 0.1;
    return L - (L - C) * Math.exp(-k * x);
  };

  console.log("\\n--- ML Integration: CWE Value Report ---");
  console.log("CWE-NUMBER | CRITICAL | HIGH | MEDIUM | LOW | VALUE");
  console.log("-".repeat(75));

  const mlFeatures = {};

  for (const cwe of Object.keys(cweStats).sort()) {
    const counts = cweStats[cwe];
    const critCount = counts.CRITICAL;
    const highCount = counts.HIGH;
    const medCount = counts.MEDIUM;
    const lowCount = counts.LOW;

    const y1 = calculateValue(lowCount, 2.5, 0.0);
    const y2 = calculateValue(medCount, 5.0, 2.5);
    const y3 = calculateValue(highCount, 7.5, 5.0);
    const y4 = calculateValue(critCount, 10.0, 7.5);

    const totalValue = Math.max(y1, y2, y3, y4);
    mlFeatures[cwe] = totalValue;
    
    console.log(`${cwe.padEnd(10)} | ${critCount.toString().padStart(8)} | ${highCount.toString().padStart(4)} | ${medCount.toString().padStart(6)} | ${lowCount.toString().padStart(3)} | ${totalValue.toFixed(4)}`);
  }
  console.log("-".repeat(75) + "\\n");

  if (window.scannerAPI && window.scannerAPI.runMLPredict) {
    console.log("Running ML model predictions...");
    window.scannerAPI.runMLPredict(mlFeatures)
      .then(result => {
        console.log("=== ML Model Output ===", result);
        
        // Add ML Results tab to ide-state
        const mlTab = {
          path: '__ML_RESULTS__',
          name: 'ML Visualizer',
          isDirty: false
        };
        addTab(mlTab);
        setActiveTab('__ML_RESULTS__');
        
        // Render UI
        renderTabs();

        MlResultsPanel.render(result);
        updateLastScanResult({ mlPredictions: result });
      })
      .catch(err => {
        console.error("ML Prediction failed:", err);
      });
  }
}

async function handleCWELocation(projectFolder, cweIssuesArray) {
  const uniqueCweIds = getUniqueCweIds(cweIssuesArray);
  const container = document.getElementById('cwe-location-results-container');
  
  if (!container) return;

  if (uniqueCweIds.length === 0) {
    container.innerHTML = '<div class="no-issues">No CWE IDs were extracted to locate in source code.</div>';
    return;
  }

  container.innerHTML = '<div class="scan-loading">Locating CWE matches in source code...</div>';
  
  try {
    const locateResults = await window.scannerAPI.locateCweFindings(projectFolder, uniqueCweIds);
    const renderedHtml = renderCWELocationResults(locateResults);
    ScanResultsPanel.renderCWELocations(renderedHtml);
  } catch (error) {
    console.error('CWE location failed:', error);
    container.innerHTML = `<div class="no-issues">Unable to locate CWE findings: ${error.message}</div>`;
  }
}