// ============================================================
// Evaluations — Avaliações
// ============================================================
Router.register('evaluations', async (container, params) => {
  if (params.protocol) {
    return renderEvaluationForm(container, params.protocol);
  }

  const evals = await avaliaAPI.evaluations.list({});

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Avaliações</h1>
        <p class="page-subtitle">${evals.length} avaliação(ões)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btn-results">Resultados Consolidados</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="all">Todas</button>
      <button class="tab-btn" data-tab="pending">Pendentes</button>
      <button class="tab-btn" data-tab="completed">Concluídas</button>
    </div>

    <div id="evals-table">
      ${renderEvalsTable(evals)}
    </div>
  `;

  // Tabs
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      let filtered = evals;
      if (tab === 'pending') filtered = evals.filter(e => e.status !== 'concluida');
      if (tab === 'completed') filtered = evals.filter(e => e.status === 'concluida');
      document.getElementById('evals-table').innerHTML = renderEvalsTable(filtered);
    });
  });

  // Resultados
  document.getElementById('btn-results').addEventListener('click', () => renderResultsPage(container));
});

function renderEvalsTable(evals) {
  return Components.table([
    { label: 'Protocolo', key: 'submission_protocol', render: (r) => `<strong>${escapeHtml(r.submission_protocol)}</strong>` },
    { label: 'Candidato', render: (r) => escapeHtml(r.candidato_nome || '-') },
    { label: 'Fase', key: 'phase', render: (r) => escapeHtml(r.phase || '-') },
    { label: 'Avaliador', render: (r) => `${escapeHtml(r.evaluator_line || '')} #${r.evaluator_num || ''}` },
    { label: 'Média Proj.', render: (r) => r.proj_media != null ? r.proj_media.toFixed(2) : '-' },
    { label: 'Média Entr.', render: (r) => r.int_media != null ? r.int_media.toFixed(2) : '-' },
    { label: 'Média Líng.', render: (r) => r.lang_media != null ? r.lang_media.toFixed(2) : '-' },
    { label: 'Status', render: (r) => statusBadge(r.status) },
    { label: 'Data', render: (r) => formatDate(r.created_at) }
  ], evals, { emptyTitle: 'Nenhuma avaliação', emptyText: 'Avaliações serão exibidas aqui.' });
}

async function renderResultsPage(container) {
  const results = await avaliaAPI.evaluations.results({});
  results.sort((a, b) => (b.nota_final || 0) - (a.nota_final || 0));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('evaluations')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">Resultados Consolidados</h1>
        <p class="page-subtitle">${results.length} candidato(s)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-export-results">Exportar CSV</button>
      </div>
    </div>
    ${Components.table([
      { label: '#', render: (_, i) => String(i + 1) },
      { label: 'Nome', key: 'nome' },
      { label: 'Linha', render: (r) => escapeHtml(r.linha_pesquisa || '-') },
      { label: 'Projeto', render: (r) => r.media_projeto != null ? String(r.media_projeto) : '-' },
      { label: 'Entrevista', render: (r) => r.media_entrevista != null ? String(r.media_entrevista) : '-' },
      { label: 'Língua', render: (r) => r.media_lingua != null ? String(r.media_lingua) : '-' },
      { label: 'Nota Final', render: (r) => `<strong style="color:${r.nota_final >= 7 ? 'var(--success)' : 'var(--danger)'}">${r.nota_final || 0}</strong>` },
      { label: 'Cota', render: (r) => r.tem_cota ? '<span class="badge badge-warning">Sim</span>' : '-' }
    ], results.map((r, i) => ({ ...r, _index: i })), { emptyTitle: 'Sem resultados' })}
  `;

  document.getElementById('btn-export-results').addEventListener('click', async () => {
    const result = await avaliaAPI.reports.exportResultsCSV();
    if (result.success) Toast.show('success', 'CSV exportado!');
  });
}

async function renderEvaluationForm(container, protocol) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('evaluations')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">Avaliação — ${escapeHtml(protocol)}</h1>
      </div>
    </div>

    <form id="eval-form">
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Avaliação do Projeto</div></div>
        <div class="grade-grid">
          ${['Introdução','Problema','Justificativa','Objetivos','Revisão','Métodos','Cronograma','Referências'].map((label, i) => {
            const keys = ['projIntroducao','projProblema','projJustificativa','projObjetivos','projRevisao','projMetodos','projCronograma','projReferencias'];
            return `<div class="grade-item"><label>${label}</label><input type="number" name="${keys[i]}" min="0" max="10" step="0.1"></div>`;
          }).join('')}
        </div>
        <div class="form-group"><label>Parecer do Projeto</label><textarea class="form-control" name="projParecer" rows="3"></textarea></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Avaliação da Entrevista</div></div>
        <div class="grade-grid">
          ${['Apresentação','Histórico','Defesa','Justificativa'].map((label, i) => {
            const keys = ['intApresentacao','intHistorico','intDefesa','intJustificativa'];
            return `<div class="grade-item"><label>${label}</label><input type="number" name="${keys[i]}" min="0" max="10" step="0.1"></div>`;
          }).join('')}
        </div>
        <div class="form-group"><label>Parecer da Entrevista</label><textarea class="form-control" name="intParecer" rows="3"></textarea></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Avaliação de Língua Estrangeira</div></div>
        <div class="grade-grid">
          ${['Clareza (30%)','Domínio (40%)','Análise (30%)'].map((label, i) => {
            const keys = ['langClareza','langDominio','langAnalise'];
            return `<div class="grade-item"><label>${label}</label><input type="number" name="${keys[i]}" min="0" max="10" step="0.1"></div>`;
          }).join('')}
        </div>
        <div class="form-group"><label>Parecer de Língua</label><textarea class="form-control" name="langParecer" rows="3"></textarea></div>
      </div>

      <input type="hidden" name="submissionProtocol" value="${protocol}">
      <input type="hidden" name="phase" value="completa">

      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button type="button" class="btn btn-ghost" onclick="Router.navigate('evaluations')">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-lg">Salvar Avaliação</button>
      </div>
    </form>
  `;

  document.getElementById('eval-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const [key, val] of fd.entries()) {
      data[key] = val === '' ? null : (isNaN(val) ? val : parseFloat(val));
    }
    data.evaluatorId = App.currentUser?.id;
    data.evaluatorLine = App.currentUser?.line || '';
    data.evaluatorNum = App.currentUser?.evaluatorNum || 1;

    const result = await avaliaAPI.evaluations.submit(data);
    if (result.success) {
      Toast.show('success', 'Avaliação salva com sucesso!');
      Router.navigate('evaluations');
    } else {
      Toast.show('error', 'Erro ao salvar avaliação');
    }
  });
}
