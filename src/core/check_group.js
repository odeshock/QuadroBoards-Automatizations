// ───────────────── пользовательская группа ─────────────────
function getCurrentGroupId() {
  const bodyGroup = Number(document.body?.dataset?.groupId || NaN);
  const groupId = Number(
    (window && window.GroupID) ??
    (window && window.PUNBB && window.PUNBB.group_id) ??
    (window && window.PUNBB && window.PUNBB.user && window.PUNBB.user.g_id) ??
    bodyGroup
  );
  return Number.isFinite(groupId) ? groupId : null;
}

async function ensureAllowed(group_ids) {
  const gid = getCurrentGroupId();
  const allow = new Set(group_ids.map(String));
  return gid !== null && allow.has(String(gid));
}
