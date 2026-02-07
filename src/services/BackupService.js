// ============================================================
// BackupService — Backup e Restauração
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupService {
  constructor(db, dataDir) {
    this.db = db;
    this.dataDir = dataDir;
    this.backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
  }

  create() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupName);

    // Usa backup da API do SQLite (cópia consistente)
    this.db.db.backup(backupPath).then(() => {
      // Backup feito
    }).catch(() => {
      // Fallback: cópia direta
      const dbPath = path.join(this.dataDir, 'avalia.db');
      fs.copyFileSync(dbPath, backupPath);
    });

    // Garantia com cópia síncrona
    const dbPath = path.join(this.dataDir, 'avalia.db');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    return backupPath;
  }

  restore(sourcePath) {
    if (!fs.existsSync(sourcePath)) throw new Error('Arquivo de backup não encontrado');

    const dbPath = path.join(this.dataDir, 'avalia.db');
    
    // Fecha o banco atual
    this.db.close();

    // Faz backup do banco atual antes de restaurar
    const safetyBackup = path.join(this.backupDir, `pre_restore_${Date.now()}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, safetyBackup);
    }

    // Copia o backup para o local do banco
    fs.copyFileSync(sourcePath, dbPath);

    // Reinicializa
    this.db.initialize();
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(this.backupDir, f),
        size: fs.statSync(path.join(this.backupDir, f)).size,
        created: fs.statSync(path.join(this.backupDir, f)).birthtime
      }))
      .sort((a, b) => b.created - a.created);
  }
}

module.exports = BackupService;
