import {adapter, environment} from 'get-it'

import {getTimestamp} from '../utils'

export const runtime = 'nodejs'

export default async function NodePage() {
  const [dynamic, timestamp] = await getTimestamp(runtime)
  return (
    <>
      <p id="nodejs">static: {timestamp}</p>
      <p id="dynamic">dynamic: {dynamic}</p>
      <p id="adapter">adapter: {adapter}</p>
      <p id="environment">environment: {environment}</p>
    </>
  )
}
