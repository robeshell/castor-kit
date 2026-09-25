/**
 * .claude/skills (read by Claude Code) and .agents/skills (read by Codex and other tools) must be byte-for-byte identical.
 * .claude/skills is the source of truth; sync after editing: rm -rf .agents/skills && cp -R .claude/skills .agents/skills
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = resolve(__dirname, '../../..')
const CLAUDE = join(REPO, '.claude/skills')
const AGENTS = join(REPO, '.agents/skills')

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)))
    .sort()
}

describe('skills 两份副本', () => {
  it('.claude/skills 与 .agents/skills 文件集合与内容一致', () => {
    const files = listFiles(CLAUDE)
    expect(files.length).toBeGreaterThan(0)
    expect(listFiles(AGENTS), '文件集合不一致：以 .claude/skills 为准复制到 .agents/skills').toEqual(files)
    for (const file of files) {
      expect(readFileSync(join(AGENTS, file), 'utf8'), `${file} 内容不一致`).toBe(readFileSync(join(CLAUDE, file), 'utf8'))
    }
  })
})
