import React from 'react';

export class SceneErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, background: 'red', color: 'white', padding: '20px', width: '100vw', height: '100vh' }}>
          <h1>Canvas Error</h1>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
