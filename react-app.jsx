function WelcomeBanner() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: '#2563eb',
      color: '#ffffff',
      padding: '10px 14px',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      textAlign: 'center',
      boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
    }}>
      React is loaded — your backend now supports a React frontend.
    </div>
  );
}

const rootElement = document.getElementById('react-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<WelcomeBanner />);
}
