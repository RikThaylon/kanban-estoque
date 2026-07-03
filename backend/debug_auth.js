// Debug script for token flows
// NOTE: Do NOT include real credentials. Use environment variables or pass via CLI.

async function run() {
  try {
    const baseURL = process.env.BASE_URL || 'http://localhost:3001/api/v1';
    const username = process.env.DEBUG_USERNAME || 'admin_example';
    const senha = process.env.DEBUG_PASSWORD || 'password_example';

    console.log('[1] Logging in...');
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, senha })
    });

    console.log('Login Status:', loginRes.status);
    // Try to read Set-Cookie header (only available in Node fetch/server envs)
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('Raw Set-Cookie header:', setCookieHeader);

    if (!setCookieHeader) {
      console.log('NO COOKIES RECEIVED! This may be due to HttpOnly or cross-origin issues.');
    }

    // Extract cookie name=value if present
    let cookieValue = null;
    if (setCookieHeader) {
      cookieValue = setCookieHeader.split(';')[0];
      console.log('Parsed Cookie header (name=value):', cookieValue);
    }

    console.log('[2] Refreshing token...');
    const refreshRes = await fetch(`${baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(cookieValue ? { 'Cookie': cookieValue } : {})
      }
    });

    console.log('Refresh Status:', refreshRes.status);
    const refreshData = await refreshRes.text();
    console.log('Refresh Response:', refreshData);
    console.log('SUCCESS! If there are issues, check CORS and cookie attributes (HttpOnly, SameSite, Secure).');
  } catch (err) {
    console.error('Error occurred:', err.message);
  }
}

run();
