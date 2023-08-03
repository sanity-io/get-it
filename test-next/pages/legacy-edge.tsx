import {adapter, environment} from 'get-it'
import type {GetServerSideProps, InferGetServerSidePropsType} from 'next'

export const runtime = 'experimental-edge'

type Introspection = {
  adapter: typeof adapter
  environment: typeof environment
}

export const getServerSideProps: GetServerSideProps<Introspection> = async () => {
  return {props: {adapter, environment}}
}

export default function Page(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <>
      <p id="adapter">adapter: {props.adapter}</p>
      <p id="environment">environment: {props.environment}</p>
    </>
  )
}
