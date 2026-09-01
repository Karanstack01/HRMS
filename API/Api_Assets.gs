/**
 * StackDrove HRMS — Api_Assets.gs
 * Client-callable endpoints for Asset Management and Requisitions.
 */

function Api_Assets_list() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr');

    const myAssets = DB.Assets.getByEmp_(user.empId);
    const allAssets = isPrivileged ? DB.Assets.getAll_() : [];
    const requests = DB.Assets.getRequests_();

    return ok_({
      myAssets: myAssets,
      allAssets: allAssets,
      myRequests: requests.filter(r => r.empId === user.empId),
      allRequests: isPrivileged ? requests : []
    });
  } catch (e) {
    logError_(e, 'Api_Assets_list');
    return fail_('ERROR', e.message);
  }
}

function Api_Assets_create(payload) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!payload.category || !payload.brandModel) {
      return fail_('VALIDATION_ERROR', 'Category and Brand/Model are required.');
    }

    const created = DB.Assets.create_(payload);
    logAudit_(user.empId, 'ASSET_CREATE', 'Assets', created.assetId, payload.requestId, {}, created);
    return ok_(created);
  } catch (e) {
    logError_(e, 'Api_Assets_create');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Assets_assign(assetId, empId) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!assetId || !empId) return fail_('VALIDATION_ERROR', 'Asset ID and Employee ID are required.');

    const success = DB.Assets.assign_(assetId, empId);
    if (!success) return fail_('NOT_FOUND', 'Asset not found.');

    logAudit_(user.empId, 'ASSET_ASSIGN', 'Assets', assetId, '', {}, { assignedTo: empId });

    // Notify employee
    const targetEmail = DB.Directory.getEmail_(empId);
    if (targetEmail) {
      MailQueue.enqueue(2, targetEmail, 'ASSET_ASSIGNED', {
        assetTag: assetId,
        category: 'Hardware Asset',
        assignedDate: todayStr_()
      });
    }

    return ok_({ assigned: true });
  } catch (e) {
    logError_(e, 'Api_Assets_assign');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Assets_return(assetId) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const success = DB.Assets.returnAsset_(assetId);
    if (!success) return fail_('NOT_FOUND', 'Asset not found.');

    logAudit_(user.empId, 'ASSET_RETURN', 'Assets', assetId, '', {}, { status: 'In Stock' });
    return ok_({ returned: true });
  } catch (e) {
    logError_(e, 'Api_Assets_return');
    return fail_(e.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'ERROR', e.message);
  }
}

function Api_Assets_request(category, reason) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!category) return fail_('VALIDATION_ERROR', 'Asset Category is required.');

    const reqId = DB.Assets.createRequest_(user.empId, category, reason);
    logAudit_(user.empId, 'ASSET_REQUEST', 'Assets', reqId, '', {}, { category, reason });
    return ok_({ requestId: reqId });
  } catch (e) {
    logError_(e, 'Api_Assets_request');
    return fail_('ERROR', e.message);
  }
}
