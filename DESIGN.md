# Impeccable Design Language System (DESIGN.md)

This project adheres strictly to the **Impeccable** design principles, avoiding "AI slop" and SaaS visual cliches in favor of a considered, unhurried, and premium editorial aesthetic.

## 1. Visual Philosophy & Identity
Our design is **light, simple, modern, and high-craft**. It feels like a premium print editorial or a highly-designed museum catalog—never like a generic startup web app.

*   **Human & Unhurried:** Generous spacing, minimal decoration, extreme focus on typography and clear functional layout.
*   **The Paper-Not-White Rule:** Avoid cold pure white `#fff` backgrounds. All pages use **Warm Ash Cream** (`#F7F5F0`) as the canvas, evoking premium recycled paper or warm linen.
*   **The One Voice Rule:** A single, extremely vibrant accent color represents the brand: **Emerald Green** (`#008055`). No supporting accent colors (blue, orange, purple, etc.) are allowed.
*   **Hairline Separators:** Decorative borders are thin, subtle hairlines (`1px solid rgba(0, 0, 0, 0.08)`) that define space without adding visual noise.
*   **Minimalist Shadows:** Shadows are nearly invisible, using alphas $\leq 0.04$ to provide a gentle lift, rather than a muddy floating effect.

---

## 2. Design Tokens

### Colors (Tinted Neutrals & Accent)
*   `--impeccable-bg`: `#F7F5F0` (Warm Ash Cream)
*   `--impeccable-surface`: `#FCFAF6` (Warm Tinted Ivory)
*   `--impeccable-accent`: `#008055` (Vibrant Editorial Emerald)
*   `--impeccable-accent-light`: `rgba(0, 128, 85, 0.06)` (Soft Emerald Tint)
*   `--impeccable-text`: `#1C1B1A` (Charcoal Black - no pure black)
*   `--impeccable-text-muted`: `#787672` (Warm Slate Muted Gray)
*   `--impeccable-border`: `rgba(28, 27, 26, 0.08)` (Hairline Border)

### Typography
We pair high-contrast weights to establish a clear rhythm:
*   `--impeccable-font-serif`: 'Outfit', 'Inter', -apple-system, sans-serif
*   `--impeccable-font-sans`: 'Noto Sans TC', -apple-system, sans-serif

### Spacing Scale
All margins, paddings, and gaps must strictly adhere to this scale:
*   `8px` (XS - micro alignments)
*   `16px` (S - item gaps)
*   `24px` (M - layout gutters)
*   `32px` (L - section margins)
*   `48px` (XL - large sections)
*   `80px` (XXL - hero spacing)

---

## 3. Anti-Patterns (What We Never Do)
*   **NO purple-to-blue gradients** or tech-bro gradients.
*   **NO generic system fonts** without custom letter-spacing.
*   **NO heavy shadows** or heavily rounded cards (pill shapes on large cards).
*   **NO gray text on colored backgrounds** (contrast must remain impeccable).
*   **NO bounce or elastic easing** in animations (use smooth, linear, or subtle exponential transitions).
