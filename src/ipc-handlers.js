import { registerDialogHandlers } from './handlers/dialog-handlers';
import { registerFileSystemHandlers } from './handlers/fs-handlers';
import { registerScanHandlers } from './handlers/scan-handlers';
import { registerTrainingHandlers } from './handlers/training-handlers';

export function registerAllIPCHandlers(mainWindow) {
  registerDialogHandlers();
  registerFileSystemHandlers();
  registerScanHandlers();
  registerTrainingHandlers(mainWindow);
}
