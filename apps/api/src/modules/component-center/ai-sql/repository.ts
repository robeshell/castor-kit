/**
 * AI SQL data access: everything goes through the read-only pool (db/readonly.ts), never the main app connection.
 *
 * Table structure is read from information_schema:
 * - tables: BASE TABLEs in the current schema
 * - columns: by ordinal_position; type names are output in uppercase SQL type syntax (e.g. `VARCHAR(50)`, `NUMERIC(10, 2)`, see sqlTypeName)
 */

import type { ReadonlyDb, ReadonlyResult } from '@/db/readonly'

export interface ColumnInfo {
  table: string
  name: string
  type: string
  nullable: boolean
  default: string | null
}

const COLUMNS_SQL = `
SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.character_maximum_length,
       c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default, c.domain_name,
       (SELECT max(length(e.enumlabel)) FROM pg_catalog.pg_enum e
          JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
         WHERE t.typname = c.udt_name AND n.nspname = c.udt_schema) AS enum_max_length
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
 WHERE c.table_schema = current_schema() AND t.table_type = 'BASE TABLE'
 ORDER BY c.table_name, c.ordinal_position`

const TABLES_SQL = `
SELECT table_name FROM information_schema.tables
 WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`

/**
 * udt_name → output type name (types not in this table output 'NULL', e.g. xml / point / tsquery)
 */
const SIMPLE_TYPES: Record<string, string> = {
  int2: 'SMALLINT',
  int4: 'INTEGER',
  int8: 'BIGINT',
  text: 'TEXT',
  bool: 'BOOLEAN',
  float4: 'REAL',
  float8: 'DOUBLE PRECISION',
  date: 'DATE',
  timestamp: 'TIMESTAMP',
  timestamptz: 'TIMESTAMP',
  time: 'TIME',
  timetz: 'TIME',
  interval: 'INTERVAL',
  uuid: 'UUID',
  bytea: 'BYTEA',
  json: 'JSON',
  jsonb: 'JSONB',
  inet: 'INET',
  cidr: 'CIDR',
  macaddr: 'MACADDR',
  macaddr8: 'MACADDR8',
  money: 'MONEY',
  bit: 'BIT',
  varbit: 'BIT',
  oid: 'OID',
  regclass: 'REGCLASS',
  tsvector: 'TSVECTOR',
  citext: 'CITEXT',
  hstore: 'HSTORE',
  char: 'VARCHAR',
  name: 'VARCHAR',
  int4range: 'INT4RANGE',
  int8range: 'INT8RANGE',
  numrange: 'NUMRANGE',
  daterange: 'DATERANGE',
  tsrange: 'TSRANGE',
  tstzrange: 'TSTZRANGE',
  int4multirange: 'INT4MULTIRANGE',
  int8multirange: 'INT8MULTIRANGE',
  nummultirange: 'NUMMULTIRANGE',
  datemultirange: 'DATEMULTIRANGE',
  tsmultirange: 'TSMULTIRANGE',
  tstzmultirange: 'TSTZMULTIRANGE',
}

interface ColumnRow {
  data_type: string
  udt_name: string
  character_maximum_length: string | null
  numeric_precision: string | null
  numeric_scale: string | null
  domain_name: string | null
  /** Max label length for enum types; null for non-enums */
  enum_max_length: string | null
}

export function sqlTypeName(row: ColumnRow): string {
  const udt = row.udt_name
  // Domain types always output 'DOMAIN', regardless of the underlying type
  if (row.domain_name) return 'DOMAIN'
  if (row.data_type === 'ARRAY') return 'ARRAY'
  if (udt === 'varchar') return row.character_maximum_length ? `VARCHAR(${row.character_maximum_length})` : 'VARCHAR'
  if (udt === 'bpchar') return row.character_maximum_length ? `CHAR(${row.character_maximum_length})` : 'CHAR'
  if (udt === 'numeric') {
    return row.numeric_precision !== null ? `NUMERIC(${row.numeric_precision}, ${row.numeric_scale ?? 0})` : 'NUMERIC'
  }
  // Enum: output VARCHAR(longest label length)
  if (row.enum_max_length !== null) return `VARCHAR(${row.enum_max_length})`
  return SIMPLE_TYPES[udt] ?? 'NULL'
}

export class AiSqlRepository {
  constructor(private readonly ro: () => ReadonlyDb) {}

  async listTableNames(): Promise<string[]> {
    const result = await this.ro().query(TABLES_SQL)
    return result.rows.map((r) => r[0] as string)
  }

  async listColumns(): Promise<ColumnInfo[]> {
    const result = await this.ro().query(COLUMNS_SQL)
    return result.rows.map((r) => {
      const [table, name, dataType, udtName, charLen, numPrec, numScale, isNullable, columnDefault, domainName, enumMax] = r as (
        | string
        | null
      )[]
      return {
        table: table!,
        name: name!,
        type: sqlTypeName({
          data_type: dataType!,
          udt_name: udtName!,
          character_maximum_length: charLen ?? null,
          numeric_precision: numPrec ?? null,
          numeric_scale: numScale ?? null,
          domain_name: domainName ?? null,
          enum_max_length: enumMax ?? null,
        }),
        nullable: isNullable === 'YES',
        default: columnDefault ?? null,
      }
    })
  }

  execute(sql: string): Promise<ReadonlyResult> {
    return this.ro().query(sql)
  }
}
