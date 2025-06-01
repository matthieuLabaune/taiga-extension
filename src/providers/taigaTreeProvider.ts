import * as vscode from 'vscode';
import { TaigaApiService, TaigaProject, TaigaUserStory } from '../services/taigaApi';

export class TaigaTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'project' | 'userstory',
        public readonly data?: any
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
        this.contextValue = itemType;
    }
}

export class TaigaTreeProvider implements vscode.TreeDataProvider<TaigaTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaigaTreeItem | undefined | null | void> = new vscode.EventEmitter<TaigaTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaigaTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projects: TaigaProject[] = [];

    constructor(private taigaApi: TaigaApiService) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaigaTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaigaTreeItem): Promise<TaigaTreeItem[]> {
        if (!element) {
            // Root level - show projects
            try {
                this.projects = await this.taigaApi.getProjects();
                return this.projects.map(project => new TaigaTreeItem(
                    project.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'project',
                    project
                ));
            } catch (error) {
                vscode.window.showErrorMessage('Impossible de charger les projets. Vérifiez votre connexion.');
                return [];
            }
        } else if (element.itemType === 'project') {
            // Project level - show user stories
            try {
                const userStories = await this.taigaApi.getUserStories(element.data.id);
                return userStories.map(story => new TaigaTreeItem(
                    `${story.subject} (${story.status_extra_info.name})`,
                    vscode.TreeItemCollapsibleState.None,
                    'userstory',
                    story
                ));
            } catch (error) {
                vscode.window.showErrorMessage(`Impossible de charger les user stories pour ${element.label}`);
                return [];
            }
        }

        return [];
    }

    async connectToTaiga(): Promise<void> {
        try {
            await this.taigaApi.login();
            vscode.window.showInformationMessage('Connecté à Taiga avec succès!');
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage('Erreur de connexion à Taiga');
        }
    }
}
