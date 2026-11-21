mod brain;
mod keys;
mod music;
mod pc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            music::start(app.handle().clone());
            pc::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            brain::chat,
            keys::save_claude_key,
            keys::has_claude_key,
            keys::delete_claude_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}