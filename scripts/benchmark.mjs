import fs from 'node:fs'
import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { URL } from 'node:url'
import { createDefaultRegistry } from '../dist/configs/index.js'
import { detectConfig } from '../dist/core/detector.js'
import { formatConfig } from '../dist/core/formatter.js'
import { envRecords } from '../dist/tokenizers/env.js'

const registry = createDefaultRegistry()
const output = []

function nginxDocument(minimumBytes) {
  const block = `server{
listen 80 ;
location /api {
proxy_set_header Host $host;
proxy_pass http://127.0.0.1:8080;
}
}
`
  const repetitions = Math.ceil(minimumBytes / Buffer.byteLength(block))
  return block.repeat(repetitions)
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function measure(operation, iterations) {
  for (let index = 0; index < 10; index += 1) operation()
  const timings = []
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now()
    operation()
    timings.push(performance.now() - startedAt)
  }
  return {
    median: percentile(timings, 0.5),
    p95: percentile(timings, 0.95),
  }
}

function formatMilliseconds(value) {
  return value < 0.01 ? '<0.01' : value.toFixed(2)
}

function formatMegabytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2)
}

function retainedHeap(operation) {
  if (!globalThis.gc) return undefined
  globalThis.gc()
  const before = process.memoryUsage().heapUsed
  globalThis.__confettiBenchmarkResult = operation()
  const withResult = process.memoryUsage().heapUsed
  delete globalThis.__confettiBenchmarkResult
  globalThis.gc()
  const afterRelease = process.memoryUsage().heapUsed
  return {
    withResult: Math.max(0, withResult - before),
    afterRelease: Math.max(0, afterRelease - before),
  }
}

const samples = [
  { label: '100 KB', content: nginxDocument(100 * 1024), iterations: 100 },
  { label: '1 MB', content: nginxDocument(1024 * 1024), iterations: 30 },
]

output.push(
  `Environment: ${process.platform} ${process.arch}, Node ${process.version}`,
  '| Input | Actual size | Detect median | Detect p95 | Format median | Format p95 |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
)
for (const sample of samples) {
  const filename = '/etc/nginx/nginx.conf'
  const detect = measure(
    () => detectConfig(registry, filename, sample.content),
    sample.iterations,
  )
  const format = measure(
    () => formatConfig(registry, 'confetti-nginx', sample.content),
    sample.iterations,
  )
  output.push(
    `| ${sample.label} | ${formatMegabytes(Buffer.byteLength(sample.content))} MB | ${formatMilliseconds(detect.median)} ms | ${formatMilliseconds(detect.p95)} ms | ${formatMilliseconds(format.median)} ms | ${formatMilliseconds(format.p95)} ms |`,
  )
}

const largeContent = samples.at(-1).content
const detectHeap = retainedHeap(() =>
  detectConfig(registry, '/etc/nginx/nginx.conf', largeContent),
)
const formatHeap = retainedHeap(() =>
  formatConfig(registry, 'confetti-nginx', largeContent),
)
if (detectHeap && formatHeap) {
  output.push(
    '',
    'Heap delta for the 1 MB sample (result retained / after release):',
    `- Detection: ${formatMegabytes(detectHeap.withResult)} MB / ${formatMegabytes(detectHeap.afterRelease)} MB`,
    `- Formatting: ${formatMegabytes(formatHeap.withResult)} MB / ${formatMegabytes(formatHeap.afterRelease)} MB`,
  )
}

const manifest = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const vsixPath = new URL(
  `../confetti-${manifest.version}.vsix`,
  import.meta.url,
)
if (fs.existsSync(vsixPath)) {
  output.push(
    '',
    `VSIX size: ${formatMegabytes(fs.statSync(vsixPath).size)} MB`,
  )
}

output.push(
  '',
  'Dotenv short-line quoted-value scan (10 warmups, 20 measured runs):',
)
for (const bytes of [100 * 1024, 1024 * 1024]) {
  const lines = ['KEY="', ...Array(Math.ceil(bytes / 9)).fill('12345678'), '"']
  const timing = measure(() => envRecords(lines), 20)
  output.push(
    `- ${formatMegabytes(Buffer.byteLength(lines.join('\n')))} MB: median ${formatMilliseconds(timing.median)} ms, p95 ${formatMilliseconds(timing.p95)} ms`,
  )
}

process.stdout.write(`${output.join('\n')}\n`)
