import * as vscode from 'vscode';

export class TaigaConfig {
    static getBaseUrl(): string {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('baseUrl', 'https://taiga.handisport.org');
    }

    static getApiUrl(): string {
        return `${this.getBaseUrl()}/api/v1`;
    }

    static async setCredentials(username: string, password: string): Promise<void> {
        await vscode.workspace.getConfiguration().update('taiga.username', username, vscode.ConfigurationTarget.Global);
        // Note: En production, utilisez le SecretStorage de VS Code pour les mots de passe
        await vscode.workspace.getConfiguration().update('taiga.password', password, vscode.ConfigurationTarget.Global);
    }

    static getUsername(): string {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('username', '');
    }

    static getPassword(): string {
        const config = vscode.workspace.getConfiguration('taiga');
        return config.get('password', '');
    }

    // Ajouter la propriété baseUrl manquante
    static get baseUrl(): string {
        return this.getBaseUrl();
    }
}

export const TAIGA_CONFIG = {
    get baseUrl() { return TaigaConfig.getBaseUrl(); },
    get apiUrl() { return TaigaConfig.getApiUrl(); }
};
