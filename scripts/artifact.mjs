// Strip the document skeleton from the single-file build so it can be published as a hosted page.
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
writeFileSync('dist/artifact.html', head.trim() + '\n' + body.trim() + '\n')
console.log('dist/artifact.html', (Buffer.byteLength(head + body) / 1024).toFixed(0) + ' KB')
