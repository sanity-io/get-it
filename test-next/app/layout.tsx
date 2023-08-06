export default async function RootLayout({children}: {children: React.ReactNode}) {
  // Dedupe test based on https://github.com/vercel/next.js/blob/5f9d2c55ca3ca3bd6a01cf60ced69d3dd2c64bf4/test/e2e/app-dir/app-fetch-deduping/app-fetch-deduping.test.ts#L50-L79
  if ((await getDuplicate()) !== (await getDuplicate())) {
    throw new Error('Deduping failed')
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

async function getDuplicate() {
  // Passing a signal to the fetch call is supposed to opt-out of request memoization
  const {signal} = new AbortController()
  const res = await fetch('https://ppsg7ml5.api.sanity.io/vX/data/query/test?query=now()', {
    signal,
    cache: 'force-cache',
  })
  const json = await res.json()
  return json.result
}
