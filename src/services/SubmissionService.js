// ============================================================
// SubmissionService — Gestão de Inscrições
// ============================================================
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class SubmissionService {
  constructor(db) {
    this.db = db;
  }

  _generateProtocol() {
    const now = new Date();
    const y = now.getFullYear();
    const seq = this.db.db.prepare('SELECT COUNT(*) as c FROM submissions WHERE year = ?').get(y).c + 1;
    return `${y}-${String(seq).padStart(5, '0')}`;
  }

  _hashData(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  _cpfHash(cpf) {
    const clean = String(cpf).replace(/\D/g, '');
    return crypto.createHash('sha256').update(clean).digest('hex');
  }

  create(data) {
    const protocol = this._generateProtocol();
    const hash = this._hashData({ ...data, protocol, timestamp: Date.now() });
    const cpfClean = String(data.cpf || '').replace(/\D/g, '');
    const cpfH = this._cpfHash(data.cpf);
    const cpfLast4 = cpfClean.slice(-4);
    const year = new Date().getFullYear();

    this.db.db.prepare(`
      INSERT INTO submissions (
        protocol, hash, year, status, nome, nome_social, cpf_hash, cpf_last4,
        data_nascimento, rg, orgao_emissor, email, telefone,
        endereco, cidade, estado, cep,
        curso_graduacao, instituicao, ano_conclusao,
        vaga_institucional, cooperacao_sdr,
        cota_negro, cota_indigena, cota_quilombola, cota_cigano, cota_trans, cota_pcd,
        titulo_pt, titulo_en, linha_pesquisa, palavras_chave,
        resumo, justificativa, introducao, problema, objetivos,
        revisao_literatura, metodologia, cronograma, referencias
      ) VALUES (
        ?, ?, ?, 'Recebida', ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      protocol, hash, year, data.nome, data.nomeSocial || null, cpfH, cpfLast4,
      data.dataNascimento, data.rg, data.orgaoEmissor, data.email, data.telefone,
      data.endereco, data.cidade, data.estado, data.cep,
      data.cursoGraduacao, data.instituicao, data.anoConclusao,
      data.vagaInstitucional ? 1 : 0, data.cooperacaoSdr ? 1 : 0,
      data.cotaNegro ? 1 : 0, data.cotaIndigena ? 1 : 0, data.cotaQuilombola ? 1 : 0,
      data.cotaCigano ? 1 : 0, data.cotaTrans ? 1 : 0, data.cotaPcd ? 1 : 0,
      data.tituloPt, data.tituloEn, data.linhaPesquisa, data.palavrasChave,
      data.resumo, data.justificativa, data.introducao, data.problema, data.objetivos,
      data.revisaoLiteratura, data.metodologia, data.cronograma, data.referencias
    );

    this.db.audit(null, 'submission_created', 'submission', protocol, { nome: data.nome });
    return { success: true, protocol, hash };
  }

  list(filters = {}) {
    let sql = 'SELECT * FROM submissions WHERE 1=1';
    const params = [];

    if (filters.year) { sql += ' AND year = ?'; params.push(filters.year); }
    if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters.linhaPesquisa) { sql += ' AND linha_pesquisa = ?'; params.push(filters.linhaPesquisa); }

    sql += ' ORDER BY created_at DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }

    return this.db.db.prepare(sql).all(...params);
  }

  getByProtocol(protocol) {
    return this.db.db.prepare('SELECT * FROM submissions WHERE protocol = ?').get(protocol);
  }

  update(protocol, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'nome', 'nome_social', 'email', 'telefone', 'status',
      'titulo_pt', 'titulo_en', 'linha_pesquisa', 'palavras_chave',
      'resumo', 'justificativa', 'introducao', 'problema', 'objetivos',
      'revisao_literatura', 'metodologia', 'cronograma', 'referencias'
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return { success: false, error: 'Nenhum campo para atualizar' };

    fields.push("updated_at = datetime('now')");
    values.push(protocol);
    this.db.db.prepare(`UPDATE submissions SET ${fields.join(', ')} WHERE protocol = ?`).run(...values);
    this.db.audit(null, 'submission_updated', 'submission', protocol, data);
    return { success: true };
  }

  updateStatus(protocol, status) {
    this.db.db.prepare("UPDATE submissions SET status = ?, updated_at = datetime('now') WHERE protocol = ?").run(status, protocol);
    this.db.audit(null, 'submission_status_changed', 'submission', protocol, { status });
    return { success: true };
  }

  delete(protocol) {
    this.db.db.prepare('DELETE FROM submissions WHERE protocol = ?').run(protocol);
    this.db.audit(null, 'submission_deleted', 'submission', protocol, null);
    return { success: true };
  }

  search(query) {
    const q = `%${query}%`;
    return this.db.db.prepare(
      'SELECT * FROM submissions WHERE nome LIKE ? OR protocol LIKE ? OR email LIKE ? OR titulo_pt LIKE ? ORDER BY created_at DESC LIMIT 50'
    ).all(q, q, q, q);
  }

  lookup(protocol, cpf) {
    const cpfH = crypto.createHash('sha256').update(String(cpf).replace(/\D/g, '')).digest('hex');
    return this.db.db.prepare('SELECT * FROM submissions WHERE protocol = ? AND cpf_hash = ?').get(protocol, cpfH);
  }

  exportCSV() {
    const rows = this.db.db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(';')];
    for (const row of rows) {
      lines.push(headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';'));
    }
    return lines.join('\n');
  }

  getStats() {
    const total = this.db.db.prepare('SELECT COUNT(*) as c FROM submissions').get().c;
    const byStatus = this.db.db.prepare('SELECT status, COUNT(*) as c FROM submissions GROUP BY status').all();
    const byLine = this.db.db.prepare('SELECT linha_pesquisa, COUNT(*) as c FROM submissions GROUP BY linha_pesquisa').all();
    return { total, byStatus, byLine };
  }
}

module.exports = SubmissionService;
