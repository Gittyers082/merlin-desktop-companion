//! Keeps the Claude API key in the Windows Credential Manager —
//! never in a plain file, and never sent back to the web page.

use keyring::Entry;

// Kept from before the rename so keys saved by earlier builds still work.
const SERVICE: &str = "merlin-desktop-pet";
const ACCOUNT: &str = "claude-api-key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

/// The saved key, if there is one. Only Rust ever reads it.
pub fn claude_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_claude_key(key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("Paste a key first.".into());
    }
    entry()?.set_password(key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_claude_key() -> Result<bool, String> {
    Ok(claude_key()?.is_some())
}

#[tauri::command]
pub fn delete_claude_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
