import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

export interface AwsCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface AppSettings {
  theme: string;
  language: string;
  autoSync: boolean;
}

interface ConfigData {
  remoteDatabase?: AwsCredentials;
  appSettings?: AppSettings;
}

/**
 * Configuration manager that stores settings in JSON files
 */
class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private encryptionKey: string;
  private config: ConfigData = {};
  private defaultConfigPath: string;

  private constructor() {
    // Set up user config path
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'app-config.json');

    // Set up encryption
    this.encryptionKey = this.getOrCreateEncryptionKey();

    // Determine default config path based on environment
    if (app.isPackaged) {
      this.defaultConfigPath = path.join(
        process.resourcesPath,
        'default-config.json'
      );
    } else {
      this.defaultConfigPath = path.join(__dirname, 'default-config.json');
    }

    // Load config
    this.loadConfig();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load config from file or initialize with defaults
   */
  private loadConfig(): void {
    // First try to load user config
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(this.decrypt(fileContent));
        return;
      } catch (err) {
        console.error('Error loading user config:', err);
        // Continue to load default config
      }
    }

    // If no user config, try to load default config
    if (fs.existsSync(this.defaultConfigPath)) {
      console.log('Loading default config from:', this.defaultConfigPath);
      try {
        const defaultContent = fs.readFileSync(this.defaultConfigPath, 'utf8');
        this.config = JSON.parse(defaultContent);

        // Save default config to user config location
        this.saveConfig();
        console.log('Initialized with default configuration');
      } catch (err) {
        console.error('Error loading default config:', err);
        // Initialize with empty config
        this.initEmptyConfig();
      }
    } else {
      console.log('No default config found, initializing empty config');
      this.initEmptyConfig();
    }
  }

  /**
   * Initialize with empty default values
   */
  private initEmptyConfig(): void {
    this.config = {
      appSettings: {
        theme: 'system',
        language: 'en',
        autoSync: true,
      },
    };
    this.saveConfig();
  }

  /**
   * Save config to file
   */
  private saveConfig(): void {
    try {
      const json = JSON.stringify(this.config, null, 2);
      const encrypted = this.encrypt(json);

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, encrypted);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  /**
   * Get or create encryption key for sensitive data
   */
  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(app.getPath('userData'), '.encryption-key');

    // Return existing key if available
    if (fs.existsSync(keyPath)) {
      try {
        const key = fs.readFileSync(keyPath, 'utf8');
        // Validate that the key is a valid hex string of the right length
        if (/^[0-9a-f]{64}$/i.test(key)) {
          return key;
        }
        console.warn(
          'Stored encryption key has invalid format, creating new key'
        );
      } catch (err) {
        console.error('Failed to read encryption key:', err);
      }
    }

    // Create a new key - ensure it's exactly 32 bytes (64 hex chars)
    try {
      const newKey = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, newKey, { mode: 0o600 }); // Restrict permissions
      return newKey;
    } catch (err) {
      console.error('Failed to create encryption key:', err);
      return crypto.randomBytes(32).toString('hex'); // Fallback
    }
  }

  /**
   * Encrypt a string using the encryption key
   */
  encrypt(text: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create a key Buffer of the proper length (32 bytes)
      // The key is stored as a hex string, so 64 hex chars = 32 bytes
      const key = Buffer.from(this.encryptionKey, 'hex');

      // Create the cipher with the proper key
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Prepend IV to encrypted data for later decryption
      return iv.toString('hex') + ':' + encrypted;
    } catch (err) {
      console.error('Encryption error:', err);
      return text; // Fallback to plaintext if encryption fails
    }
  }

  /**
   * Decrypt a string using the encryption key
   */
  decrypt(encryptedText: string): string {
    try {
      // Check if the text is encrypted (has the IV prefix)
      if (!encryptedText.includes(':')) {
        return encryptedText; // Not encrypted, return as is
      }

      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedData = textParts[1];

      // Create the key Buffer using the full hex string
      const key = Buffer.from(this.encryptionKey, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      console.error('Decryption error:', err);
      throw new Error('Failed to decrypt configuration data');
    }
  }

  /**
   * Get remote database credentials
   */
  public getRemoteDbCredentials(): AwsCredentials {
    if (!this.config.remoteDatabase) {
      return {
        host: '',
        port: 5432,
        username: '',
        password: '',
        database: '',
      };
    }

    return { ...this.config.remoteDatabase };
  }

  /**
   * Check if remote database credentials exist
   */
  public hasRemoteDbCredentials(): boolean {
    return !!this.config.remoteDatabase;
  }

  /**
   * Save remote database credentials
   */
  public saveRemoteDbCredentials(credentials: AwsCredentials): void {
    this.config.remoteDatabase = { ...credentials };
    this.saveConfig();
  }

  /**
   * Clear remote database credentials
   */
  public clearRemoteDbCredentials(): void {
    delete this.config.remoteDatabase;
    this.saveConfig();
  }

  /**
   * Get application settings
   */
  public getAppSettings(): AppSettings {
    return (
      { ...this.config.appSettings } || {
        theme: 'system',
        language: 'en',
        autoSync: true,
      }
    );
  }

  /**
   * Save application settings
   */
  public saveAppSettings(settings: AppSettings): void {
    this.config.appSettings = { ...settings };
    this.saveConfig();
  }
}

// Export functions for API compatibility
export const getRemoteDbCredentials = (): AwsCredentials => {
  return ConfigManager.getInstance().getRemoteDbCredentials();
};

export const hasRemoteDbCredentials = (): boolean => {
  return ConfigManager.getInstance().hasRemoteDbCredentials();
};

export const saveRemoteDbCredentials = (credentials: AwsCredentials): void => {
  ConfigManager.getInstance().saveRemoteDbCredentials(credentials);
};

export const clearRemoteDbCredentials = (): void => {
  ConfigManager.getInstance().clearRemoteDbCredentials();
};

export const getAppSettings = (): AppSettings => {
  return ConfigManager.getInstance().getAppSettings();
};

export const saveAppSettings = (settings: AppSettings): void => {
  ConfigManager.getInstance().saveAppSettings(settings);
};

// Export the singleton instance
export default ConfigManager.getInstance();
