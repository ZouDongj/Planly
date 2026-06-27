import "@testing-library/jest-dom/vitest";

// Mock the Tauri invoke API — all store tests will import from ../lib/commands
// which wraps invoke(). We mock at the invoke level so the stores' API calls
// resolve to controlled test values.
