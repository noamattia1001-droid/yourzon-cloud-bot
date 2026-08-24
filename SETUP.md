# 🚀 מדריך התקנה — YourZon Cloud Bot

זמן משוער: **~40 דקות** (רובו המתנה לאימות מטא)

---

## שלב 1: Google Sheet + Apps Script (5 דק')

1. פותחים [sheets.new](https://sheets.new) — גיליון חדש
2. שם: `YourZon Bot Database`
3. תפריט **Extensions → Apps Script**
4. מוחקים את הקוד הקיים
5. מדביקים את כל התוכן של [`apps-script.gs`](./apps-script.gs)
6. **File → Save** (Ctrl+S)

---

## שלב 2: Meta WhatsApp Business (~15 דק')

1. נכנסים ל-[developers.facebook.com](https://developers.facebook.com/)
2. לוחצים **My Apps → Create App**
3. סוג: **Business** → הבא
4. שם האפליקציה: `YourZon Bot` → **Create App**
5. במסך הבא, בכרטיס **WhatsApp** לוחצים **Set Up**
6. יוצרים חשבון עסקי חדש (אם אין) — קליק אחד
7. עוברים ל-**WhatsApp → API Setup** בסרגל השמאלי

בעמוד הזה יש 4 דברים שאתה צריך:
- **Access Token** (זמני 24 שעות — לצורך הבדיקה) — העתק
- **Phone number ID** — העתק (זה מספר, לא הטלפון עצמו)
- **Test number** — מטא נותנים לך מספר בדיקה חינם
- **To** — הכנס את המספר שלך בישראל בפורמט 972501234567

לוחצים **Send message** ומקבלים הודעת "Hello World" בוואטסאפ שלך = החיבור עובד ✅

### לקבל Access Token קבוע (לפרודקשן):

1. **Business Settings → System Users** ([business.facebook.com/settings](https://business.facebook.com/settings/system-users))
2. **Add** → שם: `YourZon Bot User` → Role: **Admin**
3. על המשתמש שיצרת → **Assign Assets** → בחר את האפליקציה, הרשאה: Full control
4. **Generate New Token** → בחר האפליקציה → Scope: `whatsapp_business_messaging`, `whatsapp_business_management` → **Generate**
5. **שמור את ה-Token בצד — לא רואים אותו שוב**

---

## שלב 3: הגדרת Apps Script (3 דק')

חזרה לעורך Apps Script של הגיליון:

1. **Project Settings** (⚙️ בסרגל שמאל) → **Script Properties → Add Property**
2. מוסיפים אחד-אחד:

| Property | Value |
|---|---|
| `WHATSAPP_TOKEN` | ה-Access Token הקבוע שהעתקת |
| `WHATSAPP_PHONE_ID` | ה-Phone number ID (מספר) |
| `VERIFY_TOKEN` | מחרוזת שאתה בוחר, למשל `yourzon_secret_2026` |
| `CLAUDE_API_KEY` | `sk-ant-...` מ-[console.anthropic.com](https://console.anthropic.com) |
| `OWNER_PHONE` | `972501234567` (המספר שלך לקבלת התראות) |
| `PERSONA_NAME` | `זואי` |

3. חזרה לעורך → תפריט למעלה: בחר את הפונקציה `testSetup` → **Run**
4. אישור הרשאות (פעם ראשונה בלבד) — לחץ Advanced → Go to project (unsafe) → Allow
5. בלוג למטה צריך להיות ✓ לכל המפתחות + `Sheets ready ✓`

---

## שלב 4: פרסום Web App (2 דק')

1. **Deploy → New deployment**
2. גלגל השיניים → **Web app**
3. הגדרות:
   - Description: `YourZon Bot v1`
   - **Execute as: Me**
   - **Who has access: Anyone**
4. **Deploy** → אישור הרשאות שוב
5. **העתק את ה-Web app URL** — נראה כך:
   ```
   https://script.google.com/macros/s/AKfy.../exec
   ```

---

## שלב 5: חיבור Webhook במטא (3 דק')

חזרה ל-Meta → **WhatsApp → Configuration**:

1. בסקציית **Webhook** → **Edit**
2. **Callback URL**: ה-Web app URL מהשלב הקודם
3. **Verify token**: אותה מחרוזת שהכנסת ב-`VERIFY_TOKEN` (למשל `yourzon_secret_2026`)
4. **Verify and save**

אם הצליח = טוב. אם נכשל = בדוק שה-Verify token זהה בדיוק.

5. תחת **Webhook fields** → סמן ✓ ל-**messages** → **Subscribe**

---

## שלב 6: דשבורד ב-GitHub Pages (3 דק')

1. יצירת רפו חדש ב-GitHub: `yourzon-cloud-bot`
2. העלאת קובץ `index.html` (בלבד — לא את ה-.gs)
3. **Settings → Pages → Branch: main → Save**
4. תוך דקה: `https://YOURUSERNAME.github.io/yourzon-cloud-bot/`
5. פותחים בדפדפן → מדביקים את ה-Web app URL מהשלב הקודם → **שמור וטען**

---

## ✅ בדיקה סופית

1. שלח הודעה למספר הוואטסאפ העסקי מהטלפון שלך
2. תוך 2-3 שניות מקבל תשובה מהבוט
3. בדשבורד: השיחה מופיעה, הליד נכנס
4. בגליון: 2 טאבים (Conversations, Leads) מתמלאים אוטומטית

---

## שגיאות נפוצות

**"Verify token mismatch"** ← ה-`VERIFY_TOKEN` בApps Script שונה מזה שהזנת במטא.

**הבוט לא עונה** ← בדוק:
- לוג Apps Script: **Executions** (סמל השעון בסרגל שמאל)
- הרשאה: **Deploy → Manage deployments** → צריך להיות `Anyone`

**"Insufficient permissions" מCloude API** ← ה-`CLAUDE_API_KEY` שגוי או שאין קרדיט.

**הודעה לא נשלחת** ← במטא, מספר הבדיקה שולח רק ל-5 מספרים שאישרת. הוסף מספרים ב-**API Setup → Manage phone numbers**.

---

## למעבר לפרודקשן

**מספר טלפון אמיתי** (במקום מספר הבדיקה של מטא):

1. **WhatsApp → Phone numbers → Add phone number**
2. אפשרות א: מספר קיים שלך → מטא שולחים קוד ב-SMS/שיחה לאימות
3. אפשרות ב: מספר חדש דרך ספק ($1-5/חודש)
4. חשוב: המספר צריך להיות **לא רשום כרגע בוואטסאפ רגיל** (אחרת חייבים למחוק את הוואטסאפ הרגיל קודם)

**הגבלה של 1000 שיחות חינם** — אחרי זה כ-$0.005 להודעה עסקית (מעל 1000 שיחות = חייב לחייב כרטיס אשראי במטא).
