// ============================================================
// Avalia+ Desktop — Main Process (Electron)
// ============================================================
const { app, BrowserWindow, ipcMain, Menu, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// Garante que o diretório de dados do app exista
const USER_DATA = app.getPath('userData');
const DATA_DIR = path.join(USER_DATA, 'avalia_data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Banco de dados
const Database = require('../database/database');
const db = new Database(DATA_DIR);

// Serviços
const AuthService = require('../services/AuthService');
const SubmissionService = require('../services/SubmissionService');
const EvaluationService = require('../services/EvaluationService');
const AppealService = require('../services/AppealService');
const EventService = require('../services/EventService');
const ReportService = require('../services/ReportService');
const BackupService = require('../services/BackupService');
const WorkflowService = require('../services/WorkflowService');
const SyncService = require('../services/SyncService');
const CalendarService = require('../services/CalendarService');
const PublicFileService = require('../services/PublicFileService');
const FaqService = require('../services/FaqService');

let mainWindow = null;
let authService, submissionService, evaluationService, appealService, eventService, reportService, backupService, workflowService, syncService, calendarService, publicFileService, faqService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Avalia+ Desktop',
    icon: path.join(__dirname, '../../assets/icon.png'),
    frame: false,           // Janela sem frame nativo — visual de software
    titleBarStyle: 'hidden',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initServices() {
  authService = new AuthService(db);
  submissionService = new SubmissionService(db);
  evaluationService = new EvaluationService(db);
  appealService = new AppealService(db);
  eventService = new EventService(db);
  reportService = new ReportService(db);
  backupService = new BackupService(db, DATA_DIR);
  workflowService = new WorkflowService(db);
  syncService = new SyncService(db);
  calendarService = new CalendarService(db);
  publicFileService = new PublicFileService(db);
  faqService = new FaqService(db);

  // Cria admin padrão se não existir
  authService.ensureDefaultAdmin();

  // Auto-configura sync com valores padrão (servidor, secret, credenciais)
  syncService.autoSetup();

  // Inicia auto-sync (habilitado por padrão)
  const syncConfig = syncService.getConfig();
  if (syncConfig.enabled && syncConfig.autoSync) {
    syncService.startAutoSync(syncConfig.intervalMinutes);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Backup dos Dados', click: () => mainWindow.webContents.send('nav:backup') },
        { label: 'Restaurar Backup', click: () => handleRestoreBackup() },
        { type: 'separator' },
        { label: 'Configurações', click: () => mainWindow.webContents.send('nav:settings') },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'DevTools' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { role: 'resetZoom', label: 'Zoom Padrão' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Sobre o Avalia+', click: () => showAbout() },
        { label: 'Documentação', click: () => shell.openExternal('https://avaliamais.tec.br') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Sobre o Avalia+ Desktop',
    message: 'Avalia+ Desktop v1.2.0',
    detail: 'Sistema de Gestão de Processos Seletivos\n\n© 2025-2026 Avalia+Tec\nTodos os direitos reservados.',
    buttons: ['OK']
  });
}

async function handleRestoreBackup() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar arquivo de backup',
    filters: [{ name: 'Backup Avalia+', extensions: ['avaliabackup', 'zip'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      backupService.restore(result.filePaths[0]);
      mainWindow.webContents.send('app:notification', { type: 'success', message: 'Backup restaurado com sucesso!' });
      mainWindow.webContents.send('nav:dashboard');
    } catch (err) {
      mainWindow.webContents.send('app:notification', { type: 'error', message: 'Erro ao restaurar backup: ' + err.message });
    }
  }
}

// ============================================================
// IPC Handlers — Comunicação Renderer ↔ Main
// ============================================================
function registerIPCHandlers() {

  // --- Window Controls ---
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // --- Auth ---
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    return authService.login(username, password);
  });
  ipcMain.handle('auth:logout', async () => {
    return authService.logout();
  });
  ipcMain.handle('auth:check', async () => {
    return authService.getCurrentUser();
  });
  ipcMain.handle('auth:change-password', async (_, { userId, oldPassword, newPassword }) => {
    return authService.changePassword(userId, oldPassword, newPassword);
  });

  // --- Submissions ---
  ipcMain.handle('submissions:create', async (_, data) => {
    return submissionService.create(data);
  });
  ipcMain.handle('submissions:list', async (_, filters) => {
    return submissionService.list(filters);
  });
  ipcMain.handle('submissions:get', async (_, protocol) => {
    return submissionService.getByProtocol(protocol);
  });
  ipcMain.handle('submissions:update', async (_, { protocol, data }) => {
    return submissionService.update(protocol, data);
  });
  ipcMain.handle('submissions:update-status', async (_, { protocol, status }) => {
    return submissionService.updateStatus(protocol, status);
  });
  ipcMain.handle('submissions:delete', async (_, protocol) => {
    return submissionService.delete(protocol);
  });
  ipcMain.handle('submissions:export-csv', async () => {
    return submissionService.exportCSV();
  });
  ipcMain.handle('submissions:search', async (_, query) => {
    return submissionService.search(query);
  });
  ipcMain.handle('submissions:lookup', async (_, { protocol, cpf }) => {
    return submissionService.lookup(protocol, cpf);
  });

  // --- Evaluations ---
  ipcMain.handle('evaluations:submit', async (_, data) => {
    return evaluationService.submit(data);
  });
  ipcMain.handle('evaluations:list', async (_, filters) => {
    return evaluationService.list(filters);
  });
  ipcMain.handle('evaluations:get', async (_, { protocol, evaluatorId }) => {
    return evaluationService.get(protocol, evaluatorId);
  });
  ipcMain.handle('evaluations:results', async (_, filters) => {
    return evaluationService.getResults(filters);
  });

  // --- Appeals ---
  ipcMain.handle('appeals:create', async (_, data) => {
    return appealService.create(data);
  });
  ipcMain.handle('appeals:list', async (_, filters) => {
    return appealService.list(filters);
  });
  ipcMain.handle('appeals:update-status', async (_, { protocol, status, motivo }) => {
    return appealService.updateStatus(protocol, status, motivo);
  });

  // --- Events ---
  ipcMain.handle('events:create', async (_, data) => {
    return eventService.create(data);
  });
  ipcMain.handle('events:list', async () => {
    return eventService.list();
  });
  ipcMain.handle('events:get', async (_, id) => {
    return eventService.get(id);
  });
  ipcMain.handle('events:update', async (_, { id, data }) => {
    return eventService.update(id, data);
  });
  ipcMain.handle('events:delete', async (_, id) => {
    return eventService.delete(id);
  });
  ipcMain.handle('events:register', async (_, { eventId, participant }) => {
    return eventService.registerParticipant(eventId, participant);
  });
  ipcMain.handle('events:toggle-confirm', async (_, { eventId, participantIndex }) => {
    return eventService.toggleConfirmation(eventId, participantIndex);
  });

  // --- Workflow ---
  ipcMain.handle('workflow:get-status', async (_, protocol) => {
    return workflowService.getCandidateStatus(protocol);
  });
  ipcMain.handle('workflow:advance-phase', async (_, { protocol, phase, status }) => {
    return workflowService.advancePhase(protocol, phase, status);
  });
  ipcMain.handle('workflow:allocate-vacancies', async (_, config) => {
    return workflowService.allocateVacancies(config);
  });

  // --- Reports ---
  ipcMain.handle('reports:submission-pdf', async (_, protocol) => {
    const pdfBuffer = await reportService.generateSubmissionPDF(protocol);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Comprovante',
      defaultPath: `comprovante_${protocol}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('reports:allocation-pdf', async (_, data) => {
    const pdfBuffer = await reportService.generateAllocationPDF(data);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Relatório de Alocação',
      defaultPath: 'alocacao_vagas.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('reports:certificate-pdf', async (_, data) => {
    const pdfBuffer = await reportService.generateCertificatePDF(data);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Certificado',
      defaultPath: `certificado_${data.participantName || 'participante'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('reports:appeal-pdf', async (_, data) => {
    const pdfBuffer = await reportService.generateAppealPDF(data);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Comprovante de Recurso',
      defaultPath: `recurso_${data.protocol || 'comprovante'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('reports:integrity-report-pdf', async (_, submission, integrity) => {
    const pdfBuffer = await reportService.generateIntegrityReportPDF(submission, integrity);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Relatório de Integridade',
      defaultPath: `integridade_${submission.protocol || 'relatorio'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, pdfBuffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('reports:export-results-csv', async () => {
    const csv = await reportService.exportResultsCSV();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Resultados',
      defaultPath: 'resultados.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, csv, 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // --- Backup ---
  ipcMain.handle('backup:create', async () => {
    const backupPath = backupService.create();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Backup',
      defaultPath: `avalia_backup_${new Date().toISOString().slice(0, 10)}.avaliabackup`,
      filters: [{ name: 'Backup Avalia+', extensions: ['avaliabackup'] }]
    });
    if (!result.canceled) {
      fs.copyFileSync(backupPath, result.filePath);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    return db.getSettings();
  });
  ipcMain.handle('settings:update', async (_, settings) => {
    return db.updateSettings(settings);
  });

  // --- Dashboard ---
  ipcMain.handle('dashboard:stats', async () => {
    return {
      submissions: submissionService.getStats(),
      evaluations: evaluationService.getStats(),
      appeals: appealService.getStats(),
      events: eventService.getStats()
    };
  });

  // --- Users Management ---
  ipcMain.handle('users:list', async () => {
    return authService.listUsers();
  });
  ipcMain.handle('users:create', async (_, data) => {
    return authService.createUser(data);
  });
  ipcMain.handle('users:toggle-active', async (_, userId) => {
    return authService.toggleUserActive(userId);
  });

  // --- Calendar ---
  ipcMain.handle('calendar:list', async (_, year) => {
    return calendarService.list(year);
  });
  ipcMain.handle('calendar:save', async (_, { year, phases }) => {
    return calendarService.upsert(year, phases);
  });
  ipcMain.handle('calendar:open-appeal-phases', async () => {
    return calendarService.getOpenAppealPhases();
  });

  // --- Public Files ---
  ipcMain.handle('public-files:list', async () => {
    return publicFileService.list();
  });
  ipcMain.handle('public-files:import', async (_, { category, description }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar documento para publicar',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return publicFileService.importFile(result.filePaths[0], category, description);
    }
    return { success: false, canceled: true };
  });
  ipcMain.handle('public-files:delete', async (_, id) => {
    return publicFileService.delete(id);
  });
  ipcMain.handle('public-files:get', async (_, id) => {
    return publicFileService.get(id);
  });

  // --- FAQ ---
  ipcMain.handle('faq:list', async () => {
    return faqService.listAll();
  });
  ipcMain.handle('faq:create', async (_, data) => {
    return faqService.create(data);
  });
  ipcMain.handle('faq:update', async (_, { id, data }) => {
    return faqService.update(id, data);
  });
  ipcMain.handle('faq:delete', async (_, id) => {
    return faqService.delete(id);
  });
  ipcMain.handle('faq:save-all', async (_, items) => {
    return faqService.saveAll(items);
  });

  // --- Sync ---
  ipcMain.handle('sync:test-connection', async () => {
    return syncService.testConnection();
  });
  ipcMain.handle('sync:authenticate', async (_, { username, password }) => {
    return syncService.authenticate(username, password);
  });
  ipcMain.handle('sync:pull-all', async () => {
    return syncService.pullAll();
  });
  ipcMain.handle('sync:push-submission', async (_, data) => {
    return syncService.pushSubmission(data);
  });
  ipcMain.handle('sync:push-appeal', async (_, data) => {
    return syncService.pushAppeal(data);
  });
  ipcMain.handle('sync:status', async () => {
    return syncService.getStatus();
  });
  ipcMain.handle('sync:start-auto', async (_, interval) => {
    syncService.startAutoSync(interval);
    return { success: true };
  });
  ipcMain.handle('sync:stop-auto', async () => {
    syncService.stopAutoSync();
    return { success: true };
  });
  ipcMain.handle('sync:auto-login-and-pull', async () => {
    return syncService.autoLoginAndPull();
  });

  // --- Backup (extended) ---
  ipcMain.handle('backup:list', async () => {
    return backupService.listBackups();
  });
  ipcMain.handle('backup:restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar arquivo de backup',
      filters: [{ name: 'Backup Avalia+', extensions: ['avaliabackup', 'db'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        backupService.restore(result.filePaths[0]);
        return { success: true, path: result.filePaths[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, canceled: true };
  });

  // --- Event Image Upload ---
  ipcMain.handle('events:select-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar banner do evento',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      const dest = path.join(DATA_DIR, 'event_images');
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const filename = `event_${Date.now()}${ext}`;
      const destPath = path.join(dest, filename);
      fs.copyFileSync(filePath, destPath);
      return { success: true, path: destPath, filename };
    }
    return { success: false, canceled: true };
  });
  ipcMain.handle('events:get-image', async (_, imagePath) => {
    try {
      if (imagePath && fs.existsSync(imagePath)) {
        const data = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase().replace('.', '');
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
        return `data:${mime[ext] || 'image/png'};base64,${data.toString('base64')}`;
      }
      return null;
    } catch { return null; }
  });

  // --- File Dialogs ---
  ipcMain.handle('dialog:open-file', async (_, options) => {
    return dialog.showOpenDialog(mainWindow, options);
  });
  ipcMain.handle('dialog:save-file', async (_, options) => {
    return dialog.showSaveDialog(mainWindow, options);
  });

  // --- Write file (for CSV export etc.) ---
  ipcMain.handle('file:write', async (_, { filePath: fp, content }) => {
    try {
      fs.writeFileSync(fp, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ============================================================
// App Lifecycle
// ============================================================
app.whenReady().then(() => {
  db.initialize();
  initServices();
  buildMenu();
  createWindow();
  registerIPCHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  db.close();
  app.quit();
});

app.on('before-quit', () => {
  db.close();
});
