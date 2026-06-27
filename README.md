# Planly

A beautiful, lightweight desktop schedule management app built with Tauri v2, React, and Rust.

一款精美的桌面日程管理工具，使用 Tauri v2 + React + Rust 构建。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

## ✨ Features

- **Multiple Views** — List, Kanban board, and Calendar views for managing tasks your way
- **Task Hierarchy** — Nested subtasks with drag-and-drop reordering
- **Floating Cards** — Pop out any task into a standalone always-on-top mini window
- **Smart Reminders** — One-time and recurring reminders with system notifications
- **Recurring Tasks** — Daily, weekly, and monthly recurrence rules
- **Task Groups** — Color-coded groups with customizable icons
- **Archive System** — Archive completed tasks to keep your workspace clean
- **Notes** — Rich text notes with image support (TipTap editor)
- **Data Export/Import** — Backup and restore all data via JSON files
- **Dark Mode** — Multiple light and dark themes
- **Bilingual** — English / 中文, auto-follows system on first launch
- **System Tray** — Quick add task, today's tasks, and show window from the tray
- **Keyboard Shortcuts** — Customizable sidebar toggle shortcut
- **Portable** — Data stored next to the executable (portable mode) or in AppData

## 🖼️ Screenshots

<img width="1100" height="720" alt="image" src="https://github.com/user-attachments/assets/95261e0c-90e4-4ff0-ae22-048a1b7c32aa" />


## 🚀 Download

Download the latest installer from the [Releases](../../releases) page.

### Windows

1. Download `planly_1.0.0_x64-setup.exe`
2. Run the installer — it supports per-user installation (no admin required)
3. Choose your language during installation (English / 中文)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | React 19 + TypeScript |
| State Management | Zustand v5 |
| Styling | Tailwind CSS v4 |
| UI Components | base-ui + custom components |
| Rich Text | TipTap |
| Animations | Framer Motion |
| Backend | Rust + SQLite (rusqlite) |
| Build | Vite + NSIS |

## 📦 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- [Rust](https://www.rust-lang.org/) (stable toolchain)
- For Windows: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Development

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build Installer

```bash
# Build a release installer (NSIS .exe)
npm run tauri build
```

The installer will be generated at:
```
src-tauri/target/release/bundle/nsis/planly_1.0.0_x64-setup.exe
```

### Run Tests

```bash
# Frontend tests
npm run test

# Rust tests
cd src-tauri && cargo test
```

## 📁 Project Structure

```
planly/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── card/                 # Floating card window components
│   │   ├── layout/               # App layout, sidebar, title bar
│   │   ├── notes/                # Rich text note editor
│   │   ├── reminders/            # Reminder creation dialog
│   │   ├── settings/             # Settings page
│   │   ├── tasks/                # Task cards, subtasks, detail drawer
│   │   ├── ui/                   # Reusable UI primitives (sheet, dialog, popover...)
│   │   └── views/                # List, Kanban, Calendar views
│   ├── stores/                   # Zustand state stores
│   ├── lib/                      # API commands, types, utilities
│   └── i18n/                     # English / Chinese translations
├── src-tauri/                    # Backend (Rust)
│   └── src/
│       ├── commands/             # Tauri command handlers (tasks, groups, reminders...)
│       ├── db.rs                 # SQLite database initialization
│       ├── models.rs             # Data models
│       └── scheduler.rs          # Background reminder scheduler
└── package.json
```

## 🎨 Customization

- **Themes** — 6 light themes (Default, GitHub, Notion, Minimal, Ocean, Sunset) and 2 dark themes (Default, One Dark Pro)
- **Corner Radius** — Adjustable from sharp to rounded
- **Drawer Width** — Customizable task detail panel width
- **Card Sections** — Toggle visibility of time, recurrence, reminders, group, and activity sections

## 📄 License

MIT
