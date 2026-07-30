---
version: "alpha"
name: "Kintsugi Frame"
description: "Cinematic, editorial studio interface for rights-safe original short-form production."
colors:
  ink: "#0D1018"
  surface: "#151B29"
  surfaceRaised: "#202A3B"
  paper: "#F4F0E8"
  paperMuted: "#C5C2BA"
  vermilion: "#FF5A3A"
  signal: "#D7FF62"
  cyan: "#9AE8E0"
  line: "#3A465B"
  danger: "#FF8E7A"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "6.5rem"
    fontWeight: "800"
    lineHeight: "0.88"
    letterSpacing: "-0.07em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "3.25rem"
    fontWeight: "750"
    lineHeight: "0.98"
    letterSpacing: "-0.045em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.55"
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.72rem"
    fontWeight: "700"
    lineHeight: "1"
    letterSpacing: "0.12em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "28px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "56px"
components:
  primaryAction:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
---

## Overview

Use cinematic editorial contrast rather than a generic generative-AI dashboard. The Studio should feel like a quiet late-night production room: dark slate surfaces, warm paper information cards, a single vermilion dramatic accent, and acid-green actions reserved for confirmed forward movement.

## Layout

Keep a thin utility bar, an oversized editorial headline, and an asymmetrical two-column composition on desktop. Collapse to a single column at 760px without hiding policy or status information. Treat every output as a production record, not a social-media post.

## Type and motion

Use dense display type for emotional hooks and deliberately compact labels for production metadata. Avoid decorative animation that can suggest an actual rendering process. Support `prefers-reduced-motion`; status changes must be expressed in text and colour-independent icons or labels.

## Components

Use paper cards for ideas, storyboards, and deliverables; use dark panels for active work and policy states. Make the primary action singular on every screen. Mark all generated-result placeholders as `DEMO` until a real media pipeline exists.

## Trust and safety

Never put copyrighted character names, real-person likenesses, or original-animation imagery in sample UI. Explain originalisation in calm language next to the moment a user selects an inspiration-based request. Default all shown projects and deliveries to Private.
