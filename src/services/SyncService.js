// ============================================================
// SyncService — Sincronização bidirecional Desktop ↔ Web
// Usa a API JSON em /secret/{ADMIN_SECRET}/api/sync/*
// ============================================================
const https = require('https');
const http = require('http');

class SyncService {
  constructor(db) {
    this.db = db;
    this.syncing = false;
    this.lastSync = null;
    this.syncInterval = null;
    this._log = []; // log das últimas operações
  }

  // ── Configuração padrão do servidor ────────────────────────
  // Estas constantes são usadas quando não há config salva no banco.
  // Produção = https://avaliamais.tec.br  |  Local = http://localhost:3000
  static DEFAULTS = {
    serverUrl: 'http://localhost:3000',
    adminSecret: '4a98a736-811d-447a-bfb3-6f4c2bc0dbc7',
    adminUser: 'diego',
    adminPass: 'u9u-WNJ1w5Nw7pTQ_GGQkLLu-qdN0X8JF4Xz9HPIyfo',
    intervalMinutes: 5
  };

  // ── Configuração ──────────────────────────────────────────
  getConfig() {
    const settings = this.db.getSettings();
    return {
      serverUrl: settings['sync.server_url'] || SyncService.DEFAULTS.serverUrl,
      adminSecret: settings['sync.admin_secret'] || SyncService.DEFAULTS.adminSecret,
      authToken: settings['sync.auth_token'] || '',
      autoSync: settings['sync.auto_sync'] !== '0',   // habilitado por padrão
      intervalMinutes: parseInt(settings['sync.interval_minutes'] || String(SyncService.DEFAULTS.intervalMinutes), 10),
      enabled: settings['sync.enabled'] !== '0'        // habilitado por padrão
    };
  }

  /**
   * Configura automaticamente a sincronização com os valores padrão.
   * Chamado apenas uma vez no primeiro boot. Se já existir config, não sobrescreve.
   */
  autoSetup() {
    // Sempre sincroniza config com os DEFAULTS (garante URL e secret atualizados)
    this.db.updateSettings({
      'sync.server_url': SyncService.DEFAULTS.serverUrl,
      'sync.admin_secret': SyncService.DEFAULTS.adminSecret,
      'sync.auto_sync': '1',
      'sync.interval_minutes': String(SyncService.DEFAULTS.intervalMinutes),
      'sync.enabled': '1'
    });
    this._addLog('info', 'Sync configurado para ' + SyncService.DEFAULTS.serverUrl);
  }

  /**
   * Autentica automaticamente com credenciais padrão e faz o primeiro pull.
   * Chamado após o login do usuário no desktop.
   */
  async autoLoginAndPull() {
    try {
      const config = this.getConfig();

      // 1. Se já tem token, tenta pull direto
      if (config.authToken) {
        this._addLog('info', 'Token existente — tentando pull...');
        try {
          const result = await this.pullAll();
          if (result.success) return result;
        } catch (_) { /* ignora */ }
        // Token inválido/expirado — limpa e re-autentica
        this._addLog('info', 'Token expirado — limpando e re-autenticando...');
        this.db.updateSettings({ 'sync.auth_token': '' });
      }

      // 2. Autentica com credenciais padrão
      await this.authenticate(
        SyncService.DEFAULTS.adminUser,
        SyncService.DEFAULTS.adminPass
      );

      // 3. Pull completo com o novo token
      return await this.pullAll();
    } catch (err) {
      this._addLog('err', 'Auto-sync falhou: ' + err.message);
      return { success: false, error: err.message };
    }
  }

  _addLog(type, msg) {
    this._log.push({ type, msg, ts: new Date().toISOString() });
    if (this._log.length > 200) this._log.shift();
  }

  // ── HTTP client ───────────────────────────────────────────
  _request(method, path, body = null) {
    const config = this.getConfig();
    if (!config.serverUrl) throw new Error('URL do servidor não configurada');

    return new Promise((resolve, reject) => {
      const fullUrl = config.serverUrl.replace(/\/+$/, '') + path;
      const url = new URL(fullUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AvaliaDesktop/2.0'
        },
        rejectUnauthorized: false,
        timeout: 60000
      };

      if (config.authToken) {
        options.headers['Authorization'] = `Bearer ${config.authToken}`;
      }

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data ? JSON.parse(data) : {});
            } else if (res.statusCode === 401) {
              // Extrai mensagem real do servidor, se disponível
              let serverMsg = 'Autenticação falhou';
              try {
                const body = JSON.parse(data);
                serverMsg = body.error || body.message || serverMsg;
              } catch (_) {}
              const err = new Error(serverMsg);
              err.statusCode = 401;
              reject(err);
            } else if (res.statusCode === 403) {
              reject(new Error('Acesso negado (IP não autorizado ou secret incorreto)'));
            } else {
              let serverMsg = `HTTP ${res.statusCode}`;
              try {
                const body = JSON.parse(data);
                serverMsg += ': ' + (body.error || body.message || data.substring(0, 200));
              } catch (_) { serverMsg += ': ' + data.substring(0, 200); }
              reject(new Error(serverMsg));
            }
          } catch (e) {
            reject(new Error(`Erro de parse: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Conexão falhou: ${e.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout — servidor demorou para responder')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ── Autenticação ──────────────────────────────────────────
  async authenticate(username, password) {
    const config = this.getConfig();
    if (!config.serverUrl || !config.adminSecret) {
      throw new Error('URL do servidor e Admin Secret são obrigatórios');
    }

    const loginUrl = `/secret/${config.adminSecret}/login`;
    const result = await this._request('POST', loginUrl, { username, password });

    if (result.token) {
      this.db.updateSettings({
        'sync.auth_token': result.token,
        'sync.enabled': '1'
      });
      this._addLog('ok', 'Autenticado com sucesso');
      return { success: true, token: result.token };
    }
    throw new Error('Token não recebido — verifique credenciais');
  }

  // ── Teste de conexão ─────────────────────────────────────
  async testConnection() {
    try {
      const config = this.getConfig();
      if (!config.serverUrl) return { success: false, error: 'URL não configurada' };

      // Tenta rota pública primeiro
      const result = await this._request('GET', '/api/registration-window');
      this._addLog('ok', 'Conexão OK — servidor respondeu');
      return { success: true, data: result };
    } catch (err) {
      this._addLog('err', 'Conexão falhou: ' + err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Teste de autenticação ─────────────────────────────────
  async testAuth() {
    try {
      const config = this.getConfig();
      if (!config.authToken) return { success: false, error: 'Não autenticado' };

      const result = await this._request('GET', `/secret/${config.adminSecret}/auth-status`);
      return { success: result.authenticated === true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ================================================================
  // PULL COMPLETO — Baixa TODOS os dados do servidor via /api/sync/full
  // ================================================================
  async pullAll() {
    if (this.syncing) return { success: false, error: 'Sincronização já em andamento' };
    this.syncing = true;
    this._addLog('info', 'Iniciando sincronização completa...');

    const results = {
      submissions: 0, evaluations: 0, appeals: 0,
      events: 0, calendar: 0, faq: 0, files: 0,
      evaluators: 0, phaseStatus: 0, settings: 0, errors: []
    };

    try {
      const config = this.getConfig();
      if (!config.serverUrl) throw new Error('URL do servidor não configurada');
      if (!config.adminSecret) throw new Error('Admin Secret não configurado');
      if (!config.authToken) throw new Error('Não autenticado — faça login primeiro');

      // Usa o endpoint /api/sync/full que retorna TUDO de uma vez
      this._addLog('info', 'Buscando dados do servidor...');
      const syncPath = `/secret/${config.adminSecret}/api/sync/full`;
      const fullData = await this._request('GET', syncPath);

      if (!fullData || !fullData.timestamp) {
        throw new Error('Resposta inválida do servidor');
      }

      this._addLog('ok', `Dados recebidos — ${new Date(fullData.timestamp).toLocaleString('pt-BR')}`);

      // 1. Configurações
      try {
        const updates = {};
        if (fullData.activeEditalYear) updates['app.year'] = String(fullData.activeEditalYear);
        if (fullData.registrationWindow) {
          const rw = fullData.registrationWindow;
          updates['registration.open'] = rw.isOpen ? '1' : '0';
          if (rw.startISO) updates['registration.start_date'] = rw.startISO.split('T')[0];
          if (rw.endISO) updates['registration.end_date'] = rw.endISO.split('T')[0];
        }
        if (Object.keys(updates).length > 0) {
          this.db.updateSettings(updates);
          results.settings = Object.keys(updates).length;
        }
        this._addLog('ok', `Configurações: ${results.settings} atualizadas`);
      } catch (e) { results.errors.push('Config: ' + e.message); this._addLog('err', 'Config: ' + e.message); }

      // 2. Inscrições (submissions)
      try {
        if (Array.isArray(fullData.submissions) && fullData.submissions.length > 0) {
          results.submissions = this._upsertSubmissions(fullData.submissions);
          this._addLog('ok', `Inscrições: ${results.submissions} sincronizadas`);
        }
      } catch (e) { results.errors.push('Submissions: ' + e.message); this._addLog('err', 'Submissions: ' + e.message); }

      // 3. Avaliações (evaluations)
      try {
        if (Array.isArray(fullData.evaluations) && fullData.evaluations.length > 0) {
          results.evaluations = this._upsertEvaluations(fullData.evaluations);
          this._addLog('ok', `Avaliações: ${results.evaluations} sincronizadas`);
        }
      } catch (e) { results.errors.push('Evaluations: ' + e.message); this._addLog('err', 'Evaluations: ' + e.message); }

      // 4. Recursos (appeals)
      try {
        if (Array.isArray(fullData.appeals) && fullData.appeals.length > 0) {
          results.appeals = this._upsertAppeals(fullData.appeals);
          this._addLog('ok', `Recursos: ${results.appeals} sincronizados`);
        }
      } catch (e) { results.errors.push('Appeals: ' + e.message); this._addLog('err', 'Appeals: ' + e.message); }

      // 5. Eventos
      try {
        if (Array.isArray(fullData.events) && fullData.events.length > 0) {
          results.events = this._upsertEvents(fullData.events);
          this._addLog('ok', `Eventos: ${results.events} sincronizados`);
        }
      } catch (e) { results.errors.push('Events: ' + e.message); this._addLog('err', 'Events: ' + e.message); }

      // 6. Calendário
      try {
        if (fullData.calendar) {
          results.calendar = this._upsertCalendar(fullData.calendar, fullData.activeEditalYear);
          this._addLog('ok', `Calendário: ${results.calendar} fases`);
        }
      } catch (e) { results.errors.push('Calendar: ' + e.message); this._addLog('err', 'Calendar: ' + e.message); }

      // 7. FAQ
      try {
        if (fullData.faq) {
          results.faq = this._upsertFAQ(fullData.faq);
          this._addLog('ok', `FAQ: ${results.faq} itens`);
        }
      } catch (e) { results.errors.push('FAQ: ' + e.message); this._addLog('err', 'FAQ: ' + e.message); }

      // 8. Arquivos públicos
      try {
        if (Array.isArray(fullData.publicFiles)) {
          results.files = this._upsertPublicFiles(fullData.publicFiles);
          this._addLog('ok', `Publicações: ${results.files} arquivos`);
        }
      } catch (e) { results.errors.push('PublicFiles: ' + e.message); this._addLog('err', 'Files: ' + e.message); }

      // 9. Avaliadores (evaluators → users)
      try {
        if (Array.isArray(fullData.evaluators) && fullData.evaluators.length > 0) {
          results.evaluators = this._upsertEvaluators(fullData.evaluators);
          this._addLog('ok', `Avaliadores: ${results.evaluators} sincronizados`);
        } else if (fullData.evaluators && typeof fullData.evaluators === 'object') {
          results.evaluators = this._upsertEvaluators(fullData.evaluators);
          this._addLog('ok', `Avaliadores: ${results.evaluators} sincronizados`);
        }
      } catch (e) { results.errors.push('Evaluators: ' + e.message); this._addLog('err', 'Evaluators: ' + e.message); }

      // 10. Phase Status (status do candidato por fase)
      try {
        if (Array.isArray(fullData.phaseStatus) && fullData.phaseStatus.length > 0) {
          results.phaseStatus = this._upsertPhaseStatus(fullData.phaseStatus);
          this._addLog('ok', `Status de fases: ${results.phaseStatus} sincronizados`);
        }
      } catch (e) { results.errors.push('PhaseStatus: ' + e.message); this._addLog('err', 'PhaseStatus: ' + e.message); }

      this.lastSync = new Date().toISOString();
      this.db.updateSettings({ 'sync.last_sync': this.lastSync });

      const total = results.submissions + results.evaluations + results.appeals +
        results.events + results.calendar + results.faq + results.files + results.evaluators +
        (results.phaseStatus || 0);
      this._addLog('ok', `✅ Sincronização concluída — ${total} registros atualizados`);

      return { success: true, results };
    } catch (err) {
      results.errors.push(err.message);
      this._addLog('err', '❌ Falha: ' + err.message);
      return { success: false, results, error: err.message };
    } finally {
      this.syncing = false;
    }
  }

  // ================================================================
  // PUSH — Envia dados do desktop para o servidor web
  // ================================================================
  async pushSubmission(submissionData) {
    const result = await this._request('POST', '/api/submissions', submissionData);
    this._addLog('ok', 'Inscrição enviada ao servidor');
    return result;
  }

  async pushAppeal(appealData) {
    const result = await this._request('POST', '/api/appeals', appealData);
    this._addLog('ok', 'Recurso enviado ao servidor');
    return result;
  }

  // ================================================================
  // UPSERT helpers — importa dados do web para o SQLite local
  // ================================================================

  _upsertSubmissions(submissions) {
    let count = 0;
    // Garante coluna 'data' (JSON completo do servidor)
    try { this.db.db.exec(`ALTER TABLE submissions ADD COLUMN data TEXT`); } catch (_) {}

    const upsert = this.db.db.prepare(`
      INSERT INTO submissions (protocol, hash, nome, cpf_hash, cpf_last4, email, status, linha_pesquisa,
        titulo_pt, titulo_en, nome_social, data_nascimento, rg, orgao_emissor,
        endereco, cidade, estado, cep, telefone,
        curso_graduacao, instituicao, ano_conclusao,
        vaga_institucional, cota_pcd,
        resumo, justificativa, palavras_chave,
        created_at, data)
      VALUES (@protocol, @hash, @nome, @cpf_hash, @cpf_last4, @email, @status, @linha_pesquisa,
        @titulo_pt, @titulo_en, @nome_social, @data_nascimento, @rg, @orgao_emissor,
        @endereco, @cidade, @estado, @cep, @telefone,
        @curso_graduacao, @instituicao, @ano_conclusao,
        @vaga_institucional, @cota_pcd,
        @resumo, @justificativa, @palavras_chave,
        @created_at, @data)
      ON CONFLICT(protocol) DO UPDATE SET
        nome = excluded.nome, email = excluded.email,
        status = excluded.status, linha_pesquisa = excluded.linha_pesquisa,
        titulo_pt = excluded.titulo_pt, titulo_en = excluded.titulo_en,
        data = excluded.data, updated_at = datetime('now')
    `);

    const crypto = require('crypto');
    const tx = this.db.db.transaction((subs) => {
      for (const s of subs) {
        try {
          const protocol = s.protocol || s.protocolo || '';
          if (!protocol) continue;

          // Dados pessoais estão dentro de s.identified {}
          const id = s.identified || {};
          // Dados do projeto estão dentro de s.project {}
          const proj = s.project || s.blind || {};

          const nome = id.nome || s.nome || 'Sem nome';
          const cpfRaw = id.cpf || s.cpf || '';
          const cpfClean = cpfRaw.replace(/\D/g, '');
          const cpfHash = s.cpfHash || (cpfClean ? crypto.createHash('sha256').update(cpfClean).digest('hex') : '');
          const cpfLast4 = s.cpfLast4 || (cpfClean.length >= 4 ? cpfClean.slice(-4) : '');

          upsert.run({
            protocol,
            hash: s.hash || crypto.createHash('sha256').update(protocol).digest('hex'),
            nome,
            cpf_hash: cpfHash,
            cpf_last4: cpfLast4,
            email: id.email || s.email || '',
            status: s.status || 'Recebido',
            linha_pesquisa: proj.area || id.linha_pesquisa || s.linha_pesquisa || '',
            titulo_pt: proj.titulo_pt || s.titulo_pt || '',
            titulo_en: proj.titulo_en || s.titulo_en || '',
            nome_social: id.nome_social || '',
            data_nascimento: id.data_nascimento || '',
            rg: id.rg || '',
            orgao_emissor: id.orgao_expedidor || id.orgao_emissor || '',
            endereco: id.endereco || '',
            cidade: id.cidade_estado ? id.cidade_estado.split('/')[0].trim() : '',
            estado: id.cidade_estado ? (id.cidade_estado.split('/')[1] || '').trim() : '',
            cep: id.cep || '',
            telefone: id.celular || id.telefone_residencial || '',
            curso_graduacao: id.curso_graduacao || '',
            instituicao: id.instituicao || '',
            ano_conclusao: id.ano_conclusao || '',
            vaga_institucional: id.vaga_institucional ? 1 : 0,
            cota_pcd: (id.cotas && id.cotas.includes && id.cotas.includes('pcd')) ? 1 : 0,
            resumo: proj.resumo || '',
            justificativa: proj.justificativa_relevancia || proj.justificativa_enquadramento || '',
            palavras_chave: (proj.palavras_pt || '') + (proj.palavras_en ? ' | ' + proj.palavras_en : ''),
            created_at: s.createdAt || s.created_at || s.timestamp || new Date().toISOString(),
            data: JSON.stringify(s)
          });
          count++;
        } catch (e) { /* skip individual errors */ }
      }
    });

    tx(submissions);
    return count;
  }

  _upsertEvaluations(evaluations) {
    let count = 0;
    // Garante coluna 'data'
    try { this.db.db.exec(`ALTER TABLE evaluations ADD COLUMN data TEXT`); } catch (_) {}

    // O formato web pode ser:
    //   { protocol, projectScores: { proj_avaliador1_proj_intro: 8, ... }, interviewScores: {...}, ... }
    // Ou array com objetos por avaliador. Precisamos decompor em linhas por avaliador.
    const insert = this.db.db.prepare(`
      INSERT INTO evaluations (submission_protocol, evaluator_line, evaluator_num, phase,
        proj_introducao, proj_problema, proj_justificativa, proj_objetivos, proj_revisao,
        proj_metodos, proj_cronograma, proj_referencias, proj_media, proj_parecer,
        int_apresentacao, int_historico, int_defesa, int_justificativa, int_media, int_parecer,
        lang_clareza, lang_dominio, lang_analise, lang_media, lang_parecer,
        status, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.db.transaction((evals) => {
      for (const e of evals) {
        try {
          const protocol = e.protocol || e.submissionProtocol || e.submission_protocol || '';
          if (!protocol) continue;

          // Se tem projectScores, decompomos por avaliador
          if (e.projectScores || e.interviewScores || e.languageScores) {
            // Descobre avaliadores únicos a partir das chaves: proj_avaliador1_*, int_avaliador2_*, etc.
            const allScores = { ...e.projectScores, ...e.interviewScores, ...e.languageScores };
            const evaluators = new Set();
            for (const key of Object.keys(allScores)) {
              const m = key.match(/^(?:proj|int|lang)_(avaliador\d+)/);
              if (m) evaluators.add(m[1]);
            }

            for (const avKey of evaluators) {
              const num = parseInt(avKey.replace('avaliador', '')) || 0;

              // Verifica se já existe
              const existing = this.db.db.prepare(
                'SELECT id FROM evaluations WHERE submission_protocol = ? AND evaluator_num = ?'
              ).get(protocol, num);

              const ps = e.projectScores || {};
              const is_ = e.interviewScores || {};
              const ls = e.languageScores || {};

              const pIntro = parseFloat(ps[`proj_${avKey}_proj_intro`] || ps[`proj_${avKey}_introducao`] || 0);
              const pProblema = parseFloat(ps[`proj_${avKey}_proj_problema`] || ps[`proj_${avKey}_problema`] || 0);
              const pJust = parseFloat(ps[`proj_${avKey}_proj_justificativa`] || ps[`proj_${avKey}_justificativa`] || 0);
              const pObj = parseFloat(ps[`proj_${avKey}_proj_objetivos`] || ps[`proj_${avKey}_objetivos`] || 0);
              const pRev = parseFloat(ps[`proj_${avKey}_proj_revisao`] || ps[`proj_${avKey}_revisao`] || 0);
              const pMet = parseFloat(ps[`proj_${avKey}_proj_metodos`] || ps[`proj_${avKey}_metodos`] || 0);
              const pCron = parseFloat(ps[`proj_${avKey}_proj_cronograma`] || ps[`proj_${avKey}_cronograma`] || 0);
              const pRef = parseFloat(ps[`proj_${avKey}_proj_referencias`] || ps[`proj_${avKey}_referencias`] || 0);
              const pMedia = (pIntro + pProblema + pJust + pObj + pRev + pMet + pCron + pRef) / 8;
              const pParecer = ps[`proj_${avKey}_parecer`] || '';

              const iApres = parseFloat(is_[`int_${avKey}_apresentacao`] || 0);
              const iHist = parseFloat(is_[`int_${avKey}_historico`] || 0);
              const iDefesa = parseFloat(is_[`int_${avKey}_defesa`] || 0);
              const iJust = parseFloat(is_[`int_${avKey}_justificativa`] || 0);
              const iMedia = (iApres + iHist + iDefesa + iJust) / 4;
              const iParecer = is_[`int_${avKey}_parecer`] || '';

              const lClar = parseFloat(ls[`lang_${avKey}_clareza`] || 0);
              const lDom = parseFloat(ls[`lang_${avKey}_dominio`] || 0);
              const lAnal = parseFloat(ls[`lang_${avKey}_analise`] || 0);
              const lMedia = (lClar + lDom + lAnal) / 3;
              const lParecer = ls[`lang_${avKey}_parecer`] || '';

              if (existing) {
                this.db.db.prepare(`UPDATE evaluations SET
                  proj_introducao=?, proj_problema=?, proj_justificativa=?, proj_objetivos=?,
                  proj_revisao=?, proj_metodos=?, proj_cronograma=?, proj_referencias=?,
                  proj_media=?, proj_parecer=?,
                  int_apresentacao=?, int_historico=?, int_defesa=?, int_justificativa=?,
                  int_media=?, int_parecer=?,
                  lang_clareza=?, lang_dominio=?, lang_analise=?, lang_media=?, lang_parecer=?,
                  status=?, data=?, updated_at=datetime('now') WHERE id=?`)
                  .run(pIntro, pProblema, pJust, pObj, pRev, pMet, pCron, pRef, pMedia, pParecer,
                    iApres, iHist, iDefesa, iJust, iMedia, iParecer,
                    lClar, lDom, lAnal, lMedia, lParecer,
                    e.eliminado ? 'eliminado' : 'concluida', JSON.stringify(e), existing.id);
              } else {
                insert.run(protocol, '', num, 'completa',
                  pIntro, pProblema, pJust, pObj, pRev, pMet, pCron, pRef, pMedia, pParecer,
                  iApres, iHist, iDefesa, iJust, iMedia, iParecer,
                  lClar, lDom, lAnal, lMedia, lParecer,
                  e.eliminado ? 'eliminado' : 'concluida',
                  e.updatedAt || e.createdAt || new Date().toISOString(), JSON.stringify(e));
              }
              count++;
            }
          } else {
            // Formato alternativo: campos planos (já tratado)
            const line = e.line || e.evaluator_line || e.linha || '';
            const num = parseInt(e.num || e.evaluator_num || e.evaluatorNum || 0);
            const phase = e.phase || e.etapa || e.type || 'projeto';

            const existing = this.db.db.prepare(
              'SELECT id FROM evaluations WHERE submission_protocol = ? AND evaluator_num = ? AND phase = ?'
            ).get(protocol, num, phase);

            if (!existing) {
              insert.run(protocol, line, num, phase,
                parseFloat(e.proj_introducao || 0), parseFloat(e.proj_problema || 0),
                parseFloat(e.proj_justificativa || 0), parseFloat(e.proj_objetivos || 0),
                parseFloat(e.proj_revisao || 0), parseFloat(e.proj_metodos || 0),
                parseFloat(e.proj_cronograma || 0), parseFloat(e.proj_referencias || 0),
                parseFloat(e.proj_media || 0), e.proj_parecer || '',
                parseFloat(e.int_apresentacao || 0), parseFloat(e.int_historico || 0),
                parseFloat(e.int_defesa || 0), parseFloat(e.int_justificativa || 0),
                parseFloat(e.int_media || 0), e.int_parecer || '',
                parseFloat(e.lang_clareza || 0), parseFloat(e.lang_dominio || 0),
                parseFloat(e.lang_analise || 0), parseFloat(e.lang_media || 0),
                e.lang_parecer || '', e.status || 'concluida',
                e.created_at || e.createdAt || new Date().toISOString(), JSON.stringify(e));
            }
            count++;
          }
        } catch (err) { /* skip */ }
      }
    });

    tx(evaluations);
    return count;
  }

  _upsertAppeals(appeals) {
    let count = 0;
    // Adiciona coluna 'data' se não existir
    try {
      this.db.db.exec(`ALTER TABLE appeals ADD COLUMN data TEXT`);
    } catch (_) { /* já existe */ }

    const crypto = require('crypto');
    const upsert = this.db.db.prepare(`
      INSERT INTO appeals (protocol, submission_protocol, nome, cpf_hash, email, etapa, status,
        argumentacao, decisao_contestacao, motivo_decisao, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(protocol) DO UPDATE SET
        status = excluded.status, motivo_decisao = excluded.motivo_decisao,
        data = excluded.data, updated_at = datetime('now')
    `);

    const tx = this.db.db.transaction((items) => {
      for (const a of items) {
        try {
          const protocol = a.protocol || a.protocolo || '';
          if (!protocol) continue;

          const cpf = a.cpf || '';
          const cpfHash = cpf ? crypto.createHash('sha256').update(cpf.replace(/\D/g, '')).digest('hex') : '';

          upsert.run(
            protocol,
            a.submissionProtocol || a.submission_protocol || '',
            a.nome || a.candidato_nome || '',
            cpfHash,
            a.email || '',
            a.etapa || '',
            a.status || 'Recebido',
            a.argumentacao || '',
            a.decisao_contestacao || a.decisaoContestacao || '',
            a.motivo_decisao || a.motivoDecisao || '',
            a.created_at || a.createdAt || new Date().toISOString(),
            JSON.stringify(a)
          );
          count++;
        } catch (err) { /* skip */ }
      }
    });

    tx(appeals);
    return count;
  }

  _upsertEvents(events) {
    let count = 0;
    // Garante colunas extras para dados do web
    try { this.db.db.exec(`ALTER TABLE events ADD COLUMN data TEXT`); } catch (_) {}

    for (const ev of events) {
      try {
        const title = ev.title || ev.titulo || '';
        if (!title) continue;

        const existing = this.db.db.prepare(
          'SELECT id FROM events WHERE title = ? AND date = ?'
        ).get(title, ev.date || '');

        if (existing) {
          this.db.db.prepare(`UPDATE events SET description = ?, time = ?, location = ?,
            max_participants = ?, active = ?, image_path = ?, data = ?, updated_at = datetime('now')
            WHERE id = ?`)
            .run(
              ev.description || '', ev.workload || '',
              ev.location || ev.local || '',
              ev.maxParticipants || ev.max_participants || 0,
              (ev.status === 'open' || ev.active) ? 1 : 0,
              ev.imageFilename || ev.image_path || '',
              JSON.stringify(ev),
              existing.id
            );
        } else {
          this.db.db.prepare(`INSERT INTO events (title, description, date, time, location,
            max_participants, active, image_path, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(
              title, ev.description || '', ev.date || '',
              ev.workload || '', ev.location || ev.local || '',
              ev.maxParticipants || ev.max_participants || 0,
              (ev.status === 'open' || ev.active) ? 1 : 0,
              ev.imageFilename || ev.image_path || '',
              JSON.stringify(ev)
            );
        }

        // Sincroniza registros de participantes
        if (Array.isArray(ev.registrations) && ev.registrations.length > 0) {
          const eventRow = this.db.db.prepare('SELECT id FROM events WHERE title = ? AND date = ?')
            .get(title, ev.date || '');
          if (eventRow) {
            const crypto = require('crypto');
            for (const reg of ev.registrations) {
              const cpfHash = reg.cpf ? crypto.createHash('sha256').update(reg.cpf.replace(/\D/g, '')).digest('hex') : '';
              const exists = this.db.db.prepare(
                'SELECT id FROM event_registrations WHERE event_id = ? AND cpf_hash = ?'
              ).get(eventRow.id, cpfHash);
              if (!exists && cpfHash) {
                this.db.db.prepare(`INSERT INTO event_registrations (event_id, nome, cpf_hash, email, telefone, confirmed)
                  VALUES (?, ?, ?, ?, ?, ?)`)
                  .run(eventRow.id, reg.nome || reg.name || '', cpfHash,
                    reg.email || '', reg.telefone || reg.phone || '', reg.confirmed ? 1 : 0);
              }
            }
          }
        }
        count++;
      } catch (err) { /* skip */ }
    }
    return count;
  }

  _upsertCalendar(calendar, year) {
    let count = 0;
    const yr = year || calendar.year || new Date().getFullYear();

    // Formato web: { year, global: {...}, phases: { INSCRICAO: {startISO, endISO, label}, ... } }
    const phases = calendar.phases || calendar;

    let phaseList = [];
    if (Array.isArray(phases)) {
      phaseList = phases;
    } else if (typeof phases === 'object') {
      phaseList = Object.entries(phases).map(([key, val]) => ({
        phase: key,
        label: val.label || key,
        start: val.startISO || val.start || '',
        end: val.endISO || val.end || ''
      }));
    }

    for (const phase of phaseList) {
      try {
        const phaseName = phase.phase || phase.name || phase.key || '';
        if (!phaseName) continue;

        const startDate = (phase.start || '').split('T')[0]; // Remove time part
        const endDate = (phase.end || '').split('T')[0];

        const existing = this.db.db.prepare(
          'SELECT id FROM process_calendar WHERE year = ? AND phase = ?'
        ).get(yr, phaseName);

        if (existing) {
          this.db.db.prepare(`UPDATE process_calendar SET label = ?, start_date = ?,
            end_date = ?, active = 1 WHERE id = ?`)
            .run(phase.label || phaseName, startDate, endDate, existing.id);
        } else {
          this.db.db.prepare(`INSERT INTO process_calendar (year, phase, label, start_date,
            end_date, active) VALUES (?, ?, ?, ?, ?, 1)`)
            .run(yr, phaseName, phase.label || phaseName, startDate, endDate);
        }
        count++;
      } catch (err) { /* skip */ }
    }
    return count;
  }

  _upsertFAQ(faq) {
    let count = 0;

    // FAQ do web tem formato: { updatedAt, sections: [{ id, title, items: [{question, answer}] }] }
    // Ou pode ser string HTML (v3), ou array plano
    if (typeof faq === 'string') {
      this.db.db.prepare('DELETE FROM faq').run();
      this.db.db.prepare('INSERT INTO faq (section, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)')
        .run('general', 'FAQ', faq, 0);
      return 1;
    }

    // Formato com sections (objeto)
    if (faq && faq.sections && Array.isArray(faq.sections)) {
      this.db.db.prepare('DELETE FROM faq').run();
      const insert = this.db.db.prepare(
        'INSERT INTO faq (section, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)');
      let order = 0;
      for (const section of faq.sections) {
        const sectionName = section.title || section.id || 'general';
        if (Array.isArray(section.items)) {
          for (const item of section.items) {
            insert.run(sectionName, item.question || item.pergunta || '',
              item.answer || item.resposta || '', order++);
            count++;
          }
        }
      }
      return count;
    }

    // Array plano fallback
    if (Array.isArray(faq)) {
      this.db.db.prepare('DELETE FROM faq').run();
      const insert = this.db.db.prepare(
        'INSERT INTO faq (section, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)');
      for (let i = 0; i < faq.length; i++) {
        const item = faq[i];
        insert.run(item.section || item.secao || 'general', item.question || item.pergunta || '',
          item.answer || item.resposta || '', i);
        count++;
      }
    }
    return count;
  }

  _upsertPublicFiles(files) {
    let count = 0;
    for (const file of files) {
      try {
        const name = file.title || file.originalName || file.name || file.filename || '';
        if (!name) continue;

        const existing = this.db.db.prepare('SELECT id FROM public_files WHERE original_name = ?').get(name);
        if (!existing) {
          this.db.db.prepare(`INSERT INTO public_files (filename, original_name, category, description)
            VALUES (?, ?, ?, ?)`)
            .run(file.filename || file.storedName || '', name,
              file.category || file.categoria || 'resultado', file.description || file.descricao || '');
          count++;
        }
      } catch (err) { /* skip */ }
    }
    return count;
  }

  _upsertEvaluators(evaluators) {
    let count = 0;
    // O formato web é array de: { username, password, line, num }
    // Ou pode ser objeto mapa { "diego": { pass, line, num } }
    let evalList = evaluators;
    if (!Array.isArray(evaluators) && typeof evaluators === 'object') {
      evalList = Object.entries(evaluators).map(([key, val]) => ({
        username: key, password: val.pass || val.password || '', line: val.line || '', num: val.num || ''
      }));
    }

    for (const ev of evalList) {
      try {
        const username = ev.username || ev.id || '';
        if (!username) continue;

        const existing = this.db.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (!existing) {
          // Cria o avaliador como usuário no desktop (senha importada para permitir login)
          const bcrypt = require('bcryptjs');
          const passHash = ev.password ? bcrypt.hashSync(ev.password, 10) : 'sync-imported';
          this.db.db.prepare(`INSERT INTO users (username, password_hash, role, display_name, email,
            line, evaluator_num, active) VALUES (?, ?, 'evaluator', ?, ?, ?, ?, 1)`)
            .run(username, passHash, ev.name || username,
              ev.email || '', ev.line || ev.linha || '', parseInt(ev.num || ev.evaluatorNum || 0));
          count++;
        } else {
          // Atualiza line/num se mudou
          this.db.db.prepare(`UPDATE users SET line = ?, evaluator_num = ? WHERE id = ?`)
            .run(ev.line || '', parseInt(ev.num || 0), existing.id);
        }
      } catch (err) { /* skip */ }
    }
    return count;
  }

  _upsertPhaseStatus(statuses) {
    let count = 0;
    // Formato web: [{year, submissionProtocol, phaseKey, status, score, updatedAt, meta}]
    // Tabela desktop: candidate_phase_status(submission_protocol, phase, status, score, ...)
    for (const ps of statuses) {
      try {
        const protocol = ps.submissionProtocol || ps.submission_protocol || '';
        const phase = ps.phaseKey || ps.phase || '';
        if (!protocol || !phase) continue;

        const existing = this.db.db.prepare(
          'SELECT id FROM candidate_phase_status WHERE submission_protocol = ? AND phase = ?'
        ).get(protocol, phase);

        if (existing) {
          this.db.db.prepare(`UPDATE candidate_phase_status SET status = ?, score = ?,
            updated_at = datetime('now') WHERE id = ?`)
            .run(ps.status || '', ps.score || null, existing.id);
        } else {
          this.db.db.prepare(`INSERT INTO candidate_phase_status (submission_protocol, phase,
            status, score) VALUES (?, ?, ?, ?)`)
            .run(protocol, phase, ps.status || '', ps.score || null);
        }
        count++;
      } catch (err) { /* skip */ }
    }
    return count;
  }

  // ── Auto-sync ─────────────────────────────────────────────
  startAutoSync(intervalMinutes = 5) {
    this.stopAutoSync();
    const interval = Math.max(1, intervalMinutes) * 60 * 1000;
    this._addLog('info', `Auto-sync ativado — intervalo de ${intervalMinutes} min`);

    // Faz sync imediato na primeira vez
    this.pullAll().catch(err => console.error('[SyncService] sync inicial:', err));

    this.syncInterval = setInterval(() => {
      this.pullAll().catch(err => console.error('[SyncService] auto-sync:', err));
    }, interval);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this._addLog('info', 'Auto-sync desativado');
    }
  }

  getStatus() {
    return {
      syncing: this.syncing,
      lastSync: this.lastSync || this.db.getSettings()['sync.last_sync'] || null,
      autoSyncActive: !!this.syncInterval,
      config: this.getConfig(),
      log: this._log.slice(-50)
    };
  }
}

module.exports = SyncService;
