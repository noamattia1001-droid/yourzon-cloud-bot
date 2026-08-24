# YourZon WhatsApp Cloud Bot

בוט וואטסאפ 24/7 בלי שרת — הכל בענן חינם.

## הארכיטקטורה

```
לקוח שולח בוואטסאפ
       ↓
Meta WhatsApp Cloud API  (חינם עד 1000 שיחות/חודש)
       ↓ webhook POST
Google Apps Script       (חינם)
       ↓
Google Sheets            (חינם, זה גם ממשק הניהול)
       ↓
Claude AI                (כ-$0.001 להודעה)
       ↓
תשובה חוזרת ללקוח
```

**עלות טיפוסית:** 0-10 ש"ח בחודש (רק עלות Claude, לפי שימוש)

## המבנה

- **`apps-script.gs`** — כל הבקאנד (Webhook, Claude, Sheets)
- **`index.html`** — דשבורד סטטי ל-GitHub Pages
- **`SETUP.md`** — מדריך הגדרה מלא צעד-אחר-צעד

## התקנה מהירה

ראה [SETUP.md](./SETUP.md) — מדריך מלא עם 6 שלבים, כ-40 דקות.

בקצרה:
1. יוצרים Google Sheet חדש
2. מדביקים את `apps-script.gs` בעורך Apps Script של הגיליון
3. פותחים חשבון Meta WhatsApp Business + מקבלים Access Token
4. מכניסים את ה-Token ופרטים לScript Properties
5. Deploy → מעתיקים URL → מגדירים כ-Webhook ב-Meta
6. מעלים `index.html` ל-GitHub Pages → פותחים בדפדפן

## למה זה עדיף מבוט Baileys

| | Baileys (הישן) | Cloud API (הזה) |
|---|---|---|
| שרת נדרש | כן, 24/7 | לא |
| עלות שרת | $5-10/חודש | 0 |
| סיכון חסימה | גבוה (לא רשמי) | 0 (רשמי מטא) |
| מספר וואטסאפ | אישי | עסקי רשמי |
| דורש QR | כן | לא — API |
| מהירות תגובה | מיידי | 1-3 שניות |
| מקסימום הודעות | ללא הגבלה | 1000 שיחות חינם/חודש |
