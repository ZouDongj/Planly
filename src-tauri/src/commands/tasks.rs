use crate::db::Database;
use crate::models::Task;
use chrono::Utc;
use chrono::Datelike;
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateTaskInput {
    pub group_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub note: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub recurrence: Option<String>,
}

#[tauri::command]
pub fn create_task(db: State<Database>, input: CreateTaskInput) -> Result<Task, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let max_sort: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM tasks WHERE group_id = ?1 AND parent_id IS ?2",
            rusqlite::params![input.group_id, input.parent_id],
            |row| row.get(0),
        )
        .unwrap_or(-1.0);

    let sort_order = max_sort + 1.0;

    conn.execute(
        "INSERT INTO tasks (id, group_id, parent_id, title, note, priority, status, due_date, due_time, recurrence, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'todo', ?7, ?8, ?9, ?10, ?11, ?11)",
        rusqlite::params![
            id, input.group_id, input.parent_id, input.title,
            input.note.as_deref().unwrap_or(""),
            input.priority.as_deref().unwrap_or("p2"),
            input.due_date, input.due_time,
            input.recurrence.as_deref(),
            sort_order, now
        ],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO activity_log (id, task_id, action, detail, created_at) VALUES (?1, ?2, 'created', 'Task created', ?3)",
        rusqlite::params![Uuid::new_v4().to_string(), id, now],
    ).map_err(|e| e.to_string())?;

    let task = conn.query_row(
        "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks WHERE id = ?1",
        rusqlite::params![id],
        |row| row_to_task(row),
    ).map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
pub fn get_tasks(db: State<Database>, group_id: Option<String>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tasks = if let Some(gid) = group_id {
        let mut stmt = conn.prepare(
            "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks WHERE group_id = ?1 AND parent_id IS NULL ORDER BY sort_order"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![gid], |row| row_to_task(row))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks WHERE parent_id IS NULL ORDER BY group_id, sort_order"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row_to_task(row))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };
    Ok(tasks)
}

#[tauri::command]
pub fn get_subtasks(db: State<Database>, parent_id: String) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks WHERE parent_id = ?1 ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params![parent_id], |row| row_to_task(row))
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[derive(Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub note: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub group_id: Option<String>,
    pub recurrence: Option<String>,
}

#[tauri::command]
pub fn update_task(db: State<Database>, input: UpdateTaskInput) -> Result<Task, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    if let Some(title) = &input.title {
        conn.execute("UPDATE tasks SET title = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![title, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(note) = &input.note {
        conn.execute("UPDATE tasks SET note = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![note, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(priority) = &input.priority {
        conn.execute("UPDATE tasks SET priority = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![priority, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(status) = &input.status {
        let completed_at: Option<String> = if status == "done" { Some(now.clone()) } else { None };
        conn.execute("UPDATE tasks SET status = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
            rusqlite::params![status, completed_at, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(due_date) = &input.due_date {
        let d: Option<&str> = if due_date.is_empty() { None } else { Some(due_date) };
        conn.execute("UPDATE tasks SET due_date = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![d, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(due_time) = &input.due_time {
        let t: Option<&str> = if due_time.is_empty() { None } else { Some(due_time) };
        conn.execute("UPDATE tasks SET due_time = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![t, now, input.id]).map_err(|e| e.to_string())?;
    }
    if let Some(group_id) = &input.group_id {
        conn.execute("UPDATE tasks SET group_id = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![group_id, now, input.id]).map_err(|e| e.to_string())?;
    }

    // Recurrence handler
    if let Some(recurrence) = &input.recurrence {
        let r: Option<&str> = if recurrence.is_empty() { None } else { Some(recurrence) };
        conn.execute("UPDATE tasks SET recurrence = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![r, now, input.id]).map_err(|e| e.to_string())?;
    }

    // If status changed to "done" and task has recurrence, create next instance
    if let Some(status) = &input.status {
        if status == "done" {
            let recurring = conn.query_row(
                "SELECT recurrence FROM tasks WHERE id = ?1",
                rusqlite::params![input.id],
                |row| row.get::<_, Option<String>>(0),
            ).map_err(|e| e.to_string())?;

            if let Some(ref rec) = recurring {
                if !rec.is_empty() {
                    let task = conn.query_row(
                        "SELECT group_id, parent_id, title, note, priority, due_date, due_time FROM tasks WHERE id = ?1",
                        rusqlite::params![input.id],
                        |row| Ok((
                            row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?,
                            row.get::<_, String>(2)?, row.get::<_, String>(3)?,
                            row.get::<_, String>(4)?, row.get::<_, Option<String>>(5)?,
                            row.get::<_, Option<String>>(6)?,
                        )),
                    ).map_err(|e| e.to_string())?;
                    let (group_id, parent_id, title, note, priority, due_date, due_time) = task;

                    if let Some(due) = due_date {
                        let d = chrono::NaiveDate::parse_from_str(&due, "%Y-%m-%d").ok();
                        let next_due = match (rec.as_str(), d) {
                            ("daily", Some(d)) => Some((d + chrono::Duration::days(1)).format("%Y-%m-%d").to_string()),
                            ("weekly", Some(d)) => Some((d + chrono::Duration::weeks(1)).format("%Y-%m-%d").to_string()),
                            ("monthly", Some(d)) => {
                                let (y, m, day) = (d.year(), d.month(), d.day());
                                let next_month = if m == 12 { 1 } else { m + 1 };
                                let next_year = if m == 12 { y + 1 } else { y };
                                let max_day = chrono::NaiveDate::from_ymd_opt(next_year, next_month, 1)
                                    .and_then(|nd| nd.pred_opt().or(Some(nd)))
                                    .map(|ld| ld.day())
                                    .unwrap_or(28);
                                Some(format!("{:04}-{:02}-{:02}", next_year, next_month, day.min(max_day)))
                            }
                            _ => None,
                        };

                        if let Some(next_due) = next_due {

                        let next_id = Uuid::new_v4().to_string();
                        let max_sort: f64 = conn.query_row(
                            "SELECT COALESCE(MAX(sort_order), -1) FROM tasks WHERE group_id = ?1 AND parent_id IS ?2",
                            rusqlite::params![group_id, parent_id],
                            |row| row.get(0),
                        ).unwrap_or(-1.0);
                        let next_sort = max_sort + 1.0;

                        conn.execute(
                            "INSERT INTO tasks (id, group_id, parent_id, title, note, priority, status, due_date, due_time, recurrence, sort_order, created_at, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'todo', ?7, ?8, ?9, ?10, ?11, ?11)",
                            rusqlite::params![
                                next_id, group_id, parent_id, title, note, priority,
                                next_due, due_time, rec.as_str(), next_sort, now
                            ],
                        ).map_err(|e| e.to_string())?;

                        conn.execute(
                            "INSERT INTO activity_log (id, task_id, action, detail, created_at) VALUES (?1, ?2, 'created', 'Recurring task auto-created', ?3)",
                            rusqlite::params![Uuid::new_v4().to_string(), next_id, now],
                        ).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }
    }

    conn.execute(
        "INSERT INTO activity_log (id, task_id, action, detail, created_at) VALUES (?1, ?2, 'updated', 'Task updated', ?3)",
        rusqlite::params![Uuid::new_v4().to_string(), input.id, now],
    ).map_err(|e| e.to_string())?;

    let task = conn.query_row(
        "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks WHERE id = ?1",
        rusqlite::params![input.id],
        |row| row_to_task(row),
    ).map_err(|e| e.to_string())?;
    Ok(task)
}

#[tauri::command]
pub fn delete_task(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_tasks(db: State<Database>, task_ids: Vec<String>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    for (i, id) in task_ids.iter().enumerate() {
        conn.execute("UPDATE tasks SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![i as f64, Utc::now().to_rfc3339(), id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_all_tasks_flat(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, group_id, parent_id, title, note, priority, status, due_date, due_time, sort_order, created_at, updated_at, completed_at, recurrence FROM tasks ORDER BY group_id, sort_order"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row_to_task(row))
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn archive_completed(db: State<Database>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let count = conn.execute(
        "UPDATE tasks SET status = 'archived', completed_at = ?1, updated_at = ?1 WHERE status = 'done' AND parent_id IS NULL",
        rusqlite::params![now],
    ).map_err(|e| e.to_string())?;
    Ok(format!("{}", count))
}

#[tauri::command]
pub fn unarchive_task(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET status = 'done', updated_at = ?1 WHERE id = ?2 AND status = 'archived'",
        rusqlite::params![Utc::now().to_rfc3339(), id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        group_id: row.get(1)?,
        parent_id: row.get(2)?,
        title: row.get(3)?,
        note: row.get(4)?,
        priority: row.get(5)?,
        status: row.get(6)?,
        due_date: row.get(7)?,
        due_time: row.get(8)?,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        completed_at: row.get(12)?,
        recurrence: row.get(13)?,
    })
}
