/**
 * StackDrove HRMS — MailDispatcher.gs
 * Core transactional email dispatcher.
 */

var MailDispatcher = (function() {

  function renderTemplateString_(str, data) {
    if (!str) return '';
    return str.replace(/{{\s*(\w+)\s*}}/g, function(_, key) {
      return (data && data[key] !== undefined && data[key] !== null) ? data[key] : '';
    });
  }

  /**
   * Direct, immediate dispatch of an email with optional attachments.
   */
  function dispatchMailDirect_(toEmail, templateKey, data, attachments) {
    if (!toEmail) return false;
    try {
      const template = MailTemplates.getTemplate(templateKey);
      const subject = renderTemplateString_(template.subject, data || {});
      const htmlBody = renderTemplateString_(template.body, data || {});
      const fromAlias = Config.get('SYSTEM_FROM_ALIAS');
      const fromName = Config.get('SYSTEM_FROM_NAME') || 'StackDrove HRMS';

      const options = {
        htmlBody: htmlBody,
        name: fromName,
        attachments: attachments || []
      };

      if (fromAlias && fromAlias.includes('@')) {
        options.from = fromAlias;
      }

      GmailApp.sendEmail(toEmail, subject, '', options);
      return true;
    } catch (e) {
      logError_(e, 'dispatchMailDirect_: ' + templateKey + ' to ' + toEmail);
      return false;
    }
  }

  function buildAppUrl_(page, params) {
    let url = ScriptApp.getService().getUrl();
    if (!url) url = 'https://script.google.com/macros/s/exec';
    const query = [];
    if (page) query.push('page=' + encodeURIComponent(page));
    if (params) {
      for (const k in params) {
        query.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return query.length ? url + '?' + query.join('&') : url;
  }

  return {
    dispatchMailDirect_: dispatchMailDirect_,
    renderTemplateString_: renderTemplateString_,
    buildAppUrl_: buildAppUrl_
  };
})();
