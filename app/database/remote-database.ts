import { DataSource, DataSourceOptions } from 'typeorm';
import { getRemoteDbCredentials } from '../config/config-manager';
import { ProductEntity } from '../entities/postgresql/product.entity';

/**
 * AWS RDS credentials interface
 */
export interface AwsCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * RemoteDatabase class for managing PostgreSQL connection
 * Implements Singleton pattern to ensure a single connection instance
 */
export class RemoteDatabase {
  private static instance: RemoteDatabase;
  private dataSource: DataSource | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<DataSource> | null = null;
  
  // Default credentials - in production, consider loading from environment variables or secure storage
  private credentials: AwsCredentials | null = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {
    this.credentials = getRemoteDbCredentials();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): RemoteDatabase {
    if (!RemoteDatabase.instance) {
      RemoteDatabase.instance = new RemoteDatabase();
    }
    return RemoteDatabase.instance;
  }

  /**
   * Set AWS credentials
   */
  public setCredentials(credentials: AwsCredentials): void {
    this.credentials = credentials;
    // If already connected, we may want to reconnect with new credentials
    if (this.isConnected()) {
      console.log('Credentials updated. You may need to reconnect for changes to take effect.');
    }
  }

  /**
   * Get current AWS credentials
   */
  public getCredentials(): AwsCredentials {
    return { ...this.credentials }; // Return a copy to prevent modification
  }

  /**
   * Get database configuration
   */
  private getConfig(): DataSourceOptions {
    if (!this.credentials) {
      throw new Error('AWS credentials not set');
    }

    return {
      type: 'postgres',
      host: this.credentials.host,
      port: this.credentials.port,
      username: this.credentials.username,
      password: this.credentials.password,
      database: this.credentials.database,
      entities: [ProductEntity],
      synchronize: true, // Should be false in production
      ssl: true,
      extra: {
        ssl: {
          rejectUnauthorized: false // For development - adjust for production
        }
      }
    };
  }

  /**
   * Connect to the remote database
   */
  public async connect(): Promise<DataSource> {
    // Return existing connection if available
    if (this.dataSource && this.dataSource.isInitialized) {
      return this.dataSource;
    }

    // Return existing initialization promise if in progress
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    
    // Create and store the initialization promise
    this.initPromise = (async () => {
      try {
        const config = this.getConfig();
        this.dataSource = new DataSource(config);
        await this.dataSource.initialize();
        console.log('Remote database connection established');
        return this.dataSource;
      } catch (error) {
        console.error('Error connecting to remote database:', error);
        this.dataSource = null;
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if connected to remote database
   */
  public isConnected(): boolean {
    return !!(this.dataSource && this.dataSource.isInitialized);
  }

  /**
   * Get the data source
   */
  public getDataSource(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Remote database connection not initialized. Call connect() first.');
    }
    return this.dataSource;
  }

  /**
   * Close database connection
   */
  public async disconnect(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.dataSource = null;
      console.log('Remote database connection closed');
    }
  }

  /**
   * Check connection health
   */
  public async checkHealth(): Promise<boolean> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return false;
    }
    
    try {
      // Simple query to verify connection
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Remote database health check failed:', error);
      return false;
    }
  }
}

// Convenience functions for backward compatibility and easier access
export const setAwsCredentials = (credentials: AwsCredentials): void => {
  RemoteDatabase.getInstance().setCredentials(credentials);
};

export const getAwsCredentials = (): AwsCredentials => {
  return RemoteDatabase.getInstance().getCredentials();
};

export const connectToRemoteDb = async (): Promise<DataSource> => {
  return RemoteDatabase.getInstance().connect();
};

export const closeRemoteConnection = async (): Promise<void> => {
  return RemoteDatabase.getInstance().disconnect();
};

export const isRemoteConnected = (): boolean => {
  return RemoteDatabase.getInstance().isConnected();
};

export const getRemoteDataSource = (): DataSource => {
  return RemoteDatabase.getInstance().getDataSource();
};

// For backwards compatibility
export const getRemoteConnection = (): DataSource => {
  return getRemoteDataSource();
};