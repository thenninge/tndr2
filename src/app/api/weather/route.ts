import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'forecast', 'history', 'today'
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const date = searchParams.get('date');
    
    if (!type || !lat || !lon) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    const apiKey = 'a38ce2793c8946aebd2195626250109';
    let url: string;
    
    switch (type) {
      case 'forecast':
        url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=7&aqi=no`;
        break;
      case 'today':
        url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=1&aqi=no`;
        break;
      case 'history':
        if (!date) {
          return NextResponse.json({ error: 'Date required for history' }, { status: 400 });
        }
        url = `https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${lat},${lon}&dt=${date}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
    
    console.log(`🌍 [Weather API Proxy] Calling: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ [Weather API Proxy] Error: ${response.status} ${response.statusText}`, data);
      return NextResponse.json({ error: data.error || 'Weather API error' }, { status: response.status });
    }
    
    console.log(`✅ [Weather API Proxy] Success: ${type} data fetched`);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('❌ [Weather API Proxy] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
