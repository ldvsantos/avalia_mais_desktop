// ============================================================
// EventService — Gestão de Eventos e Cursos
// ============================================================
class EventService {
  constructor(db) {
    this.db = db;
  }

  create(data) {
    const result = this.db.db.prepare(`
      INSERT INTO events (title, description, date, time, location, max_participants, image_path, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(data.title, data.description, data.date, data.time, data.location, data.maxParticipants || null, data.imagePath || null);
    this.db.audit(null, 'event_created', 'event', result.lastInsertRowid, { title: data.title });
    return { success: true, id: result.lastInsertRowid };
  }

  list() {
    const events = this.db.db.prepare('SELECT * FROM events ORDER BY date DESC').all();
    return events.map(e => ({
      ...e,
      registrations: this.db.db.prepare('SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?').get(e.id).c
    }));
  }

  get(id) {
    const event = this.db.db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) return null;
    event.participants = this.db.db.prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at').all(id);
    return event;
  }

  update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['title', 'description', 'date', 'time', 'location', 'max_participants', 'image_path', 'active'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return { success: false };
    fields.push("updated_at = datetime('now')");
    values.push(id);
    this.db.db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  }

  delete(id) {
    this.db.db.prepare('DELETE FROM events WHERE id = ?').run(id);
    return { success: true };
  }

  registerParticipant(eventId, participant) {
    this.db.db.prepare(`
      INSERT INTO event_registrations (event_id, nome, cpf_hash, email, telefone)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventId, participant.nome, participant.cpfHash || null, participant.email, participant.telefone);
    return { success: true };
  }

  toggleConfirmation(eventId, participantIndex) {
    const participants = this.db.db.prepare(
      'SELECT id, confirmed FROM event_registrations WHERE event_id = ? ORDER BY created_at'
    ).all(eventId);
    if (participantIndex < 0 || participantIndex >= participants.length) return { success: false };
    const p = participants[participantIndex];
    this.db.db.prepare('UPDATE event_registrations SET confirmed = ? WHERE id = ?').run(p.confirmed ? 0 : 1, p.id);
    return { success: true };
  }

  getStats() {
    const total = this.db.db.prepare('SELECT COUNT(*) as c FROM events').get().c;
    const active = this.db.db.prepare('SELECT COUNT(*) as c FROM events WHERE active = 1').get().c;
    const totalRegistrations = this.db.db.prepare('SELECT COUNT(*) as c FROM event_registrations').get().c;
    return { total, active, totalRegistrations };
  }
}

module.exports = EventService;
