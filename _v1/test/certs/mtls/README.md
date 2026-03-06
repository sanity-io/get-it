# MTLS

## Generate new certiticate

note: Set common name to localhost

```bash

# CA
openssl genrsa -aes256 -passout pass:xxxx -out ca.pass.key 4096
openssl rsa -passin pass:xxxx -in ca.pass.key -out ca.key
rm ca.pass.key

openssl req -new -x509 -days 3650 -key ca.key -out ca.pem


# Client
openssl genrsa -aes256 -passout pass:xxxx -out client.pass.key 4096
openssl rsa -passin pass:xxxx -in client.pass.key -out client.key
rm client.pass.key

openssl req -new -key client.key -out client.csr
openssl x509 -req -sha512 -days 3650 -in client.csr -CA ca.pem -CAkey ca.key -set_serial "01" -out client.pem

# Server
openssl genrsa -aes256 -passout pass:xxxx -out server.pass.key 4096
openssl rsa -passin pass:xxxx -in server.pass.key -out server.key
rm server.pass.key

openssl req -new -key server.key -out server.csr
openssl x509 -req -sha512 -days 3650 -in server.csr -CA ca.pem -CAkey ca.key -set_serial "02" -out server.pem
```
