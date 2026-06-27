use crate::db::Database;
use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager};

fn show_notification(title: &str, body: &str) {
    use notify_rust::Notification;
    let _ = Notification::new()
        .app_id("com.z7614.planly")
        .summary(title)
        .body(body)
        .show();
}

pub fn start_scheduler(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            let db = app.state::<Database>();
            let conn = match db.conn.lock() {
                Ok(c) => c,
                Err(_) => continue,
            };

            let now = Utc::now();
            let now_str = now.to_rfc3339();

            // Fetch due reminders with task titles
            let due: Vec<(String, String, String, String, Option<String>, Option<i32>)> = conn
                .prepare(
                    "SELECT r.id, r.task_id, r.type, COALESCE(t.title, 'Untitled'), r.repeat_rule, r.advance_minutes
                     FROM reminders r JOIN tasks t ON r.task_id = t.id
                     WHERE r.enabled = 1 AND r.remind_at IS NOT NULL AND r.remind_at <= ?1"
                )
                .and_then(|mut stmt| {
                    stmt.query_map(rusqlite::params![now_str], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, Option<i32>>(5)?,
                        ))
                    })?.collect::<Result<Vec<_>, _>>()
                })
                .unwrap_or_default();

            for (reminder_id, task_id, rtype, title, repeat_rule, advance_minutes) in &due {
                // Emit event to frontend
                let _ = app.emit("reminder-fired", serde_json::json!({
                    "reminder_id": reminder_id,
                    "task_id": task_id,
                    "title": title,
                }));

                // Show native Windows notification with our AUMID
                show_notification("Planly Reminder", title);

                // Handle post-fire logic
                match rtype.as_str() {
                    "one_time" => {
                        // Disable after firing
                        let _ = conn.execute(
                            "UPDATE reminders SET enabled = 0 WHERE id = ?1",
                            rusqlite::params![reminder_id],
                        );
                    }
                    "recurring" => {
                        // Calculate next occurrence from cron rule
                        if let Some(cron_expr) = repeat_rule {
                            if let Ok(schedule) = cron_expr.parse::<cron::Schedule>() {
                                if let Some(next) = schedule.upcoming(Utc).next() {
                                    let _ = conn.execute(
                                        "UPDATE reminders SET remind_at = ?1 WHERE id = ?2",
                                        rusqlite::params![next.to_rfc3339(), reminder_id],
                                    );
                                }
                            }
                        }
                    }
                    "due_date" => {
                        // Re-schedule for next occurrence if task still has a due date
                        let task_due: Option<String> = conn.query_row(
                            "SELECT due_date FROM tasks WHERE id = ?1",
                            rusqlite::params![task_id],
                            |row| row.get(0),
                        ).ok().flatten();

                        if let Some(due_str) = task_due {
                            if let Ok(due_date) = chrono::NaiveDate::parse_from_str(&due_str[..10], "%Y-%m-%d") {
                                let advance = advance_minutes.unwrap_or(30);
                                let Some(base) = due_date.and_hms_opt(9, 0, 0) else { continue };
                                let next = base - chrono::Duration::minutes(advance as i64);
                                let next_utc = next.and_utc();
                                if next_utc > now {
                                    let _ = conn.execute(
                                        "UPDATE reminders SET remind_at = ?1 WHERE id = ?2",
                                        rusqlite::params![next_utc.to_rfc3339(), reminder_id],
                                    );
                                } else {
                                    let _ = conn.execute(
                                        "UPDATE reminders SET enabled = 0 WHERE id = ?1",
                                        rusqlite::params![reminder_id],
                                    );
                                }
                            }
                        } else {
                            // Task has no due date anymore — disable
                            let _ = conn.execute(
                                "UPDATE reminders SET enabled = 0 WHERE id = ?1",
                                rusqlite::params![reminder_id],
                            );
                        }
                    }
                    _ => {}
                }
            }

            // Handle advance reminders: tasks with due_date AND advance_minutes set
            let advance_due: Vec<(String, String, String, i32)> = conn
                .prepare(
                    "SELECT r.id, r.task_id, COALESCE(t.title, 'Untitled'), r.advance_minutes
                     FROM reminders r JOIN tasks t ON r.task_id = t.id
                     WHERE r.enabled = 1 AND r.type = 'due_date' AND r.advance_minutes IS NOT NULL
                     AND r.remind_at IS NULL AND t.due_date IS NOT NULL AND t.status != 'done'"
                )
                .and_then(|mut stmt| {
                    stmt.query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, i32>(3)?,
                        ))
                    })?.collect::<Result<Vec<_>, _>>()
                })
                .unwrap_or_default();

            for (reminder_id, task_id, title, advance_minutes) in &advance_due {
                // Check if due_date is within advance window
                let task_data: Option<(String, Option<String>)> = conn.query_row(
                    "SELECT due_date, due_time FROM tasks WHERE id = ?1",
                    rusqlite::params![task_id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
                ).ok();

                if let Some((due_date_str, due_time_str)) = task_data {
                    let time_str = due_time_str.as_deref().unwrap_or("23:59");
                    if let Ok(due_dt) = chrono::NaiveDateTime::parse_from_str(
                        &format!("{} {}", &due_date_str[..10], time_str),
                        "%Y-%m-%d %H:%M"
                    ) {
                        let remind_at = due_dt - chrono::Duration::minutes(*advance_minutes as i64);
                        if remind_at.and_utc() <= now {
                            let _ = app.emit("reminder-fired", serde_json::json!({
                                "reminder_id": reminder_id,
                                "task_id": task_id,
                                "title": format!("⏰ {} — {} min before due", title, advance_minutes),
                            }));
                            show_notification(
                                "Planly Reminder",
                                &format!("{} — {} min before due", title, advance_minutes),
                            );
                            // Mark as fired so it won't fire again
                            let _ = conn.execute(
                                "UPDATE reminders SET remind_at = ?1 WHERE id = ?2",
                                rusqlite::params![now_str, reminder_id],
                            );
                        }
                    }
                }
            }
        }
    });
}
