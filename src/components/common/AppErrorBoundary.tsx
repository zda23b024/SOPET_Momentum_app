import React from 'react';
import { WorkspaceState } from './WorkspaceState';
export class AppErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { failed: boolean }> {
  private readonly childNodes: React.ReactNode;
  state = { failed: false };
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.childNodes = props.children;
  }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <WorkspaceState title="Something went wrong" description="Your workspace could not be displayed. Reload to reconnect to your saved data." onRetry={() => window.location.reload()} /> : this.childNodes;
  }
}
