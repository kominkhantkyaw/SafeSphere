import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { initWebVitalsReporting } from './services/reportWebVitals';
import './pwa-install'; // PWA install prompt handler

initWebVitalsReporting();

// Register PWA service worker for offline/install (production build)
import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

type AppErrorBoundaryProps = { children: React.ReactNode };
type AppErrorBoundaryState = { hasError: boolean; error: Error | null };

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SafeSphere error:', error, errorInfo);
  }

  handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_e) {}
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env?.DEV ?? false;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#1e40af',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>SafeSphere</h1>
          <p style={{ marginBottom: 16, opacity: 0.9 }}>
            Something went wrong. Try again, or reload the page.
          </p>
          {isDev && this.state.error && (
            <pre
              style={{
                marginBottom: 16,
                padding: 12,
                fontSize: 12,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                maxWidth: '100%',
                overflow: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleTryAgain}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '2px solid #fff',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1e40af',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '2px solid #fff',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleClearAndReload}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1e40af',
                backgroundColor: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Clear data & reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
