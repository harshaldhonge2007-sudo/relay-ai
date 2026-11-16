#!/usr/bin/env python3
"""
measure_contrast.py — WCAG 2.1 Color Contrast Measurement Script

Calculates relative luminance and contrast ratios for all palette tokens in
RELAY AI (both Light and Dark themes) extracted directly from relay/web/src/index.css.
Outputs contrast ratios, passes/fails against WCAG AA (4.5:1 / 3.0:1) and AAA (7.0:1),
and writes a structured JSON report to relay/eval/contrast_report.json.
"""

import json
import os
import re
from pathlib import Path


def parse_hex_color(hex_str: str) -> tuple[int, int, int]:
    """Parse #RGB or #RRGGBB into (R, G, B) integer tuple."""
    hex_clean = hex_str.strip().lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join(c * 2 for c in hex_clean)
    if len(hex_clean) != 6:
        raise ValueError(f"Invalid hex color: {hex_str}")
    return (
        int(hex_clean[0:2], 16),
        int(hex_clean[2:4], 16),
        int(hex_clean[4:6], 16),
    )


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    """Calculate relative luminance according to WCAG 2.1 formula."""
    def channel_linear(c_byte: int) -> float:
        c_srgb = c_byte / 255.0
        if c_srgb <= 0.04045:
            return c_srgb / 12.92
        return ((c_srgb + 0.055) / 1.055) ** 2.4

    r_lin = channel_linear(rgb[0])
    g_lin = channel_linear(rgb[1])
    b_lin = channel_linear(rgb[2])
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def contrast_ratio(hex1: str, hex2: str) -> float:
    """Compute contrast ratio between two hex colors."""
    l1 = relative_luminance(parse_hex_color(hex1))
    l2 = relative_luminance(parse_hex_color(hex2))
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def extract_tokens_from_css(css_path: Path) -> dict:
    """Extract CSS custom properties for :root and [data-theme='dark']."""
    content = css_path.read_text(encoding="utf-8")

    # Extract :root block
    root_match = re.search(r":root\s*\{([^}]+)\}", content, re.DOTALL)
    root_css = root_match.group(1) if root_match else ""

    # Extract dark mode block
    dark_match = re.search(r'\[data-theme="dark"[^{]*\{([^}]+)\}', content, re.DOTALL)
    dark_css = dark_match.group(1) if dark_match else ""

    def parse_vars(block: str) -> dict[str, str]:
        tokens = {}
        for line in block.splitlines():
            line = line.strip()
            if line.startswith("--") and ":" in line:
                key, val = line.split(":", 1)
                val_clean = val.split("/*")[0].split(";")[0].strip()
                if val_clean.startswith("#"):
                    tokens[key.strip()] = val_clean
        return tokens

    return {
        "light": parse_vars(root_css),
        "dark": parse_vars(dark_css),
    }


def evaluate_palette(tokens: dict) -> dict:
    """Evaluate contrast ratios for standard UI combinations."""
    results = {"light": [], "dark": []}

    # Surfaces and text tokens to evaluate
    eval_matrix = [
        # (Foreground Token, Background Token, Usage Context, Large Text)
        ("--ink-primary", "--bg-base", "Primary Text on Page Base", False),
        ("--ink-primary", "--surface-card", "Primary Text on Card Surface", False),
        ("--ink-primary", "--surface-elevated", "Primary Text on Elevated Surface", False),
        ("--ink-secondary", "--bg-base", "Secondary Body Text on Page Base", False),
        ("--ink-secondary", "--surface-card", "Secondary Body Text on Card Surface", False),
        ("--ink-secondary", "--surface-elevated", "Secondary Text on Elevated Surface", False),
        ("--ink-tertiary", "--bg-base", "Tertiary Metadata / Timestamps on Base", False),
        ("--ink-tertiary", "--surface-card", "Tertiary Metadata / Citations on Card", False),
        ("--ink-tertiary", "--surface-elevated", "Tertiary Labels on Elevated Surface", False),
        ("--btn-primary-text", "--btn-primary-bg", "Solid Primary Button Label", False),
        ("--btn-secondary-text", "--btn-secondary-bg", "Secondary Button Label", False),
        ("--sidebar-ink", "--sidebar-surface", "Navigation Link on Sidebar", False),
        ("--sidebar-ink-muted", "--sidebar-surface", "Secondary Navigation on Sidebar", False),
    ]

    for mode in ["light", "dark"]:
        mode_tokens = tokens[mode]
        for fg_key, bg_key, context, is_large in eval_matrix:
            fg_hex = mode_tokens.get(fg_key)
            bg_hex = mode_tokens.get(bg_key)
            if not fg_hex or not bg_hex:
                continue

            ratio = contrast_ratio(fg_hex, bg_hex)
            req_aa = 3.0 if is_large else 4.5
            req_aaa = 4.5 if is_large else 7.0
            pass_aa = ratio >= req_aa
            pass_aaa = ratio >= req_aaa

            results[mode].append({
                "context": context,
                "foreground_token": fg_key,
                "foreground_hex": fg_hex,
                "background_token": bg_key,
                "background_hex": bg_hex,
                "ratio": round(ratio, 2),
                "wcag_aa_threshold": req_aa,
                "wcag_aa_pass": pass_aa,
                "wcag_aaa_threshold": req_aaa,
                "wcag_aaa_pass": pass_aaa,
            })

    return results


def main():
    repo_root = Path(__file__).resolve().parent.parent
    css_path = repo_root / "web" / "src" / "index.css"
    eval_dir = repo_root / "eval"
    eval_dir.mkdir(exist_ok=True, parents=True)
    out_json = eval_dir / "contrast_report.json"

    if not css_path.exists():
        print(f"Error: index.css not found at {css_path}")
        return 1

    tokens = extract_tokens_from_css(css_path)
    report = evaluate_palette(tokens)

    # Summary
    print("=" * 80)
    print("RELAY AI — WCAG 2.1 Palette Contrast Verification Audit")
    print("=" * 80)

    total_checks = 0
    total_passes = 0

    for mode in ["light", "dark"]:
        print(f"\n[{mode.upper()} THEME]")
        print(f"{'Context':<40} {'FG Hex':<9} {'BG Hex':<9} {'Ratio':<8} {'WCAG AA':<10} {'WCAG AAA'}")
        print("-" * 88)
        for row in report[mode]:
            total_checks += 1
            if row["wcag_aa_pass"]:
                total_passes += 1
            aa_str = "PASS (>=4.5)" if row["wcag_aa_pass"] else "FAIL (<4.5)"
            aaa_str = "PASS (>=7.0)" if row["wcag_aaa_pass"] else "FAIL (<7.0)"
            print(f"{row['context']:<40} {row['foreground_hex']:<9} {row['background_hex']:<9} {row['ratio']:<8.2f} {aa_str:<10} {aaa_str}")

    print("\n" + "=" * 80)
    print(f"Audit Complete: {total_passes}/{total_checks} evaluated pairings pass WCAG AA standards.")
    print(f"Full structured report written to: {out_json}")
    print("=" * 80)

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return 0


if __name__ == "__main__":
    exit(main())
