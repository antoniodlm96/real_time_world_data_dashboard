# Bluesky AT Protocol (Firehose en tiempo real)

## atproto library
- `pip install atproto`
- `from atproto import FirehoseSubscribeReposClient`
- WebSocket público para escuchar TODAS las publicaciones del mundo
- Filtrar por palabras clave: "incendio", "terremoto", "breaking", etc.
- Sin API key, sin coste

## Jetstream WebSocket
- `wss://jetstream1.us-east.bsky.network/subscribe` (oficial)
- Mensajes JSON con campos: kind, did, time_us, commit
- Filtrar: kind="commit", commit.operation="create", commit.collection="app.bsky.feed.post"
- Extraer: commit.record.text, commit.record.createdAt, did, commit.rkey
