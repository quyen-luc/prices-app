import { ipcMain } from 'electron';
import * as dns from 'dns';
import { RemoteDatabase } from '../database/remote-database';
import * as connectionEvents from '../constants/connection-events';

/**
 * ConnectionMonitor class that handles checking internet connectivity
 * and database connection status, with automatic reconnection attempts
 */
export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private isInternetConnected: boolean = true;
  private isDbConnected: boolean = true;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000; // 5 seconds
  private readonly CONNECTIVITY_CHECK_INTERVAL = 10000; // 10 seconds
  private internetCheckTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private mainWindow: Electron.BrowserWindow | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  /**
   * Initialize connection monitoring
   */
  public init(mainWindow: Electron.BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.setupIpcHandlers();
    this.startInternetMonitoring();
    this.checkDbConnection();
  }

  /**
   * Set up IPC handlers for renderer process to request connection status checks
   */
  private setupIpcHandlers(): void {
    ipcMain.handle(connectionEvents.CHECK_INTERNET_CONNECTION, async () => {
      return { connected: await this.checkInternetConnection() };
    });

    ipcMain.handle(connectionEvents.CHECK_DB_CONNECTION, async () => {
      return { connected: await this.checkDbConnection() };
    });

    ipcMain.handle(connectionEvents.RECONNECT_DATABASE, async () => {
      return this.reconnectDatabase();
    });
  }

  /**
   * Start monitoring internet connectivity
   */
  private startInternetMonitoring(): void {
    // Perform initial check
    this.checkInternetConnection();

    // Set up periodic checks
    this.internetCheckTimer = setInterval(async () => {
      await this.checkInternetConnection();
    }, this.CONNECTIVITY_CHECK_INTERVAL);
  }

  /**
   * Check internet connection by performing a DNS lookup
   */
  private async checkInternetConnection(): Promise<boolean> {
    try {
      // Use DNS resolution to check internet connectivity
      // Try to resolve a reliable domain like Google DNS
      return new Promise<boolean>((resolve) => {
        dns.resolve('8.8.8.8', (err) => {
          const isConnected = !err;
          
          // Only handle state changes
          if (this.isInternetConnected !== isConnected) {
            this.isInternetConnected = isConnected;
            this.notifyConnectionStatus();
            
            // If internet is restored, check database connectivity
            if (isConnected && !this.isDbConnected) {
              this.checkDbConnection();
            }
          }
          
          resolve(isConnected);
        });
      });
    } catch (error) {
      console.error('Error checking internet connection:', error);
      this.isInternetConnected = false;
      this.notifyConnectionStatus();
      return false;
    }
  }

  /**
   * Check database connection
   */
  public async checkDbConnection(): Promise<boolean> {
    try {
      const remoteDb = RemoteDatabase.getInstance();
      
      // Check if database is connected or can be connected
      const isConnected = await remoteDb.checkHealth();
      
      // Handle state changes
      if (this.isDbConnected !== isConnected) {
        this.isDbConnected = isConnected;
        this.notifyConnectionStatus();
        
        // If database connection is lost but internet is available, 
        // start reconnection attempts
        if (!isConnected && this.isInternetConnected) {
          this.startReconnectionAttempts();
        }
      }
      
      return isConnected;
    } catch (error) {
      console.error('Error checking database connection:', error);
      this.isDbConnected = false;
      this.notifyConnectionStatus();
      
      // Start reconnection if internet is available
      if (this.isInternetConnected) {
        this.startReconnectionAttempts();
      }
      
      return false;
    }
  }

  /**
   * Start database reconnection attempts
   */
  private startReconnectionAttempts(): void {
    // Reset reconnect attempts counter if this is a new reconnection sequence
    if (!this.reconnectTimer) {
      this.reconnectAttempts = 0;
    }
    
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Attempt reconnection if under the max attempts
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      this.notifyReconnectingStatus(true);
      
      this.reconnectTimer = setTimeout(async () => {
        const result = await this.reconnectDatabase();
        
        if (!result.success) {
          // If failed, schedule another attempt
          this.startReconnectionAttempts();
        } else {
          // If successful, reset the counter and timer
          this.reconnectAttempts = 0;
          this.reconnectTimer = null;
          this.notifyReconnectingStatus(false);
        }
      }, this.RECONNECT_INTERVAL);
    } else {
      // Max attempts reached, stop trying
      this.reconnectTimer = null;
      this.notifyReconnectingStatus(false);
      this.notifyConnectionStatus({
        error: `Failed to reconnect after ${this.MAX_RECONNECT_ATTEMPTS} attempts. Please check your network or database configuration.`
      });
    }
  }

  /**
   * Attempt to reconnect to the database
   */
  private async reconnectDatabase(): Promise<{ success: boolean; error?: string }> {
    try {
      const remoteDb = RemoteDatabase.getInstance();
      
      // If already connected, nothing to do
      if (await remoteDb.checkHealth()) {
        this.isDbConnected = true;
        this.notifyConnectionStatus();
        return { success: true };
      }
      
      // Check internet connectivity first
      if (!await this.checkInternetConnection()) {
        return { 
          success: false, 
          error: 'No internet connection available. Please check your network.'
        };
      }
      
      // Try to reconnect
      await remoteDb.disconnect(); // Ensure clean state
      await remoteDb.connect();
      
      // Verify connection
      const isConnected = await remoteDb.checkHealth();
      this.isDbConnected = isConnected;
      this.notifyConnectionStatus();
      
      return isConnected
        ? { success: true }
        : { success: false, error: 'Failed to establish database connection.' };
    } catch (error) {
      console.error('Error reconnecting to database:', error);
      this.isDbConnected = false;
      this.notifyConnectionStatus({ error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify the renderer process about connection status
   */
  private notifyConnectionStatus(additionalInfo = {}): void {
    if (!this.mainWindow) return;
    
    this.mainWindow.webContents.send(connectionEvents.DB_CONNECTION_STATUS, {
      connected: this.isDbConnected,
      internetConnected: this.isInternetConnected,
      ...additionalInfo
    });
  }

  /**
   * Notify the renderer process about reconnection attempts
   */
  private notifyReconnectingStatus(isReconnecting: boolean): void {
    if (!this.mainWindow) return;
    
    this.mainWindow.webContents.send(connectionEvents.DB_RECONNECTING_STATUS, {
      reconnecting: isReconnecting,
      attemptNumber: this.reconnectAttempts,
      maxAttempts: this.MAX_RECONNECT_ATTEMPTS
    });
  }

  /**
   * Stop all monitoring and timers
   */
  public stop(): void {
    if (this.internetCheckTimer) {
      clearInterval(this.internetCheckTimer);
      this.internetCheckTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Export singleton instance
export default ConnectionMonitor.getInstance();