import {getTimestamp} from '../utils'

export const runtime = 'nodejs'
// Without dynamic rendering the revalidate tags doesn't apply, since we're not setting `revalidate`. The edge runtime is always dynamic so this isn't needed there.
export const dynamic = 'force-dynamic'

export default async function EdgePage() {
  const timestamp = await getTimestamp(runtime)
  return <p id="nodejs">{timestamp}</p>
}
