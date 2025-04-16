"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppIdentityService = void 0;
const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
const uuid_1 = require("uuid");
class AppIdentityService {
    constructor() {
        this.APP_ID_FILE = 'app-identity.json';
        // Initialize on first instantiation
        this.initializeAppId();
    }
    static getInstance() {
        if (!AppIdentityService.instance) {
            AppIdentityService.instance = new AppIdentityService();
        }
        return AppIdentityService.instance;
    }
    /**
     * Get the unique app ID for this installation
     * @returns The app ID string
     */
    getAppId() {
        return this.appId;
    }
    /**
     * Initialize the app ID from storage or create a new one
     */
    initializeAppId() {
        try {
            const appDataPath = electron_1.app.getPath('userData');
            const filePath = path.join(appDataPath, this.APP_ID_FILE);
            // Check if the ID file exists
            if (fs.existsSync(filePath)) {
                // Read existing app ID
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(fileContent);
                this.appId = data.appId;
                console.log(`Loaded existing app ID: ${this.appId}`);
            }
            else {
                // Generate a new app ID
                this.appId = (0, uuid_1.v4)();
                // Save the new app ID
                const data = { appId: this.appId, createdAt: new Date().toISOString() };
                fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
                console.log(`Generated new app ID: ${this.appId}`);
            }
        }
        catch (error) {
            console.error('Error initializing app ID:', error);
            // Fallback to a runtime-only ID if file operations fail
            this.appId = `fallback-${(0, uuid_1.v4)()}`;
        }
    }
}
exports.AppIdentityService = AppIdentityService;
exports.default = AppIdentityService.getInstance();
//# sourceMappingURL=app-identity.service.js.map