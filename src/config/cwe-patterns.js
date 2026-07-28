export const cwePatterns = {
  'CWE-78': { // OS Command Injection
    name: 'cwe-78-os-command-injection',
    severity: 'ERROR',
    patterns: [
      { pattern: 'exec\\(', language: 'javascript' },
      { pattern: 'child_process', language: 'javascript' },
      { pattern: 'spawn\\(', language: 'javascript' },
      { pattern: 'eval\\(', language: 'javascript' },
      { pattern: 'system\\(', language: 'python' },
      { pattern: 'os\\.system', language: 'python' },
      { pattern: 'subprocess\\.call', language: 'python' },
      { pattern: 'Runtime\\.getRuntime\\(\\)\\.exec', language: 'java' },
      { pattern: 'ProcessBuilder', language: 'java' },
    ]
  },
  'CWE-79': { // Cross-site Scripting (XSS)
    name: 'cwe-79-xss',
    severity: 'ERROR',
    patterns: [
      { pattern: 'innerHTML', language: 'javascript' },
      { pattern: 'document\\.write\\(', language: 'javascript' },
      { pattern: 'dangerouslySetInnerHTML', language: 'javascript' },
      { pattern: 'v-html', language: 'vue' },
      { pattern: '\\$\\{.*\\}', language: 'javascript' },
      { pattern: 'eval\\(', language: 'javascript' },
      { pattern: 'setAttribute\\(.*innerHTML', language: 'javascript' },
    ]
  },
  'CWE-89': { // SQL Injection
    name: 'cwe-89-sql-injection',
    severity: 'ERROR',
    patterns: [
      { pattern: '(query|execute)\\(.*\\+.*\\)', language: 'javascript' },
      { pattern: '(query|execute)\\(.*\\$\\{.*\\}\\)', language: 'javascript' },
      { pattern: 'string concatenat.*sql', language: 'generic' },
      { pattern: 'SELECT.*\\+.*FROM', language: 'javascript' },
      { pattern: 'cursor\\.execute\\(.*%', language: 'python' },
      { pattern: 'Statement\\.executeQuery', language: 'java' },
      { pattern: 'createQuery\\(.*\\+', language: 'java' },
    ]
  },
  'CWE-352': { // Cross-Site Request Forgery (CSRF)
    name: 'cwe-352-csrf',
    severity: 'WARNING',
    patterns: [
      { pattern: 'csrf.*disable', language: 'generic' },
      { pattern: 'csrf.*false', language: 'generic' },
      { pattern: 'without.*csrf', language: 'generic' },
      { pattern: 'exempt.*csrf', language: 'python' },
      { pattern: 'csrf_exempt', language: 'python' },
    ]
  },
  'CWE-434': { // Unrestricted File Upload
    name: 'cwe-434-file-upload',
    severity: 'ERROR',
    patterns: [
      { pattern: 'multer\\(', language: 'javascript' },
      { pattern: 'upload.*file', language: 'generic' },
      { pattern: 'formidable', language: 'javascript' },
      { pattern: 'move_uploaded_file', language: 'php' },
      { pattern: '\\$_FILES', language: 'php' },
      { pattern: 'request\\.files', language: 'python' },
    ]
  },
  'CWE-502': { // Deserialization of Untrusted Data
    name: 'cwe-502-deserialization',
    severity: 'ERROR',
    patterns: [
      { pattern: 'JSON\\.parse\\(', language: 'javascript' },
      { pattern: 'pickle\\.load', language: 'python' },
      { pattern: 'yaml\\.load\\(', language: 'python' },
      { pattern: 'ObjectInputStream', language: 'java' },
      { pattern: 'unserialize\\(', language: 'php' },
      { pattern: 'Marshal\\.load', language: 'ruby' },
    ]
  },
  'CWE-601': { // Open Redirect
    name: 'cwe-601-open-redirect',
    severity: 'WARNING',
    patterns: [
      { pattern: 'redirect\\(.*req\\.', language: 'javascript' },
      { pattern: 'window\\.location', language: 'javascript' },
      { pattern: 'redirect\\(.*request\\.', language: 'python' },
      { pattern: 'HttpResponseRedirect', language: 'python' },
      { pattern: 'response\\.sendRedirect', language: 'java' },
    ]
  },
  'CWE-798': { // Hard-coded Credentials
    name: 'cwe-798-hardcoded-credentials',
    severity: 'ERROR',
    patterns: [
      { pattern: 'password\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'api_key\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'secret\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'token\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'apiKey\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'passwd\\s*=\\s*["\']', language: 'generic' },
      { pattern: 'SECRET_KEY\\s*=\\s*["\']', language: 'python' },
    ]
  },
  'CWE-918': { // Server-Side Request Forgery (SSRF)
    name: 'cwe-918-ssrf',
    severity: 'ERROR',
    patterns: [
      { pattern: 'http\\.get\\(.*req\\.', language: 'javascript' },
      { pattern: 'requests\\.get\\(.*request\\.', language: 'python' },
      { pattern: 'urllib\\.request', language: 'python' },
      { pattern: 'HttpURLConnection', language: 'java' },
      { pattern: 'file_get_contents\\(.*\\$', language: 'php' },
    ]
  },
  'CWE-200': { // Information Exposure
    name: 'cwe-200-info-exposure',
    severity: 'WARNING',
    patterns: [
      { pattern: 'console\\.log\\(.*password', language: 'javascript' },
      { pattern: 'console\\.log\\(.*secret', language: 'javascript' },
      { pattern: 'print\\(.*password', language: 'python' },
      { pattern: 'console\\.log\\(.*token', language: 'javascript' },
      { pattern: 'System\\.out\\.println.*password', language: 'java' },
      { pattern: 'error.*stack', language: 'generic' },
    ]
  },
  'CWE-22': { // Path Traversal
    name: 'cwe-22-path-traversal',
    severity: 'ERROR',
    patterns: [
      { pattern: 'path\\.join\\(.*req\\.', language: 'javascript' },
      { pattern: 'file\\(.*req\\.', language: 'generic' },
      { pattern: 'readFile\\(.*req\\.', language: 'javascript' },
      { pattern: 'open\\(.*request\\.', language: 'python' },
      { pattern: 'include\\(.*\\$', language: 'php' },
      { pattern: '../', language: 'generic' },
    ]
  },
};