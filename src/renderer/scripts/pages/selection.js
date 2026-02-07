// ============================================================
// Selection — Alocação de Vagas
// ============================================================
Router.register('selection', async (container) => {
  const settings = await avaliaAPI.settings.get();
  const lines = JSON.parse(settings['lines'] || '["Linha 1","Linha 2"]');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Alocação de Vagas</h1>
        <p class="page-subtitle">Seleção final dos candidatos aprovados</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-run-allocation">Executar Alocação</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">Configuração de Vagas por Linha</div></div>
      <div class="card-subtitle" style="margin-bottom:16px;">— Pesos: Projeto (${settings['evaluation.proj_weight'] || 4}) | Entrevista (${settings['evaluation.int_weight'] || 5}) | Língua (${settings['evaluation.lang_weight'] || 1}) — Nota mínima: ${settings['evaluation.min_score'] || 7.0}</div>
      <div id="vacancy-config">
        ${lines.map(line => `
          <div class="allocation-line" style="margin-bottom:12px;">
            <h4>${escapeHtml(line)}</h4>
            <div class="form-row three">
              <div class="form-group">
                <label>Total de Vagas</label>
                <input type="number" class="form-control vacancy-total" data-line="${line}" value="10" min="0">
              </div>
              <div class="form-group">
                <label>Vagas de Cota</label>
                <input type="number" class="form-control vacancy-cota" data-line="${line}" value="3" min="0">
              </div>
              <div class="form-group">
                <label>Vagas Institucional</label>
                <input type="number" class="form-control vacancy-inst" data-line="${line}" value="0" min="0">
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div id="allocation-results"></div>
  `;

  document.getElementById('btn-run-allocation').addEventListener('click', async () => {
    const config = { lines: {} };
    lines.forEach(line => {
      const total = parseInt(container.querySelector(`.vacancy-total[data-line="${line}"]`).value) || 0;
      const cota = parseInt(container.querySelector(`.vacancy-cota[data-line="${line}"]`).value) || 0;
      const inst = parseInt(container.querySelector(`.vacancy-inst[data-line="${line}"]`).value) || 0;
      config.lines[line] = { total, cota, institucional: inst };
    });

    const result = await avaliaAPI.workflow.allocateVacancies(config);
    if (!result.success) {
      Toast.show('error', 'Erro ao executar alocação');
      return;
    }

    let html = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div class="card-title">Resultado da Alocação</div>
          <button class="btn btn-sm btn-ghost" id="btn-alloc-pdf">Exportar PDF</button>
        </div>
    `;

    for (const [line, candidates] of Object.entries(result.allocation)) {
      html += `
        <h4 style="color:var(--accent-light); margin:16px 0 8px;">${escapeHtml(line)} (${candidates.length} alocados)</h4>
        ${Components.table([
          { label: '#', render: (_, i) => String(i + 1) },
          { label: 'Nome', key: 'nome' },
          { label: 'Nota Final', render: (r) => `<strong style="color:var(--success)">${r.notaFinal}</strong>` },
          { label: 'Tipo Vaga', render: (r) => `<span class="badge badge-info">${escapeHtml(r.tipoVaga)}</span>` }
        ], candidates.map((c, i) => ({ ...c, _i: i })), { emptyTitle: 'Nenhum candidato alocado' })}
      `;
    }

    html += '</div>';
    document.getElementById('allocation-results').innerHTML = html;

    document.getElementById('btn-alloc-pdf')?.addEventListener('click', async () => {
      const pdfResult = await avaliaAPI.reports.allocationPDF(result);
      if (pdfResult.success) Toast.show('success', 'PDF da alocação salvo!');
    });

    Toast.show('success', 'Alocação executada com sucesso!');
  });
});
