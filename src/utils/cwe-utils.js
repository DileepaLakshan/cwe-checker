/**
 * CWE Utility Functions
 */
import { getOpenTabs, addTab } from '../state/ide-state.js';
import { switchTab } from '../services/editor-service.js';

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

export const CWE_FULL_DETAILS = {
  '78': { 
    id: 'CWE-78',
    name: 'OS Command Injection', 
    desc: 'The software constructs all or part of an OS command using externally-influenced input from an upstream component, but it does not neutralize or incorrectly neutralizes special elements that could modify the intended OS command when it is sent to a downstream component.',
    examples: ['Using user input directly in exec() or spawn()', 'Passing unsanitized query parameters to shell commands'],
    quality: ['Confidentiality', 'Integrity', 'Availability (Full system compromise)']
  },
  '79': { 
    id: 'CWE-79',
    name: 'Cross-site Scripting (XSS)', 
    desc: 'The software does not neutralize or incorrectly neutralizes user-controllable input before it is placed in output that is used as a web page that is served to other users.',
    examples: ['Reflecting search terms without HTML encoding', 'Writing user input directly to innerHTML'],
    quality: ['Confidentiality (Session theft)', 'Integrity (UI manipulation)']
  },
  '89': { 
    id: 'CWE-89',
    name: 'SQL Injection', 
    desc: 'The software constructs all or part of an SQL command using externally-influenced input from an upstream component, but it does not neutralize or incorrectly neutralizes special elements that could modify the intended SQL command when it is sent to a downstream component.',
    examples: ['String concatenation in database queries', 'Bypassing authentication with \' OR \'1\'=\'1'],
    quality: ['Confidentiality (Data leak)', 'Integrity (Data modification)']
  },
  '352': { 
    id: 'CWE-352',
    name: 'Cross-Site Request Forgery (CSRF)', 
    desc: 'The web application does not, or can not, sufficiently verify whether a well-formed, valid, consistent request was intentionally provided by the user who submitted the request.',
    examples: ['State-changing actions without anti-CSRF tokens', 'Relying solely on cookies for session validation'],
    quality: ['Integrity (Unauthorized actions)']
  },
  '434': { 
    id: 'CWE-434',
    name: 'Unrestricted File Upload', 
    desc: 'The software allows the attacker to upload or transfer files of dangerous types that can be automatically processed within the product\'s environment.',
    examples: ['Uploading a .php file disguised as an image', 'Uploading a malicious script to a public directory'],
    quality: ['Integrity', 'Availability (Remote Code Execution)']
  },
  '502': { 
    id: 'CWE-502',
    name: 'Deserialization of Untrusted Data', 
    desc: 'The software deserializes untrusted data without sufficiently verifying that the resulting data will be valid.',
    examples: ['Parsing untrusted YAML or Pickle data', 'Deserializing JSON objects that instanciate dangerous classes'],
    quality: ['Integrity', 'Availability (Remote Code Execution)']
  },
  '601': { 
    id: 'CWE-601',
    name: 'Open Redirect', 
    desc: 'A web application accepts a user-controlled input that specifies a link to an external site, and uses that link in a Redirect. This simplifies phishing attacks.',
    examples: ['Redirecting after login using a user-supplied "next" parameter'],
    quality: ['Integrity (Phishing)', 'Confidentiality']
  },
  '798': { 
    id: 'CWE-798',
    name: 'Hard-coded Credentials', 
    desc: 'The software contains hard-coded credentials, such as a password or cryptographic key, which it uses for its own inbound authentication, outbound communication to external components, or encryption of internal data.',
    examples: ['Storing API keys in source code', 'Hardcoding database passwords in configuration scripts'],
    quality: ['Confidentiality (Total system access)']
  },
  '918': { 
    id: 'CWE-918',
    name: 'Server-Side Request Forgery (SSRF)', 
    desc: 'The web server receives a URL or similar request from an upstream component and retrieves the contents of this URL, but it does not sufficiently ensure that the request is being sent to the expected destination.',
    examples: ['Fetching an external image from a user-provided URL', 'Accessing internal cloud metadata endpoints via SSRF'],
    quality: ['Confidentiality (Internal network access)', 'Integrity']
  },
  '200': { 
    id: 'CWE-200',
    name: 'Information Exposure', 
    desc: 'The product exposes sensitive information to an actor that is not explicitly authorized to have access to that information.',
    examples: ['Leaking stack traces to end users', 'Including sensitive tokens in HTTP responses'],
    quality: ['Confidentiality']
  },
  '22': { 
    id: 'CWE-22',
    name: 'Path Traversal', 
    desc: 'The software uses external input to construct a pathname that is intended to identify a file or directory that is located underneath a restricted parent directory, but the software does not properly neutralize special elements within the pathname that can cause the pathname to resolve to a location that is outside of the restricted directory.',
    examples: ['Reading /etc/passwd using ../../../', 'Accessing files outside the intended directory scope'],
    quality: ['Confidentiality', 'Integrity']
  },
  '20': {
    id: 'CWE-20',
    name: 'Improper Input Validation',
    desc: 'The product receives input or data, but it does not validate or incorrectly validates that the input has the properties that are required to process the data safely and correctly.',
    examples: ['Accepting negative numbers for a bank transfer amount', 'Failing to check the length of a string before processing'],
    quality: ['Integrity', 'Availability']
  },
  '119': {
    id: 'CWE-119',
    name: 'Improper Restriction of Operations within the Bounds of a Memory Buffer',
    desc: 'The software performs operations on a memory buffer, but it can read from or write to a memory location that is outside of the intended boundary of the buffer.',
    examples: ['Buffer overflow when copying strings in C/C++', 'Reading past the end of an array'],
    quality: ['Availability (Crash)', 'Integrity', 'Confidentiality (Memory leak)']
  },
  '787': {
    id: 'CWE-787',
    name: 'Out-of-bounds Write',
    desc: 'The software writes data past the end, or before the beginning, of the intended buffer.',
    examples: ['Writing to an array index that is larger than the array size', 'Off-by-one errors in loop conditions'],
    quality: ['Integrity (Memory corruption)', 'Availability (Crash)', 'Confidentiality']
  },
  '125': {
    id: 'CWE-125',
    name: 'Out-of-bounds Read',
    desc: 'The software reads data past the end, or before the beginning, of the intended buffer.',
    examples: ['Reading adjacent memory using an oversized length parameter', 'Heartbleed vulnerability'],
    quality: ['Confidentiality (Information leak)']
  },
  '416': {
    id: 'CWE-416',
    name: 'Use After Free',
    desc: 'Referencing memory after it has been freed can cause a program to crash, use unexpected values, or execute code.',
    examples: ['Using a pointer to an object that was already deleted', 'Dangling pointers in concurrent applications'],
    quality: ['Integrity', 'Availability', 'Confidentiality']
  },
  '287': {
    id: 'CWE-287',
    name: 'Improper Authentication',
    desc: 'When an actor claims to have a given identity, the software does not prove or insufficiently proves that the claim is correct.',
    examples: ['Failing to verify the signature of a JWT', 'Trusting client-side identity assertions blindly'],
    quality: ['Confidentiality', 'Integrity']
  },
  '269': {
    id: 'CWE-269',
    name: 'Improper Privilege Management',
    desc: 'The software does not properly assign, modify, track, or check privileges for an actor, creating an unintended sphere of control for that actor.',
    examples: ['Allowing regular users to execute admin commands', 'Failing to drop privileges after initialization'],
    quality: ['Confidentiality', 'Integrity', 'Availability']
  },
  '1333': {
    id: 'CWE-1333',
    name: 'Inefficient Regular Expression Complexity (ReDoS)',
    desc: 'The software uses a regular expression that has an inefficient or super-linear worst-case time complexity. This allows attackers to provide crafted input strings that force the regex engine into "catastrophic backtracking". When this occurs, the engine takes an exponential amount of time to evaluate the input, resulting in excessive CPU resource consumption and effectively causing a Denial of Service (DoS) for all other users of the application.',
    examples: [
      'Nested quantifiers (e.g., <code>(a+)+</code> or <code>(a*)*</code>) where the inner and outer loops both match the same characters.',
      'Overlapping alternations (e.g., <code>(a|a)*</code> or <code>(a|a?)+</code>) where multiple branches can match the identical substring.',
      'Using un-optimized regex patterns to validate user-supplied email addresses, URIs, or large payloads on the server-side.'
    ],
    quality: ['Availability (CPU exhaustion and System Lock-up)'],
    mitigations: [
      'Avoid nested quantifiers and overlapping alternations when writing regular expressions.',
      'Use regex engines that do not use backtracking (e.g., RE2, Rust\'s regex crate).',
      'Implement strict timeouts for regular expression evaluation (e.g., using Node.js child processes or thread interruptions).',
      'Validate input length strictly <i>before</i> passing it to the regex engine.',
      'Consider using string manipulation functions (like <code>indexOf</code>, <code>startsWith</code>) for simple parsing instead of full regex.'
    ]
  }
};

export function openCweTab(cweId) {
  const tabPath = '__CWE_DETAILS_' + cweId + '__';
  
  const existingTab = getOpenTabs().find(t => t.path === tabPath);
  if (!existingTab) {
    addTab({
      path: tabPath,
      name: cweId + ' Details',
      content: '',
      originalContent: '',
      isDirty: false
    });
  }
  
  switchTab(tabPath);
}

export function renderCweDetailsTab(cweId) {
  const container = document.getElementById('cwe-details-component');
  if (!container) return;

  const match = cweId.match(/\d+/);
  const number = match ? match[0] : null;
  const details = number && CWE_FULL_DETAILS[number] ? CWE_FULL_DETAILS[number] : null;

  let contentHtml = '';
  if (details) {
    contentHtml = `
      <div style="max-width: 800px; margin: 0 auto; padding-top: 20px;">
        <h2 style="font-size: 24px; color: #58a6ff; margin-bottom: 8px;">${details.id}: ${details.name}</h2>
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 20px; margin-top: 20px;">
          <h3 style="color: #c9d1d9; margin-bottom: 12px; font-size: 16px;">Description</h3>
          <p style="color: #8b949e; line-height: 1.6; font-size: 14px; margin-bottom: 24px;">${details.desc}</p>
          
          <h3 style="color: #c9d1d9; margin-bottom: 12px; font-size: 16px;">Common Examples</h3>
          <ul style="color: #8b949e; line-height: 1.6; font-size: 14px; margin-bottom: 24px; padding-left: 20px;">
            ${details.examples.map(ex => `<li style="margin-bottom: 6px;">${ex}</li>`).join('')}
          </ul>
          
          <h3 style="color: #c9d1d9; margin-bottom: 12px; font-size: 16px;">Affected Quality Characteristics</h3>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: ${details.mitigations ? '24px' : '0'};">
            ${details.quality.map(q => `<span style="background: #238636; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${q}</span>`).join('')}
          </div>
          
          ${details.mitigations ? `
          <h3 style="color: #c9d1d9; margin-bottom: 12px; font-size: 16px;">Recommended Mitigations</h3>
          <ul style="color: #8b949e; line-height: 1.6; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
            ${details.mitigations.map(mit => `<li style="margin-bottom: 6px;">${mit}</li>`).join('')}
          </ul>
          ` : ''}
        </div>
        <div style="margin-top: 24px;">
          <a href="https://cwe.mitre.org/data/definitions/${number}.html" target="_blank" style="background: #3a3a3a; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 4px; display: inline-block;">Read full MITRE specification</a>
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div style="max-width: 800px; margin: 0 auto; padding-top: 20px;">
        <h2 style="font-size: 24px; color: #58a6ff; margin-bottom: 8px;">${cweId} Details</h2>
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 20px; margin-top: 20px;">
          <p style="color: #8b949e; line-height: 1.6; font-size: 14px;">Detailed offline information for this specific CWE is not currently bundled in the application.</p>
        </div>
        ${number ? `<div style="margin-top: 24px;">
          <a href="https://cwe.mitre.org/data/definitions/${number}.html" target="_blank" style="background: #3a3a3a; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 4px; display: inline-block;">View on MITRE website</a>
        </div>` : ''}
      </div>
    `;
  }

  container.innerHTML = contentHtml;
}

window.openCweTab = openCweTab;