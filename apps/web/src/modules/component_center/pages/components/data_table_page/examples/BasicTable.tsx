import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'

/** A row as the API returns it (in a real page: `type Customer = ApiItem<'/api/admin/customers'>` from the API file) */
interface Customer {
  id: number
  name: string
  email: string
  city: string
  note: string | null
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Northwind Traders', email: 'orders@northwind.test', city: 'Seattle', note: 'Invoices at the end of each month, sent to the finance team' },
  { id: 2, name: 'Contoso Ltd.', email: 'buyer@contoso.test', city: 'Toronto', note: null },
  { id: 3, name: 'Fabrikam Inc.', email: 'hello@fabrikam.test', city: 'Berlin', note: 'Ships from the Hamburg warehouse only' },
  { id: 4, name: 'Tailspin Toys', email: 'shop@tailspin.test', city: 'Osaka', note: '' },
]

// Annotating the array types every column: dataIndex must be a Customer field, and render gets that field's type
const columns: DataTableColumn<Customer>[] = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
  { key: 'name', title: '名称', dataIndex: 'name', width: 180 },
  { key: 'email', title: '邮箱', dataIndex: 'email' },
  { key: 'city', title: '城市', dataIndex: 'city', width: 110 },
  // ellipsis: one line, the full text as a tooltip; an empty value (null / '') shows '-'
  { key: 'note', title: '备注', dataIndex: 'note', ellipsis: true },
]

export default function BasicTable() {
  // rowKey defaults to 'id'
  return <DataTable columns={columns} data={CUSTOMERS} />
}
