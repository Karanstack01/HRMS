/**
 * StackDrove HRMS — Sheet_Resignation.gs
 * Data access layer for Resignations, Offboarding Clearance Checklist, and F&F Settlement.
 */

var DB = DB || {};

DB.Resignation = (function() {
  const COL = {
    ID: 1,
    EMP_ID: 2,
    SUBMITTED_ON: 3,
    PROPOSED_LWD: 4,
    REASON: 5,
    NOTICE_DAYS: 6,
    STATUS: 7,
    LWD_FINAL: 8,
    CLEARANCE_CHECKLIST: 9,
    APPROVED_BY: 10,
    FNF_SETTLED: 11
  };

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Resignations');
    if (!s) {
      s = ss.insertSheet('Resignations');
      s.appendRow([
        'resignationId', 'empId', 'submittedOn', 'lastWorkingDay', 'reason', 'noticePeriodDays',
        'status', 'lwdFinal', 'clearanceChecklist', 'approvedBy', 'fnfSettled'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      resignationId: String(r[0]),
      empId: String(r[1]),
      submittedOn: r[2] ? formatDate_(r[2], 'yyyy-MM-dd') : '',
      lastWorkingDay: r[3] ? formatDate_(r[3], 'yyyy-MM-dd') : '',
      reason: String(r[4] || ''),
      noticePeriodDays: Number(r[5]) || 60,
      status: String(r[6] || 'Submitted'),
      lwdFinal: r[7] ? formatDate_(r[7], 'yyyy-MM-dd') : '',
      clearanceChecklist: String(r[8] || '{}'),
      approvedBy: String(r[9] || ''),
      fnfSettled: Boolean(r[10])
    };
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 11).getValues();
    return values.map(_rowToObj).filter(Boolean);
  }

  function getByEmp_(empId) {
    return getAll_().filter(r => r.empId.toLowerCase() === empId.toLowerCase());
  }

  function getActiveForEmp_(empId) {
    return getAll_().find(r => r.empId.toLowerCase() === empId.toLowerCase() && r.status !== 'Withdrawn' && r.status !== 'Completed');
  }

  function getById_(resignationId) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const values = s.getRange(2, 1, lastRow - 1, 11).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(resignationId)) {
        const obj = _rowToObj(values[i]);
        obj.rowIdx = i + 2;
        return obj;
      }
    }
    return null;
  }

  function submit_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const id = generateUuid_();

      // Auto-populate assigned hardware assets into clearance checklist
      const assignedAssets = DB.Assets.getByEmp_(payload.empId);
      const defaultChecklist = {
        knowledgeTransfer: false,
        exitInterview: false,
        duesCleared: false,
        assets: assignedAssets.map(a => ({ assetId: a.assetId, assetTag: a.assetTag, category: a.category, returned: false }))
      };

      s.appendRow([
        id,
        payload.empId,
        new Date(),
        payload.proposedLWD || todayStr_(),
        payload.reason || '',
        Number(payload.noticePeriodDays) || 60,
        'Submitted',
        payload.proposedLWD || todayStr_(),
        JSON.stringify(defaultChecklist),
        '',
        false
      ]);

      // Update Directory status to on-notice
      DB.Directory.update_(payload.empId, { status: 'on-notice' });

      return getById_(id);
    });
  }

  function updateChecklist_(resignationId, checklistObj) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(resignationId);
      if (!item) return null;
      s.getRange(item.rowIdx, COL.CLEARANCE_CHECKLIST).setValue(JSON.stringify(checklistObj));
      return getById_(resignationId);
    });
  }

  function finalizeExit_(resignationId, lwdFinal, approverEmpId) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(resignationId);
      if (!item) return null;

      s.getRange(item.rowIdx, COL.STATUS).setValue('Completed');
      s.getRange(item.rowIdx, COL.LWD_FINAL).setValue(lwdFinal || todayStr_());
      s.getRange(item.rowIdx, COL.APPROVED_BY).setValue(approverEmpId);
      s.getRange(item.rowIdx, COL.FNF_SETTLED).setValue(true);

      // Update Directory status to resigned and set exit date
      DB.Directory.update_(item.empId, {
        status: 'resigned',
        dateOfExit: lwdFinal || todayStr_()
      });

      // Queue Relieving Letter automatically
      DB.Letters.requestLetter_(item.empId, 'Relieving Letter');

      return getById_(resignationId);
    });
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    getActiveForEmp_: getActiveForEmp_,
    getById_: getById_,
    submit_: submit_,
    updateChecklist_: updateChecklist_,
    finalizeExit_: finalizeExit_
  };
})();
