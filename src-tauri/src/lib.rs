mod db;
mod models;
mod commands;
mod scheduler;
mod windows_util;

use db::Database;
use tauri::{Emitter, Listener, Manager};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};
use std::sync::Mutex;
use std::path::PathBuf;

fn lang_pref_path(app_dir: &PathBuf) -> PathBuf {
    app_dir.join("lang_pref.json")
}

fn read_lang_pref(app: &tauri::App) -> String {
    let app_dir = app.path().app_data_dir().unwrap_or_default();
    std::fs::read_to_string(lang_pref_path(&app_dir))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("lang").and_then(|l| l.as_str().map(String::from)))
        .unwrap_or_else(|| "en".into())
}

fn write_lang_pref(app: &tauri::AppHandle, lang: &str) {
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::write(
            lang_pref_path(&app_dir),
            format!("{{\"lang\":\"{}\"}}", lang),
        );
    }
}

struct TrayState {
    tray: Mutex<Option<tauri::tray::TrayIcon>>,
}

fn build_tray_menu(app: &tauri::AppHandle, lang: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let (show, quick_add, today, quit) = if lang == "zh" {
        ("显示窗口", "快速添加任务", "今日任务", "退出")
    } else {
        ("Show Window", "Quick Add Task", "Today's Tasks", "Quit")
    };
    let show_item = MenuItem::with_id(app, "show", show, true, None::<&str>)?;
    let quick_add = MenuItem::with_id(app, "quick_add", quick_add, true, None::<&str>)?;
    let today_item = MenuItem::with_id(app, "today", today, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;
    Menu::with_items(app, &[&show_item, &quick_add, &today_item, &quit_item])
}

fn setup_tray(app: &tauri::App) -> tauri::Result<tauri::tray::TrayIcon> {
    // Read saved language preference, default to English
    let lang = read_lang_pref(app);
    let menu = build_tray_menu(&app.handle(), &lang)?;
    let mut builder = TrayIconBuilder::new()
        .icon_as_template(false)
        .menu(&menu);
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    let tray = builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quick_add" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = app.emit("tray-quick-add", ());
                }
            }
            "today" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = app.emit("tray-today", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(tray)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows: set AppUserModelID so toast notifications show "Planly" instead of "PowerShell"
    #[cfg(target_os = "windows")]
    windows_util::setup_app_user_model();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Windows: ensure Start Menu shortcut exists (required for toast notifications with icon)
            #[cfg(target_os = "windows")]
            {
                let _ = windows_util::ensure_start_menu_shortcut(&app.handle());
            }
            let app_dir = {
                // Prefer a "data" folder next to the executable (portable-style),
                // fall back to the OS app-data directory if not writable (e.g. Program Files).
                let portable = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.join("data")));
                let use_portable = portable.as_ref()
                    .map(|p| std::fs::create_dir_all(p).is_ok())
                    .unwrap_or(false);
                if use_portable {
                    portable.unwrap()
                } else {
                    app.path().app_data_dir().expect("failed to get app data dir")
                }
            };
            let database = Database::new(app_dir).expect("failed to initialize database");
            app.manage(database);
            app.manage(TrayState { tray: Mutex::new(None) });
            let app_handle = app.handle().clone();
            crate::scheduler::start_scheduler(app_handle);

            // Build system tray (default English, will update on lang event)
            let tray = setup_tray(app)?;
            *app.state::<TrayState>().tray.lock().map_err(|_| "poisoned lock")? = Some(tray);

            // Listen for language changes from frontend
            let listen_handle = app.handle().clone();
            let state_handle = app.handle().clone();
            listen_handle.listen("main:lang-changed", move |event| {
                let lang: String = serde_json::from_str::<serde_json::Value>(event.payload())
                    .ok()
                    .and_then(|v| v.get("lang")?.as_str().map(String::from))
                    .unwrap_or_else(|| "en".into());
                write_lang_pref(&state_handle, &lang);
                let state = state_handle.state::<TrayState>();
                let guard = match state.tray.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };
                if let Some(tray) = guard.as_ref() {
                    if let Ok(menu) = build_tray_menu(&state_handle, &lang) {
                        let _ = tray.set_menu(Some(menu));
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::create_task,
            commands::tasks::get_tasks,
            commands::tasks::get_subtasks,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::reorder_tasks,
            commands::tasks::get_all_tasks_flat,
            commands::tasks::archive_completed,
            commands::tasks::unarchive_task,
            commands::groups::get_groups,
            commands::groups::create_group,
            commands::groups::update_group,
            commands::groups::delete_group,
            commands::groups::archive_group,
            commands::groups::reorder_groups,
            commands::reminders::create_reminder,
            commands::reminders::get_reminders,
            commands::reminders::get_all_pending_reminders,
            commands::reminders::delete_reminder,
            commands::reminders::toggle_reminder,
            commands::reminders::snooze_reminder,
            commands::export::export_all,
            commands::export::import_all,
            commands::export::export_to_file,
            commands::export::import_from_file,
            commands::export::clear_all_data,
            commands::images::save_note_image,
            commands::images::delete_note_image,
            commands::images::get_note_image_data_url,
            commands::fonts::list_system_fonts,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
