// ============================================================
// FaqService — Gerenciamento de Perguntas Frequentes
// ============================================================
class FaqService {
  constructor(db) {
    this.db = db;
  }

  list() {
    return this.db.db.prepare(
      'SELECT * FROM faq WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    ).all();
  }

  listAll() {
    return this.db.db.prepare('SELECT * FROM faq ORDER BY sort_order ASC, id ASC').all();
  }

  create({ section, question, answer, sortOrder }) {
    const result = this.db.db.prepare(
      'INSERT INTO faq (section, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)'
    ).run(section || 'general', question || '', answer || '', sortOrder || 0);
    return { success: true, id: result.lastInsertRowid };
  }

  update(id, { section, question, answer, sortOrder, active }) {
    const fields = [];
    const values = [];
    if (section !== undefined) { fields.push('section = ?'); values.push(section); }
    if (question !== undefined) { fields.push('question = ?'); values.push(question); }
    if (answer !== undefined) { fields.push('answer = ?'); values.push(answer); }
    if (sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(sortOrder); }
    if (active !== undefined) { fields.push('active = ?'); values.push(active ? 1 : 0); }
    if (fields.length === 0) return { success: false };
    values.push(id);
    this.db.db.prepare(`UPDATE faq SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  }

  delete(id) {
    this.db.db.prepare('DELETE FROM faq WHERE id = ?').run(id);
    return { success: true };
  }

  // Salva FAQ completo de uma vez (substitui tudo)
  saveAll(items) {
    const txn = this.db.db.transaction(() => {
      this.db.db.prepare('DELETE FROM faq').run();
      const ins = this.db.db.prepare(
        'INSERT INTO faq (section, question, answer, sort_order, active) VALUES (?, ?, ?, ?, 1)'
      );
      items.forEach((item, i) => {
        ins.run(item.section || 'general', item.question || '', item.answer || '', i);
      });
    });
    txn();
    return { success: true };
  }
}

module.exports = FaqService;
