"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type VelgerPost = {
  idx: number;
  nr: number;
  name: string;
  omrade: string;
  lat: number;
  lng: number;
};

type Mode = "alfabetisk" | "omrade" | "naer";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "denied" };

const AREA_ORDER = ["Strupen", "Høgemyr/GN", "Marstein", "Røytjern", "Søndre", "Hytta"];
const HYTTA = { lat: 60.72479028725314, lng: 9.036607137866255 };

type Props = {
  posts: VelgerPost[];
  selectedIds: number[];
  onConfirm: (ids: number[]) => void;
  lockedIds?: number[];
  lockedLabel?: string;
  triggerLabel?: string;
  selectionMode?: "multiple" | "single";
};

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toLocaleString("nb-NO", { maximumFractionDigits: 1, minimumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

function byName(a: VelgerPost, b: VelgerPost) {
  return a.name.localeCompare(b.name, "nb", { sensitivity: "base" }) || a.nr - b.nr;
}

function valgtTekst(n: number) {
  return n === 1 ? "1 post valgt" : `${n} poster valgt`;
}

export default function PostVelger({
  posts,
  selectedIds,
  onConfirm,
  lockedIds = [],
  lockedLabel = "Trukket",
  triggerLabel = "Poster",
  selectionMode = "multiple",
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("alfabetisk");
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const listRef = useRef<HTMLDivElement>(null);

  const lockedSet = useMemo(() => new Set(lockedIds), [lockedIds]);
  const draftSet = useMemo(() => new Set(draft), [draft]);
  const postByIdx = useMemo(() => new Map(posts.map((p) => [p.idx, p])), [posts]);

  const committed = useMemo(() => {
    return selectedIds
      .map((id) => postByIdx.get(id))
      .filter((p): p is VelgerPost => !!p && !lockedSet.has(p.idx))
      .sort(byName);
  }, [selectedIds, postByIdx, lockedSet]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "naer" || geo.status !== "idle") return;
    if (!navigator.geolocation) {
      setGeo({ status: "denied" });
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo({ status: "denied" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [open, mode, geo.status]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo(0, 0);
  }, [open, mode, query]);

  function openSheet() {
    const next = selectedIds.filter((id) => !lockedSet.has(id));
    setDraft(selectionMode === "single" ? next.slice(0, 1) : next);
    setQuery("");
    setMode("alfabetisk");
    setOpen(true);
  }

  function toggle(idx: number) {
    if (lockedSet.has(idx)) return;
    setDraft((prev) => {
      if (selectionMode === "single") {
        return prev.length === 1 && prev[0] === idx ? [] : [idx];
      }
      return prev.includes(idx) ? prev.filter((id) => id !== idx) : [...prev, idx];
    });
  }

  function toggleArea(idxs: number[]) {
    const unlocked = idxs.filter((id) => !lockedSet.has(id));
    const allOn = unlocked.length > 0 && unlocked.every((id) => draftSet.has(id));
    setDraft((prev) => {
      if (allOn) return prev.filter((id) => !unlocked.includes(id));
      const set = new Set(prev);
      unlocked.forEach((id) => set.add(id));
      return [...set];
    });
  }

  function confirm() {
    const chosen = draft
      .map((id) => postByIdx.get(id))
      .filter((p): p is VelgerPost => !!p)
      .sort(byName)
      .map((p) => p.idx);
    onConfirm(chosen);
    setOpen(false);
  }

  const needle = query.trim().toLowerCase();
  const filtered = posts
    .filter((p) => {
      if (!needle) return true;
      return p.name.toLowerCase().includes(needle) || p.omrade.toLowerCase().includes(needle) || String(p.nr).includes(needle);
    })
    .sort(byName);

  const origin = geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : HYTTA;
  const fromHytte = geo.status !== "ready";

  const nearSorted = filtered
    .map((p) => ({ p, d: distanceMeters(origin, p) }))
    .sort((a, b) => a.d - b.d || byName(a.p, b.p));

  const groups = useMemo(() => {
    const map = new Map<string, VelgerPost[]>();
    for (const p of filtered) {
      const list = map.get(p.omrade) ?? [];
      list.push(p);
      map.set(p.omrade, list);
    }
    return [...map.entries()].sort((a, b) => {
      const ra = AREA_ORDER.indexOf(a[0]);
      const rb = AREA_ORDER.indexOf(b[0]);
      return (ra === -1 ? AREA_ORDER.length : ra) - (rb === -1 ? AREA_ORDER.length : rb) || a[0].localeCompare(b[0], "nb");
    });
  }, [filtered]);

  const draftPosts = draft
    .map((id) => postByIdx.get(id))
    .filter((p): p is VelgerPost => !!p)
    .sort(byName);

  function row(p: VelgerPost, meta?: string) {
    const on = draftSet.has(p.idx);
    const locked = lockedSet.has(p.idx);
    const detail = locked ? lockedLabel : meta;
    return (
      <button
        key={p.idx}
        type="button"
        className={`pv-row${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
        disabled={locked}
        role={selectionMode === "single" ? "radio" : "checkbox"}
        aria-checked={on}
        onClick={() => toggle(p.idx)}
      >
        <span className="pv-nr">{p.nr}</span>
        <span className="pv-name">
          <span className={locked ? "pv-struck" : undefined}>{p.name}</span>
          {detail ? <span className="pv-meta">{detail}</span> : null}
        </span>
        <span className="pv-mark" aria-hidden="true">{on ? "✓" : ""}</span>
      </button>
    );
  }

  const triggerName = selectionMode === "single" && committed[0] ? committed[0].name : null;

  return (
    <div className="pv">
      <button type="button" className="pv-trigger" onClick={openSheet}>
        <span className="pv-trigger-top">
          <span>{triggerName ?? triggerLabel}</span>
          <span className="pv-trigger-count">{triggerName ? "Bytt" : committed.length === 0 ? "Velg" : valgtTekst(committed.length)}</span>
        </span>
        {selectionMode === "multiple" && committed.length > 0 && (
          <span className="pv-trigger-chips">
            {committed.slice(0, 8).map((p) => (
              <span key={p.idx} className="pv-chip">{p.name}</span>
            ))}
            {committed.length > 8 && <span className="pv-chip pv-chip-more">+{committed.length - 8}</span>}
          </span>
        )}
      </button>

      {open && (
        <div className="pv-backdrop" onClick={() => setOpen(false)}>
          <div
            className="pv-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pv-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pv-header">
              <div className="pv-title-row">
                <h2 id="pv-title">Velg poster</h2>
                <button type="button" className="pv-close" onClick={() => setOpen(false)}>Lukk</button>
              </div>
              <input
                className="pv-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søk navn, område eller nummer"
                inputMode="search"
                aria-label="Søk poster"
              />
              <div className="pv-segments" role="tablist" aria-label="Sortering">
                {([
                  ["alfabetisk", "A–Å"],
                  ["omrade", "Område"],
                  ["naer", "Nær meg"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    className={mode === id ? "is-on" : ""}
                    onClick={() => setMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "naer" && (
                <p className="pv-note">
                  {geo.status === "ready" && "Nærmeste poster først, målt fra der du står."}
                  {(geo.status === "loading" || geo.status === "idle") && "Henter posisjon. Viser avstand fra hytta så lenge."}
                  {geo.status === "denied" && "Posisjon er ikke tilgjengelig. Viser avstand fra hytta. "}
                  {geo.status === "denied" && (
                    <button type="button" className="pv-retry" onClick={() => setGeo({ status: "idle" })}>Prøv igjen</button>
                  )}
                </p>
              )}
            </div>

            <div className="pv-list" ref={listRef}>
              {filtered.length === 0 && <p className="pv-empty">Ingen poster matcher søket.</p>}

              {mode === "alfabetisk" && filtered.map((p) => row(p, p.omrade))}

              {mode === "omrade" && groups.map(([omrade, list]) => {
                const unlocked = list.filter((p) => !lockedSet.has(p.idx));
                const picked = unlocked.filter((p) => draftSet.has(p.idx)).length;
                const allOn = unlocked.length > 0 && picked === unlocked.length;
                return (
                  <section key={omrade}>
                    <div className="pv-area-head">
                      <span className="pv-area-name">{omrade}</span>
                      <span className="pv-area-count">{picked}/{list.length}</span>
                      {selectionMode === "multiple" && unlocked.length > 0 && (
                        <button type="button" className="pv-area-all" onClick={() => toggleArea(list.map((p) => p.idx))}>
                          {allOn ? "Fjern" : "Alle"}
                        </button>
                      )}
                    </div>
                    {list.map((p) => row(p))}
                  </section>
                );
              })}

              {mode === "naer" && nearSorted.map(({ p, d }) => row(
                p,
                `${formatDistance(d)} ${fromHytte ? "fra hytta" : "fra deg"} · ${p.omrade}`
              ))}
            </div>

            <div className="pv-footer">
              {draftPosts.length > 0 && (
                <div className="pv-foot-chips">
                  {draftPosts.map((p) => (
                    <button key={p.idx} type="button" onClick={() => toggle(p.idx)}>
                      {p.name} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="pv-footer-actions">
                <button type="button" className="pv-clear" onClick={() => setDraft([])} disabled={draft.length === 0}>
                  Tøm
                </button>
                <button type="button" className="pv-primary" onClick={confirm}>
                  {draft.length === 1 ? "Bruk 1 post" : `Bruk ${draft.length} poster`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
