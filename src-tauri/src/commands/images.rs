use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;
use crate::db::Database;

fn resolve_image_path(db: &Database, filepath: &str) -> Result<PathBuf, String> {
    let images_dir = db.app_dir.join("images");
    let filename = Path::new(filepath)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Invalid image path: {}", filepath))?;
    let resolved = images_dir.join(filename);
    // Canonicalize to resolve symlinks and validate the path
    let canonical = resolved.canonicalize().map_err(|e| format!("Image not found: {}", e))?;
    let canonical_images = images_dir.canonicalize().unwrap_or_else(|_| images_dir.clone());
    if !canonical.starts_with(&canonical_images) {
        return Err("Access denied: path outside images directory".into());
    }
    Ok(canonical)
}

fn mime_from_ext(ext: &str) -> &str {
    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "image/png",
    }
}

#[tauri::command]
pub fn save_note_image(
    db: State<'_, Database>,
    data: Vec<u8>,
    ext: String,
) -> Result<String, String> {
    let images_dir = db.app_dir.join("images");
    fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let filepath = images_dir.join(&filename);
    fs::write(&filepath, data).map_err(|e| e.to_string())?;

    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_note_image(
    db: State<'_, Database>,
    filepath: String,
) -> Result<(), String> {
    let path = resolve_image_path(&db, &filepath)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_note_image_data_url(
    db: State<'_, Database>,
    filepath: String,
) -> Result<String, String> {
    let path = resolve_image_path(&db, &filepath)?;
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = mime_from_ext(ext);
    let b64 = base64_encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 { result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char); } else { result.push('='); }
        if chunk.len() > 2 { result.push(CHARS[(triple & 0x3F) as usize] as char); } else { result.push('='); }
    }
    result
}
