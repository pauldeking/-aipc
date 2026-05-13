export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { template_params } = req.body;
    const report     = template_params?.session_report || 'No report provided';
    const student    = template_params?.student_name   || 'Anonymous';
    const unit       = template_params?.unit           || 'Unknown unit';
    const scenario   = template_params?.scenario       || 'Unknown scenario';
    const diff       = template_params?.diff           || '';
    const date       = template_params?.date           || new Date().toLocaleDateString('en-AU');

    const subject = `CounsellorReady — ${student} — ${unit} — ${scenario} — ${date}`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'CounsellorReady <onboarding@resend.dev>',
        to: ['paul.de.king@gmail.com'],
        subject: subject,
        text: `CounsellorReady — Session Feedback\n${'='.repeat(50)}\n\nStudent:   ${student}\nUnit:      ${unit}\nScenario:  ${scenario}\nDifficulty: ${diff}\nDate:      ${date}\n\n${'='.repeat(50)}\n\n${report}`
      })
    });

    const data = await response.json();
    console.log('Resend response:', response.status, JSON.stringify(data));
    if (response.ok) {
      return res.status(200).send('OK');
    } else {
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: error.message });
  }
}
