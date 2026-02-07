// ============================================================
// Backup — Backup e Restauração (completo)
// ============================================================
Router.register('backup', async (container) => {
  // Busca lista de backups existentes
  let backups = [];
  try { backups = await avaliaAPI.backup.list(); } catch (_) {}

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Backup e Restauração</h1>
        <p class="page-subtitle">${backups.length} backup(s) encontrado(s)</p>
      </div>
    </div>

    <div class="backup-info">
      <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <p>Os backups salvam uma cópia completa do banco de dados, incluindo todas as inscrições, avaliações, recursos, eventos e configurações. Recomendamos fazer backup regularmente.</p>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
      <div class="card">
        <div class="card-header"><div class="card-title">Criar Backup</div></div>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:16px;">
          Gera um arquivo de backup contendo todos os dados do sistema. Escolha um local seguro para salvar.
        </p>
        <button class="btn btn-primary btn-lg btn-block" id="btn-create-backup">
          Criar Backup Agora
        </button>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Restaurar Backup</div></div>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:16px;">
          Restaura o sistema a partir de um arquivo de backup anterior. <strong style="color:var(--warning);">Atenção: os dados atuais serão substituídos!</strong>
        </p>
        <button class="btn btn-warning btn-lg btn-block" id="btn-restore-backup">
          Restaurar de Arquivo
        </button>
      </div>
    </div>

    <!-- Lista de backups existentes -->
    <div class="panel">
      <div class="panel-header">Backups Existentes</div>
      <div class="panel-body">
        ${backups.length === 0
          ? '<div class="empty-state"><h3>Nenhum backup encontrado</h3><p>Crie seu primeiro backup acima.</p></div>'
          : `<div class="table-container"><table>
            <thead><tr>
              <th>Arquivo</th>
              <th>Tamanho</th>
              <th>Data de Criação</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${backups.map(b => `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td>${formatFileSize(b.size)}</td>
                  <td>${new Date(b.created).toLocaleString('pt-BR')}</td>
                  <td>
                    <button class="btn btn-sm btn-warning backup-restore-file" data-path="${escapeHtml(b.path)}">Restaurar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`
        }
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><div class="card-title">Dicas de Segurança</div></div>
      <ul style="color:var(--text-secondary); font-size:13px; line-height:2; padding-left:20px;">
        <li>Faça backup antes de qualquer operação crítica (alocação, exclusões em massa)</li>
        <li>Armazene backups em local diferente do computador principal (pen drive, nuvem)</li>
        <li>Mantenha pelo menos 3 cópias de backup recentes</li>
        <li>Teste a restauração periodicamente para garantir integridade</li>
        <li>O backup inclui: inscrições, avaliações, recursos, eventos, configurações e logs</li>
      </ul>
    </div>
  `;

  document.getElementById('btn-create-backup').addEventListener('click', async () => {
    try {
      const result = await avaliaAPI.backup.create();
      if (result.success) {
        Toast.show('success', `Backup salvo em: ${result.path}`);
        Router.navigate('backup'); // Recarrega para mostrar novo backup na lista
      } else {
        Toast.show('warning', result.error || 'Backup cancelado');
      }
    } catch (err) {
      Toast.show('error', 'Erro ao criar backup: ' + err.message);
    }
  });

  document.getElementById('btn-restore-backup').addEventListener('click', () => {
    performRestore();
  });

  // Restaurar backup específico da lista
  container.querySelectorAll('.backup-restore-file').forEach(btn => {
    btn.addEventListener('click', () => {
      performRestore(btn.dataset.path);
    });
  });
});

function performRestore(specificPath) {
  Components.confirm(
    'Restaurar Backup',
    'Tem certeza? Todos os dados atuais serão substituídos pelo conteúdo do backup selecionado. Um backup de segurança será criado automaticamente antes da restauração.',
    async () => {
      try {
        Toast.show('info', 'Restaurando backup... Aguarde.');
        const result = await avaliaAPI.backup.restore(specificPath);
        if (result.success) {
          Toast.show('success', 'Backup restaurado com sucesso! Recarregando...');
          setTimeout(() => location.reload(), 2000);
        } else {
          Toast.show('error', result.error || 'Erro na restauração');
        }
      } catch (err) {
        Toast.show('error', 'Erro: ' + err.message);
      }
    }
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let size = bytes;
  while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx++; }
  return size.toFixed(idx > 0 ? 1 : 0) + ' ' + units[idx];
}
