// ============================================================
// Submissions — Gestão de Inscrições
// ============================================================
Router.register('submissions', async (container, params) => {
  if (params.action === 'new') {
    return renderSubmissionForm(container);
  }
  if (params.protocol) {
    return renderSubmissionDetail(container, params.protocol);
  }

  const submissions = await avaliaAPI.submissions.list({});

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Inscrições</h1>
        <p class="page-subtitle">${submissions.length} inscrição(ões) registrada(s)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-export-csv">Exportar CSV</button>
        <button class="btn btn-primary" id="btn-new-sub">+ Nova Inscrição</button>
      </div>
    </div>
    ${Components.toolbar({
      searchPlaceholder: 'Buscar por nome, protocolo ou e-mail...',
      filters: [
        { key: 'status', label: 'Todos os Status', options: [
          { value: 'Recebida', label: 'Recebida' },
          { value: 'Deferida', label: 'Deferida' },
          { value: 'Indeferida', label: 'Indeferida' }
        ]}
      ]
    })}
    <div id="submissions-table">
      ${renderSubmissionsTable(submissions)}
    </div>
  `;

  // Nova inscrição
  document.getElementById('btn-new-sub').addEventListener('click', () => {
    Router.navigate('submissions', { action: 'new' });
  });

  // Exportar CSV
  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const result = await avaliaAPI.submissions.exportCSV();
    if (result) Toast.show('success', 'CSV exportado com sucesso!');
  });

  // Busca
  const searchInput = container.querySelector('.toolbar-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const q = searchInput.value.trim();
        const results = q ? await avaliaAPI.submissions.search(q) : await avaliaAPI.submissions.list({});
        document.getElementById('submissions-table').innerHTML = renderSubmissionsTable(results);
      }, 300);
    });
  }

  // Filtro de status
  const statusFilter = container.querySelector('[data-filter="status"]');
  if (statusFilter) {
    statusFilter.addEventListener('change', async () => {
      const filters = {};
      if (statusFilter.value) filters.status = statusFilter.value;
      const results = await avaliaAPI.submissions.list(filters);
      document.getElementById('submissions-table').innerHTML = renderSubmissionsTable(results);
    });
  }
});

function renderSubmissionsTable(submissions) {
  return Components.table([
    { label: 'Protocolo', key: 'protocol', render: (r) => `<a href="#" class="sub-link" data-protocol="${r.protocol}" style="color:var(--accent);font-weight:600;">${r.protocol}</a>` },
    { label: 'Nome', key: 'nome' },
    { label: 'Linha', key: 'linha_pesquisa', render: (r) => escapeHtml(r.linha_pesquisa || '-') },
    { label: 'Status', render: (r) => statusBadge(r.status) },
    { label: 'Data', render: (r) => formatDate(r.created_at) },
    { label: 'Ações', render: (r) => `
      <div class="table-actions">
        <button class="btn btn-sm btn-ghost sub-view" data-protocol="${r.protocol}">Ver</button>
        <button class="btn btn-sm btn-ghost sub-pdf" data-protocol="${r.protocol}">PDF</button>
      </div>
    `}
  ], submissions, { emptyTitle: 'Nenhuma inscrição', emptyText: 'Clique em "+ Nova Inscrição" para começar.' });
}

// Delegação de eventos para links e botões da tabela
document.addEventListener('click', (e) => {
  const link = e.target.closest('.sub-link, .sub-view');
  if (link) {
    e.preventDefault();
    Router.navigate('submissions', { protocol: link.dataset.protocol });
  }
  const pdfBtn = e.target.closest('.sub-pdf');
  if (pdfBtn) {
    avaliaAPI.reports.submissionPDF(pdfBtn.dataset.protocol).then(r => {
      if (r.success) Toast.show('success', 'PDF salvo!');
    });
  }
});

async function renderSubmissionDetail(container, protocol) {
  const sub = await avaliaAPI.submissions.get(protocol);
  if (!sub) {
    container.innerHTML = '<div class="empty-state"><h3>Inscrição não encontrada</h3></div>';
    return;
  }

  // Parseia o JSON completo da coluna 'data' (vindo do servidor web via sync)
  let fullData = null;
  try { fullData = sub.data ? JSON.parse(sub.data) : null; } catch (_) {}
  const id = (fullData && fullData.identified) || {};
  const proj = (fullData && fullData.project) || (fullData && fullData.blind) || {};

  // Helper: busca primeiro no JSON completo, depois nas colunas SQLite
  const f = (jsonVal, sqliteVal) => {
    const v = jsonVal || sqliteVal || '';
    return typeof v === 'string' ? v : String(v);
  };

  // Monta dados mesclados (JSON tem prioridade, fallback para colunas SQLite)
  const nome = f(id.nome, sub.nome);
  const nomeSocial = f(id.nome_social, sub.nome_social);
  const dataNasc = f(id.data_nascimento, sub.data_nascimento);
  const cpfDisplay = id.cpf ? id.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4') : (sub.cpf_last4 ? '***' + sub.cpf_last4 : '-');
  const rg = f(id.rg, sub.rg);
  const orgaoExp = f(id.orgao_expedidor, sub.orgao_emissor);
  const dataExp = f(id.data_expedicao, '');
  const email = f(id.email, sub.email);
  const celular = f(id.celular, sub.telefone);
  const telRes = f(id.telefone_residencial, '');
  const endereco = f(id.endereco, sub.endereco);
  const cidadeEstado = id.cidade_estado || ((sub.cidade || '') + (sub.estado ? '/' + sub.estado : ''));
  const cep = f(id.cep, sub.cep);
  const cursoGrad = f(id.curso_graduacao, sub.curso_graduacao);
  const instituicao = f(id.instituicao, sub.instituicao);
  const anoConclusao = f(id.ano_conclusao, sub.ano_conclusao);
  const racaCor = f(id.raca_cor, '');
  const linguaEstr = f(id.lingua_estrangeira, '');
  const vinculo = f(id.vinculo_empregaticio, '');
  const cargaHoraria = f(id.carga_horaria, '');
  const empresaVinculo = f(id.empresa_vinculo, '');

  // Vagas/cotas
  const vagaInst = id.vaga_institucional || sub.vaga_institucional;
  const vagaCoop = id.vaga_cooperacao || sub.cooperacao_sdr;
  const vagaReserv = id.vaga_reservada || '';
  const cotasStr = id.cotas || '';
  const cotaNegro = (typeof cotasStr === 'string' && cotasStr.includes('negro')) || sub.cota_negro;
  const cotaIndig = (typeof cotasStr === 'string' && cotasStr.includes('indígena')) || (typeof cotasStr === 'string' && cotasStr.includes('indigena')) || sub.cota_indigena;
  const cotaQuil = (typeof cotasStr === 'string' && cotasStr.includes('quilombola')) || sub.cota_quilombola;
  const cotaCig = (typeof cotasStr === 'string' && cotasStr.includes('cigano')) || sub.cota_cigano;
  const cotaTrans = (typeof cotasStr === 'string' && cotasStr.includes('trans')) || sub.cota_trans;
  const cotaPcd = (typeof cotasStr === 'string' && cotasStr.includes('pcd')) || sub.cota_pcd;

  // Projeto
  const tituloPt = f(proj.titulo_pt, sub.titulo_pt);
  const tituloEn = f(proj.titulo_en, sub.titulo_en);
  const area = f(proj.area, sub.linha_pesquisa);
  const palavrasPt = f(proj.palavras_pt, sub.palavras_chave);
  const palavrasEn = f(proj.palavras_en, '');

  // Anteprojeto
  const resumo = f(proj.resumo, sub.resumo);
  const justEnq = f(proj.justificativa_enquadramento, '');
  const intro = f(proj.introducao, sub.introducao);
  const problPesq = f(proj.problema_pesquisa, sub.problema);
  const justRelev = f(proj.justificativa_relevancia, sub.justificativa);
  const objGeral = f(proj.objetivo_geral, '');
  const objEspec = f(proj.objetivos_especificos, sub.objetivos);
  const revisao = f(proj.revisao_literatura, sub.revisao_literatura);
  const metodo = f(proj.procedimentos_metodologicos, sub.metodologia);
  const cronograma = f(proj.cronograma, sub.cronograma);
  const referencias = f(proj.referencias, sub.referencias);

  // Helper para gerar campo somente se tiver valor
  const field = (label, value) => {
    const v = (value || '').trim();
    if (!v || v === '-') return '';
    return `<div><div class="detail-label">${label}</div><div class="detail-value">${escapeHtml(v)}</div></div>`;
  };
  const fieldFull = (label, value) => {
    const v = (value || '').trim();
    if (!v || v === '-') return '';
    return `<div class="full"><div class="detail-label">${label}</div><div class="detail-value" style="white-space:pre-wrap;">${escapeHtml(v)}</div></div>`;
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('submissions')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">Inscrição ${escapeHtml(sub.protocol)}</h1>
        <p class="page-subtitle">${statusBadge(sub.status)} — ${formatDateTime(sub.created_at)}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-sub-pdf">Gerar PDF</button>
        <select class="form-control" id="sub-status-select" style="width:auto;">
          <option ${sub.status === 'Recebida' ? 'selected' : ''}>Recebida</option>
          <option ${sub.status === 'Deferida' ? 'selected' : ''}>Deferida</option>
          <option ${sub.status === 'Indeferida' ? 'selected' : ''}>Indeferida</option>
        </select>
        <button class="btn btn-primary" id="btn-sub-save-status">Salvar Status</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">Dados Pessoais</div></div>
      <div class="submission-detail">
        ${field('Nome', nome)}
        ${field('Nome Social', nomeSocial)}
        ${field('Data de Nascimento', dataNasc)}
        ${field('CPF', cpfDisplay)}
        ${field('RG', rg)}
        ${field('Órgão Expedidor', orgaoExp)}
        ${field('Data de Expedição', dataExp)}
        ${field('E-mail', email)}
        ${field('Celular', celular)}
        ${field('Telefone Residencial', telRes)}
        ${field('Endereço', endereco)}
        ${field('Cidade/UF', cidadeEstado)}
        ${field('CEP', cep)}
        ${field('Curso de Graduação', cursoGrad)}
        ${field('Instituição', instituicao)}
        ${field('Ano de Conclusão', anoConclusao)}
        ${field('Raça/Cor', racaCor)}
        ${field('Língua Estrangeira', linguaEstr)}
        ${field('Vínculo Empregatício', vinculo)}
        ${field('Carga Horária', cargaHoraria)}
        ${field('Empresa', empresaVinculo)}
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">Projeto de Pesquisa</div></div>
      <div class="submission-detail">
        <div class="full"><div class="detail-label">Título (PT)</div><div class="detail-value">${escapeHtml(tituloPt || '-')}</div></div>
        <div class="full"><div class="detail-label">Título (EN)</div><div class="detail-value">${escapeHtml(tituloEn || '-')}</div></div>
        ${field('Linha de Pesquisa / Área', area)}
        ${field('Palavras-chave (PT)', palavrasPt)}
        ${field('Palavras-chave (EN)', palavrasEn)}
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">Anteprojeto</div></div>
      <div class="submission-detail">
        ${fieldFull('Resumo', resumo)}
        ${fieldFull('Justificativa de Enquadramento', justEnq)}
        ${fieldFull('Introdução / Contextualização', intro)}
        ${fieldFull('Problema de Pesquisa', problPesq)}
        ${fieldFull('Justificativa / Relevância', justRelev)}
        ${fieldFull('Objetivo Geral', objGeral)}
        ${fieldFull('Objetivos Específicos', objEspec)}
        ${fieldFull('Revisão da Literatura', revisao)}
        ${fieldFull('Procedimentos Metodológicos', metodo)}
        ${fieldFull('Cronograma', cronograma)}
        ${fieldFull('Referências', referencias)}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Vagas Especiais</div></div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${vagaInst ? '<span class="badge badge-info">Institucional</span>' : ''}
        ${vagaCoop ? '<span class="badge badge-info">Cooperação SDR</span>' : ''}
        ${vagaReserv ? '<span class="badge badge-info">Vaga Reservada</span>' : ''}
        ${cotaNegro ? '<span class="badge badge-warning">Cota Negro</span>' : ''}
        ${cotaIndig ? '<span class="badge badge-warning">Cota Indígena</span>' : ''}
        ${cotaQuil ? '<span class="badge badge-warning">Cota Quilombola</span>' : ''}
        ${cotaCig ? '<span class="badge badge-warning">Cota Cigano</span>' : ''}
        ${cotaTrans ? '<span class="badge badge-warning">Cota PessoaTrans</span>' : ''}
        ${cotaPcd ? '<span class="badge badge-warning">Cota PcD</span>' : ''}
        ${!vagaInst && !vagaCoop && !vagaReserv && !cotaNegro && !cotaIndig && !cotaQuil && !cotaCig && !cotaTrans && !cotaPcd ? '<span style="color:var(--text-muted)">Ampla Concorrência</span>' : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-sub-pdf').addEventListener('click', () => {
    avaliaAPI.reports.submissionPDF(protocol).then(r => { if (r.success) Toast.show('success', 'PDF salvo!'); });
  });

  document.getElementById('btn-sub-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('sub-status-select').value;
    await avaliaAPI.submissions.updateStatus(protocol, newStatus);
    Toast.show('success', `Status atualizado para "${newStatus}"`);
    Router.navigate('submissions', { protocol });
  });
}

async function renderSubmissionForm(container) {
  const settings = await avaliaAPI.settings.get();
  const lines = JSON.parse(settings['lines'] || '["Linha 1","Linha 2"]');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('submissions')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">Nova Inscrição</h1>
      </div>
    </div>

    <form id="submission-form">
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Dados Pessoais</div></div>
        <div class="form-row">
          <div class="form-group"><label>Nome Completo *</label><input class="form-control" name="nome" required></div>
          <div class="form-group"><label>Nome Social</label><input class="form-control" name="nomeSocial"></div>
        </div>
        <div class="form-row three">
          <div class="form-group"><label>CPF *</label><input class="form-control" name="cpf" placeholder="000.000.000-00" required></div>
          <div class="form-group"><label>Data de Nascimento</label><input type="date" class="form-control" name="dataNascimento"></div>
          <div class="form-group"><label>RG</label><input class="form-control" name="rg"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>E-mail *</label><input type="email" class="form-control" name="email" required></div>
          <div class="form-group"><label>Telefone</label><input class="form-control" name="telefone" placeholder="(00) 00000-0000"></div>
        </div>
        <div class="form-row three">
          <div class="form-group"><label>Cidade</label><input class="form-control" name="cidade"></div>
          <div class="form-group"><label>Estado</label><input class="form-control" name="estado" maxlength="2" placeholder="BA"></div>
          <div class="form-group"><label>CEP</label><input class="form-control" name="cep" placeholder="00000-000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Curso de Graduação</label><input class="form-control" name="cursoGraduacao"></div>
          <div class="form-group"><label>Instituição</label><input class="form-control" name="instituicao"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Projeto de Pesquisa</div></div>
        <div class="form-row">
          <div class="form-group"><label>Título (PT) *</label><input class="form-control" name="tituloPt" required></div>
          <div class="form-group"><label>Título (EN)</label><input class="form-control" name="tituloEn"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Linha de Pesquisa *</label>
            <select class="form-control" name="linhaPesquisa" required>
              <option value="">Selecione...</option>
              ${lines.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Palavras-chave</label><input class="form-control" name="palavrasChave" placeholder="Separadas por vírgula"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Anteprojeto (Avaliação Cega)</div></div>
        <div class="form-group"><label>Resumo</label><textarea class="form-control" name="resumo" rows="4"></textarea></div>
        <div class="form-group"><label>Justificativa</label><textarea class="form-control" name="justificativa" rows="4"></textarea></div>
        <div class="form-group"><label>Introdução</label><textarea class="form-control" name="introducao" rows="4"></textarea></div>
        <div class="form-group"><label>Problema de Pesquisa</label><textarea class="form-control" name="problema" rows="3"></textarea></div>
        <div class="form-group"><label>Objetivos</label><textarea class="form-control" name="objetivos" rows="3"></textarea></div>
        <div class="form-group"><label>Revisão da Literatura</label><textarea class="form-control" name="revisaoLiteratura" rows="4"></textarea></div>
        <div class="form-group"><label>Metodologia</label><textarea class="form-control" name="metodologia" rows="4"></textarea></div>
        <div class="form-group"><label>Cronograma</label><textarea class="form-control" name="cronograma" rows="3"></textarea></div>
        <div class="form-group"><label>Referências</label><textarea class="form-control" name="referencias" rows="4"></textarea></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div class="card-title">Vagas Especiais</div></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="vagaInstitucional"> Vaga Institucional</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cooperacaoSdr"> Cooperação SDR</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaNegro"> Cota Negro</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaIndigena"> Cota Indígena</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaQuilombola"> Cota Quilombola</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaCigano"> Cota Cigano</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaTrans"> Cota Pessoa Trans</label>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" name="cotaPcd"> Cota PcD</label>
        </div>
      </div>

      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button type="button" class="btn btn-ghost" onclick="Router.navigate('submissions')">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-lg">Registrar Inscrição</button>
      </div>
    </form>
  `;

  document.getElementById('submission-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const [key, val] of fd.entries()) {
      if (e.target.elements[key]?.type === 'checkbox') {
        data[key] = e.target.elements[key].checked;
      } else {
        data[key] = val;
      }
    }
    // Força checkboxes não marcados
    ['vagaInstitucional','cooperacaoSdr','cotaNegro','cotaIndigena','cotaQuilombola','cotaCigano','cotaTrans','cotaPcd'].forEach(k => {
      if (data[k] === undefined) data[k] = false;
    });

    const result = await avaliaAPI.submissions.create(data);
    if (result.success) {
      Toast.show('success', `Inscrição registrada! Protocolo: ${result.protocol}`);
      Router.navigate('submissions', { protocol: result.protocol });
    } else {
      Toast.show('error', result.error || 'Erro ao registrar inscrição');
    }
  });
}
