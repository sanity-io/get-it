import {createRequester} from 'get-it'

const request = createRequester({
  base: 'https://api.example.com',
})

const users = await request('/users')
console.log(users.json())
