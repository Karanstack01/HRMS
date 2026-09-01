/**
 * StackDrove HRMS — Utils.gs
 * Shared concurrency lock helpers, date manipulation, sequential ID generation,
 * sandwich leave calculations, and response wrappers.
 */

function ok_(data) {
  return {
    success: true,
    data: data !== undefined ? data : null
  };
}

function fail_(code, message, details) {
  return {
    success: false,
    error: {
      code: code || 'UNKNOWN_ERROR',
      message: message || 'An unexpected error occurred.',
      details: details || null
    }
  };
}

function withLock_(fn, maxWaitMs) {
  const waitMs = maxWaitMs || 10000;
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(waitMs);
  if (!acquired) {
    throw new Error('SYSTEM_BUSY: Database concurrency lock could not be acquired within ' + waitMs + 'ms.');
  }
  try {
    return fn();
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

function generateSequentialId_(prefix, counterKey, padLength) {
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    const current = Number(props.getProperty(counterKey)) || 0;
    const next = current + 1;
    props.setProperty(counterKey, String(next));
    const pad = padLength || 4;
    return prefix + String(next).padStart(pad, '0');
  });
}

function generateUuid_() {
  return Utilities.getUuid();
}

function isDuplicateRequest_(requestId) {
  if (!requestId) return false;
  const cache = CacheService.getScriptCache();
  const key = 'req_' + requestId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 60);
  return false;
}

function formatDate_(date, formatStr, tz) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const timezone = tz || Config.get('TIMEZONE') || 'Asia/Kolkata';
  const fmt = formatStr || 'yyyy-MM-dd';
  return Utilities.formatDate(d, timezone, fmt);
}

function parseDate_(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const parts = String(str).split('T')[0].split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function todayStr_() {
  return formatDate_(new Date(), 'yyyy-MM-dd');
}

function isWeekend_(dateStr) {
  const d = parseDate_(dateStr);
  if (!d) return false;
  const day = d.getDay();
  return (day === 0 || day === 6);
}

function isHoliday_(dateStr, location) {
  try {
    if (typeof DB !== 'undefined' && DB.Holidays) {
      return DB.Holidays.isHoliday_(dateStr, location);
    }
  } catch (_) {}
  return false;
}

function isNonWorkingDay_(dateStr, location) {
  return isWeekend_(dateStr) || isHoliday_(dateStr, location);
}

function calcLeaveDaysWithSandwich_(fromDateStr, toDateStr, empId, leaveType, isHalfDay) {
  if (isHalfDay) return 0.5;
  const start = parseDate_(fromDateStr);
  const end = parseDate_(toDateStr);
  if (!start || !end || start > end) return 0;

  const sandwichRule = Config.getJson('SANDWICH_LEAVE_RULE') || { enabled: true, appliesTo: ['Casual', 'Earned'] };
  const applies = sandwichRule.enabled && (sandwichRule.appliesTo || []).includes(leaveType);

  let empLocation = '';
  try {
    if (typeof DB !== 'undefined' && DB.Directory) {
      const emp = DB.Directory.getById_(empId);
      if (emp) empLocation = emp.location || '';
    }
  } catch (_) {}

  // Generate all days in selected range
  const dates = [];
  const curr = new Date(start.getTime());
  while (curr <= end) {
    dates.push(formatDate_(curr, 'yyyy-MM-dd'));
    curr.setDate(curr.getDate() + 1);
  }

  if (!applies) {
    // Only count working days (exclude weekends & holidays)
    let workingDays = 0;
    dates.forEach(d => {
      if (!isNonWorkingDay_(d, empLocation)) {
        workingDays++;
      }
    });
    return workingDays;
  }

  // Sandwich Rule Active:
  // If span covers contiguous days, check if the non-working days are sandwiched between leave days
  let count = 0;
  for (let i = 0; i < dates.length; i++) {
    const dStr = dates[i];
    if (!isNonWorkingDay_(dStr, empLocation)) {
      count++;
    } else {
      // It's a non-working day. Check if flanked by leave on both sides.
      const hasPriorLeave = (i > 0) || wasEmployeeOnLeaveOnDate_(empId, getPrevDay_(dates[0]));
      const hasPostLeave = (i < dates.length - 1) || wasEmployeeOnLeaveOnDate_(empId, getNextDay_(dates[dates.length - 1]));

      if (hasPriorLeave && hasPostLeave) {
        count++; // Sandwiched!
      }
    }
  }
  return count;
}

function wasEmployeeOnLeaveOnDate_(empId, dateStr) {
  try {
    if (typeof DB !== 'undefined' && DB.Leave) {
      const requests = DB.Leave.getByEmp_(empId);
      return requests.some(r => {
        return (r.status === 'Approved' || r.status === 'Pending') &&
               r.fromDate <= dateStr && r.toDate >= dateStr;
      });
    }
  } catch (_) {}
  return false;
}

function getPrevDay_(dateStr) {
  const d = parseDate_(dateStr);
  d.setDate(d.getDate() - 1);
  return formatDate_(d, 'yyyy-MM-dd');
}

function getNextDay_(dateStr) {
  const d = parseDate_(dateStr);
  d.setDate(d.getDate() + 1);
  return formatDate_(d, 'yyyy-MM-dd');
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN');
}

function numberToWordsINR_(num) {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'overflow';
    const n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n_array) return '';
    let str = '';
    str += (Number(n_array[1]) !== 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'crore ' : '';
    str += (Number(n_array[2]) !== 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'lakh ' : '';
    str += (Number(n_array[3]) !== 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'thousand ' : '';
    str += (Number(n_array[4]) !== 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'hundred ' : '';
    str += (Number(n_array[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
    return str.trim();
  }

  return inWords(Math.round(num));
}

function maskString_(str, unmaskedTrailing) {
  if (!str) return '';
  const s = String(str);
  const trail = unmaskedTrailing || 4;
  if (s.length <= trail) return s;
  return 'X'.repeat(s.length - trail) + s.slice(-trail);
}

function logAudit_(actorEmpId, action, module, recordId, requestId, oldVal, newVal) {
  try {
    if (typeof DB !== 'undefined' && DB.AuditLog) {
      DB.AuditLog.append_(actorEmpId, action, module, recordId, requestId, oldVal, newVal);
    }
  } catch (e) {
    Logger.log('[AuditLog Failure] ' + e.message);
  }
}

function logError_(error, context) {
  try {
    const errObj = {
      message: error.message || String(error),
      stack: error.stack || '',
      context: context || '',
      timestamp: new Date().toISOString()
    };
    Logger.log('[StackDrove Error] ' + JSON.stringify(errObj));
  } catch (_) {}
}
