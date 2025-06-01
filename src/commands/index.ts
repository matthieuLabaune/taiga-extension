import { commands, window } from 'vscode';

export function registerCommands() {
    commands.registerCommand('taiga.createTask', async () => {
        const taskName = await window.showInputBox({ prompt: 'Enter task name' });
        if (taskName) {
            // Call Taiga.sh API to create a task
            window.showInformationMessage(`Task "${taskName}" created!`);
        }
    });

    commands.registerCommand('taiga.getTasks', async () => {
        // Call Taiga.sh API to get tasks
        window.showInformationMessage('Fetching tasks...');
    });

    // Add more commands as needed
}