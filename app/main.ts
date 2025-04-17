import { app, BrowserWindow, dialog, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerIpcHandlers } from './handlers/product.handlers';
import { connectToRemoteDb } from './database/remote-database';
import { initializeDatabase } from './database/database';

import connectionMonitorService from './service/connection-monitor.service';
import productSyncService from './service/product-sync.service';
import { AppIdentityService } from './config/app-identity.service';
import firstRunService from './service/first-run.service';

let win: BrowserWindow | null = null;
const args = process.argv.slice(1),
  serve = args.some((val) => val === '--serve');

// Add flag to track if services are initialized
let servicesInitialized = false;

/**
 * Initialize application services
 * @param window The browser window to associate with services
 */
async function initializeServices(window: BrowserWindow): Promise<void> {
  if (servicesInitialized) {
    // If services are already initialized, just update window references
    connectionMonitorService.setWindow(window);
    productSyncService.setWindow(window);
    firstRunService.setWindow(window);
    return;
  }

  try {
    await initializeDatabase();
  } catch (error) {
    dialog.showErrorBox(
      'Database Error',
      `Failed to initialize database: ${error.message}\n\nThe application will attempt to reconnect automatically.`
    );
  }

  try {
    registerIpcHandlers();
    connectToRemoteDb();
  } catch (error) {
    console.error('Failed to initialize services:', error);
    dialog.showErrorBox('Initialization Error', 'Failed to initialize services');
  }

  // Initialize connection monitoring
  connectionMonitorService.init(window);

  // Initialize product sync service
  productSyncService.init(window);
  firstRunService.init(window);

  servicesInitialized = true;
}

/**
 * Properly clean up services when application is quitting
 */
function cleanupServices(): void {
  if (servicesInitialized) {
    connectionMonitorService.stop();
    productSyncService.stop();
    firstRunService.stop();
    servicesInitialized = false;
  }
}

async function createWindow(): Promise<BrowserWindow> {
  const size = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: serve,
      contextIsolation: false,
    },
  });

  AppIdentityService.getInstance();

  // Initialize services
  await initializeServices(win);

  if (serve) {
    const debug = require('electron-debug');
    debug();

    require('electron-reloader')(module);
    win.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html';

    if (fs.existsSync(path.join(__dirname, '../../dist/index.html'))) {
      // Path when running electron in local folder
      pathIndex = '../../dist/index.html';
    }

    const url = new URL(path.join('file:', __dirname, pathIndex));
    win.loadURL(url.href);
  }

  // Modified behavior for macOS
  if (process.platform === 'darwin') {
    // On macOS, use 'close' event instead of 'closed' to handle window close
    win.on('close', (event) => {
      // Prevent the window from actually closing
      event.preventDefault();
      
      // Just hide the window instead of closing it
      win.hide();
    });
  } else {
    // On Windows/Linux, handle 'closed' event normally
    win.on('closed', () => {
      win = null;
    });
  }

  return win;
}

try {
  // This method will be called when Electron has finished initialization
  app.on('ready', () => setTimeout(createWindow, 400));

  // Handle before-quit event to properly clean up
  app.on('before-quit', () => {
    // Allow the window to close normally during quit
    if (win && process.platform === 'darwin') {
      win.removeAllListeners('close');
    }
    
    // Clean up services
    cleanupServices();
  });

  // Quit when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    // On macOS, recreate window when dock icon is clicked and no windows open
    if (win === null) {
      win = await createWindow();
    } else if (win && !win.isVisible()) {
      // If window exists but is hidden, show it
      win.show();
    }
  });
} catch (e) {
  console.error('Application initialization error:', e);
}