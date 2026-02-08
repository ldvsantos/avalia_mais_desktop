// ============================================================
// Settings — Configurações do Sistema (completo)
// ============================================================
Router.register('settings', async (container) => {
  const settings = await avaliaAPI.settings.get();

  // Busca status de sync
  let syncStatus = null;
  try { syncStatus = await avaliaAPI.sync.status(); } catch (_) {}

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Configurações</h1>
        <p class="page-subtitle">Parâmetros gerais do sistema</p>
      </div>
    </div>

    <form id="settings-form">
      <div class="settings-section">
        <h3>Instituição</h3>
        <div class="form-row">
          <div class="form-group"><label>Nome da Instituição</label><input class="form-control" name="app.institution" value="${escapeHtml(settings['app.institution'] || '')}"></div>
          <div class="form-group"><label>Ano do Processo Seletivo</label><input type="number" class="form-control" name="app.year" value="${settings['app.year'] || new Date().getFullYear()}"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Inscrições</h3>
        <div class="form-row three">
          <div class="form-group">
            <label>Inscrições Abertas</label>
            <select class="form-control" name="registration.open">
              <option value="0" ${settings['registration.open'] !== '1' ? 'selected' : ''}>Não</option>
              <option value="1" ${settings['registration.open'] === '1' ? 'selected' : ''}>Sim</option>
            </select>
          </div>
          <div class="form-group"><label>Data de Início</label><input type="date" class="form-control" name="registration.start_date" value="${settings['registration.start_date'] || ''}"></div>
          <div class="form-group"><label>Data de Encerramento</label><input type="date" class="form-control" name="registration.end_date" value="${settings['registration.end_date'] || ''}"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Pesos de Avaliação</h3>
        <p class="form-hint" style="margin-bottom:12px;">Nota Final = (Projeto × P) + (Entrevista × E) + (Língua × L) / (P + E + L)</p>
        <div class="form-row three">
          <div class="form-group">
            <label>Peso — Projeto</label>
            <input type="number" class="form-control" name="evaluation.proj_weight" value="${settings['evaluation.proj_weight'] || '4'}" min="0" max="10" step="0.5">
          </div>
          <div class="form-group">
            <label>Peso — Entrevista</label>
            <input type="number" class="form-control" name="evaluation.int_weight" value="${settings['evaluation.int_weight'] || '5'}" min="0" max="10" step="0.5">
          </div>
          <div class="form-group">
            <label>Peso — Língua Estrangeira</label>
            <input type="number" class="form-control" name="evaluation.lang_weight" value="${settings['evaluation.lang_weight'] || '1'}" min="0" max="10" step="0.5">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nota Mínima para Aprovação</label>
            <input type="number" class="form-control" name="evaluation.min_score" value="${settings['evaluation.min_score'] || '7.0'}" min="0" max="10" step="0.1">
          </div>
          <div class="form-group">
            <label>Número de Avaliadores por Inscrição</label>
            <input type="number" class="form-control" name="evaluation.num_evaluators" value="${settings['evaluation.num_evaluators'] || '3'}" min="1" max="10">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Linhas de Pesquisa</h3>
        <div class="form-group">
          <label>Linhas (uma por linha)</label>
          <textarea class="form-control" name="lines_text" rows="4" placeholder="Linha 1&#10;Linha 2&#10;...">${(() => {
            try { return JSON.parse(settings['lines'] || '[]').join('\n'); } catch { return ''; }
          })()}</textarea>
          <div class="form-hint">Cada linha do texto será uma opção de linha de pesquisa.</div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Aparência</h3>
        <div class="form-group">
          <label>Tema</label>
          <select class="form-control" name="theme">
            <option value="dark" ${settings['theme'] !== 'light' ? 'selected' : ''}>Escuro</option>
            <option value="light" ${settings['theme'] === 'light' ? 'selected' : ''}>Claro</option>
          </select>
        </div>
      </div>

      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button type="button" class="btn btn-ghost" onclick="Router.navigate('dashboard')">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-lg">Salvar Configurações</button>
      </div>
    </form>

    <!-- Atalhos para outros módulos de configuração -->
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-top:24px;">
      <div class="card" style="cursor:pointer; text-align:center;" onclick="Router.navigate('calendar')">
        <div style="font-size:32px; margin-bottom:8px;">📅</div>
        <h4>Calendário do Processo</h4>
        <p style="font-size:12px; color:var(--text-muted);">Gerencie datas de cada etapa</p>
      </div>
      <div class="card" style="cursor:pointer; text-align:center;" id="sync-card-btn">
        <div style="font-size:32px; margin-bottom:8px;">🔄</div>
        <h4>Sincronizar Agora</h4>
        <p style="font-size:12px; color:var(--text-muted);">
          ${syncStatus?.lastSync ? 'Última sync: ' + new Date(syncStatus.lastSync).toLocaleString('pt-BR') : 'Clique para sincronizar com o servidor'}
        </p>
      </div>
      <div class="card" style="cursor:pointer; text-align:center;" onclick="Router.navigate('backup')">
        <div style="font-size:32px; margin-bottom:8px;">💾</div>
        <h4>Backup</h4>
        <p style="font-size:12px; color:var(--text-muted);">Criar e restaurar backups do sistema</p>
      </div>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    // Converte linhas de texto para JSON
    if (data.lines_text) {
      const lines = data.lines_text.split('\n').map(l => l.trim()).filter(Boolean);
      data['lines'] = JSON.stringify(lines);
      delete data.lines_text;
    }

    await avaliaAPI.settings.update(data);
    Toast.show('success', 'Configurações salvas com sucesso!');
  });

  // Botão de sincronização manual
  const syncBtn = document.getElementById('sync-card-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.style.opacity = '0.6';
      syncBtn.querySelector('h4').textContent = 'Sincronizando...';
      Toast.show('info', 'Sincronizando com o servidor...', 3000);
      try {
        const result = await avaliaAPI.sync.autoLoginAndPull();
        if (result && result.success) {
          const r = result.results || {};
          const total = (r.submissions || 0) + (r.evaluations || 0) + (r.appeals || 0) +
            (r.events || 0) + (r.calendar || 0) + (r.faq || 0) + (r.files || 0) +
            (r.evaluators || 0) + (r.phaseStatus || 0);
          Toast.show('success', `Sincronizado — ${total} registros atualizados`, 4000);
          syncBtn.querySelector('p').textContent = 'Última sync: ' + new Date().toLocaleString('pt-BR');
        } else {
          Toast.show('error', 'Falha na sincronização: ' + (result?.error || 'sem conexão'), 5000);
        }
      } catch (err) {
        Toast.show('error', 'Erro: ' + err.message, 5000);
      } finally {
        syncBtn.style.opacity = '1';
        syncBtn.querySelector('h4').textContent = 'Sincronizar Agora';
      }
    });
  }
});
