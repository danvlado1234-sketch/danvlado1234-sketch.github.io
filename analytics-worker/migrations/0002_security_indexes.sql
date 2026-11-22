-- אינדקסים למניעת סריקה מלאה של טבלאות events ו-listens בעת צפייה/מחיקה של מבקר
CREATE INDEX IF NOT EXISTS idx_listens_visitor ON listens(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor  ON events(visitor_id);
