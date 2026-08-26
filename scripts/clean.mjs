import { rmSync } from 'node:fs'
import { URL } from 'node:url'

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true })
