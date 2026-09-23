export const state = {
  connected: false,
  scanning: false,
  messages: [],
  selectedIds: new Set(),
  lastScanAt: null,
};

export function resetSelection() {
  state.selectedIds = new Set();
}

export function resetMessages() {
  state.messages = [];
  state.lastScanAt = null;
  resetSelection();
}

export function restoreMessages({ messages, selectedIds, lastScanAt }) {
  state.messages = Array.isArray(messages) ? messages : [];
  state.selectedIds = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  state.lastScanAt = lastScanAt ? new Date(lastScanAt) : null;
}
