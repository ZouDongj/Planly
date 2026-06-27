use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskGroup {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub sort_order: f64,
    pub archived: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub group_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub note: String,
    pub priority: String,
    pub status: String,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub sort_order: f64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub recurrence: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reminder {
    pub id: String,
    pub task_id: String,
    #[serde(rename = "type")]
    pub reminder_type: String,
    pub remind_at: Option<String>,
    pub advance_minutes: Option<i32>,
    pub repeat_rule: Option<String>,
    pub snooze_minutes: i32,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityLog {
    pub id: String,
    pub task_id: String,
    pub action: String,
    pub detail: String,
    pub created_at: String,
}
