//! Merlin's brain: sends the conversation to a local Ollama model or to
//! the Claude API, and streams the reply back to the front end piece by piece.

use crate::keys;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const OLLAMA_URL: &str = "http://localhost:11434/api/chat";
const OLLAMA_DEFAULT_MODEL: &str = "llama3.2";

const CLAUDE_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_DEFAULT_MODEL: &str = "claude-haiku-5-5";
/// Replies show in a small bubble, so keep them short (and cheap).
const CLAUDE_MAX_TOKENS: u32 = 600;

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

/// Asks Merlin something. Called from TypeScript with `invoke("chat", …)`.
#[tauri::command]
pub async fn chat(
    messages: Vec<ChatMessage>,
    provider: Option<String>,
    model: Option<String>,
    on_event: Channel<ChatEvent>,
) -> Result<(), String> {
    match provider.as_deref() {
        Some("claude") => {
            let model = model.unwrap_or_else(|| CLAUDE_DEFAULT_MODEL.to_string());
            ask_claude(&messages, &model, &on_event).await
        }
        _ => {
            let model = model.unwrap_or_else(|| OLLAMA_DEFAULT_MODEL.to_string());
            ask_ollama(&messages, &model, &on_event).await
        }
    }
}

/// Reads a streamed HTTP response one line at a time. `handle` returns
/// `Ok(true)` when the reply is finished.
async fn for_each_line<F>(response: reqwest::Response, mut handle: F) -> Result<(), String>
where
    F: FnMut(&str) -> Result<bool, String>,
{
    // Network chunks don't line up with lines, so we collect bytes and
    // handle each complete line as it arrives.
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.extend_from_slice(&chunk);

        while let Some(newline) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=newline).collect();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim();
            if !line.is_empty() && handle(line)? {
                return Ok(());
            }
        }
    }
    Ok(())
}

/// Turns a non-200 response into a readable error.
async fn check_status(response: reqwest::Response, who: &str) -> Result<reqwest::Response, String> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    Err(format!("{who} returned {status}: {body}"))
}

// ---------- Ollama (local, free) ----------

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

async fn ask_ollama(
    messages: &[ChatMessage],
    model: &str,
    on_event: &Channel<ChatEvent>,
) -> Result<(), String> {
    let request = OllamaRequest {
        model,
        messages,
        stream: true,
    };
    let response = reqwest::Client::new()
        .post(OLLAMA_URL)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach Ollama. Is it running? ({e})"))?;
    let response = check_status(response, "Ollama").await?;

    // Ollama sends one JSON object per line.
    for_each_line(response, |line| {
        let chunk: OllamaChunk = serde_json::from_str(line).map_err(|e| e.to_string())?;
        if let Some(error) = chunk.error {
            return Err(format!("Ollama error: {error}"));
        }
        if let Some(message) = chunk.message
            && !message.content.is_empty()
        {
            on_event
                .send(ChatEvent::Token {
                    text: message.content,
                })
                .map_err(|e| e.to_string())?;
        }
        Ok(chunk.done)
    })
    .await?;

    on_event.send(ChatEvent::Done).map_err(|e| e.to_string())
}

// ---------- Claude API ----------

#[derive(Serialize)]
struct ClaudeRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: String,
    messages: Vec<&'a ChatMessage>,
    stream: bool,
}

async fn ask_claude(
    messages: &[ChatMessage],
    model: &str,
    on_event: &Channel<ChatEvent>,
) -> Result<(), String> {
    let key = keys::claude_key()?.ok_or("No Claude API key saved. Add one in Settings.")?;

    // Claude takes the system prompt separately from the conversation.
    let system = messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    let conversation: Vec<&ChatMessage> = messages.iter().filter(|m| m.role != "system").collect();

    let request = ClaudeRequest {
        model,
        max_tokens: CLAUDE_MAX_TOKENS,
        system,
        messages: conversation,
        stream: true,
    };
    let response = reqwest::Client::new()
        .post(CLAUDE_URL)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach Claude. ({e})"))?;
    let response = check_status(response, "Claude").await?;

    // Claude streams server-sent events: lines like `data: {...}`.
    for_each_line(response, |line| {
        let Some(data) = line.strip_prefix("data:") else {
            return Ok(false); // "event: …" lines; the data line says it all
        };
        let event: serde_json::Value =
            serde_json::from_str(data.trim()).map_err(|e| e.to_string())?;
        match event["type"].as_str() {
            Some("content_block_delta") => {
                if let Some(text) = event["delta"]["text"].as_str() {
                    on_event
                        .send(ChatEvent::Token {
                            text: text.to_string(),
                        })
                        .map_err(|e| e.to_string())?;
                }
                Ok(false)
            }
            Some("message_stop") => Ok(true),
            Some("error") => Err(format!("Claude error: {}", event["error"]["message"])),
            _ => Ok(false),
        }
    })
    .await?;

    on_event.send(ChatEvent::Done).map_err(|e| e.to_string())
}
