// ============================================================
// Avalia+ Desktop — Banco de Dados SQLite
// ============================================================
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

class Database {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'avalia.db');
    this.db = null;
  }

  initialize() {
    this.db = new BetterSqlite3(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._createTables();
    this._seedDefaults();
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  _createTables() {
    this.db.exec(`
      -- Usuários do sistema (admin, avaliadores)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        display_name TEXT,
        email TEXT,
        line TEXT,
        evaluator_num INTEGER,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Configurações do sistema
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Inscrições
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol TEXT UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        status TEXT DEFAULT 'Recebida',
        year INTEGER,
        -- Dados pessoais
        nome TEXT NOT NULL,
        nome_social TEXT,
        cpf_hash TEXT NOT NULL,
        cpf_last4 TEXT,
        data_nascimento TEXT,
        rg TEXT,
        orgao_emissor TEXT,
        email TEXT,
        telefone TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        -- Formação
        curso_graduacao TEXT,
        instituicao TEXT,
        ano_conclusao TEXT,
        -- Vagas especiais
        vaga_institucional INTEGER DEFAULT 0,
        cooperacao_sdr INTEGER DEFAULT 0,
        cota_negro INTEGER DEFAULT 0,
        cota_indigena INTEGER DEFAULT 0,
        cota_quilombola INTEGER DEFAULT 0,
        cota_cigano INTEGER DEFAULT 0,
        cota_trans INTEGER DEFAULT 0,
        cota_pcd INTEGER DEFAULT 0,
        -- Projeto
        titulo_pt TEXT,
        titulo_en TEXT,
        linha_pesquisa TEXT,
        palavras_chave TEXT,
        -- Anteprojeto (avaliação cega)
        resumo TEXT,
        justificativa TEXT,
        introducao TEXT,
        problema TEXT,
        objetivos TEXT,
        revisao_literatura TEXT,
        metodologia TEXT,
        cronograma TEXT,
        referencias TEXT,
        -- Metadados
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Avaliações
      CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_protocol TEXT NOT NULL,
        evaluator_id INTEGER,
        evaluator_line TEXT,
        evaluator_num INTEGER,
        phase TEXT NOT NULL,
        -- Notas Projeto
        proj_introducao REAL,
        proj_problema REAL,
        proj_justificativa REAL,
        proj_objetivos REAL,
        proj_revisao REAL,
        proj_metodos REAL,
        proj_cronograma REAL,
        proj_referencias REAL,
        proj_media REAL,
        proj_parecer TEXT,
        -- Notas Entrevista
        int_apresentacao REAL,
        int_historico REAL,
        int_defesa REAL,
        int_justificativa REAL,
        int_media REAL,
        int_parecer TEXT,
        -- Notas Língua Estrangeira
        lang_clareza REAL,
        lang_dominio REAL,
        lang_analise REAL,
        lang_media REAL,
        lang_parecer TEXT,
        -- Meta
        status TEXT DEFAULT 'pendente',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (submission_protocol) REFERENCES submissions(protocol)
      );

      -- Recursos
      CREATE TABLE IF NOT EXISTS appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol TEXT UNIQUE NOT NULL,
        submission_protocol TEXT NOT NULL,
        nome TEXT,
        cpf_hash TEXT,
        email TEXT,
        etapa TEXT NOT NULL,
        decisao_contestacao TEXT,
        argumentacao TEXT NOT NULL,
        status TEXT DEFAULT 'Recebido',
        motivo_decisao TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (submission_protocol) REFERENCES submissions(protocol)
      );

      -- Status por fase do candidato
      CREATE TABLE IF NOT EXISTS candidate_phase_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_protocol TEXT NOT NULL,
        phase TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(submission_protocol, phase),
        FOREIGN KEY (submission_protocol) REFERENCES submissions(protocol)
      );

      -- Eventos e Cursos
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT,
        time TEXT,
        location TEXT,
        max_participants INTEGER,
        image_path TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Inscrições em Eventos
      CREATE TABLE IF NOT EXISTS event_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        cpf_hash TEXT,
        email TEXT,
        telefone TEXT,
        confirmed INTEGER DEFAULT 0,
        certificate_issued INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      -- Calendário do Processo
      CREATE TABLE IF NOT EXISTS process_calendar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        phase TEXT NOT NULL,
        label TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        active INTEGER DEFAULT 1
      );

      -- Documentos Públicos
      CREATE TABLE IF NOT EXISTS public_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT,
        category TEXT,
        description TEXT,
        file_data BLOB,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- FAQ
      CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1
      );

      -- Log de Auditoria
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Alocação de Vagas
      CREATE TABLE IF NOT EXISTS vacancy_allocation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        line TEXT NOT NULL,
        total_vagas INTEGER DEFAULT 0,
        vagas_cota INTEGER DEFAULT 0,
        vagas_institucional INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  _seedDefaults() {
    // Insere configurações padrão se não existirem
    const defaults = {
      'app.name': 'Avalia+ Desktop',
      'app.institution': 'Universidade',
      'app.year': new Date().getFullYear().toString(),
      'registration.open': '0',
      'registration.start_date': '',
      'registration.end_date': '',
      'evaluation.proj_weight': '4',
      'evaluation.int_weight': '5',
      'evaluation.lang_weight': '1',
      'evaluation.min_score': '7.0',
      'lines': JSON.stringify(['Linha 1', 'Linha 2']),
      'theme': 'dark'
    };

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    );
    const insertMany = this.db.transaction((entries) => {
      for (const [key, value] of entries) {
        stmt.run(key, value);
      }
    });
    insertMany(Object.entries(defaults));
  }

  // ---- Generic Helpers ----
  getSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    return obj;
  }

  updateSettings(settings) {
    const stmt = this.db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    );
    const updateMany = this.db.transaction((entries) => {
      for (const [key, value] of entries) {
        stmt.run(key, String(value));
      }
    });
    updateMany(Object.entries(settings));
    return this.getSettings();
  }

  audit(userId, action, entityType, entityId, details) {
    this.db.prepare(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, action, entityType, entityId, typeof details === 'string' ? details : JSON.stringify(details));
  }
}

module.exports = Database;
