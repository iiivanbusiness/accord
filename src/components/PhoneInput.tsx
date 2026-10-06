"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Country } from "@/lib/countries";
import { composePhone, countryByCode, flagEmoji, searchCountries, splitPhone } from "@/lib/phone-input";

const SHOWN = 60;

// A phone number field with the country picked from a list (flag and
// calling code, searchable by typing its first letters), so people type
// only their number, the way they'd dial it at home. onChange gets the
// full +number, or "" when the number is empty. fallbackCountry is where
// an empty field starts (the page guesses it from the browser's language).
export default function PhoneInput({
  value,
  onChange,
  fallbackCountry = "US",
  ariaLabel = "Phone number",
}: {
  value: string;
  onChange: (e164: string) => void;
  fallbackCountry?: string;
  ariaLabel?: string;
}) {
  const initial = splitPhone(value);
  const [country, setCountry] = useState<Country>(initial?.country ?? countryByCode(fallbackCountry) ?? searchCountries("United States")[0]);
  const [local, setLocal] = useState(initial?.local ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const matches = useMemo(() => searchCountries(query).slice(0, SHOWN), [query]);

  function pick(c: Country) {
    setCountry(c);
    setOpen(false);
    setQuery("");
    onChange(composePhone(c, local));
    numberRef.current?.focus();
  }

  function type(text: string) {
    // A pasted +number brings its own country.
    const pasted = text.trim().startsWith("+") ? splitPhone(composePhone(country, text)) : null;
    if (pasted) {
      setCountry(pasted.country);
      setLocal(pasted.local);
      onChange(composePhone(pasted.country, pasted.local));
      return;
    }
    setLocal(text);
    onChange(composePhone(country, text));
  }

  return (
    <div ref={boxRef} className="flex w-full max-w-[340px] flex-col gap-1.5">
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setActive(0);
          }}
          className="input flex shrink-0 items-center gap-1.5 px-2.5"
          style={{ width: "auto" }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country: ${country.name} +${country.dial}`}
        >
          <span aria-hidden>{flagEmoji(country.code)}</span>
          <span className="font-mono-tab">+{country.dial}</span>
          <span aria-hidden style={{ color: "var(--ink-muted)" }}>▾</span>
        </button>
        <input
          ref={numberRef}
          value={local}
          onChange={(e) => type(e.target.value)}
          placeholder={country.dial === "1" ? "512 555 0100" : "Your number"}
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={ariaLabel}
          className="input min-w-0 flex-1"
        />
      </div>
      {/* In the flow rather than floating, so a card that clips its edges
          (settings cards do) can't cut the list off. */}
      {open && (
        <div
          className="w-full overflow-hidden rounded-[12px] border"
          style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (matches[active]) pick(matches[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type a country or +code"
            aria-label="Search countries"
            className="w-full border-b bg-transparent px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: "var(--hairline)" }}
          />
          <div role="listbox" aria-label="Countries" className="max-h-[260px] overflow-y-auto py-1">
            {matches.length === 0 ? (
              <div className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No country matches that.</div>
            ) : (
              matches.map((c, i) => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={c.code === country.code}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
                  style={i === active ? { background: "var(--canvas)" } : undefined}
                >
                  <span aria-hidden>{flagEmoji(c.code)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-mono-tab shrink-0" style={{ color: "var(--ink-muted)" }}>+{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
