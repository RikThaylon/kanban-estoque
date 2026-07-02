async function run() {
  try {
    const baseURL = 'http://localhost:3001/api/v1';

    console.log('[1] Logging in...');
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        senha: 'password123'
      })
    });

    const loginData = await loginRes.json();
    console.log('Login Status:', loginRes.status);
    
    // Extract cookies from response headers
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('Cookies received:', setCookieHeader);

    if (!setCookieHeader) {
      console.log('NO COOKIES RECEIVED! This is the root cause!');
      return;
    }

    console.log('[2] Refreshing token...');
    const refreshRes = await fetch(`${baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': setCookieHeader
      }
    });

    console.log('Refresh Status:', refreshRes.status);
    const refreshData = await refreshRes.text();
    console.log('Refresh Response:', refreshData);
    console.log('SUCCESS! The issue might be in the browser handling or CORS.');
  } catch (err) {
    console.error('Error occurred:', err.message);
  }
}

run();
