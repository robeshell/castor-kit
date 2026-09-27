/** Types for api-types.mjs, which the frontend tests import (the script stays plain JavaScript run by node). */

/** The doc read and the file written for a repository root */
export function pathsFor(root?: string): { doc: string; out: string }

/** apps/web/src/shared/api/openapi.d.ts of this repository */
export const OUT: string

/** The generated file's content (from the doc of `root`, default: this repository) */
export function generate(root?: string): Promise<string>
