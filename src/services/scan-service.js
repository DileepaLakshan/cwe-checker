/**
 * Scan Service - Handles scan operations
 */
import { ScanResultsPanel } from '../components/scan-results/scan-results-panel.js';
import { WelcomeScreen } from '../components/welcome-screen/welcome-screen.js';
import { StatusBar } from '../components/status-bar/status-bar.js';
import { collectCweIds, getUniqueCweIds } from '../utils/cwe-utils.js';
import { getCurrentWorkspace } from '../state/ide-state.js';
import { openWorkspace } from './workspace-service.js';

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
    WelcomeScreen.hide();
    ScanResultsPanel.show();
    ScanResultsPanel.showLoading();

    const [sastResults, scaResults] = await Promise.all([
      window.scannerAPI.runSAST(projectFolder),
      window.scannerAPI.runSCA(projectFolder)
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

    // Handle CWE location
    await handleCWELocation(projectFolder, cweIssuesArray);

    StatusBar.updateMode('Scan complete');
  } catch (error) {
    console.error("Scanning failed:", error);
    ScanResultsPanel.hideLoading();
    StatusBar.updateMode('Scan failed', true);
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