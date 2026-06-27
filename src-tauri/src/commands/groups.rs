use crate::db::Database;
use crate::models::TaskGroup;
use chrono::Utc;
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_groups(db: State<Database>) -> Result<Vec<TaskGroup>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, sort_order, archived, created_at FROM task_groups WHERE archived = 0 ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(TaskGroup {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            sort_order: row.get(4)?,
            archived: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[derive(Deserialize)]
pub struct CreateGroupInput {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[tauri::command]
pub fn create_group(db: State<Database>, input: CreateGroupInput) -> Result<TaskGroup, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let max_sort: f64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM task_groups", [], |row| row.get(0)
    ).unwrap_or(-1.0);

    conn.execute(
        "INSERT INTO task_groups (id, name, color, icon, sort_order, archived, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        rusqlite::params![id, input.name, input.color.as_deref().unwrap_or("#6366f1"), input.icon.as_deref().unwrap_or("folder"), max_sort + 1.0, now],
    ).map_err(|e| e.to_string())?;

    Ok(TaskGroup {
        id,
        name: input.name,
        color: input.color.unwrap_or_else(|| "#6366f1".to_string()),
        icon: input.icon.unwrap_or_else(|| "folder".to_string()),
        sort_order: max_sort + 1.0,
        archived: false,
        created_at: now,
    })
}

#[derive(Deserialize)]
pub struct UpdateGroupInput {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[tauri::command]
pub fn update_group(db: State<Database>, input: UpdateGroupInput) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    if let Some(name) = &input.name {
        conn.execute("UPDATE task_groups SET name = ?1 WHERE id = ?2", rusqlite::params![name, input.id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(color) = &input.color {
        conn.execute("UPDATE task_groups SET color = ?1 WHERE id = ?2", rusqlite::params![color, input.id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(icon) = &input.icon {
        conn.execute("UPDATE task_groups SET icon = ?1 WHERE id = ?2", rusqlite::params![icon, input.id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_group(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM task_groups WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn archive_group(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE task_groups SET archived = 1 WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_groups(db: State<Database>, group_ids: Vec<String>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    for (i, id) in group_ids.iter().enumerate() {
        conn.execute("UPDATE task_groups SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![i as f64, id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}
