/**
 * StackDrove HRMS — Api_Admin.gs
 * Client-callable endpoints for Admin Console, Organization Settings, and Audit Logs.
 */

function Api_Admin_getConfig() {
  try {
    Auth.requireRole_(['admin', 'hr']);
    const allConfig = Config.getAll();
    const auditLogs = DB.AuditLog.getRecent_(50);

    let quotaRemaining = 500;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (_) {}

    return ok_({
      config: allConfig,
      auditLogs: auditLogs,
      health: {
        dailyMailQuotaRemaining: quotaRemaining,
        triggersRegistered: ScriptApp.getProjectTriggers().length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    logError_(e, 'Api_Admin_getConfig');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Admin_saveConfig(settingsDict) {
  try {
    const user = Auth.requireRole_(['admin']);
    if (!settingsDict) return fail_('VALIDATION_ERROR', 'Settings dictionary required.');

    Config.setBatch(settingsDict);
    logAudit_(user.empId, 'ADMIN_CONFIG_UPDATE', 'Config', 'GLOBAL', '', {}, settingsDict);
    return ok_({ saved: true });
  } catch (e) {
    logError_(e, 'Api_Admin_saveConfig');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Admin_initializeSystem() {
  try {
    const user = Auth.requireRole_(['admin']);
    const res = initializeSystem();
    logAudit_(user.empId, 'ADMIN_INITIALIZE_SYSTEM', 'System', 'ALL', '', {}, res);
    return ok_(res);
  } catch (e) {
    logError_(e, 'Api_Admin_initializeSystem');
    return fail_('ERROR', e.message);
  }
}

function Api_Admin_reinstallTriggers() {
  try {
    const user = Auth.requireRole_(['admin']);
    const res = Triggers.installAll();
    logAudit_(user.empId, 'ADMIN_INSTALL_TRIGGERS', 'Triggers', 'ALL', '', {}, res);
    return ok_(res);
  } catch (e) {
    logError_(e, 'Api_Admin_reinstallTriggers');
    return fail_('ERROR', e.message);
  }
}

function Api_Admin_saveLogo(logoDataUrl) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!logoDataUrl) return fail_('VALIDATION_ERROR', 'Logo data URL required.');
    
    // Save to ScriptProperties
    PropertiesService.getScriptProperties().setProperty('COMPANY_LOGO_DATA_URL', logoDataUrl);
    Config.set('COMPANY_LOGO_URL', logoDataUrl);
    logAudit_(user.empId, 'ADMIN_LOGO_UPDATE', 'Branding', 'LOGO', '', {}, { logoUpdated: true });
    return ok_({ saved: true });
  } catch (e) {
    logError_(e, 'Api_Admin_saveLogo');
    return fail_('ERROR', e.message);
  }
}

function Api_Admin_resetLogo() {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    PropertiesService.getScriptProperties().deleteProperty('COMPANY_LOGO_DATA_URL');
    Config.set('COMPANY_LOGO_URL', '');
    logAudit_(user.empId, 'ADMIN_LOGO_RESET', 'Branding', 'LOGO', '', {}, { logoReset: true });
    return ok_({ reset: true });
  } catch (e) {
    logError_(e, 'Api_Admin_resetLogo');
    return fail_('ERROR', e.message);
  }
}
