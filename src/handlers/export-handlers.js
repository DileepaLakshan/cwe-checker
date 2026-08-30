import { app, dialog, ipcMain, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function renderHtmlToPdfBuffer(html) {
  const tempFile = path.join(app.getPath('temp'), `cwe-checker-report-${Date.now()}.html`);
  await fs.writeFile(tempFile, html, 'utf-8');

  const pdfWindow = new BrowserWindow({ show: false });
  try {
    await pdfWindow.loadFile(tempFile);
    return await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally {
    pdfWindow.destroy();
    fs.unlink(tempFile).catch(() => {});
  }
}

export function registerExportHandlers(mainWindow) {
  ipcMain.handle('export:csv', async (event, csvContent, defaultFileName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFileName,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (result.canceled) return null;

    try {
      await fs.writeFile(result.filePath, csvContent, 'utf-8');
      return { path: result.filePath };
    } catch (err) {
      console.error('Error exporting CSV:', err);
      throw err;
    }
  });

  ipcMain.handle('export:pdf', async (event, htmlContent, defaultFileName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled) return null;

    try {
      const pdfBuffer = await renderHtmlToPdfBuffer(htmlContent);
      await fs.writeFile(result.filePath, pdfBuffer);
      return { path: result.filePath };
    } catch (err) {
      console.error('Error exporting PDF:', err);
      throw err;
    }
  });
}
