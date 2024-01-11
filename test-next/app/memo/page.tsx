import {adapter, getIt} from 'get-it'
import {jsonResponse, promise} from 'get-it/middleware'

// Dedupe test based on https://github.com/vercel/next.js/blob/5f9d2c55ca3ca3bd6a01cf60ced69d3dd2c64bf4/test/e2e/app-dir/app-fetch-deduping/app-fetch-deduping.test.ts#L50-L79

export default async function MemoPage() {
  const id = `${Date.now()}-${Math.random()}`
  return (
    <>
      <p id="adapter">adapter: {adapter}</p>
      <MemoTest1 id={id} />
      <MemoTest2 id={id} />
      <MemoTest3 id={id} />
    </>
  )
}

interface MemoProps {
  id: string
}
async function MemoTest1({id}: MemoProps) {
  const a = await test(id, false)
  const b = await test(id, false)

  return <p id="test1">{a === b ? 'success' : 'failed'}</p>
}
async function MemoTest2({id}: MemoProps) {
  const a = await test(id, true)
  const b = await test(id, true)
  return <p id="test2">{a !== b ? 'success' : 'failed'}</p>
}
async function MemoTest3({id}: MemoProps) {
  let controller = new AbortController()
  const a = await test(id, controller.signal)
  controller = new AbortController()
  const b = await test(id, controller.signal)
  return <p id="test3">{a !== b ? 'success' : 'failed'}</p>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const request = getIt([jsonResponse(), promise()])
async function test(id: string, signal?: boolean | AbortSignal) {
  const url = `https://get-it-test-next.sanity.build/api/random?id=${id}&signal=${
    typeof signal === 'boolean' ? signal : 'controller'
  }`
  const controller = new AbortController()
  const next = {revalidate: 0} satisfies NextFetchRequestConfig
  // return await (
  //   await fetch(
  //     url,
  //     signal === false ? {next} : {next, signal: signal === true ? controller.signal : signal},
  //   )
  // ).text()

  return await request({
    url,
    useAbortSignal: signal === true,
    fetch: signal === false ? {next} : {next, signal: signal === true ? controller.signal : signal},
  }).then((res: any) => res.body)
}
