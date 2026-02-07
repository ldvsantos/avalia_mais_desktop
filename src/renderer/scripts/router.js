// ============================================================
// Router — Navegação SPA entre páginas
// ============================================================
const Router = {
  currentPage: null,
  pages: {},

  register(name, renderFn) {
    this.pages[name] = renderFn;
  },

  async navigate(page, params = {}) {
    if (!this.pages[page]) {
      console.warn('Página não encontrada:', page);
      return;
    }

    this.currentPage = page;

    // Atualiza sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Renderiza página
    const content = document.getElementById('content');
    content.scrollTop = 0;

    try {
      await this.pages[page](content, params);
    } catch (err) {
      console.error('Erro ao renderizar página:', err);
      content.innerHTML = `
        <div class="empty-state">
          <h3>Erro ao carregar página</h3>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }
};

// Vincula clicks na sidebar
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => Router.navigate(btn.dataset.page));
  });
});
