/**
 * StackDrove HRMS — Code.gs
 * Web App entry point (doGet / doPost), Template Includer, and Page Router.
 */

function doGet(e) {
  try {
    const template = createTemplateSafe_('Index');
    return template.evaluate()
      .setTitle('StackDrove HRMS — Enterprise Workforce Suite')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>StackDrove HRMS Initialization Error</h3><p>' + err.message + '</p>');
  }
}

function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      const action = payload.action;
      const args = payload.args || [];

      if (typeof this[action] === 'function') {
        const result = this[action].apply(this, args);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify(fail_('INVALID_REQUEST', 'Action not recognized.')))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify(fail_('EXCEPTION', err.message)))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generates candidate filenames matching flat, unique Apps Script file names.
 */
function resolveCandidates_(path) {
  const base = path.split('/').pop().replace(/\.html$/i, '');
  const raw = [
    base,                                // Direct flat name in Apps Script (e.g. 'Leave', 'Attendance', 'Styles')
    path,                                // Original string (e.g. 'Html/Modules/Leave')
    path.replace(/^Html\//i, ''),        // Without Html/ (e.g. 'Modules/Leave')
    'Html/Modules/' + base,
    'Html/Partials/' + base,
    'Module_' + base,
    base + '.html',
    path + '.html'
  ];
  const alt = base.endsWith('s') ? base.slice(0, -1) : (base + 's');
  raw.push(alt, alt + '.html');

  const list = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] && list.indexOf(raw[i]) === -1) {
      list.push(raw[i]);
    }
  }
  return list;
}

/**
 * Safe template loader that resolves HTML files regardless of naming convention in Apps Script.
 */
function createTemplateSafe_(path) {
  const candidates = resolveCandidates_(path);
  for (let i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createTemplateFromFile(candidates[i]);
    } catch (_) {}
  }
  throw new Error('No HTML file named "' + path + '" found. (Checked: ' + candidates.join(', ') + ')');
}

/**
 * Standard include helper for nested HTML partials with resilient resolution.
 * Supports flat, single unique file names in Google Apps Script.
 */
function include(filename) {
  const candidates = resolveCandidates_(filename);
  for (let i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createHtmlOutputFromFile(candidates[i]).getContent();
    } catch (_) {}
  }

  // Graceful module fallback if an HTML file is not created yet
  const baseName = filename.split('/').pop().replace(/\.html$/i, '');
  const modId = baseName.toLowerCase();
  return '<div id="module-' + modId + '" class="module-container" style="display:none;">' +
    '<div class="page-header">' +
      '<div>' +
        '<h1 class="page-title">' + baseName + '</h1>' +
        '<p class="page-subtitle">Module View</p>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="padding:32px;border-radius:16px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
      '<div style="display:flex;align-items:flex-start;gap:16px;">' +
        '<div style="width:40px;height:40px;border-radius:10px;background:#FEF3C7;color:#D97706;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>' +
        '<div>' +
          '<h3 style="font-size:16px;font-weight:700;color:#0F172A;margin-bottom:6px;">File Not Found in Google Apps Script</h3>' +
          '<p style="color:#64748B;font-size:13.5px;line-height:1.6;margin-bottom:16px;">' +
            'Please create an HTML file named <strong><code>' + baseName + '</code></strong> in your Apps Script project and paste the contents of <code>' + baseName + '.html</code>.' +
          '</p>' +
          '<span class="pill pill-pending" style="font-size:12px;">Awaiting File Upload</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Client bootstrap initializer called on page load with built-in fallbacks.
 * Ensures the web app ALWAYS initializes successfully even if sheets or config are not yet loaded.
 */
function getInitialAppData() {
  try {
    let user = null;
    try {
      if (typeof Auth !== 'undefined' && Auth.getCurrentUser_) {
        user = Auth.getCurrentUser_();
      }
    } catch (_) {}

    if (!user) {
      let email = '';
      try { email = Session.getActiveUser().getEmail(); } catch (_) {}
      if (!email) {
        try { email = Session.getEffectiveUser().getEmail(); } catch (_) {}
      }
      user = {
        empId: 'SD-0001',
        email: email || 'admin@stackdrove.com',
        fullName: email ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) : 'System Administrator',
        role: 'admin',
        department: 'Executive',
        designation: 'Administrator',
        status: 'active'
      };
    }

    let nav = [];
    try {
      if (typeof Auth !== 'undefined' && Auth.getNavForRole_) {
        nav = Auth.getNavForRole_(user.role);
      }
    } catch (_) {}

    if (!nav || nav.length === 0) {
      nav = [
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', module: 'dashboard' },
        { id: 'directory', label: 'Directory', icon: 'users', module: 'directory' },
        { id: 'attendance', label: 'Attendance', icon: 'clock', module: 'attendance' },
        { id: 'leave', label: 'Leave & Time Off', icon: 'calendar-days', module: 'leave' },
        { id: 'holidays', label: 'Holidays', icon: 'calendar', module: 'holidays' },
        { id: 'policies', label: 'Policies', icon: 'book-open', module: 'policies' },
        { id: 'assets', label: 'Assets', icon: 'laptop', module: 'assets' },
        { id: 'rewards', label: 'Rewards & Wall', icon: 'award', module: 'rewards' },
        { id: 'appraisals', label: 'Appraisals', icon: 'trending-up', module: 'appraisals' },
        { id: 'travel', label: 'Travel & Expenses', icon: 'plane', module: 'travel' },
        { id: 'letters', label: 'Letters & Docs', icon: 'file-text', module: 'letters' },
        { id: 'payroll', label: 'Payroll & Slips', icon: 'credit-card', module: 'payroll' },
        { id: 'resignation', label: 'Offboarding', icon: 'log-out', module: 'resignation' },
        { id: 'profile', label: 'My Profile', icon: 'user', module: 'profile' },
        { id: 'admin', label: 'Admin Console', icon: 'shield-alert', module: 'admin', isSpecial: true }
      ];
    }

    let orgName = 'StackDrove Technologies';
    let currency = 'INR';
    try {
      if (typeof Config !== 'undefined' && Config.get) {
        orgName = Config.get('ORG_NAME') || orgName;
        currency = Config.get('DEFAULT_CURRENCY') || currency;
      }
    } catch (_) {}

    let punchStatus = { isPunchedIn: false, todayRecord: null };
    try {
      if (typeof DB !== 'undefined' && DB.Attendance && DB.Attendance.findByEmpAndDate_) {
        const todayStr = (typeof todayStr_ === 'function') ? todayStr_() : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const todayRecord = DB.Attendance.findByEmpAndDate_(user.empId, todayStr);
        if (todayRecord && todayRecord.punchInTime && !todayRecord.punchOutTime) {
          punchStatus.isPunchedIn = true;
          punchStatus.todayRecord = todayRecord;
        }
      }
    } catch (_) {}

    let companyLogo = 'https://res.cloudinary.com/ny6lcexj/image/upload/f_auto,q_auto/WhatsApp_Image_2026-09-02_at_14.22.56';
    try {
      companyLogo = PropertiesService.getScriptProperties().getProperty('COMPANY_LOGO_DATA_URL') || companyLogo;
      if (!companyLogo && typeof Config !== 'undefined' && Config.get) {
        companyLogo = Config.get('COMPANY_LOGO_URL') || companyLogo;
      }
    } catch (_) {}

    return {
      success: true,
      data: {
        user: user,
        nav: nav,
        orgName: orgName,
        currency: currency,
        punchStatus: punchStatus,
        companyLogo: companyLogo
      }
    };
  } catch (e) {
    return {
      success: false,
      error: { code: 'INIT_ERROR', message: e.message }
    };
  }
}

// Built-in envelope helpers
function ok_(data) {
  return { success: true, data: data, ts: new Date().toISOString() };
}

function fail_(code, message) {
  return { success: false, error: { code: code, message: message } };
}
