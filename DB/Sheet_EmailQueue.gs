/**
 * StackDrove HRMS — Sheet_EmailQueue.gs
 * Data access layer for Email Queue table.
 */

var DB = DB || {};

DB.EmailQueue = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('EmailQueue');
    if (!s) {
      s = ss.insertSheet('EmailQueue');
      s.appendRow(['queueId', 'priority', 'toEmail', 'templateKey', 'payloadJson', 'status', 'attempts', 'createdAt', 'dispatchedAt', 'errorMessage']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function enqueue_(priority, toEmail, templateKey, payload) {
    const s = _sheet();
    const id = generateUuid_();
    s.appendRow([
      id,
      Number(priority) || 2,
      toEmail,
      templateKey,
      JSON.stringify(payload || {}),
      'Pending',
      0,
      new Date(),
      '',
      ''
    ]);
    return id;
  }

  function getPendingBatch_(limit) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];

    const max = limit || 25;
    const values = s.getRange(2, 1, lastRow - 1, 10).getValues();

    const pending = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (r[5] === 'Pending') {
        pending.push({
          rowIdx: i + 2,
          queueId: r[0],
          priority: Number(r[1]),
          toEmail: r[2],
          templateKey: r[3],
          payload: r[4] ? JSON.parse(r[4]) : {},
          attempts: Number(r[6])
        });
      }
    }

    // Sort: Priority 1 first (Urgent), then Priority 2, then Priority 3
    pending.sort((a, b) => a.priority - b.priority);
    return pending.slice(0, max);
  }

  function markSuccess_(rowIdx) {
    const s = _sheet();
    s.getRange(rowIdx, 6).setValue('Sent');
    s.getRange(rowIdx, 9).setValue(new Date());
  }

  function markFailed_(rowIdx, errMsg, attempts) {
    const s = _sheet();
    const nextAttempts = (attempts || 0) + 1;
    s.getRange(rowIdx, 7).setValue(nextAttempts);
    s.getRange(rowIdx, 10).setValue(errMsg || 'Send failure');
    if (nextAttempts >= 3) {
      s.getRange(rowIdx, 6).setValue('Failed');
    }
  }

  return {
    enqueue_: enqueue_,
    getPendingBatch_: getPendingBatch_,
    markSuccess_: markSuccess_,
    markFailed_: markFailed_
  };
})();
