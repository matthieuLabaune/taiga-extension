// src/extension.js

const axios = require('axios');
const vscode = require('vscode');

// TreeDataProvider enrichi pour afficher projets, milestones, user stories et tâches
class TaigaTreeDataProvider {
    constructor(context, viewType = 'projects') {
        this.context = context;
        this.viewType = viewType;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.searchQuery = '';
        this.selectedProjectId = null;
    }

    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.refresh();
    }

    clearSearch() {
        this.searchQuery = '';
        this.refresh();
    }

    matchesSearch(item) {
        if (!this.searchQuery) return true;
        const searchText = `#${item.ref} ${item.subject}`.toLowerCase();
        return searchText.includes(this.searchQuery);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    setSelectedProject(projectId) {
        this.selectedProjectId = projectId;
        this.refresh();
    }

    async getChildren(element) {
        const token = this.context.globalState.get('taiga_auth_token');

        if (!token) {
            return [this.createInfoItem('Connectez-vous pour voir vos projets')];
        }

        if (!element) {
            // Afficher selon le type de vue
            switch (this.viewType) {
                case 'projects':
                    return await this.getProjects();
                case 'search':
                    return await this.getSearchResults();
                case 'epics':
                    return await this.getEpicsForCurrentProject();
                case 'sprints':
                    return await this.getSprintsForCurrentProject();
                case 'userstories':
                    return await this.getUserStoriesForCurrentProject();
                default:
                    return [];
            }
        }

        return [];
    }

    async getProjects() {
        const projects = this.context.globalState.get('taiga_projects', []);
        if (projects.length === 0) {
            return [this.createInfoItem('Aucun projet trouvé')];
        }

        return projects.map(project => {
            const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.None);
            item.tooltip = `${project.name}\n${project.description || 'Pas de description'}`;
            item.contextValue = 'project';
            item.iconPath = new vscode.ThemeIcon('project');
            item.data = project;
            return item;
        });
    }

    async getSearchResults() {
        if (!this.searchQuery) {
            return [this.createInfoItem('Utilisez la barre de recherche pour chercher')];
        }
        if (!this.selectedProjectId) {
            return [this.createInfoItem('Sélectionnez d\'abord un projet')];
        }

        // Implémenter la recherche ici
        return [this.createInfoItem(`Recherche: "${this.searchQuery}" dans projet ${this.selectedProjectId}`)];
    }

    async getEpicsForCurrentProject() {
        if (!this.selectedProjectId) {
            return [this.createInfoItem('Sélectionnez d\'abord un projet')];
        }

        try {
            const epics = await this.loadEpics(this.selectedProjectId);
            const filtered = epics.filter(epic => this.matchesSearch(epic));

            if (filtered.length === 0) {
                return [this.createInfoItem('Aucun epic trouvé')];
            }

            return filtered.map(epic => {
                const item = new vscode.TreeItem(`#${epic.ref} ${epic.subject}`, vscode.TreeItemCollapsibleState.None);
                item.tooltip = `Epic #${epic.ref}: ${epic.subject}`;
                item.contextValue = 'epic';
                item.data = epic;
                item.iconPath = new vscode.ThemeIcon(epic.is_closed ? 'check' : 'bookmark');
                return item;
            });
        } catch (error) {
            return [this.createInfoItem('Erreur lors du chargement des epics')];
        }
    }

    async getSprintsForCurrentProject() {
        if (!this.selectedProjectId) {
            return [this.createInfoItem('Sélectionnez d\'abord un projet')];
        }

        try {
            const sprints = await this.loadSprints(this.selectedProjectId);
            const filtered = sprints.filter(sprint => this.matchesSearch(sprint));

            if (filtered.length === 0) {
                return [this.createInfoItem('Aucun sprint trouvé')];
            }

            return filtered.map(sprint => {
                const item = new vscode.TreeItem(sprint.name, vscode.TreeItemCollapsibleState.None);
                item.tooltip = `Sprint: ${sprint.name}`;
                item.contextValue = 'milestone';
                item.data = sprint;
                item.iconPath = new vscode.ThemeIcon(sprint.closed ? 'check' : 'clock');
                return item;
            });
        } catch (error) {
            return [this.createInfoItem('Erreur lors du chargement des sprints')];
        }
    }

    async getUserStoriesForCurrentProject() {
        if (!this.selectedProjectId) {
            return [this.createInfoItem('Sélectionnez d\'abord un projet')];
        }

        try {
            const userStories = await this.loadUserStories(this.selectedProjectId);
            const filtered = userStories.filter(us => this.matchesSearch(us));

            if (filtered.length === 0) {
                return [this.createInfoItem('Aucune user story trouvée')];
            }

            return filtered.map(us => {
                const item = new vscode.TreeItem(`#${us.ref} ${us.subject}`, vscode.TreeItemCollapsibleState.None);
                item.tooltip = `User Story #${us.ref}: ${us.subject}`;
                item.contextValue = 'userstory';
                item.data = us;
                item.iconPath = new vscode.ThemeIcon(us.is_closed ? 'check' : 'circle-outline');
                return item;
            });
        } catch (error) {
            return [this.createInfoItem('Erreur lors du chargement des user stories')];
        }
    }

    async loadEpics(projectId) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            const response = await axios.get(`${baseUrl}/api/v1/epics?project=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API epics:', error);
            return [];
        }
    }

    async loadSprints(projectId) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            const response = await axios.get(`${baseUrl}/api/v1/milestones?project=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API sprints:', error);
            return [];
        }
    }

    async loadUserStories(projectId) {
        const token = this.context.globalState.get('taiga_auth_token');
        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        try {
            const response = await axios.get(`${baseUrl}/api/v1/userstories?project=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Erreur API user stories:', error);
            return [];
        }
    }

    createInfoItem(text) {
        const item = new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        return item;
    }
}

function activate(context) {
    console.log('Extension Taiga activée');

    // Créer les TreeDataProviders pour chaque vue
    const projectsProvider = new TaigaTreeDataProvider(context, 'projects');
    const searchProvider = new TaigaTreeDataProvider(context, 'search');
    const epicsProvider = new TaigaTreeDataProvider(context, 'epics');
    const sprintsProvider = new TaigaTreeDataProvider(context, 'sprints');
    const userStoriesProvider = new TaigaTreeDataProvider(context, 'userstories');

    // Créer les vues
    vscode.window.createTreeView('taigaProjects', {
        treeDataProvider: projectsProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('taigaSearch', {
        treeDataProvider: searchProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('taigaEpics', {
        treeDataProvider: epicsProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('taigaSprints', {
        treeDataProvider: sprintsProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('taigaUserStories', {
        treeDataProvider: userStoriesProvider,
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
                await loadProjects(context, baseUrl, token, projectsProvider);

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

    // Nouvelle commande pour sélectionner un projet
    const selectProjectCommand = vscode.commands.registerCommand('taiga.selectProject', (item) => {
        if (item && item.data && item.data.id) {
            const projectId = item.data.id;

            // Mettre à jour toutes les vues avec le projet sélectionné
            searchProvider.setSelectedProject(projectId);
            epicsProvider.setSelectedProject(projectId);
            sprintsProvider.setSelectedProject(projectId);
            userStoriesProvider.setSelectedProject(projectId);

            vscode.window.showInformationMessage(`Projet sélectionné: ${item.data.name}`);
        }
    });

    const refreshCommand = vscode.commands.registerCommand('taiga.refresh', async () => {
        const token = context.globalState.get('taiga_auth_token');
        if (!token) {
            vscode.window.showWarningMessage('Veuillez vous connecter d\'abord');
            return;
        }

        const config = vscode.workspace.getConfiguration('taiga');
        const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');

        await loadProjects(context, baseUrl, token, projectsProvider);
    });

    const logoutCommand = vscode.commands.registerCommand('taiga.logout', async () => {
        await context.globalState.update('taiga_auth_token', undefined);
        await context.globalState.update('taiga_user_info', undefined);
        await context.globalState.update('taiga_projects', []);

        projectsProvider.refresh();
        searchProvider.refresh();
        epicsProvider.refresh();
        sprintsProvider.refresh();
        userStoriesProvider.refresh();
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

    const openEpicCommand = vscode.commands.registerCommand('taiga.openEpic', (item) => {
        if (item && item.data) {
            const config = vscode.workspace.getConfiguration('taiga');
            const baseUrl = config.get('baseUrl', 'https://taiga.handisport.org');
            const url = `${baseUrl}/project/${item.data.project_extra_info?.slug}/epic/${item.data.ref}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    });

    // AJOUT UNIQUEMENT - 2 commandes :
    const searchCommand = vscode.commands.registerCommand('taiga.search', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Rechercher',
            placeHolder: '#42 ou titre...'
        });
        if (query !== undefined) {
            searchProvider.setSearchQuery(query);
            epicsProvider.setSearchQuery(query);
            sprintsProvider.setSearchQuery(query);
            userStoriesProvider.setSearchQuery(query);
        }
    });

    const clearSearchCommand = vscode.commands.registerCommand('taiga.clearSearch', () => {
        searchProvider.clearSearch();
        epicsProvider.clearSearch();
        sprintsProvider.clearSearch();
        userStoriesProvider.clearSearch();
    });

    context.subscriptions.push(
        loginCommand,
        refreshCommand,
        logoutCommand,
        openProjectCommand,
        openUserStoryCommand,
        openTaskCommand,
        openMilestoneCommand,
        openEpicCommand,
        searchCommand,
        clearSearchCommand,
        selectProjectCommand
    );
}

function deactivate() {
    console.log('Extension Taiga désactivée');
}

module.exports = {
    activate,
    deactivate
};

async function loadProjects(context, baseUrl, token, projectsProvider) {
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
            projectsProvider.refresh();

            vscode.window.showInformationMessage(
                `${projects.length} projet(s) chargé(s) avec succès !`
            );
        });
    } catch (err) {
        console.error('Erreur lors du chargement des projets:', err);
        vscode.window.showErrorMessage('Impossible de charger les projets');
    }
}
