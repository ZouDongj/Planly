import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ErrorBoundary is a class component (React requirement), so we can't use hooks.
// The text is intentionally simple English — this screen is only shown on crash.
const ERR_TITLE = "Something went wrong";
const ERR_BODY = "An unexpected error occurred";
const ERR_RETRY = "Try again";
const ERR_HINT = "If the problem persists, try restarting the app.";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-screen flex items-center justify-center bg-surface-muted">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{ERR_TITLE}</h2>
              <p className="text-xs text-text-muted mt-1">
                {this.state.error?.message || ERR_BODY}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {ERR_RETRY}
            </button>
            <p className="text-[10px] text-text-muted/60">
              {ERR_HINT}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
