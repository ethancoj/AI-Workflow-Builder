import { create } from 'zustand'

// UI-only state for the builder's test chat. Kept out of builderStore so nothing here
// can end up in the saved workflow JSON.

type TestRunState = {
  open: boolean
  /** Steps that ran on the last message, highlighted on the canvas. */
  ranNodeIds: string[]
  /** The step the conversation is paused at, waiting for the customer. */
  waitingNodeId: string | null
  /** Increases on every test message, so the canvas can replay its highlight animation. */
  runId: number
  setOpen: (open: boolean) => void
  showRun: (ranNodeIds: string[], waitingNodeId: string | null) => void
  clearRun: () => void
}

export const useTestRunStore = create<TestRunState>((set) => ({
  open: false,
  ranNodeIds: [],
  waitingNodeId: null,
  runId: 0,
  setOpen: (open) => set(open ? { open } : { open, ranNodeIds: [], waitingNodeId: null }),
  showRun: (ranNodeIds, waitingNodeId) => set((s) => ({ ranNodeIds, waitingNodeId, runId: s.runId + 1 })),
  clearRun: () => set({ ranNodeIds: [], waitingNodeId: null }),
}))
