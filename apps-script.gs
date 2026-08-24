/*
 * YourZon WhatsApp Cloud Bot — Google Apps Script backend
 *
 * ארכיטקטורה:
 *   Meta WhatsApp Cloud API → doPost(webhook) → Sheets + Claude → sendMessage
 *   Dashboard (GitHub Pages) → doGet(?action=...) → JSON מהגיליון
 *
 * Script Properties (הגדר דרך: Project Settings → Script Properties):
 *   WHATSAPP_TOKEN     — Permanent access token מ-Meta
 *   WHATSAPP_PHONE_ID  — Phone Number ID מ-Meta (לא המספר עצמו)
 *   VERIFY_TOKEN       — מחרוזת שאתה בוחר, זהה למה שתכניס ב-Meta webhook
 *   CLAUDE_API_KEY     — sk-ant-... מ-console.anthropic.com
 *   OWNER_PHONE        — 972501234567 (המספר שיקבל התראות על לידים חמים)
 *   PERSONA_NAME       — 'זואי'
 */

// ═══════════════════════════════════════════════════════════════
// דאטהבייס YourZon (משובץ בקוד — לעריכה מהירה, אל תיגע במחירים)
// ═══════════════════════════════════════════════════════════════
const YOURZON = {
  company: {
    name: 'YourZon', name_he: 'יורזון',
    phone: '055-687-2548', whatsapp: '972556872548',
    email: 'yourzon@yourzon.net', website: 'yourzon.net',
  },
  sales_rules: [
    'בלי חוזים ארוכים — חודש בחודשו, ביטול בכל עת',
    'שיחת ייעוץ חינם 30 דקות — אבחון, לא מכירה',
    'לעולם לא להוריד מחיר — להוסיף ערך (חודש חינם, שירות נוסף)',
    'להציג ערך לפני מחיר — מה הלקוח מקבל, לא כמה עולה',
    'רוב השירותים ב-0 הקמה — אפס סיכון, תנסה חודש',
    'תמיד להציע חבילה, לא רשימת שירותים בודדים',
    'להשוות לעלות של לא-לעשות: כמה לידים מפספסים בלי אתר?',
    'לדבר בשפת הלקוח: לקוחות, כסף, זמן — לא API, CRM, טכנולוגיה',
    'תמיד לסיים שיחה עם צעד הבא: שולח הצעה / מתחילים ביום ראשון',
  ],
  services: [
    ['אתר תדמית', 0, 249, 'אתר מעוצב שהופך מבקרים ללקוחות'],
    ['חנות אינטרנט', 5000, 399, 'עגלה, סליקה וניהול מלאי 24/7'],
    ['דף נחיתה', 0, 149, 'דף המרה ממוקד לקמפיינים'],
    ['אפליקציית ווב', 200, 'לפי פרויקט', 'מערכת מותאמת אישית'],
    ['אוטומציות AI', 0, 299, 'זרימות עבודה חכמות — חוסך 90% זמן אדמין'],
    ['בוט WhatsApp חכם', 0, 299, 'מענה מיידי 24/7 + קביעת פגישות'],
    ['אוטומציה שיווקית', 0, 399, 'חיבור לידים ל-CRM וניהול קמפיינים'],
    ['שירות לקוחות חכם', 0, 199, 'בוט AI למענה מהיר 24/7'],
    ['ניהול ידע ודאטה', 5000, 500, 'בסיס ידע ארגוני חכם'],
    ['CRM וניהול לידים', 0, 249, 'מעקב ואוטומציה — אף הכנסה לא הולכת לאיבוד'],
    ['ניהול סושיאל', 0, 599, 'פוסטים יומיים + ניהול קהל + אנליטיקס'],
    ['קמפיינים ממומנים', 0, 459.9, 'Meta · Google · TikTok'],
    ['קידום SEO', 749, 'חודשי', 'עמוד ראשון בגוגל'],
    ['מיתוג דיגיטלי', 749, 'חודשי', 'לוגו, צבעים, טיפוגרפיה'],
  ],
  packages: [
    { name: 'בסיסי', target: 'עסקים שרק מתחילים', setup: 1499, monthly: 699,
      includes: 'נוכחות YOURZON, עד 8 פוסטים, בוט WhatsApp בסיסי, דוח חודשי' },
    { name: 'צמיחה (הכי משתלם)', target: 'עסקים בצמיחה', setup: 5000, monthly: 759.9,
      includes: 'סושיאל 3 רשתות + בוט AI + CRM + נחיתה + SEO + קמפיין' },
    { name: 'פרימיום', target: 'עסקים שרוצים הכל', setup: 12000, monthly: 1999,
      includes: 'הכל בצמיחה + אתר/אפליקציה מלאים + AI מותאם + מנהל אישי' },
  ],
};

const SHEETS = { CONV: 'Conversations', LEADS: 'Leads' };

// ═══════════════════════════════════════════════════════════════
// GET — Meta webhook verification + Dashboard JSON API
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const p = e?.parameter || {};

  // 1. Meta webhook verification handshake
  if (p['hub.mode'] === 'subscribe') {
    if (p['hub.verify_token'] === prop('VERIFY_TOKEN')) {
      return ContentService.createTextOutput(p['hub.challenge']);
    }
    return ContentService.createTextOutput('Forbidden');
  }

  // 2. Dashboard API
  try {
    switch (p.action) {
      case 'conversations': return json(getAllConversationsGrouped());
      case 'leads':         return json(getAllLeads());
      case 'stats':         return json(getStats());
      case 'health':        return json({ ok: true, ts: new Date().toISOString() });
      default:              return json({ name: 'YourZon Cloud Bot', ok: true });
    }
  } catch (err) {
    return json({ error: err.message, stack: String(err.stack).substring(0, 500) });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Meta WhatsApp webhook: incoming customer message
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;
    if (!messages || !messages.length) {
      return ContentService.createTextOutput('OK');
    }
    for (const msg of messages) {
      if (msg.type !== 'text') continue;
      handleIncoming(msg, value);
    }
  } catch (err) {
    console.error('doPost error:', err.message, err.stack);
  }
  return ContentService.createTextOutput('OK');
}

// ═══════════════════════════════════════════════════════════════
// עיבוד הודעה נכנסת
// ═══════════════════════════════════════════════════════════════
function handleIncoming(msg, value) {
  const from = msg.from;
  const text = (msg.text?.body || '').trim();
  if (!text) return;

  const contactName = value?.contacts?.[0]?.profile?.name || '';

  appendConversation(from, contactName, 'in', text);
  const lead = upsertLead(from, { lastMessage: text, contactName });
  extractProfile(from, text, lead);

  const history = getRecentHistoryForClaude(from, 20);
  const persona = prop('PERSONA_NAME') || 'זואי';
  const systemPrompt = buildSystemPrompt(persona, lead);

  let reply = callClaude(systemPrompt, history, text);
  let escalate = false;
  if (reply.includes('[ESCALATE_TO_HUMAN]')) {
    reply = reply.replace(/\[ESCALATE_TO_HUMAN\]/g, '').trim();
    escalate = true;
  }

  if (reply) {
    sendWhatsApp(from, reply);
    appendConversation(from, contactName, 'out', reply);
  }

  if (escalate) {
    const freshLead = getLead(from);
    if (!freshLead?.escalatedAt) {
      updateLead(from, { status: 'ready_for_call', escalatedAt: new Date().toISOString() });
      notifyOwner(from);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Claude AI
// ═══════════════════════════════════════════════════════════════
function callClaude(systemPrompt, history, userMessage) {
  const apiKey = prop('CLAUDE_API_KEY');
  if (!apiKey) return smartFallback(userMessage);

  const messages = history.concat([{ role: 'user', content: userMessage }]);

  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        temperature: 0.85,
        system: systemPrompt,
        messages,
      }),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText());
    if (code >= 400) {
      console.error('Claude API error:', code, body?.error?.message);
      return smartFallback(userMessage);
    }
    return body.content?.filter(b => b.type === 'text').map(b => b.text).join('') || smartFallback(userMessage);
  } catch (err) {
    console.error('Claude call failed:', err.message);
    return smartFallback(userMessage);
  }
}

function smartFallback(msg) {
  const persona = prop('PERSONA_NAME') || 'זואי';
  const m = (msg || '').toLowerCase();
  if (/שלום|היי|הי|בוקר|ערב|hello|hi/.test(m)) return `היי! 😊 אני ${persona} מ-YourZon. במה אפשר לעזור?`;
  if (/אתר|תדמית/.test(m))                       return `אתרי תדמית מתחילים מ-249 ש"ח/חודש, בלי הקמה 💻 ספר לי על העסק שלך`;
  if (/בוט|וואטסאפ/.test(m))                     return `בוט WhatsApp חכם — 299 ש"ח/חודש 🤖 איזה סוג עסק יש לך?`;
  if (/מחיר|עלות|כמה/.test(m))                   return `בוא נעשה שיחת ייעוץ קצרה של 30 דק' חינם ואני אתן לך מחיר מדויק 💡 מסכים?`;
  return `היי! אני ${persona} מ-YourZon. אנחנו בונים אתרים, בוטים ואוטומציה לעסקים 💪 מה אתה מחפש?`;
}

// ═══════════════════════════════════════════════════════════════
// System prompt לClaude
// ═══════════════════════════════════════════════════════════════
function buildSystemPrompt(persona, lead) {
  const services = YOURZON.services.map(s => {
    const setup = s[1] === 0 ? '0 הקמה' : `${s[1]} ש"ח הקמה`;
    const monthly = typeof s[2] === 'number' ? `${s[2]} ש"ח/חודש` : s[2];
    return `• ${s[0]} (${setup} · ${monthly}) — ${s[3]}`;
  }).join('\n');

  const packages = YOURZON.packages.map(p =>
    `• ${p.name} (${p.target}): ${p.setup} ש"ח הקמה + ${p.monthly} ש"ח/חודש — ${p.includes}`
  ).join('\n');

  const rules = YOURZON.sales_rules.map(r => `• ${r}`).join('\n');

  const memBits = [];
  if (lead?.name)         memBits.push(`שם: ${lead.name}`);
  if (lead?.businessType) memBits.push(`סוג עסק: ${lead.businessType}`);
  if (lead?.interest)     memBits.push(`מה מעניין אותו: ${lead.interest}`);
  const memBlock = memBits.length
    ? `\n═══ מה שאתה כבר יודע על האדם הזה ═══\n${memBits.map(b => '• ' + b).join('\n')}\n(אל תשאל שוב.)\n`
    : '';

  return `אתה ${persona}, נציגת מכירות ב-YourZon — חברת אוטומציה, אתרים ו-AI לעסקים קטנים בישראל.
את עונה בוואטסאפ בעברית מדוברת, חמה ומקצועית — לא כמו רובוט.${memBlock}

═══ פרטי החברה ═══
${YOURZON.company.name} · ${YOURZON.company.phone} · ${YOURZON.company.website}

═══ שירותים ═══
${services}

═══ חבילות ═══
${packages}

═══ חוקי מכירה ═══
${rules}

═══ איך לדבר ═══
• עברית מדוברת קצרה: "שמע", "תכלס", "סבבה", "וואלה"
• שאלה אחת בכל פעם. משפטים קצרים.
• אמוג'י: 1-2 להודעה, לא יותר.
• תגיבי לאדם, לא רק תזרקי שירותים
• תמיד סיימי עם צעד הבא

═══ המטרה — איסוף ליד ═══
תוציאי מהאדם בשיחה טבעית: 1) שם 2) סוג עסק 3) מה הוא מחפש.
כשהוא מסכים לשיחת ייעוץ / מבקש הצעה / מוכן להתחיל — כתבי [ESCALATE_TO_HUMAN] בסוף התשובה.

═══ מחירים ═══
לא לזרוק מחיר לפני שהבנת מה הוא צריך. אם שואל ישירות — עני קצר ותכווני לשיחת ייעוץ חינם.
לעולם לא להוריד מחיר. אם לוחצים — להוסיף ערך.

❌ אסור: להמציא שירותים · לענות כמו רובוט · רשימת bullet ארוכה · לתת הכל בהודעה ראשונה`;
}

// ═══════════════════════════════════════════════════════════════
// WhatsApp Cloud API — שליחת הודעה
// ═══════════════════════════════════════════════════════════════
function sendWhatsApp(toPhone, text) {
  const token = prop('WHATSAPP_TOKEN');
  const phoneId = prop('WHATSAPP_PHONE_ID');
  if (!token || !phoneId) {
    console.error('Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID');
    return;
  }
  try {
    UrlFetchApp.fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${token}` },
      payload: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text },
      }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('sendWhatsApp failed:', err.message);
  }
}

function notifyOwner(leadPhone) {
  const owner = prop('OWNER_PHONE');
  if (!owner) return;
  const lead = getLead(leadPhone) || {};
  const info = [
    '🔥 *ליד חדש מוכן לשיחה — YourZon*',
    '',
    `📱 טלפון: ${leadPhone}`,
    lead.name         ? `👤 שם: ${lead.name}` : null,
    lead.businessType ? `🏢 עסק: ${lead.businessType}` : null,
    lead.interest     ? `🎯 מעניין: ${lead.interest}` : null,
    lead.lastMessage  ? `💬 הודעה: ${String(lead.lastMessage).substring(0, 100)}` : null,
    '',
    `wa.me/${leadPhone}`,
  ].filter(Boolean).join('\n');
  sendWhatsApp(owner, info);
}

// ═══════════════════════════════════════════════════════════════
// Google Sheets — אחסון שיחות ולידים
// ═══════════════════════════════════════════════════════════════
function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

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
  sheet.appendRow([new Date().toISOString(), phone, name || '', direction, message]);
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
    if (h === 'phone') return phone;
    if (h === 'firstContact' || h === 'lastUpdate') return now;
    if (h === 'status') return 'new';
    return patch[h] || '';
  });
  sheet.appendRow(row);
  return getLead(phone);
}

function updateLead(phone, patch) {
  return upsertLead(phone, patch);
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

function getRecentHistoryForClaude(phone, limit) {
  const sheet = ss().getSheetByName(SHEETS.CONV);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
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
      byPhone.set(phone, {
        phone,
        name: data[i][nCol] || phone,
        messages: [],
        lastActivity: data[i][tCol],
      });
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
// זיהוי אוטומטי של שם, סוג עסק ותחום עניין
// ═══════════════════════════════════════════════════════════════
function extractProfile(phone, msg, current) {
  const patch = {};
  const m = msg || '';
  const low = m.toLowerCase();

  if (!current?.name) {
    const nm = m.match(/(?:קוראים לי|שמי|השם שלי|אני נקרא)\s+([א-ת]{2,15})/)
            || m.match(/^אני\s+([א-ת]{2,12})\b/);
    if (nm && !['רוצה','צריך','מחפש','מעוניין','בא','לא','כן','בעל'].includes(nm[1])) {
      patch.name = nm[1];
    }
  }

  if (!current?.businessType) {
    if (/מספר|מספרה|תספורת/.test(low))               patch.businessType = 'מספרה';
    else if (/מסעד|קפה|פיצריה|בר\b/.test(low))       patch.businessType = 'מסעדה/בית קפה';
    else if (/חנות|קמעונ|בגד|אופנה/.test(low))       patch.businessType = 'חנות/קמעונאות';
    else if (/עורך דין|עוד\b|משפט|נוטריון/.test(low)) patch.businessType = 'משרד עורכי דין';
    else if (/רופא|מרפא|קליני|קוסמט/.test(low))      patch.businessType = 'קליניקה/רפואה';
    else if (/כושר|יוגה|פילאטיס/.test(low))          patch.businessType = 'כושר/בריאות';
    else if (/נדלן|תיווך|קבלן|שיפוצ/.test(low))      patch.businessType = 'נדל"ן/שיפוצים';
    else if (/מורה|לימוד|קורס/.test(low))            patch.businessType = 'חינוך/הוראה';
    else if (/יועץ|קואוצ/.test(low))                 patch.businessType = 'שירותים/ייעוץ';
  }

  if (!current?.interest) {
    if (/אתר\s|תדמית|לנדינג/.test(low))               patch.interest = 'אתר';
    else if (/חנות|איקומרס/.test(low))                patch.interest = 'חנות אינטרנט';
    else if (/בוט|מענה/.test(low))                    patch.interest = 'בוט WhatsApp';
    else if (/אוטומצ/.test(low))                      patch.interest = 'אוטומציות AI';
    else if (/סושיאל|אינסטגרם|פייסבוק|טיקטוק/.test(low)) patch.interest = 'ניהול סושיאל';
    else if (/פרסום|קמפיין|ממומן/.test(low))          patch.interest = 'קמפיינים ממומנים';
    else if (/seo|קידום/.test(low))                   patch.interest = 'SEO';
    else if (/מיתוג|לוגו|ברנד/.test(low))             patch.interest = 'מיתוג';
    else if (/הכל|חבילה|פרימיום|צמיחה|בסיסי/.test(low)) patch.interest = 'חבילה שלמה';
  }

  if (Object.keys(patch).length) upsertLead(phone, patch);
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

// ═══════════════════════════════════════════════════════════════
// בדיקה ידנית (הפעל מתפריט Run בעורך)
// ═══════════════════════════════════════════════════════════════
function testSetup() {
  const checks = {
    WHATSAPP_TOKEN: !!prop('WHATSAPP_TOKEN'),
    WHATSAPP_PHONE_ID: !!prop('WHATSAPP_PHONE_ID'),
    VERIFY_TOKEN: !!prop('VERIFY_TOKEN'),
    CLAUDE_API_KEY: !!prop('CLAUDE_API_KEY'),
    OWNER_PHONE: !!prop('OWNER_PHONE'),
  };
  console.log('Setup check:', checks);
  ensureSheet(SHEETS.CONV, ['timestamp', 'phone', 'name', 'direction', 'message']);
  ensureSheet(SHEETS.LEADS,
    ['phone', 'name', 'businessType', 'interest', 'status', 'firstContact', 'lastUpdate', 'lastMessage', 'escalatedAt', 'contactName']);
  console.log('Sheets ready ✓');
  return checks;
}

function testSendMessage() {
  const owner = prop('OWNER_PHONE');
  if (!owner) { console.log('OWNER_PHONE not set'); return; }
  sendWhatsApp(owner, '🤖 בדיקת חיבור מ-YourZon Bot — אם קיבלת את זה, החיבור עובד! ✅');
  console.log('Test message sent to', owner);
}
