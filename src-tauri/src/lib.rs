mod brain;
mod music;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            music::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![brain::chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}