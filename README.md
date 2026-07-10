# 🏟️ Stadium Pulse AI

**Real-time stadium operations and fan engagement platform for FIFA World Cup 2026**

[![License: MIT](https://img.shields.io/badge/License-MIT-0df2a2?style=for-the-badge)](LICENSE)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🎯 Overview

Stadium Pulse AI is a **zero-backend, fully offline** command-and-control dashboard that serves two audiences:

- **Operations Teams**: Real-time stadium metrics, incident management, and scenario simulation
- **Fans**: Contextual guidance, wayfinding, and engagement through the Fan Concierge

The application uses a **shared state machine** to synchronize information across both interfaces, ensuring consistency across venue operations and fan experience.

**Built for:** FIFA World Cup 2026 Hackathon | **Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES2020) | **Dependencies:** Zero (100% offline)

---

## ✨ Key Features

### Command Center Dashboard

| Feature | Purpose |
|---------|---------|
| **Live Venue Heatmap** | 24-segment SVG stadium map showing real-time seat occupancy (green → orange → red) |
| **5 Scenario Modes** | Pre-Match, Kick-off Surge, Halftime Rush, Post-Match Exit, Severe Weather |
| **AI Terminal** | Typewriter-streamed tactical reasoning for current scenario |
| **Live Metrics** | Real-time updates: Seat Occupancy, Transit Wait, Energy, Gate Throughput |
| **Critical Alerts** | Seating segments ≥75% density trigger pulsing red indicators |
| **Incident Log** | AI-powered incident analysis with resolution tracking |
| **Pitch Telemetry** | Live player and ball movement simulation |
| **Venue Switcher** | Toggle between 4 FIFA 2026 venues (MetLife, Azteca, AT&T, BC Place) |

### Fan Concierge

| Feature | Purpose |
|---------|---------|
| **Contextual Chatbot** | Scenario-aware assistant responding to fan queries |
| **AR Wayfinder** | Visual path guidance with distance and destination updates |
| **State Sync** | Cross-mode updates reflecting current operations status |
| **Incident Alerts** | Direct deep-linking from ops incidents to priority fan notifications |
| **Eco-Tracker** | Gamified sustainability tracking for green transit choices |
| **Quick Access Prompts** | One-tap queries for transit, accessibility, gates, food, and seating |

---

## 🏗️ Architecture

### State Machine Design

The application centers on a **scenario state machine** that propagates operational context to both interfaces:

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Scenario State                     │
│  (Pre-Match | Kick-off | Halftime | Post-Match | Weather)  │
└─────────────────┬──────────────────────┬────────────────────┘
                   │                      │
         ┌─────────▼────────┐    ┌───────▼─────────┐
         │  Command Center  │    │  Fan Concierge  │
         ├──────────────────┤    ├─────────────────┤
         │ • Heatmap color  │    │ • Greeting text │
         │ • Metrics update │    │ • AR destination│
         │ • Incident seed  │    │ • Alert badge   │
         │ • AI terminal    │    │ • Scenario icon │
         └──────────────────┘    └─────────────────┘
```

### Scenario-Driven Behavior

Each scenario triggers distinct state changes across both interfaces:

| Scenario | Command Center | Fan Concierge |
|----------|---|---|
| **Pre-Match** | Green heatmap, normal metrics | "Gate C busy → try Gate A" |
| **Kick-off Surge** | Orange/red heatmap, critical alerts | "Block D at 98% — caution on concourses" |
| **Halftime Rush** | Red food/concourse areas | "Stalls 9–11 under 3 min wait" |
| **Post-Match Exit** | Red transit zones | "Metro delays — consider rideshare" |
| **Severe Weather** | Full red alert, outdoor areas blocked | "Emergency shelter mode active" |

### Data Flow

```
User Action (Scenario Click)
        ↓
applyScenario(mode)
        ↓
    ├─ Update global state
    ├─ Seed incidents
    ├─ Queue AI messages
    ├─ Pre-calculate AR routes
    └─ Trigger animations
        ↓
Parallel Rendering
    ├─ Command Center: Heatmap, metrics, terminal
    └─ Fan Concierge: Greeting, AR path, alerts
```

---

## 📸 Screenshots

### Command Center Dashboard
![Command Center Dashboard - Live Operations View]<img width="1920" height="2184" alt="image" src="https://github.com/user-attachments/assets/ea6b5ffe-7c65-47db-b40a-11855a28d778" />

*Real-time stadium heatmap with 24-segment occupancy zones, live metrics, AI terminal, and incident log for operational control.*

### Fan Concierge Interface
![Fan Concierge - Wayfinding & Engagement]<img width="1920" height="2090" alt="image" src="https://github.com/user-attachments/assets/7917a411-ce10-424b-89fe-925ffb394240" />

*Interactive fan companion with contextual chatbot, AR wayfinder for seat navigation, eco-tracker gamification, and scenario-aware alerts.*

---

## 📁 Project Structure

```
Stadium_pulse_ai/
├── index.html              # Application shell
│                          # • Both UI modes (Ops + Fan)
│                          # • SVG stadium map
│                          # • Semantic HTML structure
│
├── styles.css             # Design system & animations
│                          # • Glassmorphism theme
│                          # • CSS custom properties
│                          # • Keyframe animations (~600 lines)
│
├── app.js                 # State engine & logic
│                          # • Scenario state machine
│                          # • AI simulation engine
│                          # • Telemetry physics loop
│                          # • Cross-mode synchronization (~970 lines)
│
├── screenshots/           # Demo images
│
└── README.md             # This file
```

---

## 🚀 Quick Start

### Option 1: Direct Browser
```bash
# Simply open the file
open index.html
```

### Option 2: Local Server (Recommended)

**With Node.js:**
```bash
npx serve .
# Navigate to http://localhost:3000
```

**With Python:**
```bash
python -m http.server 3000
# Navigate to http://localhost:3000
```

---

## 🛠️ Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Markup** | HTML5 | Semantic, ARIA labels for accessibility |
| **Styling** | CSS3 | Glassmorphism, custom properties, animations |
| **Logic** | Vanilla JavaScript (ES2020) | No frameworks, no dependencies |
| **Animation** | CSS + `requestAnimationFrame` | Physics loop for smooth motion |
| **Fonts** | Google Fonts | Rajdhani (display), Inter (body), JetBrains Mono (terminal) |
| **Networking** | None (Offline-first) | Fully functional without internet |

---

## ♿ Accessibility

- **ARIA Labels**: All interactive elements labeled for screen readers
- **Semantic HTML**: Proper heading hierarchy, `<button>`, `<nav>` structure
- **Keyboard Navigation**: Full keyboard support with visible focus indicators
- **Motion Sensitivity**: Respects `prefers-reduced-motion` system preference
- **Color Contrast**: WCAG AA compliant text contrast ratios
- **Live Regions**: Dynamic updates announced to assistive technologies

---

## 🎓 Hackathon Challenge Alignment

| Requirement | Implementation |
|------------|---|
| **AI/GenAI** | OpsGenius AI terminal + contextual Fan Companion chatbot |
| **Real-Time Data** | `setInterval` refresh loop + `requestAnimationFrame` telemetry |
| **Fan Experience** | Full Concierge with AR, gamification, multilingual support |
| **Operations** | Incident management, 5-scenario simulation, alert propagation |
| **Sustainability** | Eco-Tracker with rewards for green transit choices |
| **Accessibility** | WCAG AA compliance + assistive tech support |
| **Zero Backend** | 100% client-side, no APIs, works offline |

---

## 📊 Code Metrics

- **Total Lines**: ~1,600 (HTML, CSS, JS combined)
- **Dependencies**: 0 (no npm, no external packages)
- **Bundle Size**: <100 KB uncompressed
- **Performance**: <50ms initial render, 60 FPS animations
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)

---

## 💡 Design Principles

1. **State-Driven**: Single source of truth for scenario state
2. **Offline-First**: Full functionality without network
3. **Performance**: Physics loop, CSS animations, no DOM thrashing
4. **Accessibility**: WCAG AA compliant from the ground up
5. **Maintainability**: Minimal dependencies, readable code structure

---

## 👩‍💻 Author

**Aryaa Jaiswal**  
FIFA World Cup 2026 Hackathon — Stadium Technology Track

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details

---

*Stadium Pulse AI — All data is procedurally generated for demonstration purposes.*
