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
    setTimeout(() => {
      setMessages(msgs => [
        ...msgs,
        {
          role: "assistant",
          content: `Med vind fra N–NØ vil elgen ofte vende nesa mot N–NØ. Og ja: koordinatene mine blandet Strupen/Raubakk i forrige skisse – nå har jeg lest inn post-lista (elgposter.ts) og laget et korrigert kart + forslag.

<img src="/ai-images/example1.png" alt="Taktisk AI-kart N–NØ" style="max-width:100%;margin:12px 0;border-radius:10px;box-shadow:0 2px 8px #0002;" />

Jeg la ved to figurer og et avstandsskjema i visningen over:
- et geografisk oversiktskart (alle poster)
- en taktisk skisse (foreslåtte poster + Asles drivlinje S/SSV → N–NØ)
- tabell med ca. avstander mellom nøkkelposter (for å vurdere “små smett”)

Rask taktisk anbefaling (med N–NØ-vind, uten hund, drag 2 kl. 13–17)

Mål: Stramme nettet rundt GN–beltet og utnytte at dyr nylig er observert Gjøken–Trøstheim og et ungdyr ved Langemyr på morgenen.

Poster (tett linje, små hull):
- Njord – GN Vest
- Skytter – GN Øst (eller bytt GN Vest/Øst mellom Njord/Skytter etter hva dere liker)
- Alex – Trøstheim (for å dekke Gjøken–Trøstheim-aksen; GN Vest ↔ Trøstheim ~296 m)
- Halvor – Raubakk eller Høgemyr P. etter hva Asle finner:
  - Starter Halvor på Raubakk som øst-anker (GN Øst ↔ Raubakk ~456 m).
  - Plan B: Hvis Asle melder tegn sør/vest i draget, flytt Halvor ned til Høgemyr P. for å tette mot Trøstheim (Høgemyr P. ↔ Trøstheim ~259 m).

NB: Å spre helt fra GN til Langemyr gjør linja for åpen i dette terrenget (tette granfelt og smådrag = mange fluktkorridorer). Det er derfor jeg foreslår en komprimert GN-linje + ett øst-anker (Raubakk) med hurtig skifte til Høgemyr P. ved behov.

Asle (driver):
Start S/SSV i Hyttemyr/Langemyr-beltet (der ungdyr ble sett), gå rolig mot N–NØ i lange S-kurver via Brattrensle → Hogsten S/N → Høgemyr P. → Trøstheim / GN.

Poeng: Uten hund og med fuktig, stille skog står elgen ofte. Hyppige korte stopp + rolig gange gjør at dyr “seiler” foran deg mot vinden (N–NØ) og inn i GN-linja.

Pass på å ikke blåse vitring inn i postene: hold en svak vestlig bue i sluttfasen så vinden fortsatt er fra deg og mot N–NØ.

Om “smett mellom poster”
Ut fra post-lista (se tabellen):
- GN Vest ↔ GN Øst ~206 m = bra.
- GN Øst ↔ Trøstheim ~432 m = litt vidt → kompenser med Skytter på GN Øst og Alex på Trøstheim (to raske skyttere i endene), og vurder rask flytting av Halvor til Høgemyr P. hvis Asle får tegn sørfra.
- Trøstheim ↔ Raubakk ~811 m = her er øst-ankeret sårbart; derfor start Halvor på Raubakk, men ha klar Plan B (flytt til Høgemyr P.).

Hvorfor ikke Trekanten nå?
Den er “krem”, men dere har brukt den nylig og vi har ferskere tegn Gjøken–Trøstheim + Langemyr. Med N–NØ-vind og uten hund vil det ofte lønne seg å sate på ferskeste bevegelse og stram linje framfor å åpne opp for store hull.

Hvis du vil, kan jeg også legge på alternative oppsett (f.eks. “vestlig drift” med Strupen/Camping/Edgarpost som baknet) basert på samme kart.`
        }
      ]);
      setLoading(false);
    }, 3000);
  }

  return (
    <section style={{ maxWidth: 700, margin: '0 auto', background: '#f8f8ff', border: '1px solid #b2d8f6', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px #0001' }}>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>Jaktassistent (AI)</h2>
      <div style={{ minHeight: 180, marginBottom: 18 }}>
        {messages.map((m, i) => (
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
