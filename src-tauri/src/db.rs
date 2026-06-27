use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
    pub app_dir: PathBuf,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("planly.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Database {
            conn: Mutex::new(conn),
            app_dir,
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::InvalidParameterName("database lock poisoned".into()))?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS task_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6366f1',
                icon TEXT NOT NULL DEFAULT 'folder',
                sort_order REAL NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                parent_id TEXT,
                title TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'p2',
                status TEXT NOT NULL DEFAULT 'todo',
                due_date TEXT,
                due_time TEXT,
                sort_order REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                type TEXT NOT NULL,
                remind_at TEXT,
                advance_minutes INTEGER,
                repeat_rule TEXT,
                snooze_minutes INTEGER NOT NULL DEFAULT 10,
                enabled INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                action TEXT NOT NULL,
                detail TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
        ",
        )?;
        // Migration: add icon column (ignore error if already exists)
        conn.execute("ALTER TABLE task_groups ADD COLUMN icon TEXT NOT NULL DEFAULT 'folder'", []).ok();
        // Migration: add recurrence column
        conn.execute("ALTER TABLE tasks ADD COLUMN recurrence TEXT", []).ok();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_db(name: &str) -> Database {
        let dir = std::env::temp_dir().join(format!("planly_test_{}", name));
        let _ = std::fs::remove_dir_all(&dir);
        Database::new(dir).expect("failed to create test db")
    }

    #[test]
    fn creates_tables_on_init() {
        let db = test_db("creates_tables");
        let conn = db.conn.lock().unwrap();
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tasks'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn inserts_and_reads_task() {
        let db = test_db("insert_read");
        let conn = db.conn.lock().unwrap();
        // Create group first (FK constraint)
        conn.execute("INSERT INTO task_groups (id, name, sort_order, created_at) VALUES ('g1','Test',0,'2026-01-01')", []).unwrap();
        conn.execute(
            "INSERT INTO tasks (id, group_id, title, priority, status, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params!["t1", "g1", "Test", "p2", "todo", 0.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        ).unwrap();
        let title: String = conn.query_row("SELECT title FROM tasks WHERE id='t1'", [], |r| r.get(0)).unwrap();
        assert_eq!(title, "Test");
    }

    #[test]
    fn foreign_key_enforcement() {
        let db = test_db("fk");
        let conn = db.conn.lock().unwrap();
        let result = conn.execute(
            "INSERT INTO tasks (id, group_id, title, priority, status, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params!["t2", "nonexistent", "Bad", "p2", "todo", 0.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        );
        assert!(result.is_err());
    }

    #[test]
    fn cascade_delete_subtasks() {
        let db = test_db("cascade");
        let conn = db.conn.lock().unwrap();
        conn.execute("INSERT INTO task_groups (id, name, sort_order, created_at) VALUES ('g1','Test',0,'2026-01-01')", []).unwrap();
        conn.execute(
            "INSERT INTO tasks (id, group_id, title, priority, status, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params!["parent", "g1", "Parent", "p2", "todo", 0.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        ).unwrap();
        conn.execute(
            "INSERT INTO tasks (id, group_id, parent_id, title, priority, status, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            rusqlite::params!["sub", "g1", "parent", "Sub", "p2", "todo", 1.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        ).unwrap();
        conn.execute("DELETE FROM tasks WHERE id='parent'", []).unwrap();
        let count: i32 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE id='sub'", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn recurrence_column_exists() {
        let db = test_db("recurrence");
        let conn = db.conn.lock().unwrap();
        conn.execute("INSERT INTO task_groups (id, name, sort_order, created_at) VALUES ('g1','Test',0,'2026-01-01')", []).unwrap();
        conn.execute(
            "INSERT INTO tasks (id, group_id, title, recurrence, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params!["t3", "g1", "Recurring Task", "weekly", 0.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        ).unwrap();
        let rec: String = conn.query_row("SELECT recurrence FROM tasks WHERE id='t3'", [], |r| r.get(0)).unwrap();
        assert_eq!(rec, "weekly");
    }
}
