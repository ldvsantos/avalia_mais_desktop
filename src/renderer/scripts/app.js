// ============================================================
// App.js — Controlador Principal da Aplicação
// ============================================================
const App = {
  currentUser: null,

  async init() {
    console.log('[App] init() started');
    try {
      // Verifica se já está autenticado
      const user = await avaliaAPI.auth.check();
      console.log('[App] auth.check result:', user);
      if (user) {
        this.currentUser = user;
        this.showMainLayout();
      }
    } catch (err) {
      console.error('[App] Error in auth.check:', err);
    }

    // Configura login
    document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('btn-logout').addEventListener('click', () => this.handleLogout());

    // Titlebar controls
    document.getElementById('tb-minimize').addEventListener('click', () => avaliaAPI.window.minimize());
    document.getElementById('tb-maximize').addEventListener('click', () => avaliaAPI.window.maximize());
    document.getElementById('tb-close').addEventListener('click', () => avaliaAPI.window.close());

    console.log('[App] Event listeners attached');

    // Navegação do menu principal via ipc
    avaliaAPI.onNavigate((page) => Router.navigate(page));
    avaliaAPI.onNotification((data) => Toast.show(data.type, data.message));
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');
    console.log('[App] Login attempt:', username);

    if (!username || !password) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.hidden = false;
      return;
    }

    try {
      const result = await avaliaAPI.auth.login(username, password);
      console.log('[App] Login result:', result);
      if (result.success) {
        this.currentUser = result.user;
        errorEl.hidden = true;
        this.showMainLayout();

        // Sincronização automática após login
        this.runAutoSync();
      } else {
        errorEl.textContent = result.error || 'Falha no login';
        errorEl.hidden = false;
      }
    } catch (err) {
      console.error('[App] Login error:', err);
      errorEl.textContent = 'Erro interno: ' + err.message;
      errorEl.hidden = false;
    }
  },

  async handleLogout() {
    await avaliaAPI.auth.logout();
    this.currentUser = null;
    this.showLoginScreen();
  },

  showMainLayout() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').hidden = true;
    const main = document.getElementById('main-layout');
    main.hidden = false;
    main.classList.add('active');

    // Atualiza info do usuário na sidebar
    if (this.currentUser) {
      document.getElementById('user-name').textContent = this.currentUser.displayName || this.currentUser.username;
      document.getElementById('user-role').textContent = this.currentUser.role === 'admin' ? 'Administrador' : 'Avaliador';
      document.getElementById('user-avatar').textContent = (this.currentUser.displayName || this.currentUser.username).charAt(0).toUpperCase();
    }

    Router.navigate('dashboard');
  },

  async runAutoSync() {
    try {
      console.log('[App] Iniciando sincronização automática...');
      Toast.show('info', 'Sincronizando com o servidor...', 5000);
      const result = await avaliaAPI.sync.autoLoginAndPull();
      if (result && result.success) {
        const r = result.results || {};
        const total = (r.submissions || 0) + (r.evaluations || 0) + (r.appeals || 0) +
          (r.events || 0) + (r.calendar || 0) + (r.faq || 0) + (r.files || 0) +
          (r.evaluators || 0) + (r.phaseStatus || 0);
        Toast.show('success', `Sincronizado — ${total} registros atualizados`, 4000);
        console.log('[App] Sync completo:', result.results);
        // Atualiza a página atual para refletir os dados novos
        if (Router && Router.currentPage) Router.navigate(Router.currentPage);
      } else {
        const errMsg = result?.error || 'sem conexão';
        console.warn('[App] Sync falhou:', errMsg);
        // Mensagem amigável para o usuário
        if (errMsg.includes('ENOTFOUND') || errMsg.includes('DNS')) {
          Toast.show('warning', 'Sem internet — trabalhando offline', 5000);
        } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('indisponível')) {
          Toast.show('warning', 'Servidor indisponível — trabalhando offline', 5000);
        } else if (errMsg.includes('Timeout') || errMsg.includes('ETIMEDOUT')) {
          Toast.show('warning', 'Servidor lento — trabalhando offline', 5000);
        } else {
          Toast.show('warning', 'Sincronização falhou: ' + errMsg, 5000);
        }
      }
    } catch (err) {
      console.error('[App] Sync error:', err);
      Toast.show('warning', 'Sem conexão com o servidor — trabalhando offline', 5000);
    }
  },

  showLoginScreen() {
    document.getElementById('main-layout').classList.remove('active');
    document.getElementById('main-layout').hidden = true;
    const login = document.getElementById('login-screen');
    login.hidden = false;
    login.classList.add('active');
    document.getElementById('login-pass').value = '';
  }
};

// Toast notifications
const Toast = {
  show(type, message, duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `<span style="font-size:16px; font-weight:bold;">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '300ms ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

// Modal
const Modal = {
  show(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').hidden = false;
  },
  hide() {
    document.getElementById('modal-overlay').hidden = true;
    document.getElementById('modal-content').innerHTML = '';
  }
};

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) Modal.hide();
});

// Utilitários
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('pt-BR');
  } catch { return dateStr; }
}

function statusBadge(status) {
  const map = {
    'Recebida': 'info', 'Deferida': 'success', 'Indeferida': 'danger',
    'aprovado': 'success', 'reprovado_preliminar': 'warning', 'reprovado_definitivo': 'danger',
    'Recebido': 'info', 'Deferido': 'success', 'Indeferido': 'danger',
    'pendente': 'neutral', 'concluida': 'success'
  };
  return `<span class="badge badge-${map[status] || 'neutral'}">${escapeHtml(status)}</span>`;
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => App.init());
