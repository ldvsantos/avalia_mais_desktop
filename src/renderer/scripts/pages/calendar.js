// ============================================================
// Calendar — Calendário do Processo Seletivo
// ============================================================
Router.register('calendar', async (container) => {
  const settings = await avaliaAPI.settings.get();
  const year = settings['app.year'] || new Date().getFullYear();
  let phases = await avaliaAPI.calendar.list(year);

  const defaultPhases = [
    { phase: 'inscricao', label: 'Inscrições' },
    { phase: 'recurso_inscricao', label: 'Recurso - Inscrição' },
    { phase: 'avaliacao_projeto', label: 'Avaliação do Projeto' },
    { phase: 'recurso_projeto', label: 'Recurso - Projeto' },
    { phase: 'entrevista', label: 'Entrevista' },
    { phase: 'recurso_entrevista', label: 'Recurso - Entrevista' },
    { phase: 'avaliacao_lingua', label: 'Avaliação de Língua' },
    { phase: 'recurso_lingua', label: 'Recurso - Língua' },
    { phase: 'resultado_final', label: 'Resultado Final' },
    { phase: 'matricula', label: 'Matrícula' }
  ];

  // Merge: usa phases do DB se existirem, senão defaults
  const mergedPhases = defaultPhases.map(dp => {
    const existing = phases.find(p => p.phase === dp.phase);
    return existing || { ...dp, start_date: '', end_date: '', active: 1, year };
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Calendário do Edital ${escapeHtml(String(year))}</h1>
        <p class="page-subtitle">Defina as datas de cada fase do processo seletivo</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="cal-save">Salvar Calendário</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">Fases do Processo</div>
      <div class="panel-body">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width:30%;">Fase</th>
                <th>Data Início</th>
                <th>Data Fim</th>
                <th style="width:80px;">Ativa</th>
              </tr>
            </thead>
            <tbody>
              ${mergedPhases.map((p, i) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(p.label)}</strong>
                    <input type="hidden" class="cal-phase" value="${escapeHtml(p.phase)}">
                    <input type="hidden" class="cal-label" value="${escapeHtml(p.label)}">
                  </td>
                  <td><input type="datetime-local" class="form-control cal-start" value="${p.start_date ? p.start_date.replace(' ', 'T').substring(0,16) : ''}"></td>
                  <td><input type="datetime-local" class="form-control cal-end" value="${p.end_date ? p.end_date.replace(' ', 'T').substring(0,16) : ''}"></td>
                  <td style="text-align:center;">
                    <input type="checkbox" class="cal-active" ${p.active ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cal-save').addEventListener('click', async () => {
    const rows = container.querySelectorAll('tbody tr');
    const phasesData = [];
    rows.forEach(row => {
      phasesData.push({
        phase: row.querySelector('.cal-phase').value,
        label: row.querySelector('.cal-label').value,
        start_date: row.querySelector('.cal-start').value.replace('T', ' '),
        end_date: row.querySelector('.cal-end').value.replace('T', ' '),
        active: row.querySelector('.cal-active').checked
      });
    });

    try {
      await avaliaAPI.calendar.save(year, phasesData);
      Toast.show('success', 'Calendário salvo com sucesso');
    } catch (e) {
      Toast.show('error', 'Erro ao salvar: ' + e.message);
    }
  });
});
