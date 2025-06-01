import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { TaigaConfig } from '../config';

export interface TaigaProject {
    id: number;
    name: string;
    slug: string;
    description: string;
    created_date: string;
    modified_date: string;
    is_private: boolean;
}

export interface TaigaAuthResponse {
    auth_token: string;
    refresh: string;
    id: number;
    username: string;
    email: string;
    full_name: string;
}

export interface TaigaUserStory {
    id: number;
    subject: string;
    description: string;
    status_extra_info: {
        name: string;
        color: string;
    };
    assigned_to_extra_info?: {
        full_name_display: string;
    };
}

export class TaigaApiService {
    private authToken: string | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async login(username?: string, password?: string): Promise<TaigaAuthResponse> {
        const user = username || TaigaConfig.getUsername();
        const pass = password || TaigaConfig.getPassword();

        if (!user || !pass) {
            throw new Error('Username and password are required');
        }

        try {
            const response = await fetch(`${TaigaConfig.getApiUrl()}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'normal',
                    username: user,
                    password: pass
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.statusText}`);
            }

            const authData = await response.json() as TaigaAuthResponse;
            this.authToken = authData.auth_token;

            // Stocker le token dans le storage de VS Code
            await this.context.globalState.update('taiga_auth_token', authData.auth_token);

            return authData;
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur de connexion à Taiga: ${error}`);
            throw error;
        }
    }

    async getProjects(): Promise<TaigaProject[]> {
        await this.ensureAuthenticated();

        try {
            const response = await fetch(`${TaigaConfig.getApiUrl()}/projects`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch projects: ${response.statusText}`);
            }

            return await response.json() as TaigaProject[];
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur lors de la récupération des projets: ${error}`);
            throw error;
        }
    }

    async getUserStories(projectId: number): Promise<TaigaUserStory[]> {
        await this.ensureAuthenticated();

        try {
            const response = await fetch(`${TaigaConfig.getApiUrl()}/userstories?project=${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user stories: ${response.statusText}`);
            }

            return await response.json() as TaigaUserStory[];
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur lors de la récupération des user stories: ${error}`);
            throw error;
        }
    }

    private async ensureAuthenticated(): Promise<void> {
        if (!this.authToken) {
            // Essayer de récupérer le token depuis le storage
            this.authToken = this.context.globalState.get('taiga_auth_token') || null;
        }

        if (!this.authToken) {
            await this.login();
        }
    }

    async logout(): Promise<void> {
        this.authToken = null;
        await this.context.globalState.update('taiga_auth_token', undefined);
        vscode.window.showInformationMessage('Déconnecté de Taiga');
    }
}

// Exporter une fonction factory au lieu d'une instance
export function createTaigaApiService(context: vscode.ExtensionContext): TaigaApiService {
    return new TaigaApiService(context);
}
