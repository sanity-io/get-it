import {getTimestamp} from '../utils'

export const runtime = 'nodejs'

export default async function EdgePage() {
  const timestamp = await getTimestamp(runtime)
  return <p id="nodejs">{timestamp}</p>
}
