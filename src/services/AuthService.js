// ============================================================
// AuthService — Autenticação local
// ============================================================
const bcrypt = require('bcryptjs');

class AuthService {
  constructor(db) {
    this.db = db;
    this.currentUser = null;
  }

  ensureDefaultAdmin() {
    const existing = this.db.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!existing) {
      const hash = bcrypt.hashSync('admin', 10);
      this.db.db.prepare(
        'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
      ).run('admin', hash, 'admin', 'Administrador');
    }
  }

  login(username, password) {
    const user = this.db.db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user) return { success: false, error: 'Usuário não encontrado' };
    if (!bcrypt.compareSync(password, user.password_hash)) {
      this.db.audit(null, 'login_failed', 'user', username, 'Senha incorreta');
      return { success: false, error: 'Senha incorreta' };
    }
    this.currentUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      line: user.line,
      evaluatorNum: user.evaluator_num
    };
    this.db.audit(user.id, 'login_success', 'user', user.id, null);
    return { success: true, user: this.currentUser };
  }

  logout() {
    this.currentUser = null;
    return { success: true };
  }

  getCurrentUser() {
    return this.currentUser;
  }

  changePassword(userId, oldPassword, newPassword) {
    const user = this.db.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return { success: false, error: 'Usuário não encontrado' };
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return { success: false, error: 'Senha atual incorreta' };
    }
    const newHash = bcrypt.hashSync(newPassword, 10);
    this.db.db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newHash, userId);
    this.db.audit(userId, 'password_changed', 'user', userId, null);
    return { success: true };
  }

  createUser({ username, password, role, displayName, email, line, evaluatorNum }) {
    const hash = bcrypt.hashSync(password, 10);
    const result = this.db.db.prepare(
      'INSERT INTO users (username, password_hash, role, display_name, email, line, evaluator_num) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(username, hash, role || 'evaluator', displayName, email, line, evaluatorNum);
    return { success: true, id: result.lastInsertRowid };
  }

  listUsers() {
    return this.db.db.prepare('SELECT id, username, role, display_name, email, line, evaluator_num, active, created_at FROM users').all();
  }

  toggleUserActive(userId) {
    this.db.db.prepare('UPDATE users SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(userId);
    return { success: true };
  }
}

module.exports = AuthService;
