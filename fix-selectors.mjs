#!/usr/bin/env node
/**
 * Codemod: split Zustand object-selector destructuring into atomic selectors.
 *
 * BEFORE:
 *   const { products, setProducts } = useAppStore((s) => ({
 *     products: s.products, setProducts: s.setProducts,
 *   }))
 *
 * AFTER:
 *   const products = useAppStore((s) => s.products)
 *   const setProducts = useAppStore((s) => s.setProducts)
 *
 * Usage: node fix-selectors.mjs <glob-root> [--hook=useAppStore] [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const root = args.find((a) => !a.startsWith('--')) || '.'
const dry = args.includes('--dry')
const hookArg = args.find((a) => a.startsWith('--hook='))
const hookNames = hookArg ? hookArg.split('=')[1].split(',') : ['useAppStore']

const exts = new Set(['.ts', '.tsx'])
const ignoreDirs = new Set(['node_modules', '.next', '.git', 'dist', 'build'])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (exts.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

// Find `const { ... } = useAppStore((s) => ({ ... }))` blocks with balanced braces.
function transform(src, hook) {
  const pattern = new RegExp(
    String.raw`const\s*\{([^}]*)\}\s*=\s*${hook}\s*\(\s*\(?(\w+)\)?\s*=>\s*\(\{`,
    'g',
  )
  let result = ''
  let lastIndex = 0
  let match
  let changed = false

  while ((match = pattern.exec(src))) {
    const destructureStart = match.index
    const objBodyStart = match.index + match[0].length
    const stateArg = match[2]

    // find matching closing `})` for the object literal, tracking brace depth
    let depth = 1
    let i = objBodyStart
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    const objBodyEnd = i - 1 // index of the matching '}'
    // expect `))` right after (allowing whitespace) — one ')' closes the
    // parenthesized object literal `({...})`, the other closes the call `useX(...)`
    let j = objBodyEnd + 1
    while (src[j] === ' ' || src[j] === '\n' || src[j] === '\t') j++
    if (src[j] !== ')') continue // not the pattern we expect, skip
    let k = j + 1
    while (src[k] === ' ' || src[k] === '\n' || src[k] === '\t') k++
    if (src[k] !== ')') continue // not the pattern we expect, skip
    j = k // consume both closing parens

    const objBody = src.slice(objBodyStart, objBodyEnd)
    // Parse top-level `key: expr` pairs separated by commas (no nested destructuring expected)
    const props = objBody
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const idx = p.indexOf(':')
        if (idx === -1) return { name: p.trim(), path: p.trim() }
        const name = p.slice(0, idx).trim()
        const expr = p.slice(idx + 1).trim()
        return { name, path: expr }
      })

    const replacement = props
      .map(({ name, path: expr }) => `const ${name} = ${hook}((${stateArg}) => ${expr})`)
      .join('\n')

    result += src.slice(lastIndex, destructureStart) + replacement
    lastIndex = j + 1 // skip past the closing ')'
    changed = true
    pattern.lastIndex = lastIndex
  }
  result += src.slice(lastIndex)
  return { result, changed }
}

const files = walk(root)
let totalChanged = 0
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let out = src
  let anyChanged = false
  for (const hook of hookNames) {
    const { result, changed } = transform(out, hook)
    out = result
    anyChanged = anyChanged || changed
  }
  if (anyChanged) {
    totalChanged++
    console.log(`${dry ? '[dry-run] would fix' : 'fixed'}: ${file}`)
    if (!dry) fs.writeFileSync(file, out, 'utf8')
  }
}
console.log(`\n${totalChanged} file(s) ${dry ? 'would be' : ''} changed.`)
