// ============================================================
// PublicFiles — Gerenciamento de Publicações/Documentos
// ============================================================
Router.register('publicfiles', async (container) => {
  async function render() {
    const files = await avaliaAPI.publicFiles.list();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Publicações e Resultados</h1>
          <p class="page-subtitle">Gerencie documentos públicos (resultados, editais, atas)</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="pf-upload">+ Publicar Documento</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">Documentos Publicados (${files.length})</div>
        <div class="panel-body">
          ${files.length === 0
            ? '<div class="empty-state"><h3>Nenhum documento publicado</h3><p>Clique em "+ Publicar Documento" para adicionar um PDF</p></div>'
            : `<div class="table-container"><table>
              <thead><tr>
                <th>Data</th>
                <th>Título</th>
                <th>Categoria</th>
                <th>Ações</th>
              </tr></thead>
              <tbody>
                ${files.map(f => `
                  <tr>
                    <td>${formatDate(f.created_at)}</td>
                    <td><strong>${escapeHtml(f.original_name)}</strong>${f.description ? `<br><span style="font-size:11px;color:var(--text-muted);">${escapeHtml(f.description)}</span>` : ''}</td>
                    <td><span class="badge badge-info">${escapeHtml(f.category || 'resultado')}</span></td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-danger btn-sm" onclick="deletePublicFile(${f.id}, '${escapeHtml(f.original_name)}')">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
          }
        </div>
      </div>
    `;

    document.getElementById('pf-upload').addEventListener('click', () => {
      Modal.show(`
        <h2 style="margin-bottom:16px;">Publicar Documento</h2>
        <div class="form-group">
          <label>Categoria</label>
          <select class="form-control" id="pf-cat">
            <option value="resultado">Resultado</option>
            <option value="edital">Edital</option>
            <option value="ata">Ata</option>
            <option value="comunicado">Comunicado</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div class="form-group">
          <label>Descrição (opcional)</label>
          <input type="text" class="form-control" id="pf-desc" placeholder="Breve descrição do documento">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
          <button class="btn btn-primary" id="pf-select-file">Selecionar PDF e Publicar</button>
        </div>
      `);

      document.getElementById('pf-select-file').addEventListener('click', async () => {
        const cat = document.getElementById('pf-cat').value;
        const desc = document.getElementById('pf-desc').value.trim();
        Modal.hide();
        try {
          const result = await avaliaAPI.publicFiles.import(cat, desc);
          if (result.success) {
            Toast.show('success', 'Documento publicado com sucesso');
            render();
          } else if (!result.canceled) {
            Toast.show('error', 'Erro ao publicar documento');
          }
        } catch (e) {
          Toast.show('error', 'Erro: ' + e.message);
        }
      });
    });
  }

  // Função global para deletar
  window.deletePublicFile = async (id, name) => {
    const confirmed = confirm(`Excluir "${name}"?`);
    if (!confirmed) return;
    try {
      await avaliaAPI.publicFiles.delete(id);
      Toast.show('success', 'Documento excluído');
      render();
    } catch (e) {
      Toast.show('error', 'Erro: ' + e.message);
    }
  };

  render();
});
