// Talking to Merlin: the box you type in, his speech bubble, and the
// reply streaming in from his brain (the Rust `chat` command).

import { invoke, Channel } from "@tauri-apps/api/core";
import { getMood, setMood } from "./mood";
import { MERLIN_PERSONALITY } from "./personality";
import { loadSettings } from "./settings";
import { babble } from "./sounds";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** What the Rust side sends while Merlin is answering. */
type ChatEvent = { event: "token"; data: { text: string } } | { event: "done" };

/** How many past messages Merlin remembers in one session. */
const HISTORY_LIMIT = 12;
/** How long his reply stays up after he finishes speaking. */
const READ_MS_PER_CHAR = 45;
const MIN_READ_MS = 3500;
const INPUT_IDLE_MS = 10000;

export interface ChatControl {
  open(): void;
}

export function initChat(): ChatControl {
  const form = document.querySelector<HTMLFormElement>("#chat-form")!;
  const input = document.querySelector<HTMLInputElement>("#chat-input")!;
  const speech = document.querySelector<HTMLElement>("#speech")!;

  const history: ChatMessage[] = [];
  let busy = false;
  let hideTimer = 0;
  let idleTimer = 0;

  /** (Re)starts the countdown that closes an untouched input box. */
  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!input.value.trim()) close();
    }, INPUT_IDLE_MS);
  };

  const open = () => {
    if (busy) return;
    form.classList.add("show");
    input.focus();
    armIdle();
  };

  const close = () => {
    clearTimeout(idleTimer);
    form.classList.remove("show");
    input.value = "";
    input.blur();
  };

  const say = (text: string) => {
    speech.textContent = text;
    speech.classList.add("show");
    speech.scrollTop = speech.scrollHeight;
  };

  babble();

  /** Leaves the bubble up long enough to read, then tidies up. */
  const hideSpeechLater = (text: string) => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(
      () => {
        speech.classList.remove("show");
        if (getMood() === "confused") setMood("idle");
      },
      Math.max(MIN_READ_MS, text.length * READ_MS_PER_CHAR),
    );
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
        if (message.event === "token") {
          if (!reply) setMood("talking"); // first words: start moving the jaw
          reply += message.data.text;
          say(reply);
        } else {
          resolve();
        }
      };
    });

    // Use whichever brain is picked in Settings.
    const { provider, ollamaModel, claudeModel } = loadSettings();

    try {
      await invoke("chat", {
        messages: [{ role: "system", content: MERLIN_PERSONALITY }, ...history],
        provider,
        model: provider === "claude" ? claudeModel : ollamaModel,
        onEvent: channel,
      });
      finished;
      history.push({ role: "assistant", content: reply });
      if (getMood() === "talking") setMood("idle");
      hideSpeechLater(reply);
    } catch (error) {
      console.error(error);
      history.pop(); // forget the question he couldn't answer
      const sorry =
        provider === "claude"
          ? "My crystal ball has gone dark... Is your Claude API key set in Settings, apprentice?"
          : "My crystal ball has gone dark... Is Ollama running, apprentice?";
      setMood("confused");
      say(sorry);
      hideSpeechLater(sorry);
    } finally {
      busy = false;
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  input.addEventListener("input", armIdle);
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
