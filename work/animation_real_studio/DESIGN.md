---
version: "alpha"
name: "Kintsugi Frame"
description: "Cinematic, editorial studio interface for rights-safe original short-form production."
colors:
  ink: "#11141D"
  primary: "#C7E977"
  surface: "#1A2030"
  surfaceRaised: "#263147"
  paper: "#F5F1E8"
  paperMuted: "#C7C5BE"
  vermilion: "#E86F58"
  signal: "#C7E977"
  cyan: "#9FDAD3"
  line: "#435067"
  danger: "#E99987"
typography:
  display:
    fontFamily: "Pretendard Variable, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif"
    fontSize: "6.15rem"
    fontWeight: "700"
    lineHeight: "0.92"
    letterSpacing: "-0.055em"
  title:
    fontFamily: "Pretendard Variable, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif"
    fontSize: "3.125rem"
    fontWeight: "700"
    lineHeight: "0.98"
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Pretendard Variable, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.55"
  label:
    fontFamily: "Pretendard Variable, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  metadataPanel:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.paperMuted}"
    rounded: "{rounded.sm}"
  accentLabel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.vermilion}"
    typography: "{typography.label}"
  safeState:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  blockedState:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  nextAction:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  separator:
    backgroundColor: "{colors.line}"
    height: "1px"
---

## Overview

Use cinematic editorial contrast rather than a generic generative-AI dashboard. The Studio should feel like a quiet late-night production room: softened slate surfaces, warm paper information cards, a restrained coral accent, and muted-lime actions reserved for confirmed forward movement.

## Layout

Keep a thin utility bar, an oversized editorial headline, and an asymmetrical two-column composition on desktop. Collapse to a single column at 760px without hiding policy or status information. Treat every output as a production record, not a social-media post.

## Type and motion

Use dense display type for emotional hooks and deliberately compact labels for production metadata. Avoid decorative animation that can suggest an actual rendering process. Support `prefers-reduced-motion`; status changes must be expressed in text and colour-independent icons or labels.

## Components

Use paper cards for ideas, storyboards, and deliverables; use dark panels for active work and policy states. Make the primary action singular on every screen. Mark all generated-result placeholders as `DEMO` until a real media pipeline exists.

## Trust and safety

Never put copyrighted character names, real-person likenesses, or original-animation imagery in sample UI. Explain originalisation in calm language next to the moment a user selects an inspiration-based request. Default all shown projects and deliveries to Private.
