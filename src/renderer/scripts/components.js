// ============================================================
// Componentes JS reutilizáveis
// ============================================================
const Components = {

  /** Gera HTML de tabela com dados */
  table(headers, rows, options = {}) {
    if (rows.length === 0) {
      return `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6"/></svg>
          <h3>${options.emptyTitle || 'Nenhum registro encontrado'}</h3>
          <p>${options.emptyText || 'Os dados aparecerão aqui quando estiverem disponíveis.'}</p>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table>
          <thead><tr>${headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>${headers.map(h => `<td>${h.render ? h.render(row) : escapeHtml(String(row[h.key] || ''))}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /** Barra de busca + filtros */
  toolbar({ searchPlaceholder, filters, actions }) {
    return `
      <div class="toolbar">
        ${searchPlaceholder ? `
          <div class="search-box">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="toolbar-search" placeholder="${searchPlaceholder}">
          </div>
        ` : ''}
        ${(filters || []).map(f => `
          <select class="form-control toolbar-filter" data-filter="${f.key}" style="width:auto; min-width:140px;">
            <option value="">${f.label}</option>
            ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        `).join('')}
        ${(actions || []).map((a, i) => `
          <button class="btn ${a.class || 'btn-secondary'}" data-toolbar-action="${i}">${a.label}</button>
        `).join('')}
      </div>
    `;
  },

  /** Ativa os onclick de toolbar actions após inserir no DOM */
  bindToolbarActions(container, actions) {
    if (!actions) return;
    actions.forEach((a, i) => {
      const btn = container.querySelector(`[data-toolbar-action="${i}"]`);
      if (btn && a.onclick) {
        btn.addEventListener('click', typeof a.onclick === 'function' ? a.onclick : () => eval(a.onclick));
      }
    });
  },

  /** Confirmar ação */
  confirm(title, message, onConfirm) {
    Modal.show(`
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="Modal.hide()">✕</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 14px;">${message}</p>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
        <button class="btn btn-danger" id="confirm-action-btn">Confirmar</button>
      </div>
    `);
    document.getElementById('confirm-action-btn').addEventListener('click', () => {
      Modal.hide();
      onConfirm();
    });
  }
};
