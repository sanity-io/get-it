export const runtime = 'nodejs'

export default async function EdgePage() {
  const timestamp = (
    await fetch('https://apicdn.sanity.io', {next: {tags: ['nodejs']}})
  ).headers.get('date')
  return <p id="nodejs">{timestamp}</p>
}
