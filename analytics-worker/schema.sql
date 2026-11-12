-- ============================================================
--  מסד הנתונים של מערכת הסטטיסטיקות (Cloudflare D1 / SQLite)
--  התקנה:  npx wrangler d1 execute shiurim-analytics --remote --file=schema.sql
--  זמנים: ts = מילישניות UTC. day/hour/dow מחושבים לפי שעון ישראל
--  (dow: 0 = ראשון ... 6 = שבת) כדי שהקיבוץ יהיה מהיר.
--  פרטיות: לא נשמרת כתובת IP. המבקר מזוהה במזהה אקראי שנוצר בדפדפן שלו.
-- ============================================================

-- מבקר = דפדפן/מכשיר אחד (מזהה אקראי ב-localStorage)
CREATE TABLE IF NOT EXISTS visitors (
  visitor_id     TEXT PRIMARY KEY,
  first_seen     INTEGER NOT NULL,
  first_day      TEXT NOT NULL,
  last_seen      INTEGER NOT NULL,
  sessions       INTEGER NOT NULL DEFAULT 0,
  listen_s       REAL    NOT NULL DEFAULT 0,
  plays          INTEGER NOT NULL DEFAULT 0,
  country        TEXT,
  city           TEXT,
  device         TEXT,
  os             TEXT,
  browser        TEXT,
  first_referrer TEXT,
  first_source   TEXT
);

-- ביקור = רצף פעילות; הפסקה של 30 דקות מתחילה ביקור חדש
CREATE TABLE IF NOT EXISTS sessions (
  session_id   TEXT PRIMARY KEY,
  visitor_id   TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  start_day    TEXT NOT NULL,
  start_hour   INTEGER NOT NULL,
  start_dow    INTEGER NOT NULL,
  duration_s   INTEGER NOT NULL DEFAULT 0,   -- מהכניסה ועד הפעילות האחרונה
  active_s     INTEGER NOT NULL DEFAULT 0,   -- זמן שהאתר היה גלוי על המסך
  pageviews    INTEGER NOT NULL DEFAULT 0,
  plays        INTEGER NOT NULL DEFAULT 0,
  listen_s     REAL    NOT NULL DEFAULT 0,
  events       INTEGER NOT NULL DEFAULT 0,
  is_new       INTEGER NOT NULL DEFAULT 0,   -- הביקור הראשון של המבקר
  entry_route  TEXT,
  exit_route   TEXT,
  referrer     TEXT,
  source       TEXT,                         -- utm_source / ref / מקור מזוהה
  campaign     TEXT,
  country      TEXT,
  region       TEXT,
  city         TEXT,
  timezone     TEXT,
  device       TEXT,
  os           TEXT,
  browser      TEXT,
  standalone   INTEGER NOT NULL DEFAULT 0,   -- נפתח כאפליקציה מותקנת
  lang         TEXT,
  screen       TEXT,
  connection   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_day     ON sessions(start_day);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last    ON sessions(last_seen);

-- האזנה = השמעה אחת של שיעור (כולל כמה ממנו נשמע בפועל)
CREATE TABLE IF NOT EXISTS listens (
  listen_id    TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  visitor_id   TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  kind         TEXT,          -- mishna / parasha / moed / iyun
  title        TEXT,
  series       TEXT,
  started_at   INTEGER NOT NULL,
  last_at      INTEGER NOT NULL,
  day          TEXT NOT NULL,
  hour         INTEGER NOT NULL,
  dow          INTEGER NOT NULL,
  listened_s   REAL    NOT NULL DEFAULT 0,   -- שניות מתוך השיעור שנשמעו
  start_pos_s  REAL    NOT NULL DEFAULT 0,
  max_pos_s    REAL    NOT NULL DEFAULT 0,
  duration_s   REAL    NOT NULL DEFAULT 0,
  speed        REAL    NOT NULL DEFAULT 1,
  completed    INTEGER NOT NULL DEFAULT 0,
  resumed      INTEGER NOT NULL DEFAULT 0,   -- המשך מנקודה שמורה
  source       TEXT                          -- מאיפה הופעל: תור, המשך אוטומטי, לחיצה
);
CREATE INDEX IF NOT EXISTS idx_listens_day     ON listens(day);
CREATE INDEX IF NOT EXISTS idx_listens_item    ON listens(item_id);
CREATE INDEX IF NOT EXISTS idx_listens_session ON listens(session_id);
CREATE INDEX IF NOT EXISTS idx_listens_last    ON listens(last_at);

-- אירועים נקודתיים: צפייה בדף, הורדה, פתיחת סיכום, שיתוף, חיפוש, התקנה ועוד
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  day         TEXT NOT NULL,
  hour        INTEGER NOT NULL,
  visitor_id  TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL,
  route       TEXT,
  item_id     TEXT,
  kind        TEXT,
  title       TEXT,
  series      TEXT,
  label       TEXT,
  value       REAL
);
CREATE INDEX IF NOT EXISTS idx_events_day_type ON events(day, type);
CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session_id);
