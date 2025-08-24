import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const apiKey = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || 'mistral-tiny';

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Du er en hjelpsom jaktassistent. Svar alltid på norsk.' },
        { role: 'user', content: message }
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  });

  const data = await response.json();
  return NextResponse.json({ answer: data.choices[0].message.content });
}

