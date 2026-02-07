// ============================================================
// PublicFileService — Gerenciamento de Documentos Públicos
// ============================================================
const fs = require('fs');
const path = require('path');

class PublicFileService {
  constructor(db) {
    this.db = db;
  }

  list() {
    return this.db.db.prepare(
      'SELECT id, filename, original_name, category, description, created_at FROM public_files ORDER BY created_at DESC'
    ).all();
  }

  create({ filename, originalName, category, description, fileData }) {
    const result = this.db.db.prepare(
      `INSERT INTO public_files (filename, original_name, category, description, file_data)
       VALUES (?, ?, ?, ?, ?)`
    ).run(filename || '', originalName || '', category || 'resultado', description || '', fileData || null);
    this.db.audit(null, 'create', 'public_file', result.lastInsertRowid, `Upload: ${originalName}`);
    return { success: true, id: result.lastInsertRowid };
  }

  get(id) {
    return this.db.db.prepare('SELECT * FROM public_files WHERE id = ?').get(id);
  }

  delete(id) {
    this.db.db.prepare('DELETE FROM public_files WHERE id = ?').run(id);
    this.db.audit(null, 'delete', 'public_file', id, 'Deleted');
    return { success: true };
  }

  // Importa um arquivo do sistema de arquivos
  importFile(filePath, category, description) {
    const fileBuffer = fs.readFileSync(filePath);
    const originalName = path.basename(filePath);
    const filename = `${Date.now()}_${originalName}`;
    return this.create({ filename, originalName, category, description, fileData: fileBuffer });
  }
}

module.exports = PublicFileService;
