/**
 * StackDrove HRMS — Sheet_Appraisals.gs
 * Data access layer for Performance Appraisal Review cycles.
 */

var DB = DB || {};

DB.Appraisals = (function() {
  const COL = {
    ID: 1,
    EMP_ID: 2,
    CYCLE: 3,
    SELF_RATING: 4,
    MGR_RATING: 5,
    FINAL_RATING: 6,
    GOALS: 7,
    COMPETENCIES: 8,
    MGR_COMMENTS: 9,
    HR_COMMENTS: 10,
    STATUS: 11,
    CREATED_ON: 12,
    COMPLETED_ON: 13
  };

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Appraisals');
    if (!s) {
      s = ss.insertSheet('Appraisals');
      s.appendRow([
        'appraisalId', 'empId', 'cycle', 'selfRating', 'managerRating', 'finalRating',
        'goals', 'competencyScores', 'managerComments', 'hrComments', 'status',
        'createdOn', 'completedOn'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      appraisalId: String(r[0]),
      empId: String(r[1]),
      cycle: String(r[2]),
      selfRating: Number(r[3]) || 0,
      managerRating: Number(r[4]) || 0,
      finalRating: Number(r[5]) || 0,
      goals: String(r[6] || '{}'),
      competencyScores: String(r[7] || '{}'),
      managerComments: String(r[8] || ''),
      hrComments: String(r[9] || ''),
      status: String(r[10] || 'Self-Pending'),
      createdOn: r[11] ? formatDate_(r[11], 'yyyy-MM-dd') : '',
      completedOn: r[12] ? formatDate_(r[12], 'yyyy-MM-dd') : ''
    };
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 13).getValues();
    return values.map(_rowToObj).filter(Boolean);
  }

  function getByEmp_(empId) {
    return getAll_().filter(a => a.empId.toLowerCase() === empId.toLowerCase());
  }

  function getById_(appraisalId) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const values = s.getRange(2, 1, lastRow - 1, 13).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(appraisalId)) {
        const obj = _rowToObj(values[i]);
        obj.rowIdx = i + 2;
        return obj;
      }
    }
    return null;
  }

  function createCycleForEmp_(empId, cycle) {
    return withLock_(() => {
      const s = _sheet();
      const id = generateUuid_();
      s.appendRow([
        id,
        empId,
        cycle || 'H1-2026',
        0, 0, 0,
        '{}', '{}',
        '', '',
        'Self-Pending',
        new Date(),
        ''
      ]);
      return getById_(id);
    });
  }

  function submitSelfReview_(appraisalId, rating, achievements) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(appraisalId);
      if (!item) return null;
      s.getRange(item.rowIdx, COL.SELF_RATING).setValue(Number(rating) || 4);
      s.getRange(item.rowIdx, COL.GOALS).setValue(JSON.stringify({ achievements: achievements }));
      s.getRange(item.rowIdx, COL.STATUS).setValue('Manager-Pending');
      return getById_(appraisalId);
    });
  }

  function submitManagerReview_(appraisalId, rating, comments) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(appraisalId);
      if (!item) return null;
      s.getRange(item.rowIdx, COL.MGR_RATING).setValue(Number(rating) || 4);
      s.getRange(item.rowIdx, COL.MGR_COMMENTS).setValue(comments || '');
      s.getRange(item.rowIdx, COL.STATUS).setValue('HR-Review');
      return getById_(appraisalId);
    });
  }

  function finalizeHrCalibration_(appraisalId, finalRating, hrComments) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(appraisalId);
      if (!item) return null;
      s.getRange(item.rowIdx, COL.FINAL_RATING).setValue(Number(finalRating) || 4);
      s.getRange(item.rowIdx, COL.HR_COMMENTS).setValue(hrComments || '');
      s.getRange(item.rowIdx, COL.STATUS).setValue('Completed');
      s.getRange(item.rowIdx, COL.COMPLETED_ON).setValue(new Date());
      return getById_(appraisalId);
    });
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    getById_: getById_,
    createCycleForEmp_: createCycleForEmp_,
    submitSelfReview_: submitSelfReview_,
    submitManagerReview_: submitManagerReview_,
    finalizeHrCalibration_: finalizeHrCalibration_
  };
})();
