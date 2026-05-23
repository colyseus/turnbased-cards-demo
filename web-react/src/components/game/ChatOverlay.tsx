import { useState, useEffect, useRef } from "react";
import { useRoom, useRoomState } from "../../colyseus";
import { ChatMessageSchema } from "../../types";

interface ChatOverlayProps {
  onClose: () => void;
}

export default function ChatOverlay({ onClose }: ChatOverlayProps) {
  const { room } = useRoom();
  const state = useRoomState();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = (state as unknown as { chatMessages?: ChatMessageSchema[] }).chatMessages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !room) return;
    room.send("chat", { text });
    setInput("");
  };

  return (
    <div className="rules-overlay" role="dialog" aria-modal="true" aria-label="Game Chat" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="rules-header">
          <h2>Chat</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body" style={{ maxHeight: 240, overflowY: "auto", gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              No messages yet
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              <strong style={{ color: "var(--accent)" }}>{msg.sender}:</strong>{" "}
              <span style={{ color: "var(--text-primary)" }}>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            ref={inputRef}
            className="lobby-input"
            style={{ flex: 1, fontSize: 14, padding: "8px 12px" }}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            maxLength={200}
          />
          <button
            className="lobby-btn"
            style={{ width: "auto", padding: "8px 16px", fontSize: 14 }}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
