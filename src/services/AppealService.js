// ============================================================
// AppealService — Gestão de Recursos
// ============================================================
const crypto = require('crypto');

class AppealService {
  constructor(db) {
    this.db = db;
  }

  create(data) {
    const protocol = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const cpfH = data.cpf ? crypto.createHash('sha256').update(String(data.cpf).replace(/\D/g, '')).digest('hex') : null;

    this.db.db.prepare(`
      INSERT INTO appeals (protocol, submission_protocol, nome, cpf_hash, email, etapa, decisao_contestacao, argumentacao, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Recebido')
    `).run(protocol, data.submissionProtocol, data.nome, cpfH, data.email, data.etapa, data.decisaoContestacao, data.argumentacao);

    this.db.audit(null, 'appeal_created', 'appeal', protocol, { etapa: data.etapa });
    return { success: true, protocol };
  }

  list(filters = {}) {
    let sql = 'SELECT a.*, s.nome as candidato_nome FROM appeals a LEFT JOIN submissions s ON a.submission_protocol = s.protocol WHERE 1=1';
    const params = [];
    if (filters.status) { sql += ' AND a.status = ?'; params.push(filters.status); }
    if (filters.etapa) { sql += ' AND a.etapa = ?'; params.push(filters.etapa); }
    if (filters.submissionProtocol) { sql += ' AND a.submission_protocol = ?'; params.push(filters.submissionProtocol); }
    sql += ' ORDER BY a.created_at DESC';
    return this.db.db.prepare(sql).all(...params);
  }

  updateStatus(protocol, status, motivo) {
    this.db.db.prepare(
      "UPDATE appeals SET status = ?, motivo_decisao = ?, updated_at = datetime('now') WHERE protocol = ?"
    ).run(status, motivo || null, protocol);
    this.db.audit(null, 'appeal_status_changed', 'appeal', protocol, { status, motivo });
    return { success: true };
  }

  getStats() {
    const total = this.db.db.prepare('SELECT COUNT(*) as c FROM appeals').get().c;
    const byStatus = this.db.db.prepare('SELECT status, COUNT(*) as c FROM appeals GROUP BY status').all();
    return { total, byStatus };
  }
}

module.exports = AppealService;
