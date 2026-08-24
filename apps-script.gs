/*
 * YourZon Bot — Google Apps Script (Storage endpoint)
 *
 * הבוט Baileys רץ ב-Railway ומדבר עם הגיליון הזה דרך HTTP.
 * הגיליון הוא ה-DB. הדשבורד ב-GitHub Pages קורא מכאן.
 *
 * Script Properties (Project Settings → Script Properties):
 *   API_TOKEN — סיסמה שרירותית. חייבת להיות זהה ב-Railway (SHEET_API_TOKEN).
 *                למשל: yz_a3f9k2m7 — כל אחד שיודע אותה יכול לכתוב לגיליון.
 */

const SHEETS = { CONV: 'Conversations', LEADS: 'Leads' };

// ═══════════════════════════════════════════════════════════════
// GET — קריאה בלבד. משמש את הדשבורד + את הבוט לקבל היסטוריה.
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const p = e?.parameter || {};
  try {
    switch (p.action) {
      case 'conversations': return json(getAllConversationsGrouped());
      case 'leads':         return json(getAllLeads());
      case 'stats':         return json(getStats());
      case 'history':       return json(getRecentHistory(p.phone, parseInt(p.limit || '20')));
      case 'lead':          return json(getLead(p.phone));
      case 'health':        return json({ ok: true, ts: new Date().toISOString() });
      default:              return json({ ok: true, name: 'YourZon Bot Storage' });
    }
  } catch (err) {
    return json({ error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — כתיבה. הבוט Baileys שולח לכאן הודעות ולידים.
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const token = prop('API_TOKEN');
    if (token && body.token !== token) {
      return json({ error: 'unauthorized' });
    }
    switch (body.action) {
      case 'saveMessage':
        appendConversation(body.phone, body.name || '', body.direction, body.message);
        return json({ ok: true });
      case 'upsertLead':
        return json({ ok: true, lead: upsertLead(body.phone, body.patch || {}) });
      default:
        return json({ error: 'unknown action: ' + body.action });
    }
  } catch (err) {
    return json({ error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// Sheets
// ═══════════════════════════════════════════════════════════════
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ensureSheet(name, headers) {
  const spreadsheet = ss();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendConversation(phone, name, direction, message) {
  const sheet = ensureSheet(SHEETS.CONV, ['timestamp', 'phone', 'name', 'direction', 'message']);
  sheet.appendRow([new Date().toISOString(), String(phone), name || '', direction, String(message)]);
}

function upsertLead(phone, patch) {
  const sheet = ensureSheet(SHEETS.LEADS,
    ['phone', 'name', 'businessType', 'interest', 'status', 'firstContact', 'lastUpdate', 'lastMessage', 'escalatedAt', 'contactName']);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const phoneCol = headers.indexOf('phone');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][phoneCol]) === String(phone)) {
      const row = i + 1;
      for (const [k, v] of Object.entries(patch)) {
        const col = headers.indexOf(k);
        if (col >= 0) sheet.getRange(row, col + 1).setValue(v);
      }
      const luCol = headers.indexOf('lastUpdate');
      if (luCol >= 0) sheet.getRange(row, luCol + 1).setValue(new Date().toISOString());
      return getLead(phone);
    }
  }

  const now = new Date().toISOString();
  const row = headers.map(h => {
    if (h === 'phone') return String(phone);
    if (h === 'firstContact' || h === 'lastUpdate') return now;
    if (h === 'status') return 'new';
    return patch[h] || '';
  });
  sheet.appendRow(row);
  return getLead(phone);
}

function getLead(phone) {
  const sheet = ss().getSheetByName(SHEETS.LEADS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0];
  const phoneCol = headers.indexOf('phone');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][phoneCol]) === String(phone)) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = data[i][idx]; });
      return obj;
    }
  }
  return null;
}

function getAllLeads() {
  const sheet = ss().getSheetByName(SHEETS.LEADS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  }).reverse();
}

function getRecentHistory(phone, limit) {
  const sheet = ss().getSheetByName(SHEETS.CONV);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const pCol = headers.indexOf('phone');
  const dCol = headers.indexOf('direction');
  const mCol = headers.indexOf('message');
  const rows = data.slice(1).filter(r => String(r[pCol]) === String(phone));
  const recent = rows.slice(-limit);
  return recent.map(r => ({
    role: r[dCol] === 'in' ? 'user' : 'assistant',
    content: String(r[mCol]),
  }));
}

function getAllConversationsGrouped() {
  const sheet = ss().getSheetByName(SHEETS.CONV);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const tCol = headers.indexOf('timestamp');
  const pCol = headers.indexOf('phone');
  const nCol = headers.indexOf('name');
  const dCol = headers.indexOf('direction');
  const mCol = headers.indexOf('message');

  const byPhone = new Map();
  for (let i = 1; i < data.length; i++) {
    const phone = String(data[i][pCol]);
    if (!byPhone.has(phone)) {
      byPhone.set(phone, { phone, name: data[i][nCol] || phone, messages: [], lastActivity: data[i][tCol] });
    }
    const conv = byPhone.get(phone);
    conv.messages.push({
      role: data[i][dCol] === 'in' ? 'user' : 'bot',
      content: String(data[i][mCol]),
      timestamp: data[i][tCol],
    });
    conv.lastActivity = data[i][tCol];
  }
  return Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
  );
}

function getStats() {
  const leads = getAllLeads();
  const conv = getAllConversationsGrouped();
  const today = new Date().toDateString();
  return {
    total: conv.length,
    today: conv.filter(c => new Date(c.lastActivity).toDateString() === today).length,
    leads: leads.length,
    escalated: leads.filter(l => l.status === 'ready_for_call').length,
  };
}

// ═══════════════════════════════════════════════════════════════
// עזרים
// ═══════════════════════════════════════════════════════════════
function prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSetup() {
  ensureSheet(SHEETS.CONV, ['timestamp', 'phone', 'name', 'direction', 'message']);
  ensureSheet(SHEETS.LEADS,
    ['phone', 'name', 'businessType', 'interest', 'status', 'firstContact', 'lastUpdate', 'lastMessage', 'escalatedAt', 'contactName']);
  console.log('Sheets ready ✓');
  console.log('API_TOKEN set:', !!prop('API_TOKEN'));
  return { ok: true, token_set: !!prop('API_TOKEN') };
}
