//! Merlin's brain: sends the conversation to a local Ollama model and
//! streams the reply back to the front end, piece by piece.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const OLLAMA_URL: &str = "http://localhost:11434/api/chat";
const DEFAULT_MODEL: &str = "llama3.2";

/// One message in the conversation ("system", "user" or "assistant").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: String,
}

/// What we send to the front end while Merlin is answering.
#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum ChatEvent {
    /// The next piece of his reply.
    Token { text: String },
    /// He has finished talking.
    Done,
}

/// The body Ollama's /api/chat endpoint expects.
#[derive(Serialize)]
struct OllamaRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
}

/// One line of Ollama's streamed reply.
#[derive(Deserialize)]
struct OllamaChunk {
    message: Option<ChatMessage>,
    #[serde(default)]
    done: bool,
    error: Option<String>,
}

/// Asks Merlin something. Called from TypeScript with `invoke("chat", …)`.
#[tauri::command]
pub async fn chat(
    messages: Vec<ChatMessage>,
    model: Option<String>,
    on_event: Channel<ChatEvent>,
) -> Result<(), String> {
    let model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let request = OllamaRequest {
        model: &model,
        messages: &messages,
        stream: true,
    };

    let response = reqwest::Client::new()
        .post(OLLAMA_URL)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach Ollama. Is it running? ({e})"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {body}"));
    }

    // Ollama streams one JSON object per line. Network chunks don't line up
    // with lines, so we collect bytes and handle each complete line.
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.extend_from_slice(&chunk);

        while let Some(newline) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=newline).collect();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let parsed: OllamaChunk = serde_json::from_str(line).map_err(|e| e.to_string())?;
            if let Some(error) = parsed.error {
                return Err(format!("Ollama error: {error}"));
            }
            if let Some(message) = parsed.message {
                if !message.content.is_empty() {
                    on_event
                        .send(ChatEvent::Token { text: message.content })
                        .map_err(|e| e.to_string())?;
                }
            }
            if parsed.done {
                on_event.send(ChatEvent::Done).map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
    }

    // The stream ended without a "done" line; finish anyway.
    on_event.send(ChatEvent::Done).map_err(|e| e.to_string())?;
    Ok(())
}