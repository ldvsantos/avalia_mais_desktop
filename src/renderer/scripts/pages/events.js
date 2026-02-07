// ============================================================
// Events — Gestão de Eventos e Cursos (completo)
// ============================================================
Router.register('events', async (container, params) => {
  if (params.id) return renderEventDetail(container, params.id);
  if (params.action === 'new') return renderEventForm(container);

  const events = await avaliaAPI.events.list();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Eventos e Cursos</h1>
        <p class="page-subtitle">${events.length} evento(s)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-new-event">+ Novo Evento</button>
      </div>
    </div>
    
    <div id="events-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
      ${events.length === 0 ? '<div class="empty-state" style="grid-column:1/-1;"><h3>Nenhum evento</h3><p>Crie o primeiro evento clicando no botão acima.</p></div>' : ''}
      ${events.map(ev => `
        <div class="card event-card" style="cursor:pointer; overflow:hidden; padding:0;" onclick="Router.navigate('events', {id: ${ev.id}})">
          <div class="event-card-banner" id="evt-banner-${ev.id}" style="height:140px;background:linear-gradient(135deg,#e0eff9,#d0e5f5);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:36px;">📅</span>
          </div>
          <div style="padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span class="badge ${ev.active ? 'badge-success' : 'badge-neutral'}">${ev.active ? 'Ativo' : 'Inativo'}</span>
              <span style="font-size:11px; color:var(--text-muted);">${formatDate(ev.date)}</span>
            </div>
            <h3 style="font-size:16px; font-weight:700; margin-bottom:4px;">${escapeHtml(ev.title)}</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">${escapeHtml((ev.description || '').slice(0, 100))}${(ev.description || '').length > 100 ? '...' : ''}</p>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-secondary);">
              <span>📍 ${escapeHtml(ev.location || 'Local não definido')}</span>
              <span>👥 ${ev.registrations || 0}${ev.max_participants ? '/' + ev.max_participants : ''} inscritos</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('btn-new-event').addEventListener('click', () => {
    Router.navigate('events', { action: 'new' });
  });

  // Carrega banners dos eventos
  for (const ev of events) {
    if (ev.image_path) {
      const dataUri = await avaliaAPI.eventsExt.getImage(ev.image_path);
      if (dataUri) {
        const el = document.getElementById(`evt-banner-${ev.id}`);
        if (el) {
          el.style.background = `url(${dataUri}) center/cover no-repeat`;
          el.innerHTML = '';
        }
      }
    }
  }
});

async function renderEventDetail(container, id) {
  const ev = await avaliaAPI.events.get(id);
  if (!ev) {
    container.innerHTML = '<div class="empty-state"><h3>Evento não encontrado</h3></div>';
    return;
  }

  let bannerHtml = '<div style="height:200px;background:linear-gradient(135deg,#e0eff9,#d0e5f5);display:flex;align-items:center;justify-content:center;border-radius:var(--radius-lg);margin-bottom:20px;"><span style="font-size:48px;">📅</span></div>';
  if (ev.image_path) {
    const dataUri = await avaliaAPI.eventsExt.getImage(ev.image_path);
    if (dataUri) {
      bannerHtml = `<div style="margin-bottom:20px;border-radius:var(--radius-lg);overflow:hidden;"><img src="${dataUri}" style="width:100%;max-height:300px;object-fit:cover;" alt="Banner"></div>`;
    }
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('events')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">${escapeHtml(ev.title)}</h1>
        <p class="page-subtitle">${formatDate(ev.date)} ${ev.time || ''} — ${escapeHtml(ev.location || '')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-edit-event">Editar</button>
        <button class="btn btn-danger" id="btn-delete-event">Excluir</button>
      </div>
    </div>

    ${bannerHtml}

    <div style="display:grid; grid-template-columns:2fr 1fr; gap:16px;">
      <div class="card">
        <div class="card-header"><div class="card-title">Descrição</div></div>
        <p style="white-space:pre-wrap; color:var(--text-secondary);">${escapeHtml(ev.description || 'Sem descrição')}</p>
        <div style="margin-top:16px; display:flex; gap:16px; font-size:13px; color:var(--text-muted);">
          <span>📍 ${escapeHtml(ev.location || '-')}</span>
          <span>🕐 ${ev.time || '-'}</span>
          <span>👥 ${ev.max_participants ? ev.max_participants + ' vagas máx.' : 'Sem limite'}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Registrar Participante</div></div>
        <form id="reg-participant-form">
          <div class="form-group"><label>Nome *</label><input class="form-control" name="nome" required></div>
          <div class="form-group"><label>E-mail</label><input type="email" class="form-control" name="email"></div>
          <div class="form-group"><label>Telefone</label><input class="form-control" name="telefone" placeholder="(00) 00000-0000"></div>
          <button type="submit" class="btn btn-primary btn-block">Inscrever</button>
        </form>
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div class="panel-header">Participantes (${(ev.participants || []).length})</div>
      <div class="panel-body">
        ${(ev.participants || []).length === 0
          ? '<div class="empty-state"><h3>Nenhum participante inscrito</h3></div>'
          : `<div class="table-container"><table>
            <thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Confirmado</th><th>Certificado</th><th>Ações</th></tr></thead>
            <tbody>
              ${(ev.participants || []).map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(p.nome)}</strong></td>
                  <td>${escapeHtml(p.email || '-')}</td>
                  <td>${escapeHtml(p.telefone || '-')}</td>
                  <td>${p.confirmed ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-neutral">Não</span>'}</td>
                  <td>${p.certificate_issued ? '<span class="badge badge-info">Emitido</span>' : '-'}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-sm btn-ghost evt-toggle" data-event="${id}" data-idx="${i}">
                        ${p.confirmed ? 'Desconfirmar' : 'Confirmar'}
                      </button>
                      ${p.confirmed ? `<button class="btn btn-sm btn-secondary evt-cert" data-event="${id}" data-idx="${i}" data-name="${escapeHtml(p.nome)}">Certificado PDF</button>` : ''}
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

  // Register participant
  document.getElementById('reg-participant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!data.nome) { Toast.show('warning', 'Nome é obrigatório'); return; }

    // Check max participants
    if (ev.max_participants && (ev.participants || []).length >= ev.max_participants) {
      Toast.show('warning', 'Evento lotado — vagas esgotadas');
      return;
    }

    try {
      await avaliaAPI.events.register(id, data);
      Toast.show('success', `${data.nome} inscrito(a) com sucesso`);
      renderEventDetail(container, id);
    } catch (err) {
      Toast.show('error', 'Erro: ' + err.message);
    }
  });

  document.getElementById('btn-delete-event').addEventListener('click', () => {
    Components.confirm('Excluir Evento', 'Tem certeza de que deseja excluir este evento? Esta ação não pode ser desfeita.', async () => {
      await avaliaAPI.events.delete(id);
      Toast.show('success', 'Evento excluído!');
      Router.navigate('events');
    });
  });

  document.getElementById('btn-edit-event').addEventListener('click', () => {
    renderEventForm(container, ev);
  });

  // Delegação para toggle confirmação e certificado
  container.addEventListener('click', async (e) => {
    const toggle = e.target.closest('.evt-toggle');
    if (toggle) {
      await avaliaAPI.events.toggleConfirm(parseInt(toggle.dataset.event), parseInt(toggle.dataset.idx));
      renderEventDetail(container, id);
    }
    const cert = e.target.closest('.evt-cert');
    if (cert) {
      const result = await avaliaAPI.reports.certificatePDF({
        participantName: cert.dataset.name,
        eventTitle: ev.title,
        eventDate: formatDate(ev.date)
      });
      if (result.success) Toast.show('success', 'Certificado gerado!');
    }
  });
}

async function renderEventForm(container, existing = null) {
  const isEdit = !!existing;
  let selectedImagePath = existing?.image_path || '';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('events')" style="margin-bottom:8px;">← Voltar</button>
        <h1 class="page-title">${isEdit ? 'Editar' : 'Novo'} Evento</h1>
      </div>
    </div>
    <form id="event-form">
      <div style="display:grid; grid-template-columns:2fr 1fr; gap:16px;">
        <div class="card">
          <div class="form-group"><label>Título *</label><input class="form-control" name="title" value="${escapeHtml(existing?.title || '')}" required></div>
          <div class="form-group"><label>Descrição</label><textarea class="form-control" name="description" rows="4">${escapeHtml(existing?.description || '')}</textarea></div>
          <div class="form-row three">
            <div class="form-group"><label>Data</label><input type="date" class="form-control" name="date" value="${existing?.date || ''}"></div>
            <div class="form-group"><label>Horário</label><input type="time" class="form-control" name="time" value="${existing?.time || ''}"></div>
            <div class="form-group"><label>Máx. Participantes</label><input type="number" class="form-control" name="maxParticipants" value="${existing?.max_participants || ''}"></div>
          </div>
          <div class="form-group"><label>Local</label><input class="form-control" name="location" value="${escapeHtml(existing?.location || '')}"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Banner / Imagem</div></div>
          <div id="banner-preview" style="height:180px;background:linear-gradient(135deg,#e0eff9,#d0e5f5);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;margin-bottom:12px;overflow:hidden;">
            <span style="font-size:36px;">📷</span>
          </div>
          <button type="button" class="btn btn-ghost btn-block" id="btn-select-banner">Selecionar Imagem</button>
          <div class="form-hint" style="margin-top:6px;">PNG, JPG, GIF ou WebP — até 5MB</div>
          <input type="hidden" name="imagePath" id="event-image-path" value="${escapeHtml(selectedImagePath)}">
        </div>
      </div>
      <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;">
        <button type="button" class="btn btn-ghost" onclick="Router.navigate('events')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Atualizar' : 'Criar'} Evento</button>
      </div>
    </form>
  `;

  // Load existing banner
  if (existing?.image_path) {
    const dataUri = await avaliaAPI.eventsExt.getImage(existing.image_path);
    if (dataUri) {
      const preview = document.getElementById('banner-preview');
      preview.style.background = `url(${dataUri}) center/cover no-repeat`;
      preview.innerHTML = '';
    }
  }

  // Select banner
  document.getElementById('btn-select-banner').addEventListener('click', async () => {
    const result = await avaliaAPI.eventsExt.selectImage();
    if (result.success) {
      selectedImagePath = result.path;
      document.getElementById('event-image-path').value = result.path;
      const dataUri = await avaliaAPI.eventsExt.getImage(result.path);
      if (dataUri) {
        const preview = document.getElementById('banner-preview');
        preview.style.background = `url(${dataUri}) center/cover no-repeat`;
        preview.innerHTML = '';
      }
      Toast.show('success', 'Imagem selecionada');
    }
  });

  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (data.maxParticipants) data.maxParticipants = parseInt(data.maxParticipants);
    data.imagePath = selectedImagePath;

    if (isEdit) {
      await avaliaAPI.events.update(existing.id, { ...data, image_path: selectedImagePath });
      Toast.show('success', 'Evento atualizado!');
      Router.navigate('events', { id: existing.id });
    } else {
      const result = await avaliaAPI.events.create({ ...data, image_path: selectedImagePath });
      Toast.show('success', 'Evento criado!');
      Router.navigate('events');
    }
  });
}
