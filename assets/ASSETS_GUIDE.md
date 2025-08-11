# Valkyrie Wallet Assets Guide

## Required Assets

### App Icon (`icon.png`)
- **Size**: 1024x1024 px
- **Format**: PNG with transparency
- **Design**: 
  - Background: Cyberpunk gradient (#0a0e27 to #1a1f3a)
  - Main element: Lightning bolt (⚡) or stylized "V" 
  - Colors: Primary (#00ff9f), Accent (#0080ff), Secondary (#ff0080)
  - Style: Futuristic, glowing effect with neon borders

### Adaptive Icon (`adaptive-icon.png`)
- **Size**: 1024x1024 px
- **Format**: PNG with transparency
- **Design**: Foreground only version of main icon
- **Safe area**: 66% of total size (center 672x672 px)

### Splash Screen (`splash.png`)
- **Size**: 1284x2778 px (iPhone 14 Pro Max)
- **Format**: PNG
- **Design**:
  - Background: Dark gradient matching app theme
  - Logo: Centered Valkyrie logo with glow effect
  - Text: "VALKYRIE" with cyberpunk typography
  - Loading indicator area at bottom

### Favicon (`favicon.png`)
- **Size**: 32x32 px
- **Format**: PNG
- **Design**: Simplified version of main icon

## Color Palette

```
Primary: #00ff9f (Cyberpunk Green)
Secondary: #ff0080 (Cyberpunk Pink)
Accent: #0080ff (Cyberpunk Blue)
Background: #0a0e27 (Dark Blue)
Surface: #1a1f3a (Lighter Dark Blue)
Text: #ffffff (White)
Text Secondary: #cccccc (Light Gray)
Border: #333366 (Dark Gray-Blue)
```

## Design Guidelines

### Logo Elements
- Lightning bolt (⚡) as primary symbol
- Geometric, angular design
- Glowing/neon effect
- Optional circuit board patterns
- Futuristic typography for "VALKYRIE"

### Visual Effects
- Gradient overlays
- Glow/bloom effects
- Sharp, angular borders
- Metallic/chrome accents
- Holographic elements

### Typography
- Font family: Sans-serif, modern
- Weight: Bold for headings
- Letter spacing: Increased for cyberpunk feel
- Case: UPPERCASE for logos and headings

## Tools Recommended

- **Figma**: For vector design and prototyping
- **Adobe Illustrator**: For vector logo creation
- **Adobe Photoshop**: For effects and raster graphics
- **Canva**: For quick iterations
- **GIMP**: Free alternative to Photoshop

## Size Variations Needed

### iOS
- 20x20 (iPhone Notification)
- 29x29 (iPhone Settings)
- 40x40 (iPhone Spotlight)
- 58x58 (iPhone Settings @2x)
- 60x60 (iPhone App)
- 80x80 (iPhone Spotlight @2x)
- 87x87 (iPhone App @3x)
- 120x120 (iPhone App @2x)
- 180x180 (iPhone App @3x)

### Android
- 48x48 (mdpi)
- 72x72 (hdpi)
- 96x96 (xhdpi)
- 144x144 (xxhdpi)
- 192x192 (xxxhdpi)

### Web
- 16x16 (favicon)
- 32x32 (favicon)
- 192x192 (PWA)
- 512x512 (PWA)

## Implementation Notes

1. Use Expo's `expo-splash-screen` for dynamic splash screens
2. Configure `app.json` with proper icon paths
3. Test icons on different backgrounds (light/dark)
4. Ensure icons are readable at small sizes
5. Follow platform-specific guidelines (iOS HIG, Material Design)

## Asset Generation Commands

```bash
# Generate all icon sizes (using a tool like expo-cli)
npx expo install expo-splash-screen
npx @expo/configure-splash-screen

# Or use online tools:
# - https://makeappicon.com/
# - https://appicon.co/
# - https://icon.kitchen/
```

## Current Status

- [ ] App Icon (1024x1024)
- [ ] Adaptive Icon (1024x1024)
- [ ] Splash Screen (1284x2778)
- [ ] Favicon (32x32)
- [ ] Icon variations (all sizes)
- [x] Splash screen implementation (code-based)
- [x] Color palette defined
- [x] Design guidelines established
