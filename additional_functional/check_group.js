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

async function ensureAllowed() {
  const gid = getCurrentGroupId();
  const allow = new Set((window?.CHRONO_CHECK.GroupID || []).map(String)); // нормализуем к строкам
  return gid !== null && allow.has(String(gid));
}
