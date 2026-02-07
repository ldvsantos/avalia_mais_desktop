// ============================================================
// Appeals — Recursos (completo com criação)
// ============================================================
Router.register('appeals', async (container) => {
  const appeals = await avaliaAPI.appeals.list({});

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Recursos</h1>
        <p class="page-subtitle">${appeals.length} recurso(s)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-new-appeal">+ Novo Recurso</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="all">Todos (${appeals.length})</button>
      <button class="tab-btn" data-tab="Recebido">Recebidos (${appeals.filter(a => a.status === 'Recebido').length})</button>
      <button class="tab-btn" data-tab="Deferido">Deferidos (${appeals.filter(a => a.status === 'Deferido').length})</button>
      <button class="tab-btn" data-tab="Indeferido">Indeferidos (${appeals.filter(a => a.status === 'Indeferido').length})</button>
    </div>

    <div id="appeals-table">
      ${renderAppealsTable(appeals)}
    </div>
  `;

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const filtered = tab === 'all' ? appeals : appeals.filter(a => a.status === tab);
      document.getElementById('appeals-table').innerHTML = renderAppealsTable(filtered);
    });
  });

  document.getElementById('btn-new-appeal').addEventListener('click', () => showNewAppealForm());
});

function renderAppealsTable(appeals) {
  return Components.table([
    { label: 'Protocolo', key: 'protocol', render: (r) => `<strong>${escapeHtml(r.protocol)}</strong>` },
    { label: 'Inscrição', key: 'submission_protocol' },
    { label: 'Candidato', render: (r) => escapeHtml(r.candidato_nome || r.nome || '-') },
    { label: 'Etapa', key: 'etapa' },
    { label: 'Status', render: (r) => statusBadge(r.status) },
    { label: 'Data', render: (r) => formatDate(r.created_at) },
    { label: 'Ações', render: (r) => `
      <div class="table-actions">
        <button class="btn btn-sm btn-ghost appeal-view" data-protocol="${r.protocol}">Ver</button>
        ${r.status === 'Recebido' ? `
          <button class="btn btn-sm btn-success appeal-defer" data-protocol="${r.protocol}">Deferir</button>
          <button class="btn btn-sm btn-danger appeal-indefer" data-protocol="${r.protocol}">Indeferir</button>
        ` : ''}
      </div>
    `}
  ], appeals, { emptyTitle: 'Nenhum recurso', emptyText: 'Recursos interpostos aparecerão aqui.' });
}

// Delegação de eventos para botões de recurso
document.addEventListener('click', (e) => {
  const viewBtn = e.target.closest('.appeal-view');
  if (viewBtn) {
    showAppealDetail(viewBtn.dataset.protocol);
  }
  const deferBtn = e.target.closest('.appeal-defer');
  if (deferBtn) {
    showAppealDecision(deferBtn.dataset.protocol, 'Deferido');
  }
  const indeferBtn = e.target.closest('.appeal-indefer');
  if (indeferBtn) {
    showAppealDecision(indeferBtn.dataset.protocol, 'Indeferido');
  }
});

async function showNewAppealForm() {
  // Busca etapas de recurso abertas do calendário
  let phases = [];
  try { phases = await avaliaAPI.calendar.openAppealPhases(); } catch (_) {}
  const phaseOptions = phases.length > 0
    ? phases.map(p => `<option value="${escapeHtml(p.phase_name)}">${escapeHtml(p.phase_name)}</option>`).join('')
    : `<option value="inscricao">Inscrição</option>
       <option value="avaliacao_projeto">Avaliação de Projeto</option>
       <option value="avaliacao_entrevista">Avaliação de Entrevista</option>
       <option value="avaliacao_lingua">Avaliação de Língua</option>
       <option value="resultado_preliminar">Resultado Preliminar</option>
       <option value="resultado_final">Resultado Final</option>`;

  Modal.show(`
    <div class="modal-header">
      <h3 class="modal-title">Novo Recurso</h3>
      <button class="modal-close" onclick="Modal.hide()">✕</button>
    </div>
    <form id="new-appeal-form">
      <div class="form-row">
        <div class="form-group"><label>Protocolo da Inscrição *</label><input class="form-control" name="submission_protocol" placeholder="P-2025-XXXXX" required></div>
        <div class="form-group"><label>Etapa *</label><select class="form-control" name="etapa" required>${phaseOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nome do Candidato *</label><input class="form-control" name="nome" required></div>
        <div class="form-group"><label>CPF *</label><input class="form-control" name="cpf" required placeholder="000.000.000-00"></div>
      </div>
      <div class="form-group"><label>E-mail</label><input type="email" class="form-control" name="email"></div>
      <div class="form-group"><label>Decisão Contestada *</label><input class="form-control" name="decisao_contestacao" required placeholder="Descreva qual decisão está sendo contestada"></div>
      <div class="form-group"><label>Argumentação *</label><textarea class="form-control" name="argumentacao" rows="5" required placeholder="Apresente os argumentos do recurso..."></textarea></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar Recurso</button>
      </div>
    </form>
  `);

  document.getElementById('new-appeal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    if (!data.submission_protocol || !data.etapa || !data.nome || !data.cpf || !data.argumentacao) {
      Toast.show('warning', 'Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const result = await avaliaAPI.appeals.create(data);
      if (result.success || result.protocol) {
        Modal.hide();
        Toast.show('success', `Recurso registrado — protocolo ${result.protocol || 'gerado'}`);
        Router.navigate('appeals');
      } else {
        Toast.show('error', result.error || 'Erro ao criar recurso');
      }
    } catch (err) {
      Toast.show('error', 'Erro: ' + err.message);
    }
  });
}

async function showAppealDetail(protocol) {
  const appeals = await avaliaAPI.appeals.list({});
  const appeal = appeals.find(a => a.protocol === protocol);
  if (!appeal) return;

  Modal.show(`
    <div class="modal-header">
      <h3 class="modal-title">Recurso ${escapeHtml(appeal.protocol)}</h3>
      <button class="modal-close" onclick="Modal.hide()">✕</button>
    </div>
    <div class="submission-detail">
      <div><div class="detail-label">Inscrição</div><div class="detail-value">${escapeHtml(appeal.submission_protocol)}</div></div>
      <div><div class="detail-label">Candidato</div><div class="detail-value">${escapeHtml(appeal.candidato_nome || appeal.nome || '-')}</div></div>
      <div><div class="detail-label">CPF</div><div class="detail-value">${escapeHtml(appeal.cpf || '-')}</div></div>
      <div><div class="detail-label">E-mail</div><div class="detail-value">${escapeHtml(appeal.email || '-')}</div></div>
      <div><div class="detail-label">Etapa</div><div class="detail-value">${escapeHtml(appeal.etapa)}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(appeal.status)}</div></div>
      <div class="full"><div class="detail-label">Decisão Contestada</div><div class="detail-value">${escapeHtml(appeal.decisao_contestacao || '-')}</div></div>
      <div class="full"><div class="detail-label">Argumentação</div><div class="detail-value" style="white-space:pre-wrap;">${escapeHtml(appeal.argumentacao)}</div></div>
      ${appeal.motivo_decisao ? `<div class="full"><div class="detail-label">Motivo da Decisão</div><div class="detail-value" style="white-space:pre-wrap;">${escapeHtml(appeal.motivo_decisao)}</div></div>` : ''}
    </div>
  `);
}

function showAppealDecision(protocol, decision) {
  Modal.show(`
    <div class="modal-header">
      <h3 class="modal-title">${decision === 'Deferido' ? 'Deferir' : 'Indeferir'} Recurso</h3>
      <button class="modal-close" onclick="Modal.hide()">✕</button>
    </div>
    <div class="form-group">
      <label>Motivo da Decisão *</label>
      <textarea class="form-control" id="appeal-motivo" rows="4" placeholder="Descreva o motivo da decisão..." required></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
      <button class="btn ${decision === 'Deferido' ? 'btn-success' : 'btn-danger'}" id="btn-appeal-confirm">${decision === 'Deferido' ? 'Deferir' : 'Indeferir'}</button>
    </div>
  `);

  document.getElementById('btn-appeal-confirm').addEventListener('click', async () => {
    const motivo = document.getElementById('appeal-motivo').value.trim();
    if (!motivo) { Toast.show('warning', 'Informe o motivo da decisão'); return; }
    await avaliaAPI.appeals.updateStatus(protocol, decision, motivo);
    Modal.hide();
    Toast.show('success', `Recurso ${decision.toLowerCase()} com sucesso!`);
    Router.navigate('appeals');
  });
}
