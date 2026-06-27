use font_loader::system_fonts;

/// List all system-installed font family names, deduplicated and sorted.
#[tauri::command]
pub fn list_system_fonts() -> Vec<String> {
    let mut fonts = system_fonts::query_all();
    // Sort alphabetically (case-insensitive)
    fonts.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    // Deduplicate by family name (case-insensitive)
    fonts.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    fonts
}
