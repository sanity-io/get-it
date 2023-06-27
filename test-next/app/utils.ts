export async function getTimestamp(runtime: string) {
  const [dynamicRes, staticRes] = await Promise.all([
    fetch('https://apicdn.sanity.io', {cache: 'no-store'}),
    fetch('https://api.sanity.io', {next: {tags: [runtime]}}),
  ])
  return [dynamicRes.headers.get('date'), staticRes.headers.get('date')]
}
