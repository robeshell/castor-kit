import { Clock3, ShoppingCart, UserPlus, Wallet } from 'lucide-react'
import StatCard from '@/shared/components/StatCard'

// Last 12 days, oldest first: a trend only goes on cards whose data really has one
const SIGNUPS = [42, 48, 45, 51, 58, 55, 63, 61, 70, 74, 69, 81]
const REVENUE = [8.2, 7.9, 8.8, 9.1, 8.7, 9.6, 10.2, 9.8, 10.9, 11.4, 11.1, 12.3]

export default function StatCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* label and suffix are Chinese source text, translated by the card */}
      <StatCard label="新注册用户" value={81} suffix="人" delta="+17%" trend={SIGNUPS} icon={UserPlus} />
      <StatCard label="今日收入" value={12.3} decimals={1} suffix="万元" delta="+10.8%" trend={REVENUE} icon={Wallet} />
      {/* A falling number that is bad news: danger tone */}
      <StatCard label="订单量" value={1284} delta="-4.2%" deltaTone="danger" hint="较昨日少 56 单" icon={ShoppingCart} />
      {/* No trend data: explain the number in hint instead */}
      <StatCard label="平均响应时间" value={320} suffix="ms" delta="持平" deltaTone="neutral" hint="过去 1 小时" icon={Clock3} />
    </div>
  )
}
