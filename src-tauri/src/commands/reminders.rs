use crate::db::Database;
use crate::models::Reminder;
use chrono::Utc;
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateReminderInput {
    pub task_id: String,
    pub reminder_type: String,
    pub remind_at: Option<String>,
    pub advance_minutes: Option<i32>,
    pub repeat_rule: Option<String>,
    pub snooze_minutes: Option<i32>,
}

#[tauri::command]
pub fn create_reminder(db: State<Database>, input: CreateReminderInput) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO reminders (id, task_id, type, remind_at, advance_minutes, repeat_rule, snooze_minutes, enabled)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
        rusqlite::params![
            id, input.task_id, input.reminder_type,
            input.remind_at, input.advance_minutes, input.repeat_rule,
            input.snooze_minutes.unwrap_or(10),
        ],
    ).map_err(|e| e.to_string())?;

    Ok(Reminder {
        id,
        task_id: input.task_id,
        reminder_type: input.reminder_type,
        remind_at: input.remind_at,
        advance_minutes: input.advance_minutes,
        repeat_rule: input.repeat_rule,
        snooze_minutes: input.snooze_minutes.unwrap_or(10),
        enabled: true,
    })
}

#[tauri::command]
pub fn get_reminders(db: State<Database>, task_id: String) -> Result<Vec<Reminder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, type, remind_at, advance_minutes, repeat_rule, snooze_minutes, enabled FROM reminders WHERE task_id = ?1"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params![task_id], |row| {
        Ok(Reminder {
            id: row.get(0)?,
            task_id: row.get(1)?,
            reminder_type: row.get(2)?,
            remind_at: row.get(3)?,
            advance_minutes: row.get(4)?,
            repeat_rule: row.get(5)?,
            snooze_minutes: row.get(6)?,
            enabled: row.get::<_, i32>(7)? != 0,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn get_all_pending_reminders(db: State<Database>) -> Result<Vec<Reminder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, type, remind_at, advance_minutes, repeat_rule, snooze_minutes, enabled FROM reminders WHERE enabled = 1"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Reminder {
            id: row.get(0)?,
            task_id: row.get(1)?,
            reminder_type: row.get(2)?,
            remind_at: row.get(3)?,
            advance_minutes: row.get(4)?,
            repeat_rule: row.get(5)?,
            snooze_minutes: row.get(6)?,
            enabled: row.get::<_, i32>(7)? != 0,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn delete_reminder(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM reminders WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_reminder(db: State<Database>, id: String, enabled: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE reminders SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![enabled as i32, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn snooze_reminder(db: State<Database>, reminder_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let snooze_minutes: i32 = conn.query_row(
        "SELECT snooze_minutes FROM reminders WHERE id = ?1",
        rusqlite::params![reminder_id], |row| row.get(0)
    ).unwrap_or(10);
    let new_time = Utc::now() + chrono::Duration::minutes(snooze_minutes as i64);
    conn.execute("UPDATE reminders SET remind_at = ?1 WHERE id = ?2",
        rusqlite::params![new_time.to_rfc3339(), reminder_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
