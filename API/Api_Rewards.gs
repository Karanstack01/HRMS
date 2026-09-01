/**
 * StackDrove HRMS — Api_Rewards.gs
 * Client-callable endpoints for Rewards and Wall of Fame nominations.
 */

function Api_Rewards_list() {
  try {
    Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const all = DB.Rewards.getAll_();

    const enriched = all.map(r => {
      const emp = DB.Directory.getById_(r.empId);
      const giver = DB.Directory.getById_(r.givenBy);
      return {
        ...r,
        employeeName: emp ? emp.fullName : r.empId,
        department: emp ? emp.department : '',
        photoUrl: emp ? emp.photoUrl : '',
        giverName: giver ? giver.fullName : (r.givenBy || 'Management')
      };
    });

    return ok_(enriched);
  } catch (e) {
    logError_(e, 'Api_Rewards_list');
    return fail_('ERROR', e.message);
  }
}

function Api_Rewards_give(payload) {
  try {
    const user = Auth.requireRole_(['manager', 'hr', 'admin']);
    if (!payload.empId || !payload.title) {
      return fail_('VALIDATION_ERROR', 'Recipient and Award Title are required.');
    }

    const created = DB.Rewards.create_({
      ...payload,
      givenBy: user.empId
    });

    logAudit_(user.empId, 'REWARD_GIVE', 'Rewards', created.rewardId, payload.requestId, {}, created);

    // Notify recipient
    const recipientEmail = DB.Directory.getEmail_(payload.empId);
    if (recipientEmail) {
      MailQueue.enqueue(2, recipientEmail, 'REWARD_RECEIVED', {
        rewardTitle: created.title,
        givenBy: user.fullName,
        message: created.description || 'Thank you for your fantastic contribution!'
      });
    }

    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Rewards_give');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}
