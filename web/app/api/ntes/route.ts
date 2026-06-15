import { NextRequest, NextResponse } from 'next/server';
import { ntesRequest, buildPayload, Method, Params } from '@/app/lib/ntes';
import { pnrStatus } from '@/app/lib/pnr';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'ntes-proxy' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params } = body as { method: Method; params: any };

    if (method === 'pnr') {
      const data = await pnrStatus(params.pnr);
      return NextResponse.json({ success: true, data });
    }

    const payload = buildPayload(method, params as Params[typeof method]);
    const data = await ntesRequest(payload);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
