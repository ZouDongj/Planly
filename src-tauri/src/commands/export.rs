use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct ExportData {
    pub groups: Vec<crate::models::TaskGroup>,
    pub tasks: Vec<crate::models::Task>,
    pub reminders: Vec<crate::models::Reminder>,
    pub activity_log: Vec<crate::models::ActivityLog>,
    pub exported_at: String,
}

#[tauri::command]
pub fn export_all(db: State<Database>) -> Result<ExportData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, sort_order, archived, created_at FROM task_groups"
    ).map_err(|e| e.to_string())?;
    let groups: Vec<_> = stmt.query_map([], |row| {
        Ok(crate::models::TaskGroup {
            id: row.get(0)?, name: row.get(1)?, color: row.get(2)?, icon: row.get(3)?,
            sort_order: row.get(4)?, archived: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let mut stmt = conn.prepare(
        "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks"
    ).map_err(|e| e.to_string())?;
    let tasks: Vec<_> = stmt.query_map([], |row| {
        Ok(crate::models::Task {
            id: row.get(0)?, group_id: row.get(1)?, parent_id: row.get(2)?,
            title: row.get(3)?, note: row.get(4)?, priority: row.get(5)?,
            status: row.get(6)?, due_date: row.get(7)?, due_time: row.get(8)?,
            sort_order: row.get(9)?, created_at: row.get(10)?,
            updated_at: row.get(11)?, completed_at: row.get(12)?,
            recurrence: row.get(13)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let mut stmt = conn.prepare(
        "SELECT id, task_id, type, remind_at, advance_minutes, repeat_rule, snooze_minutes, enabled FROM reminders"
    ).map_err(|e| e.to_string())?;
    let reminders: Vec<_> = stmt.query_map([], |row| {
        Ok(crate::models::Reminder {
            id: row.get(0)?, task_id: row.get(1)?, reminder_type: row.get(2)?,
            remind_at: row.get(3)?, advance_minutes: row.get(4)?,
            repeat_rule: row.get(5)?, snooze_minutes: row.get(6)?,
            enabled: row.get::<_, i32>(7)? != 0,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let mut stmt = conn.prepare(
        "SELECT id, task_id, action, detail, created_at FROM activity_log"
    ).map_err(|e| e.to_string())?;
    let activity_log: Vec<_> = stmt.query_map([], |row| {
        Ok(crate::models::ActivityLog {
            id: row.get(0)?, task_id: row.get(1)?, action: row.get(2)?,
            detail: row.get(3)?, created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(ExportData {
        groups, tasks, reminders, activity_log,
        exported_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn import_all(db: State<Database>, data: ExportData) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut imported = 0;

    // Clear existing data first so the backup fully replaces current state.
    conn.execute_batch("
        DELETE FROM activity_log;
        DELETE FROM reminders;
        DELETE FROM tasks;
        DELETE FROM task_groups;
    ").map_err(|e| e.to_string())?;

    // Deduplicate groups by name — keeps the first occurrence, maps duplicate
    // IDs to the canonical one so tasks referencing them stay valid.
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut id_remap: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for group in &data.groups {
        if seen_names.contains(&group.name) {
            // This is a duplicate — map its ID to the canonical group
            if let Some(canonical_id) = id_remap.get(&group.name) {
                id_remap.insert(group.id.clone(), canonical_id.clone());
            }
            continue;
        }
        seen_names.insert(group.name.clone());
        id_remap.insert(group.name.clone(), group.id.clone());
        // Also map the group's own id to itself (identity)
        id_remap.insert(group.id.clone(), group.id.clone());

        conn.execute(
            "INSERT OR IGNORE INTO task_groups (id, name, color, icon, sort_order, archived, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![group.id, group.name, group.color, group.icon, group.sort_order, group.archived as i32, group.created_at],
        ).ok();
        imported += 1;
    }

    // Build a lookup: any group id → canonical id
    let mut group_id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for group in &data.groups {
        if let Some(canonical) = id_remap.get(&group.id) {
            group_id_map.insert(group.id.clone(), canonical.clone());
        }
    }

    for task in &data.tasks {
        // Remap group_id to the canonical group (dedup by name)
        let resolved_group_id = group_id_map.get(&task.group_id).cloned().unwrap_or_else(|| task.group_id.clone());
        conn.execute(
            "INSERT OR IGNORE INTO tasks (id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            rusqlite::params![task.id, resolved_group_id, task.parent_id, task.title, task.note, task.priority, task.status, task.due_date, task.due_time, task.sort_order, task.created_at, task.updated_at, task.completed_at, task.recurrence],
        ).ok();
        imported += 1;
    }
    for reminder in &data.reminders {
        conn.execute(
            "INSERT OR IGNORE INTO reminders (id, task_id, type, remind_at, advance_minutes, repeat_rule, snooze_minutes, enabled) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            rusqlite::params![reminder.id, reminder.task_id, reminder.reminder_type, reminder.remind_at, reminder.advance_minutes, reminder.repeat_rule, reminder.snooze_minutes, reminder.enabled as i32],
        ).ok();
    }

    Ok(format!("{}", imported))
}

/// Export all data to a JSON file at the given path (Rust std file IO, no fs plugin needed).
#[tauri::command]
pub fn export_to_file(db: State<Database>, path: String) -> Result<String, String> {
    let data = export_all(db)?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok("ok".into())
}

/// Import data from a JSON file at the given path.
#[tauri::command]
pub fn import_from_file(db: State<Database>, path: String) -> Result<String, String> {
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: ExportData = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    import_all(db, data)
}

#[tauri::command]
pub fn clear_all_data(db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("
        DELETE FROM activity_log;
        DELETE FROM reminders;
        DELETE FROM tasks;
        DELETE FROM task_groups;
    ").map_err(|e| e.to_string())?;
    Ok("All data cleared".into())
}
