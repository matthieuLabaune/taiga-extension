const vscode = require('vscode');

class TaigaConfig {
    static getBaseUrl() {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('baseUrl', 'https://taiga.handisport.org');
    }

    static getApiUrl() {
        return `${this.getBaseUrl()}/api/v1`;
    }

    static async setCredentials(username, password) {
        await vscode.workspace.getConfiguration().update('taiga.username', username, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update('taiga.password', password, vscode.ConfigurationTarget.Global);
    }

    static getUsername() {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('username', '');
    }

    static getPassword() {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('password', '');
    }
}

const TAIGA_CONFIG = {
    get baseUrl() { return TaigaConfig.getBaseUrl(); },
    get apiUrl() { return TaigaConfig.getApiUrl(); }
};

module.exports = { TaigaConfig, TAIGA_CONFIG };
