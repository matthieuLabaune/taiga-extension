import { taigaApi } from './services/taigaApi.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const projectsView = document.getElementById('projectsView');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const projectsList = document.getElementById('projectsList');

    // Vérifier si l'utilisateur est déjà connecté
    await checkAuthStatus();

    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', loadProjects);

    async function checkAuthStatus() {
        try {
            const result = await chrome.storage.local.get(['taiga_auth_token']);
            if (result.taiga_auth_token) {
                showProjectsView();
                await loadProjects();
            } else {
                showLoginForm();
            }
        } catch (error) {
            showLoginForm();
        }
    }

    async function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showError('Veuillez remplir tous les champs');
            return;
        }

        loginBtn.textContent = 'Connexion...';
        loginBtn.disabled = true;
        hideError();

        try {
            await taigaApi.login(username, password);
            showProjectsView();
            await loadProjects();
        } catch (error) {
            showError('Erreur de connexion. Vérifiez vos identifiants.');
        } finally {
            loginBtn.textContent = 'Se connecter';
            loginBtn.disabled = false;
        }
    }

    async function handleLogout() {
        await taigaApi.logout();
        showLoginForm();
        clearProjectsList();
    }

    async function loadProjects() {
        refreshBtn.textContent = 'Chargement...';
        refreshBtn.disabled = true;

        try {
            const projects = await taigaApi.getProjects();
            displayProjects(projects);
        } catch (error) {
            console.error('Error loading projects:', error);
            projectsList.innerHTML = '<p class="error">Erreur lors du chargement des projets</p>';
        } finally {
            refreshBtn.textContent = 'Actualiser';
            refreshBtn.disabled = false;
        }
    }

    function displayProjects(projects) {
        if (projects.length === 0) {
            projectsList.innerHTML = '<p>Aucun projet trouvé</p>';
            return;
        }

        projectsList.innerHTML = projects.map(project => `
      <div class="project-item">
        <strong>${project.name}</strong>
        <p style="font-size: 12px; color: #666; margin: 4px 0;">
          ${project.description || 'Pas de description'}
        </p>
        <button onclick="openProject('${project.slug}')" style="width: auto; padding: 4px 8px; font-size: 12px;">
          Ouvrir
        </button>
      </div>
    `).join('');
    }

    function showLoginForm() {
        loginForm.classList.remove('hidden');
        projectsView.classList.add('hidden');
        usernameInput.value = '';
        passwordInput.value = '';
    }

    function showProjectsView() {
        loginForm.classList.add('hidden');
        projectsView.classList.remove('hidden');
    }

    function showError(message) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
    }

    function hideError() {
        loginError.classList.add('hidden');
    }

    function clearProjectsList() {
        projectsList.innerHTML = '';
    }

    // Fonction globale pour ouvrir un projet
    window.openProject = function (slug) {
        const url = `https://taiga.handisport.org/project/${slug}`;
        chrome.tabs.create({ url });
    };
});
