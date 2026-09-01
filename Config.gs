/**
 * StackDrove HRMS — Config.gs
 * Centralized system configuration and PropertiesService helper.
 */

var Config = (function() {
  const DEFAULTS = {
    ORG_NAME: 'StackDrove Technologies',
    DEFAULT_CURRENCY: 'INR',
    TIMEZONE: 'Asia/Kolkata',
    SYSTEM_FROM_ALIAS: '',
    SYSTEM_FROM_NAME: 'StackDrove HRMS',
    ADMIN_EMAIL: 'admin@stackdrove.com',
    ALLOW_PIN_PUNCH: 'true',
    ENABLE_KIOSK_MODE: 'true',
    STANDARD_CHECKIN_TIME: '09:30',
    STANDARD_CHECKOUT_TIME: '18:30',
    GRACE_PERIOD_MINS: '15',
    WORK_HOURS_PER_DAY: '8',
    HALF_DAY_HOURS: '4',
    SANDWICH_LEAVE_RULE: JSON.stringify({
      enabled: true,
      appliesTo: ['Casual', 'Earned'],
      exempt: ['Sick', 'Maternity', 'Paternity', 'CompOff']
    }),
    LEAVE_ACCRUAL_RATES: JSON.stringify({
      Casual: 1.25,
      Sick: 1.0,
      Earned: 1.75
    }),
    NOTICE_PERIOD_DAYS: JSON.stringify({
      probation: 30,
      'full-time': 60,
      contract: 30,
      intern: 15
    }),
    DAILY_MAIL_QUOTA_RESERVE: '20',
    BATCH_MAIL_SIZE: '25',
    MAX_FILE_UPLOAD_MB: '10',
    PUNCH_GEOFENCE_ENABLED: 'false',
    PUNCH_ALLOWED_RADIUS_METERS: '200',
    PUNCH_ALLOWED_COORDS: JSON.stringify([]),
    PROBATION_PERIOD_MONTHS: '6',
    PAYROLL_CYCLE_START_DAY: '1',
    PAYROLL_CYCLE_END_DAY: '31',
    PAYROLL_PAYMENT_DAY: '1',
    ATTENDANCE_MODE: 'SSO' // SSO | PIN | KIOSK
  };

  function get(key) {
    const props = PropertiesService.getScriptProperties();
    const val = props.getProperty(key);
    if (val !== null && val !== undefined) return val;
    return DEFAULTS[key] !== undefined ? DEFAULTS[key] : null;
  }

  function getJson(key) {
    const val = get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch (e) {
      return null;
    }
  }

  function set(key, value) {
    const props = PropertiesService.getScriptProperties();
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    props.setProperty(key, strVal);
  }

  function setBatch(dict) {
    const props = PropertiesService.getScriptProperties();
    const cleanDict = {};
    for (const k in dict) {
      cleanDict[k] = typeof dict[k] === 'object' ? JSON.stringify(dict[k]) : String(dict[k]);
    }
    props.setProperties(cleanDict);
  }

  function getAll() {
    const props = PropertiesService.getScriptProperties().getProperties();
    const merged = Object.assign({}, DEFAULTS, props);
    return merged;
  }

  function initDefaults() {
    const props = PropertiesService.getScriptProperties();
    const current = props.getProperties();
    const toSet = {};
    for (const key in DEFAULTS) {
      if (current[key] === undefined) {
        toSet[key] = DEFAULTS[key];
      }
    }
    if (Object.keys(toSet).length > 0) {
      props.setProperties(toSet);
    }
  }

  function getFolderId(key) {
    return get('DRIVE_FOLDER_' + key);
  }

  function setFolderId(key, id) {
    set('DRIVE_FOLDER_' + key, id);
  }

  return {
    get: get,
    getJson: getJson,
    set: set,
    setBatch: setBatch,
    getAll: getAll,
    initDefaults: initDefaults,
    getFolderId: getFolderId,
    setFolderId: setFolderId
  };
})();
