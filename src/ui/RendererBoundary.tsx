import { Component } from 'react';
import type { ReactNode } from 'react';
/** A failed experimental import/render must leave a playable baseline. */
export class RendererBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
