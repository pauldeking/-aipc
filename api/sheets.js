export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      student_name, unit, scenario, difficulty,
      date, rating, notes_count, reactions, summary
    } = req.body;

    // Google Sheets API via service account
    // Uses the GOOGLE_SERVICE_ACCOUNT_JSON and SHEETS_ID env vars
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const sheetsId = process.env.SHEETS_ID;

    // Get access token via JWT
    const token = await getAccessToken(serviceAccount);

    // Append a row to the sheet
    const row = [
      date,
      student_name || 'Anonymous',
      unit || '',
      scenario || '',
      difficulty || '',
      rating || '',
      notes_count || 0,
      reactions || '',
      summary || ''
    ];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!A:I:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [row] })
      }
    );

    const data = await response.json();
    if (response.ok) {
      return res.status(200).json({ ok: true });
    } else {
      console.error('Sheets error:', data);
      return res.status(500).json({ error: 'Sheets append failed', details: data });
    }
  } catch (error) {
    console.error('Sheets handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Minimal JWT implementation for Google service account auth
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const toSign = `${headerB64}.${claimB64}`;

  // Sign with private key using Web Crypto
  const privateKeyPem = serviceAccount.private_key;
  const pemBody = privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const keyData = Buffer.from(pemBody, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(toSign)
  );

  const jwt = `${toSign}.${Buffer.from(sig).toString('base64url')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}
