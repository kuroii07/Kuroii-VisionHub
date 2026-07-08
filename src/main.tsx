import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

function formatBootError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '';
  return { message, stack };
}

function renderBootError(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;

  const { message, stack } = formatBootError(error);
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;background:#070a11;color:#f7f8fb;font-family:Inter,Segoe UI,Arial,sans-serif;padding:28px;">
      <div style="width:min(860px,92vw);padding:30px;border:1px solid rgba(255,99,126,.35);border-radius:24px;background:rgba(36,16,24,.88);box-shadow:0 24px 80px rgba(0,0,0,.32);">
        <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#ffb2bf;margin-bottom:12px;">Kuroii VisionHub 启动错误</div>
        <h1 style="margin:0 0 12px;font-size:28px;">前端运行时启动失败</h1>
        <p style="line-height:1.7;color:rgba(247,248,251,.76);">下面是 WebView 捕获到的错误。把这段发给开发者即可定位。</p>
        <pre style="white-space:pre-wrap;word-break:break-word;margin-top:16px;padding:16px;border-radius:16px;background:rgba(0,0,0,.28);color:#fff;">${message}\n\n${stack}</pre>
      </div>
    </div>
  `;
}

function BootErrorView(props: { error: unknown }) {
  const { message, stack } = formatBootError(props.error);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#070a11', color: '#f7f8fb', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', padding: 28 }}>
      <div style={{ width: 'min(860px, 92vw)', padding: 30, border: '1px solid rgba(255,99,126,.35)', borderRadius: 24, background: 'rgba(36,16,24,.88)', boxShadow: '0 24px 80px rgba(0,0,0,.32)' }}>
        <div style={{ fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', color: '#ffb2bf', marginBottom: 12 }}>Kuroii VisionHub 启动错误</div>
        <h1 style={{ margin: '0 0 12px', fontSize: 28 }}>前端运行时启动失败</h1>
        <p style={{ lineHeight: 1.7, color: 'rgba(247,248,251,.76)' }}>下面是 WebView 捕获到的错误。把这段发给开发者即可定位。</p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 16, padding: 16, borderRadius: 16, background: 'rgba(0,0,0,.28)', color: '#fff' }}>
          {message}
          {'\n\n'}
          {stack}
        </pre>
      </div>
    </div>
  );
}

class BootErrorBoundary extends React.Component<React.PropsWithChildren, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error('[Kuroii VisionHub] React render failed', error);
  }

  render() {
    if (this.state.error) {
      return <BootErrorView error={this.state.error} />;
    }

    return this.props.children;
  }
}

try {
  window.addEventListener('error', (event) => {
    console.error('[Kuroii VisionHub] window error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Kuroii VisionHub] unhandled rejection', event.reason);
  });

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BootErrorBoundary>
        <App />
      </BootErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('[Kuroii VisionHub] bootstrap failed', error);
  renderBootError(error);
}
