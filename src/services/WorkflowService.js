// ============================================================
// WorkflowService — Fluxo de Fases e Alocação
// ============================================================
const PHASE = {
  INSCRICAO: 'inscricao',
  RECURSO_INSCRICAO: 'recurso_inscricao',
  PROJETO: 'projeto',
  RECURSO_PROJETO: 'recurso_projeto',
  ENTREVISTA: 'entrevista',
  RECURSO_ENTREVISTA: 'recurso_entrevista',
  LINGUA: 'lingua',
  RECURSO_LINGUA: 'recurso_lingua'
};

const STATUS = {
  APROVADO: 'aprovado',
  REPROVADO_PRELIMINAR: 'reprovado_preliminar',
  REPROVADO_DEFINITIVO: 'reprovado_definitivo',
  PENDENTE: 'pendente'
};

class WorkflowService {
  constructor(db) {
    this.db = db;
  }

  getCandidateStatus(protocol) {
    const phases = this.db.db.prepare(
      'SELECT * FROM candidate_phase_status WHERE submission_protocol = ? ORDER BY id'
    ).all(protocol);

    const submission = this.db.db.prepare('SELECT * FROM submissions WHERE protocol = ?').get(protocol);
    const appeals = this.db.db.prepare('SELECT * FROM appeals WHERE submission_protocol = ?').all(protocol);

    return { submission, phases, appeals };
  }

  advancePhase(protocol, phase, status) {
    this.db.db.prepare(`
      INSERT INTO candidate_phase_status (submission_protocol, phase, status)
      VALUES (?, ?, ?)
      ON CONFLICT(submission_protocol, phase) DO UPDATE SET status = excluded.status, updated_at = datetime('now')
    `).run(protocol, phase, status);
    this.db.audit(null, 'phase_advanced', 'workflow', protocol, { phase, status });
    return { success: true };
  }

  allocateVacancies(config) {
    const settings = this.db.getSettings();
    const projW = parseFloat(settings['evaluation.proj_weight'] || '4');
    const intW = parseFloat(settings['evaluation.int_weight'] || '5');
    const langW = parseFloat(settings['evaluation.lang_weight'] || '1');
    const totalW = projW + intW + langW;
    const minScore = parseFloat(settings['evaluation.min_score'] || '7.0');

    // Busca todos os candidatos com avaliações
    const candidates = this.db.db.prepare(`
      SELECT 
        s.protocol, s.nome, s.linha_pesquisa, s.status,
        s.cota_negro, s.cota_indigena, s.cota_quilombola, s.cota_cigano, s.cota_trans, s.cota_pcd,
        s.vaga_institucional, s.cooperacao_sdr,
        AVG(e.proj_media) as media_projeto,
        AVG(e.int_media) as media_entrevista,
        AVG(e.lang_media) as media_lingua
      FROM submissions s
      LEFT JOIN evaluations e ON s.protocol = e.submission_protocol AND e.status = 'concluida'
      WHERE s.status != 'Indeferida'
      GROUP BY s.protocol
    `).all();

    // Calcula nota final e verifica nota mínima
    const scored = candidates.map(c => {
      const mp = c.media_projeto || 0;
      const me = c.media_entrevista || 0;
      const ml = c.media_lingua || 0;
      const notaFinal = totalW > 0 ? (mp * projW + me * intW + ml * langW) / totalW : 0;
      const aprovadoNotas = mp >= minScore && me >= minScore && ml >= minScore;
      const temCota = !!(c.cota_negro || c.cota_indigena || c.cota_quilombola || c.cota_cigano || c.cota_trans || c.cota_pcd);
      return { ...c, notaFinal: +notaFinal.toFixed(2), aprovadoNotas, temCota };
    }).filter(c => c.aprovadoNotas);

    // Agrupa por linha
    const lines = {};
    for (const c of scored) {
      const line = c.linha_pesquisa || 'Geral';
      if (!lines[line]) lines[line] = [];
      lines[line].push(c);
    }

    // Ordena cada linha por nota final decrescente
    for (const line of Object.keys(lines)) {
      lines[line].sort((a, b) => b.notaFinal - a.notaFinal);
    }

    // Aplica vagas por linha
    const allocation = {};
    for (const [line, candidates] of Object.entries(lines)) {
      const lineConfig = config.lines?.[line] || { total: candidates.length, cota: 0, institucional: 0 };
      const totalVagas = lineConfig.total;
      const vagasCota = lineConfig.cota;
      const vagasInstitucional = lineConfig.institucional;
      const vagasAmpla = totalVagas - vagasCota - vagasInstitucional;

      const allocated = [];
      const cotistas = candidates.filter(c => c.temCota);
      const institucional = candidates.filter(c => c.vaga_institucional);
      const ampla = candidates.filter(c => !c.temCota && !c.vaga_institucional);

      // Aloca cotistas
      allocated.push(...cotistas.slice(0, vagasCota).map(c => ({ ...c, tipoVaga: 'Cota' })));
      // Aloca institucional
      allocated.push(...institucional.slice(0, vagasInstitucional).map(c => ({ ...c, tipoVaga: 'Institucional' })));
      // Aloca ampla concorrência
      allocated.push(...ampla.slice(0, vagasAmpla).map(c => ({ ...c, tipoVaga: 'Ampla Concorrência' })));

      // Completa vagas não preenchidas de cota/institucional com ampla
      const remaining = totalVagas - allocated.length;
      if (remaining > 0) {
        const allRemaining = candidates.filter(c => !allocated.find(a => a.protocol === c.protocol));
        allocated.push(...allRemaining.slice(0, remaining).map(c => ({ ...c, tipoVaga: 'Remanejamento' })));
      }

      allocation[line] = allocated;
    }

    return { success: true, allocation, config: { projW, intW, langW, minScore } };
  }
}

module.exports = WorkflowService;
module.exports.PHASE = PHASE;
module.exports.STATUS = STATUS;
