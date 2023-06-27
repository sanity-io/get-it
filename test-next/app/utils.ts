export async function getTimestamp(runtime: string) {
  const res = await fetch('https://apicdn.sanity.io', {next: {tags: [runtime]}})
  return res.headers.get('date')
}
