import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { FALL } from '../../fall';
const FILE = 'data/fall.json';

export async function GET() {
  try {
    const data = await fs.readFile(FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return NextResponse.json(parsed);
    } else {
      return NextResponse.json(FALL);
    }
  } catch {
    return NextResponse.json(FALL);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  await fs.writeFile(FILE, JSON.stringify(body), 'utf-8');
  return NextResponse.json({ ok: true });
}
