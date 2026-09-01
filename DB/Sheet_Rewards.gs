/**
 * StackDrove HRMS — Sheet_Rewards.gs
 * Data access layer for Employee Recognition and Wall of Fame awards.
 */

var DB = DB || {};

DB.Rewards = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Rewards');
    if (!s) {
      s = ss.insertSheet('Rewards');
      s.appendRow(['rewardId', 'empId', 'category', 'title', 'description', 'points', 'givenBy', 'givenOn', 'badgeIcon', 'isPublic']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 10).getValues();
    return values.map(r => ({
      rewardId: String(r[0]),
      empId: String(r[1]),
      category: String(r[2]),
      title: String(r[3]),
      description: String(r[4]),
      points: Number(r[5]) || 0,
      givenBy: String(r[6]),
      givenOn: r[7] ? formatDate_(r[7], 'yyyy-MM-dd') : '',
      badgeIcon: String(r[8] || 'award'),
      isPublic: Boolean(r[9])
    })).reverse();
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const id = generateUuid_();
      s.appendRow([
        id,
        payload.empId,
        payload.category || 'Spot Award',
        payload.title,
        payload.description || '',
        Number(payload.points) || 100,
        payload.givenBy || '',
        payload.givenOn || todayStr_(),
        payload.badgeIcon || 'award',
        payload.isPublic !== undefined ? Boolean(payload.isPublic) : true
      ]);
      return getAll_().find(r => r.rewardId === id);
    });
  }

  return {
    getAll_: getAll_,
    create_: create_
  };
})();
