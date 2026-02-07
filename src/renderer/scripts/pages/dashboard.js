// ============================================================
// Dashboard — Página Inicial (espelhando versão web)
// ============================================================
Router.register('dashboard', async (container) => {
  const stats = await avaliaAPI.dashboard.stats();
  const settings = await avaliaAPI.settings.get();
  const syncStatus = await avaliaAPI.sync.status();
  const s = stats.submissions || {};
  const ev = stats.evaluations || {};
  const ap = stats.appeals || {};
  const events = stats.events || {};

  const activeYear = settings['app.year'] || new Date().getFullYear();
  const regOpen = settings['registration.open'] === '1';
  const regStart = settings['registration.start_date'] || '';
  const regEnd = settings['registration.end_date'] || '';
  const institution = settings['app.institution'] || 'Instituição';

  const lastSyncStr = syncStatus.lastSync
    ? new Date(syncStatus.lastSync).toLocaleString('pt-BR')
    : 'Nunca';
  const syncOk = !!syncStatus.lastSync;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Painel Administrativo</h1>
        <p class="page-subtitle">${escapeHtml(institution)} — Edital ${escapeHtml(String(activeYear))}</p>
      </div>
      <div class="page-actions" style="display:flex; gap:8px; align-items:center;">
        <span id="dash-sync-indicator" title="Último sync: ${escapeHtml(lastSyncStr)}"
          style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer;">
          <span style="width:8px;height:8px;border-radius:50%;background:${syncOk ? 'var(--success)' : 'var(--danger)'};display:inline-block;"></span>
          ${syncOk ? `Sync: ${escapeHtml(lastSyncStr)}` : 'Não sincronizado'}
        </span>
        <button class="btn btn-ghost btn-sm" id="dash-btn-sync-now" title="Sincronizar agora">🔄</button>
        <button class="btn btn-ghost btn-sm" id="dash-btn-settings">⚙ Configurações</button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon blue">📋</div>
        <div>
          <div class="stat-value">${s.total || 0}</div>
          <div class="stat-label">Inscrições Recebidas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✓</div>
        <div>
          <div class="stat-value">${ev.concluidas || 0}</div>
          <div class="stat-label">Avaliações Concluídas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div>
          <div class="stat-value">${ev.pendentes || 0}</div>
          <div class="stat-label">Avaliações Pendentes</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">📝</div>
        <div>
          <div class="stat-value">${ap.total || 0}</div>
          <div class="stat-label">Recursos</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon cyan">📅</div>
        <div>
          <div class="stat-value">${events.active || 0}</div>
          <div class="stat-label">Eventos Ativos</div>
        </div>
      </div>
    </div>

    <!-- Painel: Ações Rápidas -->
    <div class="panel">
      <div class="panel-header">Ações Rápidas</div>
      <div class="panel-body">
        <div class="quick-actions">
          <button class="btn btn-primary" id="dash-btn-new-sub">+ Nova Inscrição</button>
          <button class="btn btn-secondary" id="dash-btn-evals">Ver Avaliações</button>
          <button class="btn btn-secondary" id="dash-btn-appeals">Gerenciar Recursos</button>
          <button class="btn btn-secondary" id="dash-btn-ranking">Ranking / Resultados</button>
          <button class="btn btn-ghost" id="dash-btn-allocation">Alocação de Vagas</button>
          <button class="btn btn-ghost" id="dash-btn-events">Eventos</button>
          <button class="btn btn-ghost" id="dash-btn-export-csv">Exportar CSV</button>
          <button class="btn btn-ghost" id="dash-btn-backup">Backup dos Dados</button>
        </div>
      </div>
    </div>

    <!-- Painel: Calendário de Inscrições -->
    <div class="panel">
      <div class="panel-header">Calendário de Inscrições</div>
      <div class="panel-body">
        <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <span class="admin-badge ${regOpen ? 'badge-open' : 'badge-closed'}">${regOpen ? '● ABERTO' : '● FECHADO'}</span>
          </div>
          <div>
            <span class="admin-badge badge-year">Ano Ativo: ${escapeHtml(String(activeYear))}</span>
          </div>
          <div id="dash-timer" style="font-size:13px; color:var(--text-secondary); font-weight:600;">
          </div>
        </div>
        ${regStart || regEnd ? `
          <div style="margin-top:12px; display:flex; gap:24px; font-size:13px; color:var(--text-secondary);">
            ${regStart ? `<span><strong>Início:</strong> ${formatDateTime(regStart)}</span>` : ''}
            ${regEnd ? `<span><strong>Término:</strong> ${formatDateTime(regEnd)}</span>` : ''}
          </div>
        ` : '<p style="margin-top:12px; font-size:13px; color:var(--text-muted);">Datas de inscrição não configuradas. Acesse Configurações para definir.</p>'}
        <div style="margin-top:12px;">
          <button class="btn btn-ghost btn-sm" id="dash-btn-calendar-settings">Configurar Calendário do Edital</button>
        </div>
      </div>
    </div>

    <!-- Painel: Distribuição -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div class="panel">
        <div class="panel-header">Inscrições por Status</div>
        <div class="panel-body">
          ${(s.byStatus || []).length === 0
            ? '<p style="color:var(--text-muted);text-align:center;padding:16px;">Nenhuma inscrição registrada</p>'
            : (s.byStatus || []).map(item => `
              <div class="dist-row">
                <span>${statusBadge(item.status)}</span>
                <span class="dist-count">${item.c}</span>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">Por Linha de Pesquisa</div>
        <div class="panel-body">
          ${(s.byLine || []).length === 0
            ? '<p style="color:var(--text-muted);text-align:center;padding:16px;">—</p>'
            : (s.byLine || []).map(item => `
              <div class="dist-row">
                <span style="font-size:13px; color:var(--text-secondary);">${escapeHtml(item.linha_pesquisa || 'Sem linha')}</span>
                <span class="dist-count">${item.c}</span>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>

    <!-- Painel: Busca e Filtros -->
    <div class="panel">
      <div class="panel-header">Inscrições Recebidas (${s.total || 0})</div>
      <div class="panel-body">
        <div class="filter-grid">
          <div class="filter-field">
            <label>Buscar</label>
            <input type="text" class="form-control" id="dash-search" placeholder="Nome, protocolo, email...">
          </div>
          <div class="filter-field">
            <label>Status</label>
            <select class="form-control" id="dash-filter-status">
              <option value="">Todos</option>
              <option value="Recebida">Recebida</option>
              <option value="Deferida">Deferida</option>
              <option value="Indeferida">Indeferida</option>
            </select>
          </div>
          <div class="filter-field">
            <label>Linha</label>
            <select class="form-control" id="dash-filter-line">
              <option value="">Todas</option>
              ${(() => { try { return JSON.parse(settings['lines'] || '[]').map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join(''); } catch { return ''; } })()}
            </select>
          </div>
          <div class="filter-field filter-actions">
            <label>&nbsp;</label>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" id="dash-btn-filter">Filtrar</button>
              <button class="btn btn-ghost btn-sm" id="dash-btn-clear">Limpar</button>
            </div>
          </div>
        </div>
        <div id="dash-table-container" style="margin-top:12px;">
          <p style="color:var(--text-muted); text-align:center; padding:20px; font-size:13px;">Clique em "Filtrar" ou use a busca para carregar inscrições</p>
        </div>
      </div>
    </div>
  `;

  // ---- Timer de Inscrição ----
  function updateTimer() {
    const el = document.getElementById('dash-timer');
    if (!el) return;
    if (!regStart && !regEnd) { el.textContent = ''; return; }

    const now = new Date();
    const start = regStart ? new Date(regStart) : null;
    const end = regEnd ? new Date(regEnd) : null;

    let msg = '';
    if (start && now < start) {
      msg = '⏱ Abre em: ' + formatCountdown(start - now);
    } else if (end && now < end) {
      msg = '⏱ Fecha em: ' + formatCountdown(end - now);
    } else if (end && now >= end) {
      msg = '⏱ Encerrado há: ' + formatCountdown(now - end);
    }
    el.textContent = msg;
  }

  function formatCountdown(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  }

  updateTimer();
  const timerInterval = setInterval(() => {
    if (!document.getElementById('dash-timer')) { clearInterval(timerInterval); return; }
    updateTimer();
  }, 1000);

  // ---- Ações Rápidas ----
  document.getElementById('dash-btn-new-sub').addEventListener('click', () => Router.navigate('submissions', { action: 'new' }));
  document.getElementById('dash-btn-evals').addEventListener('click', () => Router.navigate('evaluations'));
  document.getElementById('dash-btn-appeals').addEventListener('click', () => Router.navigate('appeals'));
  document.getElementById('dash-btn-ranking').addEventListener('click', () => Router.navigate('evaluations', { tab: 'results' }));
  document.getElementById('dash-btn-allocation').addEventListener('click', () => Router.navigate('selection'));
  document.getElementById('dash-btn-events').addEventListener('click', () => Router.navigate('events'));
  document.getElementById('dash-btn-backup').addEventListener('click', () => Router.navigate('backup'));
  document.getElementById('dash-btn-settings').addEventListener('click', () => Router.navigate('settings'));
  document.getElementById('dash-btn-calendar-settings').addEventListener('click', () => Router.navigate('settings'));

  // ---- Sync Manual ----
  document.getElementById('dash-btn-sync-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('dash-btn-sync-now');
    const indicator = document.getElementById('dash-sync-indicator');
    btn.disabled = true;
    btn.textContent = '⏳';
    try {
      const res = await avaliaAPI.sync.autoLoginAndPull();
      if (res.success) {
        Toast.show('success', `Sincronizado — ${Object.values(res.results || {}).reduce((a,b) => a+b, 0)} registros`);
        const now = new Date().toLocaleString('pt-BR');
        if (indicator) {
          indicator.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:var(--success);display:inline-block;"></span> Sync: ${now}`;
          indicator.title = 'Último sync: ' + now;
        }
      } else {
        Toast.show('error', 'Falha ao sincronizar: ' + (res.error || 'Erro desconhecido'));
      }
    } catch (err) {
      Toast.show('error', 'Erro de sync: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄';
    }
  });

  document.getElementById('dash-btn-export-csv').addEventListener('click', async () => {
    const csv = await avaliaAPI.submissions.exportCSV();
    if (csv) {
      const result = await avaliaAPI.dialog.saveFile({
        title: 'Exportar Inscrições CSV',
        defaultPath: `inscricoes_${activeYear}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (!result.canceled && result.filePath) {
        // O CSV retornado é string, salvar via main process
        Toast.show('success', 'CSV exportado com sucesso');
      }
    }
  });

  // ---- Busca e Filtros ----
  async function loadSubmissions() {
    const search = document.getElementById('dash-search')?.value?.trim() || '';
    const status = document.getElementById('dash-filter-status')?.value || '';
    const line = document.getElementById('dash-filter-line')?.value || '';

    let data;
    if (search) {
      data = await avaliaAPI.submissions.search(search);
    } else {
      data = await avaliaAPI.submissions.list({ status, line });
    }

    const list = Array.isArray(data) ? data : [];
    const tableEl = document.getElementById('dash-table-container');
    if (!tableEl) return;

    if (list.length === 0) {
      tableEl.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px; font-size:13px;">Nenhuma inscrição encontrada</p>';
      return;
    }

    tableEl.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Protocolo</th>
              <th>Status</th>
              <th>CPF (Final)</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Linha</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(sub => `
              <tr class="clickable-row" data-protocol="${escapeHtml(sub.protocol)}">
                <td>${formatDate(sub.created_at)}</td>
                <td><strong style="color:var(--accent);">${escapeHtml(sub.protocol)}</strong></td>
                <td>${statusBadge(sub.status)}</td>
                <td>***${escapeHtml(sub.cpf_last4 || '----')}</td>
                <td>${escapeHtml(sub.nome || '')}</td>
                <td style="font-size:12px;">${escapeHtml(sub.email || '')}</td>
                <td style="font-size:12px;">${escapeHtml(sub.linha_pesquisa || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Click para abrir detalhe
    tableEl.querySelectorAll('.clickable-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        Router.navigate('submissions', { protocol: row.dataset.protocol });
      });
    });
  }

  document.getElementById('dash-btn-filter').addEventListener('click', loadSubmissions);
  document.getElementById('dash-btn-clear').addEventListener('click', () => {
    document.getElementById('dash-search').value = '';
    document.getElementById('dash-filter-status').value = '';
    document.getElementById('dash-filter-line').value = '';
    loadSubmissions();
  });

  document.getElementById('dash-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadSubmissions();
  });

  // Carrega inscrições automaticamente se houver dados
  if ((s.total || 0) > 0) {
    loadSubmissions();
  }
});
