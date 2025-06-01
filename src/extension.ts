import * as vscode from 'vscode';
import { createTaigaApiService } from './services/taigaApi';
import { TaigaConfig } from './config';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension Taiga activée !');

    // Initialiser les services
    const taigaApi = createTaigaApiService(context);

    // Afficher un message de bienvenue
    vscode.window.showInformationMessage('Extension Taiga chargée avec succès !');

    // Commande simple pour tester
    const loginCommand = vscode.commands.registerCommand('taiga.login', async () => {
        const username = await vscode.window.showInputBox({
            prompt: 'Nom d\'utilisateur Taiga',
            value: TaigaConfig.getUsername()
        });

        if (username) {
            const password = await vscode.window.showInputBox({
                prompt: 'Mot de passe Taiga',
                password: true
            });

            if (password) {
                try {
                    await TaigaConfig.setCredentials(username, password);
                    await taigaApi.login(username, password);
                    vscode.window.showInformationMessage('Connecté à Taiga avec succès !');
                } catch (error) {
                    vscode.window.showErrorMessage('Erreur de connexion à Taiga');
                }
            }
        }
    });

    const refreshCommand = vscode.commands.registerCommand('taiga.refresh', () => {
        vscode.window.showInformationMessage('Actualisation Taiga !');
    });

    context.subscriptions.push(loginCommand, refreshCommand);
}

export function deactivate() {
    console.log('Extension Taiga désactivée');
}
