export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(Math.random().toString(), {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache',
    },
  })
}
