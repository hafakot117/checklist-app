export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listName } = req.body;
  if (!listName || typeof listName !== 'string' || !listName.trim()) {
    return res.status(400).json({ error: 'listName is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `אתה עוזר לניהול רשימות. המשתמש יוצר רשימה בשם: "${listName.trim()}". הצע בדיוק 8 פריטים מתאימים לרשימה זו בעברית. החזר רק את הפריטים, כל פריט בשורה נפרדת, ללא מספרים, ללא נקודות, ללא הסברים.`
      }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
  }

  const lines = data.content[0].text.trim().split('\n').map(l => l.trim()).filter(l => l).slice(0, 8);
  return res.status(200).json({ suggestions: lines });
}
