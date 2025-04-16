import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class AppIdentityService {
  private static instance: AppIdentityService;
  private appId: string;
  private readonly APP_ID_FILE = 'app-identity.json';

  private constructor() {
    // Initialize on first instantiation
    this.initializeAppId();
  }

  public static getInstance(): AppIdentityService {
    if (!AppIdentityService.instance) {
      AppIdentityService.instance = new AppIdentityService();
    }
    return AppIdentityService.instance;
  }

  /**
   * Get the unique app ID for this installation
   * @returns The app ID string
   */
  public getAppId(): string {
    return this.appId;
  }

  /**
   * Initialize the app ID from storage or create a new one
   */
  private initializeAppId(): void {
    try {
      const appDataPath = app.getPath('userData');
      const filePath = path.join(appDataPath, this.APP_ID_FILE);

      // Check if the ID file exists
      if (fs.existsSync(filePath)) {
        // Read existing app ID
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        this.appId = data.appId;
        console.log(`Loaded existing app ID: ${this.appId}`);
      } else {
        // Generate a new app ID
        this.appId = uuidv4();
        
        // Save the new app ID
        const data = { appId: this.appId, createdAt: new Date().toISOString() };
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
        console.log(`Generated new app ID: ${this.appId}`);
      }
    } catch (error) {
      console.error('Error initializing app ID:', error);
      // Fallback to a runtime-only ID if file operations fail
      this.appId = `fallback-${uuidv4()}`;
    }
  }
}

export default AppIdentityService.getInstance();