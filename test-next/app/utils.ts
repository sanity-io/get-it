// Test that the Vercel Data Cache is fully supported: https://vercel.com/docs/infrastructure/data-cache

export async function getTimestamp(runtime: string) {
  const [dynamicRes, staticRes] = await Promise.all([
    fetch(
      'https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=%7B%22dynamic%22%3A%20now()%7D',
      {cache: 'no-store'}
    )
      .then((res) => res.json())
      .then((json) => json.result.dynamic),
    fetch('https://ppsg7ml5.api.sanity.io/v1/data/query/test?query=%7B%22static%22%3A%20now()%7D', {
      cache: 'force-cache',
      next: {tags: [runtime]},
    })
      .then((res) => res.json())
      .then((json) => json.result.static),
  ])
  return [dynamicRes, staticRes]
}
