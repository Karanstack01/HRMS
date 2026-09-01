/**
 * StackDrove HRMS — Code.gs
 * Web App entry point (doGet / doPost), Template Includer, and Page Router.
 */

function doGet(e) {
  try {
    const page = (e && e.parameter && e.parameter.page) ? e.parameter.page.toLowerCase() : 'index';

    // Standalone mobile check-in portal
    if (page === 'attendance') {
      const template = HtmlService.createTemplateFromFile('Html/Attendance');
      return template.evaluate()
        .setTitle('StackDrove HRMS — Daily Attendance')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // Standalone mobile leave application form
    if (page === 'leave') {
      const template = HtmlService.createTemplateFromFile('Html/Leave');
      return template.evaluate()
        .setTitle('StackDrove HRMS — Apply for Leave')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // Main Single Page Application (SPA)
    const template = HtmlService.createTemplateFromFile('Html/Index');
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
 * Standard include helper for nested HTML partials
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Client bootstrap initializer called on page load
 */
function getInitialAppData() {
  try {
    const user = Auth.getCurrentUser_();
    const nav = Auth.getNavForRole_(user.role);
    const orgName = Config.get('ORG_NAME') || 'StackDrove Technologies';
    const currency = Config.get('DEFAULT_CURRENCY') || 'INR';

    let punchStatus = { isPunchedIn: false, todayRecord: null };
    try {
      const todayRecord = DB.Attendance.findByEmpAndDate_(user.empId, todayStr_());
      if (todayRecord && todayRecord.punchInTime && !todayRecord.punchOutTime) {
        punchStatus.isPunchedIn = true;
        punchStatus.todayRecord = todayRecord;
      }
    } catch (_) {}

    return ok_({
      user: user,
      nav: nav,
      orgName: orgName,
      currency: currency,
      punchStatus: punchStatus
    });
  } catch (e) {
    logError_(e, 'getInitialAppData');
    return fail_('INIT_ERROR', e.message);
  }
}
