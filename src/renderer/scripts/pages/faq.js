// ============================================================
// FAQ — Gerenciamento de Perguntas Frequentes
// ============================================================
Router.register('faq', async (container) => {
  let items = [];

  async function render() {
    items = await avaliaAPI.faq.list();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Perguntas Frequentes (FAQ)</h1>
          <p class="page-subtitle">Gerencie as perguntas e respostas exibidas para os candidatos</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="faq-add">+ Nova Pergunta</button>
          <button class="btn btn-ghost" id="faq-save-all">Salvar Ordem</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">FAQ (${items.length} itens)</div>
        <div class="panel-body" id="faq-list">
          ${items.length === 0
            ? '<div class="empty-state"><h3>Nenhuma pergunta cadastrada</h3><p>Clique em "+ Nova Pergunta" para adicionar</p></div>'
            : items.map((item, i) => `
              <div class="faq-item" data-id="${item.id}" data-index="${i}">
                <div class="faq-item-header">
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="badge badge-info">${escapeHtml(item.section || 'general')}</span>
                      <strong style="font-size:14px;">${escapeHtml(item.question)}</strong>
                    </div>
                    <div style="margin-top:6px;font-size:13px;color:var(--text-secondary);line-height:1.5;max-height:60px;overflow:hidden;">${escapeHtml(item.answer).substring(0, 200)}${item.answer.length > 200 ? '...' : ''}</div>
                  </div>
                  <div class="table-actions" style="flex-shrink:0;">
                    <button class="btn btn-ghost btn-sm faq-edit" data-id="${item.id}">Editar</button>
                    <button class="btn btn-danger btn-sm faq-del" data-id="${item.id}">Excluir</button>
                  </div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;

    // Add new
    document.getElementById('faq-add').addEventListener('click', () => showFaqForm());

    // Edit
    container.querySelectorAll('.faq-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => i.id === Number(btn.dataset.id));
        if (item) showFaqForm(item);
      });
    });

    // Delete
    container.querySelectorAll('.faq-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta pergunta?')) return;
        await avaliaAPI.faq.delete(Number(btn.dataset.id));
        Toast.show('success', 'Pergunta excluída');
        render();
      });
    });

    // Save all (reorder)
    document.getElementById('faq-save-all').addEventListener('click', async () => {
      const orderedItems = items.map((item, i) => ({
        section: item.section, question: item.question, answer: item.answer
      }));
      await avaliaAPI.faq.saveAll(orderedItems);
      Toast.show('success', 'Ordem salva');
    });
  }

  function showFaqForm(existing = null) {
    Modal.show(`
      <h2 style="margin-bottom:16px;">${existing ? 'Editar' : 'Nova'} Pergunta</h2>
      <div class="form-group">
        <label>Seção</label>
        <select class="form-control" id="faq-section">
          <option value="general" ${!existing || existing.section === 'general' ? 'selected' : ''}>Geral</option>
          <option value="inscricao" ${existing?.section === 'inscricao' ? 'selected' : ''}>Inscrição</option>
          <option value="avaliacao" ${existing?.section === 'avaliacao' ? 'selected' : ''}>Avaliação</option>
          <option value="resultado" ${existing?.section === 'resultado' ? 'selected' : ''}>Resultado</option>
          <option value="recurso" ${existing?.section === 'recurso' ? 'selected' : ''}>Recurso</option>
          <option value="eventos" ${existing?.section === 'eventos' ? 'selected' : ''}>Eventos</option>
        </select>
      </div>
      <div class="form-group">
        <label>Pergunta</label>
        <input type="text" class="form-control" id="faq-question" value="${escapeHtml(existing?.question || '')}" placeholder="Ex: Como me inscrever?">
      </div>
      <div class="form-group">
        <label>Resposta</label>
        <textarea class="form-control" id="faq-answer" rows="6" placeholder="Resposta detalhada...">${escapeHtml(existing?.answer || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
        <button class="btn btn-primary" id="faq-submit">${existing ? 'Salvar' : 'Adicionar'}</button>
      </div>
    `);

    document.getElementById('faq-submit').addEventListener('click', async () => {
      const data = {
        section: document.getElementById('faq-section').value,
        question: document.getElementById('faq-question').value.trim(),
        answer: document.getElementById('faq-answer').value.trim()
      };
      if (!data.question || !data.answer) { Toast.show('warning', 'Preencha pergunta e resposta'); return; }

      try {
        if (existing) {
          await avaliaAPI.faq.update(existing.id, data);
          Toast.show('success', 'Pergunta atualizada');
        } else {
          await avaliaAPI.faq.create(data);
          Toast.show('success', 'Pergunta adicionada');
        }
        Modal.hide();
        render();
      } catch (e) {
        Toast.show('error', 'Erro: ' + e.message);
      }
    });
  }

  render();
});
