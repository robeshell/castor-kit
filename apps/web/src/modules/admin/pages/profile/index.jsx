import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Form, Toast, Typography } from '@douyinfe/semi-ui'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/modules/admin/api/auth'

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 24,
  marginBottom: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.06)',
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const formApiRef = useRef()

  const handleChangePwd = () => {
    formApiRef.current.validate().then((values) => {
      if (values.new_password !== values.confirm_password) {
        Toast.error('两次输入的新密码不一致')
        return
      }
      setSubmitting(true)
      changePassword({ old_password: values.old_password, new_password: values.new_password })
        .then(async () => {
          Toast.success('密码修改成功，请重新登录')
          await logout()
          navigate('/login', { replace: true })
        })
        .catch((err) => Toast.error(err?.error || '修改失败'))
        .finally(() => setSubmitting(false))
    })
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        个人设置
      </Typography.Title>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar
            size="extra-large"
            color="blue"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', flexShrink: 0 }}
          >
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Typography.Title heading={5} style={{ margin: 0 }}>
              {user?.username}
            </Typography.Title>
            <Typography.Text type="tertiary" size="small">
              系统账号
            </Typography.Text>
          </div>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 20 }}>
          修改密码
        </Typography.Text>
        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          labelPosition="left"
          labelWidth={100}
        >
          <Form.Input
            field="old_password"
            label="当前密码"
            type="password"
            placeholder="请输入当前登录密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          />
          <Form.Input
            field="new_password"
            label="新密码"
            type="password"
            placeholder="至少 6 位"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '至少6位' },
            ]}
          />
          <Form.Input
            field="confirm_password"
            label="确认新密码"
            type="password"
            placeholder="再次输入新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          />
        </Form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button theme="solid" type="primary" loading={submitting} onClick={handleChangePwd}>
            保存修改
          </Button>
        </div>
      </div>
    </div>
  )
}
