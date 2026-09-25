import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 打印脚本文件开头的文档注释（-h/--help） */
export function printUsage(moduleUrl: string): void {
  const source = readFileSync(fileURLToPath(moduleUrl), 'utf8')
  const block = /^\/\*\*([\s\S]*?)\*\//.exec(source)?.[1] ?? ''
  console.log(
    block
      .split('\n')
      .map((line) => line.replace(/^\s*\* ?/, ''))
      .join('\n')
      .trim(),
  )
}
