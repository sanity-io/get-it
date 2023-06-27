import {getTimestamp} from '../utils'

export const runtime = 'edge'

export default async function EdgePage() {
  const timestamp = await getTimestamp(runtime)
  return <p id="edge">{timestamp}</p>
}
