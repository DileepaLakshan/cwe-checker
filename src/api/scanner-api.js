/**
 * Scanner API - Handles communication with backend
 */
export class ScannerAPI {
  static createMock() {
    return {
      selectProject: async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('/home/user/my-project'), 200);
        });
      },
      runSAST: async (folder) => {
        return [
          {
            ruleId: 'javascript.sqli.security',
            message: 'Possible SQL injection',
            severity: 'HIGH',
            file: 'src/auth.js',
            line: 24,
            code: "query('SELECT * FROM users WHERE id = ' + userId)"
          },
          {
            ruleId: 'generic.xss',
            message: 'Unescaped user input in HTML',
            severity: 'MEDIUM',
            file: 'src/components/Profile.jsx',
            line: 48,
            code: '<div>{userInput}</div>'
          }
        ];
      },
      locateCweFindings: async (folder, cweIds) => {
        return cweIds.reduce((acc, id) => ({
          ...acc,
          [id]: []
        }), {});
      },
      runSCA: async (folder) => {
        return [
          {
            vulnerability: 'CVE-2023-1234',
            package: 'lodash',
            version: '4.17.15',
            severity: 'HIGH',
            title: 'Prototype Pollution',
            fixedVersion: '4.17.21'
          },
          {
            vulnerability: 'CVE-2022-2345',
            package: 'axios',
            version: '0.21.1',
            severity: 'MEDIUM',
            title: 'SSRF vulnerability',
            fixedVersion: '0.21.2'
          }
        ];
      }
    };
  }
}