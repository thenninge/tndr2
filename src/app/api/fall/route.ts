import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
const FILE = 'data/fall.json';

export async function GET() {
  try {
    const data = await fs.readFile(FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  await fs.writeFile(FILE, JSON.stringify(body), 'utf-8');
  return NextResponse.json({ ok: true });
}
