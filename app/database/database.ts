import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

import { ipcMain } from 'electron';
import { ProductEntity } from '../entities/product.entity';

export class LocalDatabase {
  private static instance: LocalDatabase;
  private dataSource: DataSource;
  private isInitializing: boolean = false;
  private initPromise: Promise<DataSource> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000; // 1 second initial delay
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {}

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }

    return LocalDatabase.instance;
  }

  private getLocalDbConfig(): DataSourceOptions {
    const userDataPath = app.getPath('userData');
    console.log('User Data Path:', userDataPath);
    return {
      type: 'better-sqlite3',
      database: path.join(userDataPath, 'product-database.db'),
      entities: [ProductEntity],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    };
  }

  async initializeDatabase(): Promise<DataSource> {
    if (this.dataSource && this.dataSource.isInitialized) {
      return this.dataSource;
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;

    try {
      this.initPromise = (async () => {
        const config = this.getLocalDbConfig();
        this.dataSource = new DataSource(config);
        await this.dataSource.initialize();

        this.reconnectAttempts = 0;

        console.log('Local database connection established');
        return this.dataSource;
      })();

      await this.initPromise;
      return this.dataSource;
    } catch (error) {
      console.error('Error connecting to local database:', error);
      throw error;
    }
  }

  getDataSource(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Database connection not initialized');
    }
    return this.dataSource;
  }

  async closeDatabase(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('Local database connection closed');
    }
  }

  async checkConnection(): Promise<boolean> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return false;
    }

    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async reconnect(): Promise<DataSource> {
    if (this.reconnectAttempts) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Check if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new Error(
        `Failed to reconnect to database after ${this.maxReconnectAttempts} attempts`
      );
      console.error(error);
      throw error;
    }

    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponentia
    console.log(
      `Attempting database reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    await new Promise((resolve) => {
      this.reconnectTimer = setTimeout(resolve, delay);
    });

    if (this.dataSource) {
      return;
    }

    return this.initializeDatabase();
  }
}

export const initializeDatabase = async (): Promise<DataSource> => {
  return LocalDatabase.getInstance().initializeDatabase();
};

export const getDataSource = (): DataSource => {
  return LocalDatabase.getInstance().getDataSource();
};

export const closeDatabase = async (): Promise<void> => {
  return LocalDatabase.getInstance().closeDatabase();
};

export const reconnectDatabase = async (): Promise<DataSource> => {
  return LocalDatabase.getInstance().reconnect();
};

export const checkDatabaseConnection = async (): Promise<boolean> => {
  return LocalDatabase.getInstance().checkConnection();
};


let healthCheckInterval: NodeJS.Timeout | null = null;

/** 
* Set up periodic database health checks
*/
export function setupDatabaseHealthCheck(win: BrowserWindow): void {
  // Clear any existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Check database health every 30 seconds
  healthCheckInterval = setInterval(async () => {
    try {
      const isConnected = await checkDatabaseConnection();
      
      if (!isConnected) {
        console.log('Database connection lost, attempting to reconnect...');
        
        // Notify renderer about connection issue
        if (win && !win.isDestroyed()) {
          win.webContents.send('db-connection-status', { connected: false });
        }
        
        // Attempt to reconnect
        await reconnectDatabase();
        
        // Notify renderer about successful reconnection
        if (win && !win.isDestroyed()) {
          win.webContents.send('db-connection-status', { connected: true });
        }
        
        console.log('Database reconnection successful');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      
      // If win is still available, notify renderer about continued connection issues
      if (win && !win.isDestroyed()) {
        win.webContents.send('db-connection-status', { 
          connected: false, 
          error: error.message 
        });
      }
    }
  }, 30000); // 30 seconds
 }

export function setupDatabaseIpcHandlers(): void {
  
  ipcMain.handle('check-db-connection', async () => {
    try {
      const isConnected = await checkDatabaseConnection();
      return { connected: isConnected };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  });
  
  ipcMain.handle('reconnect-database', async () => {
    try {
      await reconnectDatabase();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
