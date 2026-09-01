/**
 * StackDrove HRMS — MailQueue.gs
 * Priority Email Queue manager and Quota throttler.
 */

var MailQueue = (function() {

  /**
   * Enqueues an email. If Priority 1 (Urgent), attempts direct delivery immediately.
   */
  function enqueue(priority, toEmail, templateKey, payload) {
    if (!toEmail) return null;

    // Check remaining daily email quota
    let remainingQuota = 500;
    try {
      remainingQuota = MailApp.getRemainingDailyQuota();
    } catch (_) {}

    const reserve = Number(Config.get('DAILY_MAIL_QUOTA_RESERVE')) || 20;

    // If Priority 1 (Urgent) and quota available, send immediately
    if (priority === 1 && remainingQuota > reserve) {
      const sent = MailDispatcher.dispatchMailDirect_(toEmail, templateKey, payload);
      if (sent) return 'DISPATCHED_DIRECT';
    }

    // Otherwise, push to EmailQueue sheet for background batching
    return DB.EmailQueue.enqueue_(priority, toEmail, templateKey, payload);
  }

  /**
   * Called by time-driven trigger every 10 minutes to process queued emails
   */
  function processQueue() {
    let remainingQuota = 500;
    try {
      remainingQuota = MailApp.getRemainingDailyQuota();
    } catch (_) {}

    const reserve = Number(Config.get('DAILY_MAIL_QUOTA_RESERVE')) || 20;
    if (remainingQuota <= reserve) {
      Logger.log('[MailQueue] Daily quota low (' + remainingQuota + '). Halting non-urgent queue.');
      return;
    }

    const batchSize = Number(Config.get('BATCH_MAIL_SIZE')) || 25;
    const maxToSend = Math.min(batchSize, remainingQuota - reserve);
    const batch = DB.EmailQueue.getPendingBatch_(maxToSend);

    batch.forEach(item => {
      try {
        const sent = MailDispatcher.dispatchMailDirect_(item.toEmail, item.templateKey, item.payload);
        if (sent) {
          DB.EmailQueue.markSuccess_(item.rowIdx);
        } else {
          DB.EmailQueue.markFailed_(item.rowIdx, 'Dispatch returned false', item.attempts);
        }
      } catch (err) {
        DB.EmailQueue.markFailed_(item.rowIdx, err.message, item.attempts);
      }
    });
  }

  return {
    enqueue: enqueue,
    processQueue: processQueue
  };
})();
