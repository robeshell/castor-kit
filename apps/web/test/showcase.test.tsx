/**
 * Components gallery pages (modules/component_center/pages/components/<page>): every example file is imported by its
 * page twice — as a component and with `?raw` for the source shown — and the exemplar page renders its examples.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import DataTablePage from '@/modules/component_center/pages/components/data_table_page'
import basicTableSource from '@/modules/component_center/pages/components/data_table_page/examples/BasicTable.tsx?raw'

const PAGES = resolve(process.cwd(), 'src/modules/component_center/pages/components')
const ALIAS = '@/modules/component_center/pages/components'

describe('Components gallery pages', () => {
  it('import each example file both as a component and as ?raw source', () => {
    const problems: string[] = []
    for (const page of readdirSync(PAGES)) {
      const examplesDir = join(PAGES, page, 'examples')
      if (!existsSync(examplesDir)) continue
      const index = readFileSync(join(PAGES, page, 'index.tsx'), 'utf8')
      for (const file of readdirSync(examplesDir).filter((f) => f.endsWith('.tsx'))) {
        const name = file.replace(/\.tsx$/, '')
        const base = `${ALIAS}/${page}/examples/${name}`
        if (!index.includes(`'${base}'`)) problems.push(`${page}/index.tsx does not import ${name}`)
        if (!index.includes(`'${base}.tsx?raw'`)) problems.push(`${page}/index.tsx does not import ${name}.tsx?raw`)
      }
    }
    expect(problems).toEqual([])
  })

  afterEach(cleanup)

  it('the data table page renders its examples and shows an example source on demand', async () => {
    render(<DataTablePage />)
    expect(screen.getByRole('heading', { level: 1, name: '数据表格' })).toBeInTheDocument()
    const toggles = screen.getAllByRole('button', { name: '代码' })
    expect(toggles).toHaveLength(7)

    const first = toggles[0]!.closest('section')!
    expect(within(first).queryByText(/export default function BasicTable/)).not.toBeInTheDocument()
    await userEvent.click(toggles[0]!)
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true')
    // Plain text first, highlighted tokens once the highlighter has loaded: the text is the file's source either way
    const code = first.querySelector('pre')!
    const source = basicTableSource.replace(/\n$/, '')
    expect(code.textContent).toBe(source)
    await waitFor(() => expect(code.querySelector('span[style]')).not.toBeNull(), { timeout: 5000 })
    expect(code.textContent).toBe(source)
  })
})
