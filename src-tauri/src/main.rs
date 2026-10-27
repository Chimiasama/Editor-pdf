#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri_plugin_dialog::DialogExt;

// The webview never supplies a destination path: the user chooses it in a native dialog.
#[tauri::command]
async fn save_pdf(app: tauri::AppHandle, bytes: Vec<u8>, suggested_name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let filename = std::path::Path::new(&suggested_name)
            .file_name().and_then(|n| n.to_str()).unwrap_or("documento_editado.pdf");
        let selected = app.dialog().file().add_filter("PDF", &["pdf"])
            .set_file_name(filename).blocking_save_file();
        let Some(selected) = selected else { return Ok(false) };
        let path = selected.into_path().map_err(|e| e.to_string())?;
        std::fs::write(path, bytes).map_err(|e| format!("Não foi possível salvar o PDF: {e}"))?;
        Ok(true)
    }).await.map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![save_pdf])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o EditPDF");
}
