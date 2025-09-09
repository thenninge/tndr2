import React, { useState } from "react";

export default function JaktAI() {
  const [messages, setMessages] = useState([
    { role: "system", content: 'Jeg er en jaktleders assistent. "Ko veta me!?" Spør meg om postering, vind, elgtrekk, eller strategi!' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { role: "user", content: input }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });
      const data = await res.json();
      setMessages(msgs => [
        ...msgs,
        { role: "assistant", content: data.answer }
      ]);
    } catch (err) {
      setMessages(msgs => [
        ...msgs,
        { role: "assistant", content: "Beklager, det oppstod en feil mot AI-tjenesten." }
      ]);
    }
    setLoading(false);
  }

  return (
    <section style={{ maxWidth: 700, margin: '0 auto', background: '#f8f8ff', border: '1px solid #b2d8f6', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px #0001' }}>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>Jaktassistent (AI)</h2>
      <div style={{ minHeight: 180, marginBottom: 18 }}>
        {messages.slice(1).map((m, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            {/(<[^>]+>)/.test(m.content) ? (
              <span
                style={{ display: 'inline-block', background: m.role === 'user' ? '#e0eaff' : '#e0ffe0', color: '#222', borderRadius: 8, padding: '8px 14px', maxWidth: 480 }}
                dangerouslySetInnerHTML={{ __html: m.content }}
              />
            ) : (
              <span style={{ display: 'inline-block', background: m.role === 'user' ? '#e0eaff' : '#e0ffe0', color: '#222', borderRadius: 8, padding: '8px 14px', maxWidth: 480 }}>{m.content}</span>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#888', fontStyle: 'italic' }}>ElgAI tenker…</div>}
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Skriv et jaktspørsmål…"
          style={{ flex: 1, fontSize: 16, padding: 8, borderRadius: 8, border: '1px solid #bbb' }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer' }}>Send</button>
      </form>
      <div style={{ marginTop: 24, color: '#888', fontSize: 15 }}>
        <b>Plan videre:</b> Data fra vær, fall, observasjoner, terreng og posteringer skal kobles til en vektor-database og brukes som kontekst for AI-rådgivning.
      </div>
    </section>
  );
}
