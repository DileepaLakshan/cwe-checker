import { registerDialogHandlers } from './handlers/dialog-handlers';
import { registerFileSystemHandlers } from './handlers/fs-handlers';
import { registerScanHandlers } from './handlers/scan-handlers';
import { registerMlRetrainHandlers } from './handlers/ml-retrain-handlers';

export function registerAllIPCHandlers() {
  registerDialogHandlers();
  registerFileSystemHandlers();
  registerScanHandlers();
  registerMlRetrainHandlers();
}