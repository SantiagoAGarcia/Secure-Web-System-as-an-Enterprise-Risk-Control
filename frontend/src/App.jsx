import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    isLoading,
    user,
    error,
    getAccessTokenSilently
  } = useAuth0();

  const [result, setResult] = useState('');
  const [isCalling, setIsCalling] = useState(false);

  const isConfigured = Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN &&
    import.meta.env.VITE_AUTH0_CLIENT_ID &&
    import.meta.env.VITE_AUTH0_DOMAIN !== 'YOUR_TENANT.us.auth0.com'
  );

  async function callApi() {
    setIsCalling(true);
    setResult('Calling protected API...');
    try {
      const token = await getAccessTokenSilently();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/risk-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`API returned ${response.status}${body ? `: ${body}` : ''}`);
      }
      setResult(JSON.stringify(JSON.parse(body), null, 2));
    } catch (err) {
      setResult(`Request failed: ${err.message}`);
    } finally {
      setIsCalling(false);
    }
  }

  if (!isConfigured) {
    return (
      <main className="container">
        <header className="card warning">
          <h2>⚠️ Auth0 Configuration Required</h2>
          <p>Please edit <code>frontend/.env.local</code> with your actual Auth0 credentials:</p>
          <ul>
            <li><code>VITE_AUTH0_DOMAIN=dev-pex0h55z20dwvyvt.us.auth0.com</code></li>
            <li><code>VITE_AUTH0_CLIENT_ID=YOUR_CLIENT_ID</code></li>
            <li><code>VITE_AUTH0_AUDIENCE=https://enterprise-risk-api</code></li>
            <li><code>VITE_API_URL=https://santiago-risk.duckdns.org</code></li>
          </ul>
        </header>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="container">
        <p className="loading">Loading authentication session...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <header className="card error">
          <h2>Authentication Error</h2>
          <pre>{error.message}</pre>
          <button onClick={() => loginWithRedirect()}>Try again</button>
        </header>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="container">
        <div className="card">
          <h1>Enterprise Risk Lab</h1>
          <p className="subtitle">Secure Web System as an Enterprise Risk Control</p>
          <div className="status-badge status-unauthenticated">● Unauthenticated</div>
          <p>Log in with your Auth0 account to obtain an access token and interact with the protected API.</p>
          <button className="btn primary" onClick={() => loginWithRedirect()}>
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card">
        <h1>Enterprise Risk Lab</h1>
        <p className="subtitle">Secure Web System as an Enterprise Risk Control</p>
        <div className="status-badge status-authenticated">● Authenticated</div>

        <div className="user-details">
          <p><strong>Signed in as:</strong> {user?.name || user?.email}</p>
          <p className="subtext"><strong>Subject (sub):</strong> <code>{user?.sub}</code></p>
        </div>

        <div className="actions">
          <button className="btn primary" onClick={callApi} disabled={isCalling}>
            {isCalling ? 'Calling...' : 'Call protected API'}
          </button>
          <button
            className="btn secondary"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Log out
          </button>
        </div>

        {result && (
          <div className="response-box">
            <h3>API Response</h3>
            <pre>{result}</pre>
          </div>
        )}
      </div>
    </main>
  );
}
