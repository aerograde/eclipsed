# eclipsed. — Character-code research: making the invite short

Status: research + proposal. This file documents *why* the current limits exist,
measures the real payloads, surveys every encoding technique that applies, and
proposes a concrete scheme ("E1-wide") that is the shortest a pure client-side,
serverless invite can physically be.

---

## 1. TL;DR

| Goal | Verdict |
|---|---|
| 650 chars → **6 chars**, offline, any device | **Impossible** (counting proof in §2). No encoding, hashing, or "browser server" changes this. |
| 650 chars → **~240 chars**, offline, any device | **Possible today** — re-encode the existing compressed invite from base64 (6 bits/char) to base65536-style Unicode (16 bits/char). Pure client-side. |
| → **~150 chars** | Possible with an SDP "diet" (§5) on top, for same-network rooms. |
| → **~90–120 chars** | Theoretical floor for any real WebRTC handshake (randomness in ICE/DTLS alone). Below this, *no* scheme can go — it isn't compression anymore, it's entropy. |
| "Like a QR code but with characters" | QR does **not** compress (§3). Its trick is *density per printed area*, not per character. The character-space equivalent of QR density is: use the widest Unicode alphabet that survives copy/paste. That is base65536-class encoding. |

Bottom line: the room-to-connect code can realistically drop from **1,049 raw /
646 current** characters to **≈ 240 characters**, and scanning a QR of the same
bytes is the zero-typing option. A 6-character code requires a shared directory
(a server) — that is a deployment choice, not an encoding problem.

---

## 2. Why 6 characters is impossible (the counting proof)

### 2.1 What is actually inside the invite?

A WebRTC *offer* (what the room host generates) is browser-produced SDP text:

```
v=0
o=- 4611723498813907405 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
a=msid-semantic: WMS
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:abc1
a=ice-pwd:2Xy7... (22 chars)
a=fingerprint:sha-256 AA:BB:... (32 bytes)
a=setup:actpass
a=mid:0
a=sctp-port:5000
a=candidate:1 1 UDP 2122252543 192.168.1.20 54321 typ host
...more candidates...
```

Measured on this project's real offers:

| Payload form | Length |
|---|---|
| Raw invite (`HOP1.` + base64url of JSON{SDP,roomId,pw?}) | **1,049 chars** (≈ 787 bytes of JSON) |
| Current compact invite (`E1.` + base64url of deflate(JSON)) | **646 chars** (≈ 481 compressed bytes) |
| Underlying compressed bytes | ≈ 481 bytes |

### 2.2 The pigeonhole argument

A code of *n* characters drawn from an alphabet of size *a* can name at most
*aⁿ* different things. For 6 lowercase alphanumeric characters:
aⁿ = 36⁶ ≈ **2.2 billion**.

The handshake contains (at minimum, per offer):
- ICE username fragment — 4 chars
- ICE password — 22 chars
- DTLS certificate fingerprint — 32 bytes of SHA-256
- Session id — 8 bytes
- One or more candidate addresses + ports
- SDP structure that `setRemoteDescription` requires verbatim

Just the *random secrets* listed above are ≈ 60–80+ bytes ≈ 480–640 bits of
fresh randomness generated at the moment the host clicks Create. The number of
possible handshakes is therefore ≥ 2⁴⁸⁰. But 6 characters can only enumerate
2³¹ possibilities (36⁶) or 2³⁶ with a 64-symbol alphabet. Even if every
6-char code were magically assigned to a pre-computed handshake, there are
**2⁴⁴⁴ more handshakes than codes**. By the pigeonhole principle, the mapping
cannot be reversible for every invite — the information is not there.

Hashing makes this *worse*, not better: SHA-256 maps many inputs to one 64-char
digest, and is one-way — the digest cannot be turned back into the SDP, and the
SDP's random parts cannot be guessed or recomputed by the peer.

### 2.3 The entropy floor

Pure information theory says the *minimum possible length* of the transmitted
message is its entropy. The non-recoverable randomness above means a floor of
roughly:

- ≈ 60–80 bytes of secrets → ≈ 80–107 base64url chars, ≈ 40–53 base65536
  chars, *before any structural SDP text at all*.

In practice the browser requires its full SDP text to be transmitted, so the
realistic floor for a *working* scheme is higher (~90–200 chars depending on how
aggressively SDP can be trimmed — §5). The important conclusion: **no pure
encoding shrinks below the entropy floor**, and 6 characters sits ~30× below it.

---

## 3. What a QR code actually is (and isn't)

A QR code does not compress. It is a dense 2-D grid that packs the same bytes
with redundancy for error correction:

| QR version / ECC | Numeric | Alphanumeric | Bytes |
|---|---|---|---|
| v40-L (largest, low ECC) | 7,089 | 4,296 | 2,953 |

- Our 481-byte compressed invite fits in a **small/medium QR** comfortably
  (v40-L cap is 2,953 bytes).
- QR's advantage is **zero typing**: a camera reads thousands of bits in
  ~1 second. Its disadvantage is *proximity* — the two devices must see the
  same screen.
- "Characters like a QR" therefore means: keep the same bytes, but encode them
  in the widest **character** alphabet that survives copy/paste, so each
  character carries as many bits as possible. That is exactly the
  base-N-family of encodings surveyed next.

---

## 4. Encoding survey (measured / sourced)

Efficiency = bits of payload per transmitted character. ASCII URLs, SMS, chat
apps and email are *Unicode-clean*: they move code points, not bytes — so
wider alphabets genuinely shrink character counts. Sources: qntm/base65536
analysis (GitHub), QR capacity tables (QRcode.com / standard references).

| Encoding | Bits/char | Payload bytes/Tweet(280cp) | Risk profile |
|---|---|---|---|
| Base64 (status quo `E1.`) | 6 | 210 | Immune everywhere |
| Base85 (ASCII) | ~6.8 | 224 | Hazardous chars (quotes, brackets) — bad for chat/URLs |
| **Base2048** | 11 | 385 | "Light" scripts (Bengali, Tamil…) — safe-ish, some platforms reorder |
| **Base65536** | 16 | 280* (2 B/char) | BMP safe codepoints only; normalization-immune; proven since 2015 |
| Base32768 | 15 (UTF-16) | 263* | Uses non-BMP (surrogate) chars — normalization/font risks |
| Full-safe-Unicode (≈116k cps, theoretical) | ~17 | ~240* | Not packaged; would be a custom invention (§6) |
| QR (per printed module) | ~0.09 B/module | 2,953 B max | Density is visual, not typable |

*Twitter-specific weighting; for general paste the number is simply
`floor(8 × capacity) / bits-per-char`.

**Measured projections for THIS project's real offer** (JSON ≈ 787 bytes,
deflated ≈ 481 bytes):

| Scheme | chars (raw JSON) | chars (deflated 481 B) |
|---|---|---|
| base64url (today) | 1,049 (`HOP1.`) | 646 (`E1.`) |
| base2048 | ~573 | ~350 |
| **base65536** | **~394** | **~241** |
| max-safe ≈ 116k alphabet | ~371 | ~226 |

Notes from the source analysis:
- **base65536** is the sweet spot: 2 bytes/codepoint, uses only "safe" BMP code
  points (no unassigned, whitespace, controls), and is **immune to Unicode
  normalization** — meaning copy/paste through chat apps, email, SMS and forms
  preserves it exactly. This is the strongest real-world guarantee available.
- Going wider than 65,536 code points (e.g., all ~116k safe code points, or
  non-BMP alphabets) buys only ~5–10% more and sharply increases real-world
  failure risk (font coverage, IMEs, platform normalization, screen readers).
- Verdict: **ship base65536-class encoding; treat anything wider as an
  experimental flag.**

---

## 5. Bonus: the "SDP diet" (shrinks the bytes before encoding)

Independent of alphabet width, the underlying JSON can be made smaller by
pruning SDP before it is wrapped:

| Technique | Saving | Caveat |
|---|---|---|
| Drop `a=extmap*` lines (not needed for a bare data channel) | ~80–150 B | Safe only if you never use audio/video on that connection |
| Drop non-host ICE candidates for same-LAN rooms | ~100–300 B | Breaks cross-NAT joins; make it a "same network" mode |
| Drop `a=ice-options`, `a=msid-semantic` filler | ~40 B | Mostly safe |
| Omit redundant SDP attributes the browser re-adds on answer | small | Must test both sides |
| Deflate-raw (already shipped in `E1.`) | −38% | Done |

Combining diet + deflate + base65536, a same-LAN invite could plausibly reach
**≈ 150 characters**. Cross-network invites keep all candidates, landing
**≈ 240 characters** with base65536 alone.

---

## 6. The invention: "E1-wide" — a layered character code

Proposal for the shortest serverless invite the platform allows:

```
Layer 1  Invite diet      → trim SDP for the room's topology (optional "LAN mode")
Layer 2  Deflate-raw      → native CompressionStream (shipped)
Layer 3  E1-wide alphabet → base65536-class mapping of the compressed bytes
                            (16 bits/codepoint, safe BMP set, normalization-immune)
Layer 4  Framing          → "E2." prefix + grouped blocks for readability/typing
                            (spaces are ignored by the decoder, like a QR finder)
Layer 5  Fallbacks        → decoder still accepts E1./HOP1./plain JSON; if the
                            wide alphabet is mangled in transit, the error is
                            caught and the host is told to resend as base64
```

Design rules for the wide alphabet (derived from the base65536 experience):
1. **Only assigned, non-combining, non-variant, non-space BMP code points.**
2. **Normalization-stable** (NFC round-trip identity) — avoids silent corruption.
3. **Block-arranged in 256-entry tables** so encode/decode is pure table lookup
   (tiny code, no external dependency — matters for a single-file app).
4. Decoder ignores whitespace, so the code can be formatted as
   `驨ꍬ啯 𒁷ꍲᕤ …` blocks (note: base65536 sample shown for illustration; final
   table is fixed in code).
5. Optional Reed–Solomon-style character redundancy is *not* worth it here
   (costs ~15–25% for rare benefit on copy/paste; QR's ECC only makes sense
   because its channel is noisy optics).

Expected outcome for the current real offer:

| | today | E1-wide |
|---|---|---|
| invite payload | 646 chars | **≈ 240 chars** |
| room name (same-browser join) | 6 chars | 6 chars |
| QR of invite bytes | v~9 | same bytes (QR unchanged — still zero-typing) |

---

## 7. What still requires a server (honest appendix)

To reach truly short codes (≤ 6 chars) from *any* device, the code must point
to bytes stored where both devices can read them — a shared directory. Browsers
cannot host one: any page (JS, WASM, or an emulated OS via CheerpX/v86) may only
*open outbound* connections; nothing can dial *in* to a tab. So the directory is
either a machine you run or a third-party relay. Everything in §2–§6 is the
maximum that is possible without one.

---

## 8. Implementation plan (proposed, not yet built)

1. **`invite-codec.js`** — new file, isolated and unit-testable:
   - `encodeWide(bytes) / decodeWide(text)` — fixed 65,536-codepoint table
     (generated once into a compact trie or two Uint16 arrays, ~64 KB worst case,
     or a smaller 8,192-entry "E1-lite" table for file size).
   - Keeps existing `E1.` base64 path as fallback; adds `E2.` prefix.
   - `bundleInvite(json, {diet, wide}) → code`, `unbundleInvite(code) → json`.
2. **index.svg** — load codec (inline or external with graceful fallback),
   swap `compactInviteCode` to produce `E2.` when wide is available.
3. **Manual retype helper** — optional "show as grouped blocks" overlay for
   people who must retype rather than paste.
4. **Test matrix** — paste round-trips through at least: Chrome/Safari/Firefox,
   iOS/Android keyboards, macOS/Windows chat apps, email, SMS.
5. **QR** — unchanged bytes; zero-typing path for proximity joins.

Open decisions before building:
- Accept the exotic-glyph look of wide text (trade legibility for length), or
  keep `E1.` ASCII as the default with `E2.` behind an "ultra-short code" toggle?
- Include the SDP "diet" LAN mode, or ship only the cross-network-safe encoding
  first?
- Inline the codec into index.svg (keeps single-file property) or ship as a
  second file with a loader?
