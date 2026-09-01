# 09 — Code Structure, Naming & Sample Core Functions

## 1. Naming Conventions
- Server functions callable from client: `Api_<Module>_<action>` e.g. `Api_Leave_apply`, `Api_Attendance_punch`.
- Internal-only helpers: trailing underscore, e.g. `calcLeaveDaysWithSandwich_`, `withLock_` — Apps Script convention signaling "not meant to be called externally," also keeps them out of any accidental doPost exposure.
- DB access layer: `DB.<Sheet>.<verb>_` accessed via a namespaced object built in each `Sheet_*.gs` file, e.g.:
```javascript
// Sheet_Leave.gs
var DB = DB || {};
DB.Leave = {
  _sheet: () => SpreadsheetApp.getActive().getSheetByName('LeaveRequests'),
  create_(payload){ /* ... */ },
  getById_(id){ /* ... */ },
  getByEmp_(empId){ /* ... */ },
  updateStatus_(id, status, remarks){ /* ... */ }
};
```
- Sheet column indices defined as constants at top of each `Sheet_*.gs` to avoid magic numbers:
```javascript
const LEAVE_COL = { ID:1, EMP:2, TYPE:3, FROM:4, TO:5, DAYS:6, HALF:7, SESSION:8,
                     REASON:9, STATUS:10, APPLIED:11, APPROVER:12, ACTIONED:13,
                     REMARKS:14, ATTACHMENT:15, ROWVER:16 };
```

## 2. Standard File Header (every .gs file)
```javascript
/**
 * StackDrove HRMS — <Module Name>
 * Handles: <one-line responsibility>
 * Depends on: Utils.gs, Auth.gs, Sheet_<Name>.gs
 */
```

## 3. Core Reusable Functions

**Utils.gs**
```javascript
function ok_(data){ return {success:true, data:data}; }
function fail_(code, message){ return {success:false, error:{code,message}}; }

function withLock_(fn){
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return fn();
  } catch(e){
    logError_(e);
    return fail_('LOCK_TIMEOUT', 'System busy, please retry');
  } finally {
    lock.releaseLock();
  }
}

function isDuplicateRequest_(requestId){
  if (!requestId) return false;
  const cache = CacheService.getScriptCache();
  const key = 'req_' + requestId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 300); // 5 min window
  return false;
}

function todayStr_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function generateSequentialId_(prefix, counterKey){
  return withLock_(() => {
    const props = PropertiesService.getScriptProperties();
    const next = (Number(props.getProperty(counterKey)) || 0) + 1;
    props.setProperty(counterKey, String(next));
    return `${prefix}-${String(next).padStart(4,'0')}`;
  });
}

function logAudit_(actorEmpId, action, recordId, oldVal, newVal){
  const sheet = SpreadsheetApp.getActive().getSheetByName('AuditLog');
  sheet.appendRow([Utilities.getUuid(), new Date(), actorEmpId, action, recordId,
    JSON.stringify(oldVal||{}), JSON.stringify(newVal||{})]);
}

function logError_(e){
  try {
    SpreadsheetApp.getActive().getSheetByName('ErrorLog')
      .appendRow([new Date(), e.message, e.stack || '']);
  } catch(_) { /* never let logging break the app */ }
}
```

**Auth.gs**
```javascript
function resolveCurrentUser_(){
  const email = Session.getActiveUser().getEmail();
  if (!email) return null;
  const emp = DB.Directory.getByEmail_(email);
  if (!emp || emp.status !== 'active') return null;
  return { empId: emp.empId, fullName: emp.fullName, role: emp.role,
           email: emp.email, department: emp.department, photoUrl: emp.photoUrl };
}

function requireRole_(allowedRoles){
  const user = resolveCurrentUser_();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new Error('FORBIDDEN');
  return user;
}
```

## 4. Client-Side Shared Helper (`AppCore.html`)
```javascript
function callApi(fnName, args, onSuccess, onError){
  google.script.run
    .withSuccessHandler(function(res){
      if (res && res.success) onSuccess(res.data);
      else (onError || showToastError)(res && res.error);
    })
    .withFailureHandler(function(err){
      (onError || showToastError)({code:'SERVER_ERROR', message: err.message});
    })
    [fnName].apply(null, args || []);
}

function showToastError(err){
  const t = document.createElement('div');
  t.className = 'toast toast-error';
  t.textContent = (err && err.message) || 'Something went wrong';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function newRequestId(){ return Utilities_uuidClient(); }
```

## 5. Deployment Notes
- Deploy as **Web App**: Execute as "User accessing the web app" or "Me" with domain restriction based on your Workspace configuration.
- Set "Who has access" to your organization's domain only.
- Run `initializeSystem()` from `Setup.gs` once to bootstrap all sheets, Drive folders, and initial admin record.
- Store configuration keys in `PropertiesService.getScriptProperties()` automatically via `Setup.gs`.

## 6. Testing Approach in Apps Script
- Maintain a `RUN_ALL_TESTS()` in a `Tests.gs` file that runs all test suites (`test_Utils`, `test_Auth`, `test_Attendance`, `test_Leave`, etc.) and logs pass/fail to the execution log.
