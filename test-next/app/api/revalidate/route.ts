import {revalidateTag} from 'next/cache'
import {NextRequest, NextResponse} from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  revalidateTag(tag!)
  return NextResponse.json({revalidated: true, now: Date.now()})
}
