// ============================================================
// Preload Script — Bridge segura entre Main e Renderer
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avaliaAPI', {

  // Window Controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },

  // Auth
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    check: () => ipcRenderer.invoke('auth:check'),
    changePassword: (userId, oldPassword, newPassword) =>
      ipcRenderer.invoke('auth:change-password', { userId, oldPassword, newPassword })
  },

  // Submissions
  submissions: {
    create: (data) => ipcRenderer.invoke('submissions:create', data),
    list: (filters) => ipcRenderer.invoke('submissions:list', filters),
    get: (protocol) => ipcRenderer.invoke('submissions:get', protocol),
    update: (protocol, data) => ipcRenderer.invoke('submissions:update', { protocol, data }),
    updateStatus: (protocol, status) => ipcRenderer.invoke('submissions:update-status', { protocol, status }),
    delete: (protocol) => ipcRenderer.invoke('submissions:delete', protocol),
    exportCSV: () => ipcRenderer.invoke('submissions:export-csv'),
    search: (query) => ipcRenderer.invoke('submissions:search', query),
    lookup: (protocol, cpf) => ipcRenderer.invoke('submissions:lookup', { protocol, cpf })
  },

  // Evaluations
  evaluations: {
    submit: (data) => ipcRenderer.invoke('evaluations:submit', data),
    list: (filters) => ipcRenderer.invoke('evaluations:list', filters),
    get: (protocol, evaluatorId) => ipcRenderer.invoke('evaluations:get', { protocol, evaluatorId }),
    results: (filters) => ipcRenderer.invoke('evaluations:results', filters)
  },

  // Appeals
  appeals: {
    create: (data) => ipcRenderer.invoke('appeals:create', data),
    list: (filters) => ipcRenderer.invoke('appeals:list', filters),
    updateStatus: (protocol, status, motivo) =>
      ipcRenderer.invoke('appeals:update-status', { protocol, status, motivo })
  },

  // Events
  events: {
    create: (data) => ipcRenderer.invoke('events:create', data),
    list: () => ipcRenderer.invoke('events:list'),
    get: (id) => ipcRenderer.invoke('events:get', id),
    update: (id, data) => ipcRenderer.invoke('events:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('events:delete', id),
    register: (eventId, participant) => ipcRenderer.invoke('events:register', { eventId, participant }),
    toggleConfirm: (eventId, participantIndex) =>
      ipcRenderer.invoke('events:toggle-confirm', { eventId, participantIndex })
  },

  // Workflow
  workflow: {
    getStatus: (protocol) => ipcRenderer.invoke('workflow:get-status', protocol),
    advancePhase: (protocol, phase, status) =>
      ipcRenderer.invoke('workflow:advance-phase', { protocol, phase, status }),
    allocateVacancies: (config) => ipcRenderer.invoke('workflow:allocate-vacancies', config)
  },

  // Reports
  reports: {
    submissionPDF: (protocol) => ipcRenderer.invoke('reports:submission-pdf', protocol),
    allocationPDF: (data) => ipcRenderer.invoke('reports:allocation-pdf', data),
    certificatePDF: (data) => ipcRenderer.invoke('reports:certificate-pdf', data),
    exportResultsCSV: () => ipcRenderer.invoke('reports:export-results-csv')
  },

  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (path) => ipcRenderer.invoke('backup:restore', path)
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings)
  },

  // Dashboard
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats')
  },

  // Users Management
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (data) => ipcRenderer.invoke('users:create', data),
    toggleActive: (userId) => ipcRenderer.invoke('users:toggle-active', userId)
  },

  // Calendar
  calendar: {
    list: (year) => ipcRenderer.invoke('calendar:list', year),
    save: (year, phases) => ipcRenderer.invoke('calendar:save', { year, phases }),
    openAppealPhases: () => ipcRenderer.invoke('calendar:open-appeal-phases')
  },

  // Public Files
  publicFiles: {
    list: () => ipcRenderer.invoke('public-files:list'),
    import: (category, description) => ipcRenderer.invoke('public-files:import', { category, description }),
    delete: (id) => ipcRenderer.invoke('public-files:delete', id),
    get: (id) => ipcRenderer.invoke('public-files:get', id)
  },

  // FAQ
  faq: {
    list: () => ipcRenderer.invoke('faq:list'),
    create: (data) => ipcRenderer.invoke('faq:create', data),
    update: (id, data) => ipcRenderer.invoke('faq:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('faq:delete', id),
    saveAll: (items) => ipcRenderer.invoke('faq:save-all', items)
  },

  // Sync
  sync: {
    testConnection: () => ipcRenderer.invoke('sync:test-connection'),
    authenticate: (username, password) => ipcRenderer.invoke('sync:authenticate', { username, password }),
    pullAll: () => ipcRenderer.invoke('sync:pull-all'),
    autoLoginAndPull: () => ipcRenderer.invoke('sync:auto-login-and-pull'),
    pushSubmission: (data) => ipcRenderer.invoke('sync:push-submission', data),
    pushAppeal: (data) => ipcRenderer.invoke('sync:push-appeal', data),
    status: () => ipcRenderer.invoke('sync:status'),
    startAuto: (interval) => ipcRenderer.invoke('sync:start-auto', interval),
    stopAuto: () => ipcRenderer.invoke('sync:stop-auto')
  },

  // Dialogs
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options)
  },

  // File I/O
  file: {
    write: (filePath, content) => ipcRenderer.invoke('file:write', { filePath, content })
  },

  // Events extended
  eventsExt: {
    selectImage: () => ipcRenderer.invoke('events:select-image'),
    getImage: (path) => ipcRenderer.invoke('events:get-image', path)
  },

  // Navigation events from main
  onNavigate: (callback) => {
    ipcRenderer.on('nav:dashboard', () => callback('dashboard'));
    ipcRenderer.on('nav:backup', () => callback('backup'));
    ipcRenderer.on('nav:settings', () => callback('settings'));
  },

  // Notifications from main
  onNotification: (callback) => {
    ipcRenderer.on('app:notification', (_, data) => callback(data));
  }
});
