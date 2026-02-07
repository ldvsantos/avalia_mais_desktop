// ============================================================
// Users — Gerenciamento de Usuários (completo)
// ============================================================
Router.register('users', async (container) => {
  let allUsers = [];
  try { allUsers = await avaliaAPI.users.list(); } catch (_) {}

  const adminCount = allUsers.filter(u => u.role === 'admin').length;
  const evalCount  = allUsers.filter(u => u.role === 'evaluator').length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Usuários</h1>
        <p class="page-subtitle">${allUsers.length} total — ${adminCount} admins, ${evalCount} avaliadores</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-new-user">+ Novo Usuário</button>
      </div>
    </div>

    <!-- Usuário logado -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">Meu Perfil</div></div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px;">
        <div><div class="detail-label">Usuário</div><div class="detail-value">${escapeHtml(App.currentUser?.username || '-')}</div></div>
        <div><div class="detail-label">Papel</div><div class="detail-value"><span class="badge ${App.currentUser?.role === 'admin' ? 'badge-info' : 'badge-success'}">${App.currentUser?.role || '-'}</span></div></div>
        <div><div class="detail-label">Nome de Exibição</div><div class="detail-value">${escapeHtml(App.currentUser?.displayName || '-')}</div></div>
      </div>
      <details>
        <summary style="cursor:pointer; color:var(--primary); font-weight:600; margin-bottom:12px;">🔑 Alterar Minha Senha</summary>
        <form id="change-password-form">
          <div class="form-row three">
            <div class="form-group"><label>Senha Atual</label><input type="password" class="form-control" name="oldPassword" required></div>
            <div class="form-group"><label>Nova Senha</label><input type="password" class="form-control" name="newPassword" required minlength="4"></div>
            <div class="form-group"><label>Confirmar</label><input type="password" class="form-control" name="confirmPassword" required></div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Alterar Senha</button>
        </form>
      </details>
    </div>

    <!-- Lista de usuários -->
    <div class="panel">
      <div class="panel-header">Todos os Usuários</div>
      <div class="panel-body">
        ${allUsers.length === 0
          ? '<div class="empty-state"><h3>Nenhum usuário cadastrado</h3></div>'
          : `<div class="table-container"><table>
            <thead><tr>
              <th>Usuário</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Linha</th>
              <th>Nº Aval.</th>
              <th>Status</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${allUsers.map(u => `
                <tr>
                  <td><strong>${escapeHtml(u.username)}</strong></td>
                  <td>${escapeHtml(u.display_name || u.displayName || '-')}</td>
                  <td>${escapeHtml(u.email || '-')}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}">${u.role}</span></td>
                  <td>${escapeHtml(u.line || '-')}</td>
                  <td>${u.evaluator_num || u.evaluatorNum || '-'}</td>
                  <td><span class="badge ${u.active !== 0 ? 'badge-success' : 'badge-danger'}">
                    ${u.active !== 0 ? 'Ativo' : 'Inativo'}
                  </span></td>
                  <td>
                    <button class="btn btn-sm btn-ghost user-toggle" data-id="${u.id}" data-active="${u.active !== 0 ? 1 : 0}">
                      ${u.active !== 0 ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`
        }
      </div>
    </div>
  `;

  // Alterar senha do usuário logado
  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { oldPassword, newPassword, confirmPassword } = Object.fromEntries(fd.entries());
    
    if (newPassword !== confirmPassword) {
      Toast.show('error', 'As senhas não coincidem');
      return;
    }

    const result = await avaliaAPI.auth.changePassword(App.currentUser.id, oldPassword, newPassword);
    if (result.success) {
      Toast.show('success', 'Senha alterada com sucesso!');
      e.target.reset();
    } else {
      Toast.show('error', result.error || 'Erro ao alterar senha');
    }
  });

  // Toggle ativo/inativo
  container.querySelectorAll('.user-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = parseInt(btn.dataset.id);
      try {
        await avaliaAPI.users.toggleActive(userId);
        Toast.show('success', 'Status do usuário alterado');
        Router.navigate('users');
      } catch (err) {
        Toast.show('error', 'Erro: ' + err.message);
      }
    });
  });

  // Novo usuário
  document.getElementById('btn-new-user').addEventListener('click', () => {
    Modal.show(`
      <div class="modal-header">
        <h3 class="modal-title">Novo Usuário</h3>
        <button class="modal-close" onclick="Modal.hide()">✕</button>
      </div>
      <form id="new-user-form">
        <div class="form-group"><label>Usuário *</label><input class="form-control" name="username" required></div>
        <div class="form-group"><label>Senha *</label><input type="password" class="form-control" name="password" required minlength="4"></div>
        <div class="form-group"><label>Nome de Exibição</label><input class="form-control" name="displayName"></div>
        <div class="form-group"><label>E-mail</label><input type="email" class="form-control" name="email"></div>
        <div class="form-group">
          <label>Papel *</label>
          <select class="form-control" name="role">
            <option value="admin">Administrador</option>
            <option value="evaluator">Avaliador</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Linha de Pesquisa</label><input class="form-control" name="line" placeholder="Ex: Direito Civil"></div>
          <div class="form-group"><label>Número do Avaliador</label><input type="number" class="form-control" name="evaluatorNum" min="1"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick="Modal.hide()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Criar Usuário</button>
        </div>
      </form>
    `);

    document.getElementById('new-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (data.evaluatorNum) data.evaluatorNum = parseInt(data.evaluatorNum);
      if (!data.username || !data.password) {
        Toast.show('warning', 'Usuário e senha são obrigatórios');
        return;
      }

      try {
        const result = await avaliaAPI.users.create(data);
        if (result.success) {
          Toast.show('success', `Usuário "${data.username}" criado`);
          Modal.hide();
          Router.navigate('users');
        } else {
          Toast.show('error', result.error || 'Erro ao criar usuário');
        }
      } catch (err) {
        Toast.show('error', 'Erro: ' + err.message);
      }
    });
  });
});
