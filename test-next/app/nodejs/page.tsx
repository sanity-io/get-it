import {getTimestamp} from '../utils'

export const runtime = 'nodejs'

export default async function EdgePage() {
  const [dynamic, timestamp] = await getTimestamp(runtime)
  return (
    <>
      <p id="nodejs">{timestamp}</p>
      <p id="dynamic">{dynamic}</p>
    </>
  )
}
