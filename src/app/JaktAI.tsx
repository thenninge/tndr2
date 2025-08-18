import React, { useState } from "react";

// TODO: Når vi refaktorerer, skal alle datakilder importeres her:
// import { ELGPOSTER } from "./elgposter";
// import { ELGJEGERE } from "./elgjegere";
// import { FALL } from "./fall";
// import { værdata, observasjoner, terrengdata, jaktopplegg } from ...

/**
 * JaktAI: Chatbot for taktisk jaktassistanse
 *
 * Plan:
 * 1. Samle alle relevante data (vær, fall, observasjoner, terreng, jegere, opplegg)
 * 2. Bygg vektor-database (f.eks. via open source som Chroma, Pinecone, eller Supabase Vector)
 * 3. Indekser data for kontekstsøk (embedding per post, vær, observasjon, etc)
 * 4. Koble til LLM (OpenAI, Groq, Mistral, etc) via API
 * 5. Bruk chat-UI for å sende brukerens spørsmål + relevante kontekstbiter til LLM
 * 6. Returner og vis svaret i chatten
 *
 * Eksempelprompt til LLM:
 * "Du er jaktassistent. Bruk vær, vind, terreng, historikk og postdata for å gi taktiske råd."
 */

export default function JaktAI() {
  const [messages, setMessages] = useState([
    { role: "system", content: "Du er jaktassistent. Spør meg om postering, vind, elgtrekk, eller strategi!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // TODO: Koble til vektor-database og LLM her
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { role: "user", content: input }]);
    setInput("");
    setLoading(true);
    // --- Her skal vi gjøre kontekstsøk og sende til LLM ---
    // 1. Finn relevante data fra vektor-db basert på input
    // 2. Bygg prompt med kontekst + brukerens spørsmål
    // 3. Kall LLM API og få svar
    // 4. setMessages(msgs => [...msgs, { role: "assistant", content: svar }]);
    setTimeout(() => {
      setMessages(msgs => [...msgs, { role: "assistant", content: "(Eksempel-svar: Her kommer AI-råd basert på vær, vind, terreng og historikk!)" }]);
      setLoading(false);
    }, 1200);
  }

  return (
    <section style={{ maxWidth: 700, margin: '0 auto', background: '#f8f8ff', border: '1px solid #b2d8f6', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px #0001' }}>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>Jaktassistent (AI)</h2>
      <div style={{ minHeight: 180, marginBottom: 18 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <span style={{ display: 'inline-block', background: m.role === 'user' ? '#e0eaff' : '#e0ffe0', color: '#222', borderRadius: 8, padding: '8px 14px', maxWidth: 480 }}>{m.content}</span>
          </div>
        ))}
        {loading && <div style={{ color: '#888', fontStyle: 'italic' }}>AI tenker…</div>}
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
