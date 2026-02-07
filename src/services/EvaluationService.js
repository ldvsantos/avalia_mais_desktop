// ============================================================
// EvaluationService — Gestão de Avaliações
// ============================================================
class EvaluationService {
  constructor(db) {
    this.db = db;
  }

  submit(data) {
    const existing = this.db.db.prepare(
      'SELECT id FROM evaluations WHERE submission_protocol = ? AND evaluator_id = ? AND phase = ?'
    ).get(data.submissionProtocol, data.evaluatorId, data.phase);

    if (existing) {
      // Atualiza avaliação existente
      this._updateEvaluation(existing.id, data);
      return { success: true, id: existing.id, updated: true };
    }

    // Calcula médias
    const medias = this._calcMedias(data);

    const result = this.db.db.prepare(`
      INSERT INTO evaluations (
        submission_protocol, evaluator_id, evaluator_line, evaluator_num, phase,
        proj_introducao, proj_problema, proj_justificativa, proj_objetivos,
        proj_revisao, proj_metodos, proj_cronograma, proj_referencias, proj_media, proj_parecer,
        int_apresentacao, int_historico, int_defesa, int_justificativa, int_media, int_parecer,
        lang_clareza, lang_dominio, lang_analise, lang_media, lang_parecer,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concluida')
    `).run(
      data.submissionProtocol, data.evaluatorId, data.evaluatorLine, data.evaluatorNum, data.phase,
      data.projIntroducao, data.projProblema, data.projJustificativa, data.projObjetivos,
      data.projRevisao, data.projMetodos, data.projCronograma, data.projReferencias,
      medias.projMedia, data.projParecer,
      data.intApresentacao, data.intHistorico, data.intDefesa, data.intJustificativa,
      medias.intMedia, data.intParecer,
      data.langClareza, data.langDominio, data.langAnalise, medias.langMedia, data.langParecer
    );

    this.db.audit(data.evaluatorId, 'evaluation_submitted', 'evaluation', result.lastInsertRowid, {
      protocol: data.submissionProtocol, phase: data.phase
    });

    return { success: true, id: result.lastInsertRowid };
  }

  _updateEvaluation(id, data) {
    const medias = this._calcMedias(data);
    this.db.db.prepare(`
      UPDATE evaluations SET
        proj_introducao = ?, proj_problema = ?, proj_justificativa = ?, proj_objetivos = ?,
        proj_revisao = ?, proj_metodos = ?, proj_cronograma = ?, proj_referencias = ?, proj_media = ?, proj_parecer = ?,
        int_apresentacao = ?, int_historico = ?, int_defesa = ?, int_justificativa = ?, int_media = ?, int_parecer = ?,
        lang_clareza = ?, lang_dominio = ?, lang_analise = ?, lang_media = ?, lang_parecer = ?,
        status = 'concluida', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.projIntroducao, data.projProblema, data.projJustificativa, data.projObjetivos,
      data.projRevisao, data.projMetodos, data.projCronograma, data.projReferencias,
      medias.projMedia, data.projParecer,
      data.intApresentacao, data.intHistorico, data.intDefesa, data.intJustificativa,
      medias.intMedia, data.intParecer,
      data.langClareza, data.langDominio, data.langAnalise, medias.langMedia, data.langParecer,
      id
    );
  }

  _calcMedias(data) {
    const avg = (...vals) => {
      const valid = vals.filter(v => v != null && !isNaN(v));
      return valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : null;
    };

    return {
      projMedia: avg(data.projIntroducao, data.projProblema, data.projJustificativa,
        data.projObjetivos, data.projRevisao, data.projMetodos, data.projCronograma, data.projReferencias),
      intMedia: avg(data.intApresentacao, data.intHistorico, data.intDefesa, data.intJustificativa),
      langMedia: (() => {
        const c = data.langClareza, d = data.langDominio, a = data.langAnalise;
        if (c == null && d == null && a == null) return null;
        return +((c || 0) * 0.3 + (d || 0) * 0.4 + (a || 0) * 0.3).toFixed(2);
      })()
    };
  }

  list(filters = {}) {
    let sql = 'SELECT e.*, s.nome as candidato_nome, s.titulo_pt FROM evaluations e LEFT JOIN submissions s ON e.submission_protocol = s.protocol WHERE 1=1';
    const params = [];

    if (filters.protocol) { sql += ' AND e.submission_protocol = ?'; params.push(filters.protocol); }
    if (filters.evaluatorId) { sql += ' AND e.evaluator_id = ?'; params.push(filters.evaluatorId); }
    if (filters.phase) { sql += ' AND e.phase = ?'; params.push(filters.phase); }
    if (filters.line) { sql += ' AND e.evaluator_line = ?'; params.push(filters.line); }

    sql += ' ORDER BY e.created_at DESC';
    return this.db.db.prepare(sql).all(...params);
  }

  get(protocol, evaluatorId) {
    return this.db.db.prepare(
      'SELECT * FROM evaluations WHERE submission_protocol = ? AND evaluator_id = ?'
    ).get(protocol, evaluatorId);
  }

  getResults(filters = {}) {
    // Resultados consolidados com média ponderada final
    const settings = this.db.getSettings();
    const projW = parseFloat(settings['evaluation.proj_weight'] || '4');
    const intW = parseFloat(settings['evaluation.int_weight'] || '5');
    const langW = parseFloat(settings['evaluation.lang_weight'] || '1');
    const totalW = projW + intW + langW;

    let sql = `
      SELECT 
        s.protocol, s.nome, s.linha_pesquisa, s.status,
        s.cota_negro, s.cota_indigena, s.cota_quilombola, s.cota_cigano, s.cota_trans, s.cota_pcd,
        s.vaga_institucional, s.cooperacao_sdr,
        AVG(e.proj_media) as media_projeto,
        AVG(e.int_media) as media_entrevista,
        AVG(e.lang_media) as media_lingua
      FROM submissions s
      LEFT JOIN evaluations e ON s.protocol = e.submission_protocol AND e.status = 'concluida'
      WHERE 1=1
    `;
    const params = [];
    if (filters.year) { sql += ' AND s.year = ?'; params.push(filters.year); }
    if (filters.line) { sql += ' AND s.linha_pesquisa = ?'; params.push(filters.line); }

    sql += ' GROUP BY s.protocol ORDER BY s.nome';
    const rows = this.db.db.prepare(sql).all(...params);

    return rows.map(r => {
      const mp = r.media_projeto || 0;
      const me = r.media_entrevista || 0;
      const ml = r.media_lingua || 0;
      const notaFinal = totalW > 0 ? +((mp * projW + me * intW + ml * langW) / totalW).toFixed(2) : 0;
      return {
        ...r,
        media_projeto: mp ? +mp.toFixed(2) : null,
        media_entrevista: me ? +me.toFixed(2) : null,
        media_lingua: ml ? +ml.toFixed(2) : null,
        nota_final: notaFinal,
        tem_cota: !!(r.cota_negro || r.cota_indigena || r.cota_quilombola || r.cota_cigano || r.cota_trans || r.cota_pcd)
      };
    });
  }

  getStats() {
    const total = this.db.db.prepare('SELECT COUNT(*) as c FROM evaluations').get().c;
    const concluidas = this.db.db.prepare("SELECT COUNT(*) as c FROM evaluations WHERE status = 'concluida'").get().c;
    const pendentes = total - concluidas;
    return { total, concluidas, pendentes };
  }
}

module.exports = EvaluationService;
