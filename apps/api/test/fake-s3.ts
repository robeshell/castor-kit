/**
 * Minimal in-process S3 endpoint (path-style: /<bucket>/<key>) for the file center's s3 driver tests.
 * Supports PUT / GET / HEAD / DELETE on objects; signatures are recorded but not verified.
 *
 * vitest: `const s3 = await startFakeS3()`, point S3_ENDPOINT at `s3.url` with forcePathStyle, then `await s3.close()`.
 */

import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface FakeS3Request {
  method: string
  path: string
  query: URLSearchParams
  headers: IncomingMessage['headers']
}

export interface FakeS3 {
  url: string
  /** "<bucket>/<key>" → stored object */
  objects: Map<string, { body: Buffer; contentType: string }>
  requests: FakeS3Request[]
  close: () => Promise<void>
}

export async function startFakeS3(): Promise<FakeS3> {
  const objects = new Map<string, { body: Buffer; contentType: string }>()
  const requests: FakeS3Request[] = []

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake-s3')
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    requests.push({ method: req.method ?? '', path, query: url.searchParams, headers: req.headers })
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)

    const notFound = () => {
      res.writeHead(404, { 'Content-Type': 'application/xml' })
      res.end(req.method === 'HEAD' ? undefined : '<Error><Code>NoSuchKey</Code><Message>not found</Message></Error>')
    }
    const object = objects.get(path)
    switch (req.method) {
      case 'PUT':
        objects.set(path, { body: Buffer.concat(chunks), contentType: String(req.headers['content-type'] ?? '') })
        res.writeHead(200, { ETag: '"fake"' })
        return res.end()
      case 'HEAD':
        if (!object) return notFound()
        res.writeHead(200, { 'Content-Length': object.body.length, 'Content-Type': object.contentType })
        return res.end()
      case 'GET':
        if (!object) return notFound()
        res.writeHead(200, {
          'Content-Type': url.searchParams.get('response-content-type') ?? object.contentType,
          'Content-Disposition': url.searchParams.get('response-content-disposition') ?? '',
        })
        return res.end(object.body)
      case 'DELETE':
        objects.delete(path)
        res.writeHead(204)
        return res.end()
      default:
        res.writeHead(405)
        return res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    objects,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
