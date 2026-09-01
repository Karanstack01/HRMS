/**
 * StackDrove HRMS — Api_Profile.gs
 * Client-callable endpoints for Employee Self-Service Profile and Bank detail management.
 */

function Api_Profile_get() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const emp = DB.Directory.getById_(user.empId);
    if (!emp) return fail_('NOT_FOUND', 'Profile record not found.');

    const props = PropertiesService.getUserProperties();
    const pin = props.getProperty('ATTENDANCE_PIN') || (emp.phone ? String(emp.phone).slice(-4) : '1234');
    const bankAccount = props.getProperty('BANK_ACCOUNT') || 'XXXXXXXX9876';
    const ifsc = props.getProperty('BANK_IFSC') || 'HDFC0001234';

    return ok_({
      profile: emp,
      bank: {
        accountMasked: maskString_(bankAccount, 4),
        ifsc: ifsc
      },
      preferences: {
        attendancePin: pin
      }
    });
  } catch (e) {
    logError_(e, 'Api_Profile_get');
    return fail_('ERROR', e.message);
  }
}

function Api_Profile_updatePersonal(payload) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const updates = {
      phone: payload.phone,
      emergencyContact: payload.emergencyContact,
      address: payload.address,
      bloodGroup: payload.bloodGroup
    };

    const updated = DB.Directory.update_(user.empId, updates);
    logAudit_(user.empId, 'PROFILE_UPDATE_PERSONAL', 'Directory', user.empId, '', {}, updates);
    return ok_(updated);
  } catch (e) {
    logError_(e, 'Api_Profile_updatePersonal');
    return fail_('ERROR', e.message);
  }
}

function Api_Profile_updateBank(accountNumber, ifsc) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!accountNumber || !ifsc) return fail_('VALIDATION_ERROR', 'Account number and IFSC are required.');

    const props = PropertiesService.getUserProperties();
    props.setProperty('BANK_ACCOUNT', accountNumber);
    props.setProperty('BANK_IFSC', ifsc);

    logAudit_(user.empId, 'PROFILE_UPDATE_BANK', 'Directory', user.empId, '', {}, { ifsc, accountMasked: maskString_(accountNumber, 4) });

    // Notify HR team for verification
    const hrUsers = DB.Directory.getAllHrAndAdmins_();
    hrUsers.forEach(hr => {
      MailQueue.enqueue(2, hr.email, 'BANK_DETAILS_UPDATED', {
        employeeName: user.fullName,
        message: `Employee ${user.fullName} (${user.empId}) updated their payroll bank account details.`
      });
    });

    return ok_({
      accountMasked: maskString_(accountNumber, 4),
      ifsc: ifsc
    });
  } catch (e) {
    logError_(e, 'Api_Profile_updateBank');
    return fail_('ERROR', e.message);
  }
}

function Api_Profile_updatePin(newPin) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!newPin || newPin.length < 4) return fail_('VALIDATION_ERROR', 'PIN must be at least 4 digits.');

    const props = PropertiesService.getUserProperties();
    props.setProperty('ATTENDANCE_PIN', newPin);

    logAudit_(user.empId, 'PROFILE_UPDATE_PIN', 'Directory', user.empId, '', {}, {});
    return ok_({ updated: true });
  } catch (e) {
    logError_(e, 'Api_Profile_updatePin');
    return fail_('ERROR', e.message);
  }
}
