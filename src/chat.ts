// Talking to Merlin: the input box, his speech bubble, and the reply
// streaming in from the Rust `chat` command.

import { Channel, invoke } from "@tauri-apps/api/core";
import { getMood, setMood } from "./mood";
import { MERLIN_PERSONALITY } from "./personality";
import { loadSettings } from "./settings";
import { babble } from "./sounds";
import { element } from "./utils";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Matches the ChatEvent enum in src-tauri/src/brain.rs. */
type ChatEvent = { event: "token"; data: { text: string } } | { event: "done" };

/** How many past messages Merlin remembers in one session. */
const HISTORY_LIMIT = 12;
/** How long a reply stays up after he finishes: per character, with a floor. */
const READ_MS_PER_CHAR = 45;
const MIN_READ_MS = 3500;
/** An empty input box closes itself after this long. */
const INPUT_IDLE_MS = 10000;

const SORRY = {
  claude:
    "My crystal ball has gone dark... Is your Claude API key set in Settings, apprentice?",
  ollama: "My crystal ball has gone dark... Is Ollama running, apprentice?",
};

export interface ChatControl {
  open(): void;
}

export function initChat(): ChatControl {
  const form = element<HTMLFormElement>("#chat-form");
  const input = element<HTMLInputElement>("#chat-input");
  const speech = element<HTMLElement>("#speech");

  const history: ChatMessage[] = [];
  let busy = false;
  let hideTimer = 0;
  let idleTimer = 0;

  const close = () => {
    clearTimeout(idleTimer);
    form.classList.remove("show");
    input.value = "";
    input.blur();
  };

  const closeIfUntouched = () => {
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!input.value.trim()) close();
    }, INPUT_IDLE_MS);
  };

  const open = () => {
    if (busy) return;
    form.classList.add("show");
    input.focus();
    closeIfUntouched();
  };

  const say = (text: string) => {
    speech.textContent = text;
    speech.classList.add("show");
    speech.scrollTop = speech.scrollHeight;
  };

  const hideSpeechLater = (text: string) => {
    clearTimeout(hideTimer);
    const readTime = Math.max(MIN_READ_MS, text.length * READ_MS_PER_CHAR);
    hideTimer = window.setTimeout(() => {
      speech.classList.remove("show");
      if (getMood() === "confused") setMood("idle");
    }, readTime);
  };

  const ask = async (question: string) => {
    busy = true;
    clearTimeout(hideTimer);
    speech.classList.remove("show");

    history.push({ role: "user", content: question });
    while (history.length > HISTORY_LIMIT) history.shift();
    setMood("thinking");

    let reply = "";
    const channel = new Channel<ChatEvent>();
    const finished = new Promise<void>((resolve) => {
      channel.onmessage = (message) => {
        if (message.event === "done") return resolve();
        if (!reply) setMood("talking");
        reply += message.data.text;
        say(reply);
        babble();
      };
    });

    const { provider, ollamaModel, claudeModel } = loadSettings();

    try {
      await invoke("chat", {
        messages: [{ role: "system", content: MERLIN_PERSONALITY }, ...history],
        provider,
        model: provider === "claude" ? claudeModel : ollamaModel,
        onEvent: channel,
      });
      await finished;
      history.push({ role: "assistant", content: reply });
      if (getMood() === "talking") setMood("idle");
      hideSpeechLater(reply);
    } catch (error) {
      console.error(error);
      history.pop(); // forget the question he couldn't answer
      setMood("confused");
      say(SORRY[provider]);
      hideSpeechLater(SORRY[provider]);
    } finally {
      busy = false;
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  input.addEventListener("input", closeIfUntouched);
  input.addEventListener("blur", () => {
    if (form.classList.contains("show") && !input.value.trim()) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    close();
    void ask(question);
  });

  return { open };
}
