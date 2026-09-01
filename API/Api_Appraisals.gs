/**
 * StackDrove HRMS — Api_Appraisals.gs
 * Client-callable endpoints for Appraisals, Ratings, and HR Calibration.
 */

function Api_Appraisals_getMy() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    let myAppraisals = DB.Appraisals.getByEmp_(user.empId);

    // Auto seed an active cycle if none exist
    if (!myAppraisals.length) {
      const created = DB.Appraisals.createCycleForEmp_(user.empId, 'H1-2026');
      myAppraisals = [created];
    }

    let teamAppraisals = [];
    if (user.role === 'manager' || user.role === 'hr' || user.role === 'admin') {
      const reports = (user.role === 'admin' || user.role === 'hr') 
        ? DB.Directory.getAll_() 
        : DB.Directory.getDirectReports_(user.empId);
      
      const reportIds = new Set(reports.map(r => r.empId));
      teamAppraisals = DB.Appraisals.getAll_().filter(a => reportIds.has(a.empId) && a.empId !== user.empId).map(a => {
        const emp = DB.Directory.getById_(a.empId);
        return {
          ...a,
          employeeName: emp ? emp.fullName : a.empId,
          department: emp ? emp.department : '',
          photoUrl: emp ? emp.photoUrl : ''
        };
      });
    }

    return ok_({
      myList: myAppraisals,
      teamList: teamAppraisals
    });
  } catch (e) {
    logError_(e, 'Api_Appraisals_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Appraisals_submitSelf(appraisalId, rating, achievements) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const updated = DB.Appraisals.submitSelfReview_(appraisalId, rating, achievements);
    if (!updated) return fail_('NOT_FOUND', 'Appraisal not found');

    logAudit_(user.empId, 'APPRAISAL_SELF_SUBMIT', 'Appraisals', appraisalId, '', {}, updated);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Appraisals_submitSelf');
    return fail_('ERROR', e.message);
  }
}

function Api_Appraisals_submitManager(appraisalId, rating, comments) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    const updated = DB.Appraisals.submitManagerReview_(appraisalId, rating, comments);
    if (!updated) return fail_('NOT_FOUND', 'Appraisal not found');

    logAudit_(user.empId, 'APPRAISAL_MANAGER_SUBMIT', 'Appraisals', appraisalId, '', {}, updated);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Appraisals_submitManager');
    return fail_('ERROR', e.message);
  }
}

function Api_Appraisals_finalize(appraisalId, finalRating, hrComments) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const updated = DB.Appraisals.finalizeHrCalibration_(appraisalId, finalRating, hrComments);
    if (!updated) return fail_('NOT_FOUND', 'Appraisal not found');

    logAudit_(user.empId, 'APPRAISAL_FINALIZE', 'Appraisals', appraisalId, '', {}, updated);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Appraisals_finalize');
    return fail_('ERROR', e.message);
  }
}
