import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Form, Button, Toast, Typography } from '@douyinfe/semi-ui'
import { login } from '@/modules/admin/api/auth'
import { useAuth } from '@/context/AuthContext'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const { Title, Text } = Typography

const SPARKS = Array.from({ length: 24 }, (_, i) => ({
  left:  `${(i * 43 + 11) % 100}%`,
  top:   `${(i * 61 + 7)  % 100}%`,
  size:  (i % 3) + 1,
  delay: `${(i * 0.45).toFixed(2)}s`,
  dur:   `${2.2 + (i % 5) * 0.55}s`,
}))

const FEATURES = [
  { icon: '⚡', text: 'Node.js + Fastify + React AI-First 脚手架' },
  { icon: '🧩', text: 'TypeScript + Zod + Drizzle 类型安全后端' },
  { icon: '🎨', text: 'Semi Design 组件体系' },
  { icon: '🔐', text: '完整 RBAC 权限管理' },
  { icon: '🤖', text: 'Agent 端到端功能实现' },
]

export default function Login() {
  const { user, login: setAuth, loading } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (values) => {
    setSubmitting(true)
    try {
      const data = await login(values)
      await setAuth(data.user)
      Toast.success('登录成功')
      navigate('/')
    } catch (err) {
      Toast.error(err?.message || '用户名或密码错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes lOrbA {
          0%,100% { transform:translate(0,0) scale(1); }
          35%     { transform:translate(50px,-35px) scale(1.1); }
          68%     { transform:translate(-25px,20px) scale(0.92); }
        }
        @keyframes lOrbB {
          0%,100% { transform:translate(0,0) scale(1); }
          45%     { transform:translate(-40px,28px) scale(1.08); }
          78%     { transform:translate(30px,-18px) scale(0.94); }
        }
        @keyframes lOrbC {
          0%,100% { transform:translate(0,0) scale(1); }
          52%     { transform:translate(36px,32px) scale(1.14); }
        }
        @keyframes sparkle {
          0%,100% { opacity:.06; transform:scale(.5); }
          50%     { opacity:.85; transform:scale(1.6); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes featureIn {
          from { opacity:0; transform:translateX(-16px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .l-brand  { animation: fadeUp .7s .1s ease both; }
        .l-feat-0 { animation: featureIn .5s .4s ease both; opacity:0; animation-fill-mode:forwards; }
        .l-feat-1 { animation: featureIn .5s .55s ease both; opacity:0; animation-fill-mode:forwards; }
        .l-feat-2 { animation: featureIn .5s .7s ease both; opacity:0; animation-fill-mode:forwards; }
        .l-feat-3 { animation: featureIn .5s .85s ease both; opacity:0; animation-fill-mode:forwards; }
        .l-form   { animation: fadeUp .6s .2s ease both; opacity:0; animation-fill-mode:forwards; }
        .login-btn:hover { opacity:.92; transform:translateY(-1px); box-shadow:0 8px 28px rgba(56,100,235,.55) !important; }
        .login-btn { transition: all .2s ease !important; }
      `}</style>

      {/* ── 左侧品牌区 ── */}
      <div style={{
        flex: isMobile ? 'none' : '0 0 48%',
        minHeight: isMobile ? 180 : undefined,
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, #060d24 0%, #0a1a3e 40%, #0d1650 70%, #060d24 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: isMobile ? 'flex-end' : 'center',
        padding: isMobile ? '24px 28px' : '60px 56px',
      }}>
        {/* 色球 */}
        <div style={{ position:'absolute', width:500, height:400, borderRadius:'50%', top:'-10%', left:'-5%',
          background:'radial-gradient(circle, rgba(56,189,248,.22) 0%, rgba(99,179,255,.08) 45%, transparent 70%)',
          filter:'blur(60px)', animation:'lOrbA 12s ease-in-out infinite', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:420, height:340, borderRadius:'50%', bottom:'-8%', right:'-8%',
          background:'radial-gradient(circle, rgba(99,102,241,.3) 0%, rgba(56,189,248,.1) 50%, transparent 70%)',
          filter:'blur(56px)', animation:'lOrbB 15s ease-in-out infinite', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:320, height:260, borderRadius:'50%', top:'40%', right:'5%',
          background:'radial-gradient(circle, rgba(147,210,255,.18) 0%, transparent 68%)',
          filter:'blur(48px)', animation:'lOrbC 9s ease-in-out infinite', pointerEvents:'none' }} />

        {/* 噪点纹理 */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.04, pointerEvents:'none' }}>
          <filter id="n2"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="100%" height="100%" filter="url(#n2)" />
        </svg>

        {/* 冰晶粒子 */}
        {SPARKS.map((s, i) => (
          <div key={i} style={{ position:'absolute', left:s.left, top:s.top, width:s.size, height:s.size,
            borderRadius:'50%', background:'rgba(200,235,255,.9)',
            animation:`sparkle ${s.dur} ${s.delay} ease-in-out infinite`, pointerEvents:'none' }} />
        ))}

        {/* 顶部分割线 */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
          background:'linear-gradient(90deg,transparent,rgba(147,210,255,.3),transparent)' }} />
        {/* 右侧竖线 */}
        <div style={{ position:'absolute', top:0, bottom:0, right:0, width:1,
          background:'linear-gradient(180deg,transparent,rgba(147,210,255,.15) 30%,rgba(147,210,255,.15) 70%,transparent)' }} />

        {/* 品牌内容 */}
        <div className="l-brand" style={{ position:'relative', zIndex:1 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom: isMobile ? 12 : 40 }}>
            <div style={{
              width:48, height:48, borderRadius:13,
              background:'linear-gradient(135deg,rgba(56,189,248,.35),rgba(99,102,241,.45))',
              border:'1px solid rgba(147,210,255,.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 24px rgba(56,189,248,.25)',
              flexShrink:0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="rgba(147,210,255,.95)" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="rgba(147,210,255,.7)" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="rgba(147,210,255,.5)" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span style={{ fontSize:22, fontWeight:800, color:'#e8f4ff', letterSpacing:.5 }}>castor-kit</span>
              {isMobile && <div style={{ fontSize:12, color:'rgba(147,210,255,.6)', marginTop:2 }}>AI-First 管理脚手架</div>}
            </div>
          </div>

          {!isMobile && <>
            <div style={{ fontSize:32, fontWeight:800, color:'#fff', lineHeight:1.25, marginBottom:16, letterSpacing:-.5 }}>
              用 AI 驱动的方式<br />
              <span style={{ background:'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                构建现代管理系统
              </span>
            </div>
            <div style={{ fontSize:14, color:'rgba(147,210,255,.55)', marginBottom:48, lineHeight:1.7 }}>
              PM 用自然语言描述需求，Agent 端到端实现功能
            </div>
            {/* 特性列表 */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className={`l-feat-${i}`} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:34, height:34, borderRadius:9, flexShrink:0,
                    background:'rgba(56,189,248,.08)',
                    border:'1px solid rgba(147,210,255,.14)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                  }}>{f.icon}</div>
                  <span style={{ fontSize:13.5, color:'rgba(186,224,255,.7)', fontWeight:500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>

      {/* ── 右侧表单区 ── */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center',
        background:'var(--semi-color-bg-0)', padding: isMobile ? '36px 20px' : '48px 32px',
        position: 'relative',
      }}>
        <div className="l-form" style={{ width:'min(380px,100%)' }}>
          <div style={{ marginBottom:36 }}>
            <Title heading={3} style={{ margin:0, color:'var(--semi-color-text-0)', fontWeight:800 }}>欢迎回来</Title>
            <Text style={{ color:'var(--semi-color-text-2)', fontSize:14, marginTop:6, display:'block' }}>
              登录你的 castor-kit 账号
            </Text>
          </div>

          <Form onSubmit={handleSubmit} autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <Form.Input
              field="username"
              label="用户名"
              placeholder="请输入用户名"
              rules={[{ required:true, message:'请输入用户名' }]}
              size="large"
            />
            <Form.Input
              field="password"
              label="密码"
              type="password"
              placeholder="请输入密码"
              rules={[{ required:true, message:'请输入密码' }]}
              size="large"
            />
            <Button
              htmlType="submit"
              size="large"
              block
              loading={submitting}
              className="login-btn"
              style={{
                marginTop:16, height:48, borderRadius:10,
                fontWeight:700, fontSize:15, letterSpacing:.5,
                background:'linear-gradient(135deg,#2563eb,#4f46e5)',
                border:'none',
                boxShadow:'0 4px 20px rgba(56,100,235,.38)',
                color:'#fff',
              }}
            >
              登录
            </Button>
          </Form>

          <div style={{ marginTop:28, padding:'16px 20px', borderRadius:10, background:'var(--semi-color-fill-0)', border:'1px solid var(--semi-color-border)' }}>
            <Text style={{ color:'#94a3b8', fontSize:12 }}>
              默认管理员账号：<strong style={{ color:'var(--semi-color-text-2)' }}>admin</strong>，密码以部署配置为准
            </Text>
          </div>
        </div>

        <div style={{ position:'absolute', bottom:24, color:'#cbd5e1', fontSize:12 }}>
          © 2026 castor-kit · AI-First Scaffold
        </div>
      </div>
    </div>
  )
}
