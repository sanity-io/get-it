export default async function RootLayout({children}: {children: React.ReactNode}) {
  const id = `${Date.now()}-${Math.random()}`
  // Dedupe test based on https://github.com/vercel/next.js/blob/5f9d2c55ca3ca3bd6a01cf60ced69d3dd2c64bf4/test/e2e/app-dir/app-fetch-deduping/app-fetch-deduping.test.ts#L50-L79
  if ((await getDuplicate(id)) === (await getDuplicate(id))) {
    throw new Error('Deduping failed')
  }
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

async function getDuplicate(id: string) {
  // Passing a signal to the fetch call is supposed to opt-out of request memoization
  const {signal} = new AbortController()
  const res = await fetch(`https://get-it-test-next.sanity.build/api/random?id=${id}`, {
    signal,
  })
  return await res.text()
}
