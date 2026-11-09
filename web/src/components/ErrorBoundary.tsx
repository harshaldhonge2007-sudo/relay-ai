import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-surface-card border-2 border-edge-strong rounded-card p-6 shadow-float text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-surface-elevated border border-edge-strong text-ink-primary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                Screen Rendering Error
              </h2>
              <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                An unexpected failure occurred while displaying this view. State remains protected.
              </p>
            </div>
            {this.state.error && (
              <pre className="p-3 rounded bg-surface-elevated border border-edge-subtle text-[11px] font-mono text-ink-secondary text-left overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-ink-primary text-white text-xs font-semibold rounded-btn hover:shadow-float"
              >
                Retry View
              </button>
              <button
                type="button"
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 border border-edge-strong bg-white text-ink-primary text-xs font-semibold rounded-btn hover:bg-surface-elevated"
              >
                Return to Cases
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
