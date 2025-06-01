// src/extension.js

const axios = require('axios');
const vscode = require('vscode');

// TreeDataProvider enrichi pour afficher projets, milestones, user stories et tâches
class TaigaTreeDataProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        const token = this.context.globalState.get('taiga_auth_token');

        if (!token) {
            return [this.createInfoItem('Connectez-vous pour voir vos projets')];
        }

        if (!element) {
            // Niveau racine - afficher les projets
            return await this.getProjects();
        } else if (element.contextValue === 'project') {
            // Niveau projet - afficher sprints et user stories
            return await this.getProjectChildren(element.data);
        } else if (element.contextValue === 'sprints-section') {
            // Section sprints - afficher tous les sprints
            return await this.getProjectSprints(element.projectId);
        } else if (element.contextValue === 'milestone') {
            // Niveau sprint - afficher les user stories du sprint
            return await this.getMilestoneUserStories(element.data);
        } else if (element.contextValue === 'userstories-section') {
            // Section user stories - afficher toutes les user stories
            return await this.getProjectUserStories(element.projectId);
        } else if (element.contextValue === 'userstory') {
            // Niveau user story - afficher les tâches
            return await this.getUserStoryTasks(element.data);
        }

        return [];
    }

    async getProjects() {
        const projects = this.context.globalState.get('taiga_projects', []);
        if (projects.length === 0) {
            return [this.createInfoItem('Aucun projet trouvé')];
        }

        return projects.map(project => {
            const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.tooltip = `${project.name}\n${project.description || 'Pas de description'}`;
            item.contextValue = 'project';
            item.iconPath = new vscode.ThemeIcon('project');
            item.data = project;
            return item;
        });
    }

    async getProjectChildren(project) {
        const children = [];

        // Section Sprints (Milestones)
        const sprintsItem = new vscode.TreeItem('🏃 Sprints', vscode.TreeItemCollapsibleState.Collapsed);
        sprintsItem.contextValue = 'sprints-section';
        sprintsItem.projectId = project.id;
        children.push(sprintsItem);

        // Section User Stories
        const userStoriesItem = new vscode.TreeItem('📝 User Stories', vscode.TreeItemCollapsibleState.Collapsed);
        userStoriesItem.contextValue = 'userstories-section';
        userStoriesItem.projectId = project.id;
        children.push(userStoriesItem);

        // Charger les sprints et compter
        try {
            const milestones = await this.loadMilestones(project.id);
            if (milestones.length > 0) {
                sprintsItem.description = `(${milestones.length})`;
            }
        } catch (error) {
            console.error('Erreur chargement sprints:', error);
        }

        return children;
    }

    async getProjectSprints(projectId) {
        try {
            const milestones = await this.loadMilestones(projectId);
            if (milestones.length === 0) {
                return [this.createInfoItem('Aucun sprint trouvé')];
            }

            return milestones.map(milestone => {
                const statusIcon = milestone.closed ? '✅' : '🏃';
                const item = new vscode.TreeItem(
                    `${statusIcon} ${milestone.name}`,
                    vscode.TreeItemCollapsibleState.Collapsed
                );

                const startDate = milestone.estimated_start ? new Date(milestone.estimated_start).toLocaleDateString() : 'N/A';
                const endDate = milestone.estimated_finish ? new Date(milestone.estimated_finish).toLocaleDateString() : 'N/A';

                item.tooltip = `Sprint: ${milestone.name}\nDébut: ${startDate}\nFin: ${endDate}\nStatut: ${milestone.closed ? 'Fermé' : 'Actif'}`;
                item.contextValue = 'milestone';
                item.data = milestone;
                item.iconPath = new vscode.ThemeIcon(milestone.closed ? 'check' : 'clock');

                // Ajouter la description avec les dates
                if (milestone.estimated_start || milestone.estimated_finish) {
                    item.description = `${startDate} → ${endDate}`;
                }

                return item;
            });
        } catch (error) {
            console.error('Erreur chargement sprints:', error);
            return [this.createInfoItem('Erreur lors du chargement des sprints')];
        }
    }

    async loadMilestones(projectId) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            const response = await axios.get(`${baseUrl}/api/v1/milestones?project=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API milestones:', error);
            return [];
        }
    }

    async loadUserStories(projectId, milestoneId = null) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            let url = `${baseUrl}/api/v1/userstories?project=${projectId}`;
            if (milestoneId) {
                url += `&milestone=${milestoneId}`;
            }

            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API user stories:', error);
            return [];
        }
    }

    async loadTasks(userStoryId) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            const response = await axios.get(`${baseUrl}/api/v1/tasks?user_story=${userStoryId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API tasks:', error);
            return [];
        }
    }

    async getMilestoneUserStories(milestone) {
        const userStories = await this.loadUserStories(milestone.project, milestone.id);
        return userStories.map(us => this.createUserStoryItem(us));
    }

    async getProjectUserStories(projectId) {
        const userStories = await this.loadUserStories(projectId);
        return userStories.map(us => this.createUserStoryItem(us));
    }

    createUserStoryItem(userStory) {
        const statusIcon = userStory.is_closed ? '✅' : '🔄';

        // Construire le titre avec truncature si nécessaire
        let title = `${statusIcon} #${userStory.ref} ${userStory.subject}`;
        if (title.length > 60) {
            title = title.substring(0, 57) + '...';
        }

        const item = new vscode.TreeItem(
            title,
            vscode.TreeItemCollapsibleState.Collapsed
        );

        // Construire la description avec statut et assigné
        let description = '';
        if (userStory.status_extra_info?.name) {
            description += `*(${userStory.status_extra_info.name})*`;
        }
        if (userStory.assigned_to_extra_info?.full_name_display) {
            const assignee = userStory.assigned_to_extra_info.full_name_display;
            const shortAssignee = assignee.length > 15 ? assignee.substring(0, 12) + '...' : assignee;
            description += description ? ` - ${shortAssignee}` : shortAssignee;
        }

        item.description = description;
        item.tooltip = `#${userStory.ref}: ${userStory.subject}\nStatut: ${userStory.status_extra_info?.name || 'N/A'}\nAssigné à: ${userStory.assigned_to_extra_info?.full_name_display || 'Non assigné'}`;
        item.contextValue = 'userstory';
        item.data = userStory;
        item.iconPath = new vscode.ThemeIcon('book');
        return item;
    }

    async getUserStoryTasks(userStory) {
        const tasks = await this.loadTasks(userStory.id);
        if (tasks.length === 0) {
            return [this.createInfoItem('Aucune tâche')];
        }

        return tasks.map(task => {
            const statusIcon = task.is_closed ? '✅' : '🔲';

            // Construire le titre avec truncature si nécessaire
            let title = `${statusIcon} #${task.ref} ${task.subject}`;
            if (title.length > 60) {
                title = title.substring(0, 57) + '...';
            }

            const item = new vscode.TreeItem(
                title,
                vscode.TreeItemCollapsibleState.None
            );

            // Construire la description avec statut et assigné
            let description = '';
            if (task.status_extra_info?.name) {
                description += `*(${task.status_extra_info.name})*`;
            }
            if (task.assigned_to_extra_info?.full_name_display) {
                const assignee = task.assigned_to_extra_info.full_name_display;
                const shortAssignee = assignee.length > 15 ? assignee.substring(0, 12) + '...' : assignee;
                description += description ? ` - ${shortAssignee}` : shortAssignee;
            }

            item.description = description;
            item.tooltip = `#${task.ref}: ${task.subject}\nStatut: ${task.status_extra_info?.name || 'N/A'}\nAssigné à: ${task.assigned_to_extra_info?.full_name_display || 'Non assigné'}`;
            item.contextValue = 'task';
            item.data = task;
            item.iconPath = new vscode.ThemeIcon(task.is_closed ? 'check' : 'circle-outline');
            return item;
        });
    }

    createInfoItem(text) {
        const item = new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        return item;
    }
}

function activate(context) {
    console.log('Extension Taiga activée');

    // Créer le TreeDataProvider
    const treeDataProvider = new TaigaTreeDataProvider(context);
    vscode.window.createTreeView('taigaExplorer', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });

    const loginCommand = vscode.commands.registerCommand('taiga.login', async () => {
        // Demander les identifiants à l'utilisateur
        const username = await vscode.window.showInputBox({
            prompt: 'Nom d\'utilisateur Taiga',
            placeHolder: 'Entrez votre nom d\'utilisateur'
        });

        if (!username) return;

        const password = await vscode.window.showInputBox({
            prompt: 'Mot de passe Taiga',
            password: true,
            placeHolder: 'Entrez votre mot de passe'
        });

        if (!password) return;

        // Connexion avec indicateur de progression
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Connexion à Taiga...",
            cancellable: false
        }, async (progress) => {
            try {
                const config = vscode.workspace.getConfiguration('taiga');
                const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

                progress.report({ message: "Authentification en cours..." });

                const response = await axios.post(`${baseUrl}/api/v1/auth`, {
                    username,
                    password,
                    type: 'normal'
                });

                const token = response.data.auth_token;
                const userInfo = response.data;

                // Stocker le token et les infos utilisateur
                await context.globalState.update('taiga_auth_token', token);
                await context.globalState.update('taiga_user_info', userInfo);

                // Sauvegarder les credentials (optionnel)
                await config.update('username', username, vscode.ConfigurationTarget.Global);

                vscode.window.showInformationMessage(
                    `Connecté à Taiga en tant que ${userInfo.full_name || username} !`
                );

                // Charger les projets après connexion
                await loadProjects(context, baseUrl, token, treeDataProvider);

            } catch (err) {
                console.error('Erreur de connexion:', err);
                let errorMessage = 'Échec de la connexion';

                if (err.response) {
                    // Erreur de réponse du serveur
                    errorMessage = `Erreur ${err.response.status}: ${err.response.data?.detail || 'Identifiants incorrects'}`;
                } else if (err.request) {
                    // Erreur réseau
                    errorMessage = 'Impossible de joindre le serveur Taiga';
                } else {
                    errorMessage = err.message;
                }

                vscode.window.showErrorMessage(`Connexion échouée: ${errorMessage}`);
            }
        });
    });

    const refreshCommand = vscode.commands.registerCommand('taiga.refresh', async () => {
        const token = context.globalState.get('taiga_auth_token');
        if (!token) {
            vscode.window.showWarningMessage('Veuillez vous connecter d\'abord');
            return;
        }

        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        await loadProjects(context, baseUrl, token, treeDataProvider);
    });

    const logoutCommand = vscode.commands.registerCommand('taiga.logout', async () => {
        await context.globalState.update('taiga_auth_token', undefined);
        await context.globalState.update('taiga_user_info', undefined);
        await context.globalState.update('taiga_projects', []);

        treeDataProvider.refresh();
        vscode.window.showInformationMessage('Déconnecté de Taiga');
    });

    const openProjectCommand = vscode.commands.registerCommand('taiga.openProject', (item) => {
        if (item && item.data && item.data.slug) {
            const config = vscode.workspace.getConfiguration('taiga');
            const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');
            const url = `${baseUrl}/project/${item.data.slug}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    });

    const openUserStoryCommand = vscode.commands.registerCommand('taiga.openUserStory', (item) => {
        if (item && item.data) {
            const config = vscode.workspace.getConfiguration('taiga');
            const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');
            const url = `${baseUrl}/project/${item.data.project_extra_info?.slug}/us/${item.data.ref}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    });

    const openTaskCommand = vscode.commands.registerCommand('taiga.openTask', (item) => {
        if (item && item.data) {
            const config = vscode.workspace.getConfiguration('taiga');
            const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');
            const url = `${baseUrl}/project/${item.data.project_extra_info?.slug}/task/${item.data.ref}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    });

    const openMilestoneCommand = vscode.commands.registerCommand('taiga.openMilestone', (item) => {
        if (item && item.data) {
            const config = vscode.workspace.getConfiguration('taiga');
            const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');
            const url = `${baseUrl}/project/${item.data.project_extra_info?.slug}/milestone/${item.data.slug}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    });

    context.subscriptions.push(
        loginCommand,
        refreshCommand,
        logoutCommand,
        openProjectCommand,
        openUserStoryCommand,
        openTaskCommand,
        openMilestoneCommand
    );
}

async function loadProjects(context, baseUrl, token, treeDataProvider) {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Chargement des projets...",
            cancellable: false
        }, async (progress) => {
            const response = await axios.get(`${baseUrl}/api/v1/projects`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const projects = response.data;

            await context.globalState.update('taiga_projects', projects);

            // Rafraîchir la vue
            treeDataProvider.refresh();

            vscode.window.showInformationMessage(
                `${projects.length} projet(s) chargé(s) avec succès !`
            );

            console.log('Projets Taiga:', projects.map(p => ({ name: p.name, slug: p.slug })));
        });
    } catch (err) {
        console.error('Erreur lors du chargement des projets:', err);
        vscode.window.showErrorMessage('Impossible de charger les projets');
    }
}

function deactivate() {
    console.log('Extension Taiga désactivée');
}

module.exports = {
    activate,
    deactivate
};
