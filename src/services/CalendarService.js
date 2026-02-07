// ============================================================
// CalendarService — Gerenciamento do Calendário do Processo
// ============================================================
class CalendarService {
  constructor(db) {
    this.db = db;
  }

  list(year) {
    const y = year || this.db.getSettings()['app.year'] || new Date().getFullYear();
    return this.db.db.prepare(
      'SELECT * FROM process_calendar WHERE year = ? ORDER BY start_date ASC'
    ).all(y);
  }

  upsert(year, phases) {
    const del = this.db.db.prepare('DELETE FROM process_calendar WHERE year = ?');
    const ins = this.db.db.prepare(
      'INSERT INTO process_calendar (year, phase, label, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const txn = this.db.db.transaction(() => {
      del.run(year);
      for (const p of phases) {
        ins.run(year, p.phase, p.label || p.phase, p.start_date || '', p.end_date || '', p.active !== false ? 1 : 0);
      }
    });
    txn();
    return { success: true };
  }

  getOpenAppealPhases() {
    const now = new Date().toISOString();
    return this.db.db.prepare(
      `SELECT * FROM process_calendar 
       WHERE phase LIKE '%recurso%' AND active = 1 
       AND start_date <= ? AND end_date >= ?
       ORDER BY start_date`
    ).all(now, now);
  }
}

module.exports = CalendarService;
