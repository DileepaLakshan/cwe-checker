import { registerDialogHandlers } from './handlers/dialog-handlers';
import { registerFileSystemHandlers } from './handlers/fs-handlers';
import { registerScanHandlers } from './handlers/scan-handlers';

export function registerAllIPCHandlers() {
  registerDialogHandlers();
  registerFileSystemHandlers();
  registerScanHandlers();
}