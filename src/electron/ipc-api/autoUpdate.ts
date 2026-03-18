import { ipcMain } from 'electron';

const debug = require('../../preload-safe-debug')('Ferdium:ipcApi:autoUpdate');

export default (_params: { mainWindow: any; settings: any }) => {
  debug('autoUpdate: disabled in favour of GitHub release check');
  // Auto-install via electron-updater is disabled. Updates are notified by
  // checking the Endlesszombiez/ferdium-singularity GitHub releases page.
  // The ipcMain handler is kept as a no-op to avoid errors from any remaining
  // callers.
  ipcMain.on('autoUpdate', (_event, _args) => {
    debug('autoUpdate ipc message received but auto-update is disabled');
  });
};
