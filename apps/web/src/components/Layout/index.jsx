import { useMemo, useState, useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Nav, Avatar, Dropdown, Typography, Badge, Popover } from '@douyinfe/semi-ui'
import {
  IconHome,
  IconUser,
  IconList,
  IconArticle,
  IconChevronDown,
  IconGridSquare,
  IconSetting,
  IconApps,
  IconIdCard,
  IconFile,
  IconMenu,
  IconBranch,
  IconCode,
  IconHistogram,
  IconDesktop,
  IconPieChartStroked,
  IconBox,
  IconActivity,
  IconSend,
  IconEdit2,
  IconLayers,
  IconKanban,
  IconMoon,
  IconSun,
  IconBell,
} from '@douyinfe/semi-icons'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '@/modules/admin/api/notifications'
import './layout.css'

const { Text } = Typography

const MENU_ICON_MAP = {
  dashboard:    <IconHome />,
  system:       <IconGridSquare />,
  system_users: <IconUser />,
  system_roles: <IconList />,
  system_menus: <IconArticle />,
  system_dicts: <IconList />,
  system_logs:  <IconArticle />,
}

const MENU_ICON_NAME_MAP = {
  IconHome:            <IconHome />,
  IconUser:            <IconUser />,
  IconList:            <IconList />,
  IconArticle:         <IconArticle />,
  IconGridSquare:      <IconGridSquare />,
  IconSetting:         <IconSetting />,
  IconApps:            <IconApps />,
  IconIdCard:          <IconIdCard />,
  IconFile:            <IconFile />,
  IconBranch:          <IconBranch />,
  IconCode:            <IconCode />,
  IconHistogram:       <IconHistogram />,
  // 组件示例中心分类图标
  IconDesktop:         <IconDesktop />,         // 管理系统
  IconPieChartStroked: <IconPieChartStroked />, // 数据可视化
  IconBox:             <IconBox />,             // 3D / 创意
  IconActivity:        <IconActivity />,        // 交互体验
  IconSend:            <IconSend />,            // AI 应用
  IconEdit2:           <IconEdit2 />,           // 编辑器 / 低代码
  IconLayers:          <IconLayers />,          // 工程 / 工具类
  IconKanban:          <IconKanban />,          // 看板页
  IconBell:            <IconBell />,            // 消息通知
}

function buildNavItems(menus) {
  return menus
    .filter((m) => m.is_active && m.is_visible && m.menu_type !== 'button')
    .map((m) => ({
      itemKey: m.code,
      text: m.name,
      icon: MENU_ICON_NAME_MAP[m.icon] || MENU_ICON_MAP[m.code] || <IconList />,
      ...(m.children?.length ? { items: buildNavItems(m.children) } : {}),
    }))
}

function flattenMenus(menus = []) {
  const result = []
  const walk = (nodes = []) => {
    nodes.forEach((node) => {
      if (node?.is_active && node?.is_visible && node.menu_type !== 'button') {
        result.push(node)
      }
      if (Array.isArray(node?.children) && node.children.length > 0) {
        walk(node.children)
      }
    })
  }
  walk(menus)
  return result
}

const NOTI_DOT_COLORS = {
  info: 'var(--semi-color-primary)',
  success: 'var(--semi-color-success)',
  warning: 'var(--semi-color-warning)',
  error: 'var(--semi-color-danger)',
}

export default function Layout() {
  const { user, menus, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile(992)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState([])
  const [notiVisible, setNotiVisible] = useState(false)

  const fetchUnreadCount = useCallback(() => {
    getUnreadCount()
      .then((res) => setUnreadCount(res?.count ?? 0))
      .catch(() => {})
  }, [])

  const fetchRecentNotifs = useCallback(() => {
    getNotifications({ page: 1, per_page: 10 })
      .then((res) => setRecentNotifs(res?.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    // 未读数轮询：标签页隐藏时暂停，避免后台空耗请求
    let timer = null
    const start = () => {
      if (!timer) timer = setInterval(fetchUnreadCount, 30000)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    fetchUnreadCount()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, fetchUnreadCount])

  const handleNotiVisibleChange = (visible) => {
    setNotiVisible(visible)
    if (visible) {
      fetchRecentNotifs()
    }
  }

  const handleNotiItemClick = (notif) => {
    markAsRead(notif.id).catch(() => {})
    setNotiVisible(false)
    fetchUnreadCount()
    if (notif.link) {
      navigate(notif.link)
    }
    fetchRecentNotifs()
  }

  const handleNotiMarkAll = (e) => {
    e.stopPropagation()
    markAllAsRead()
      .then(() => {
        fetchUnreadCount()
        fetchRecentNotifs()
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }, [isMobile, location.pathname])

  const flatMenus = useMemo(() => flattenMenus(menus), [menus])
  const menuPathMap = useMemo(() => {
    const map = {}
    flatMenus.forEach((menu) => {
      if (menu.path) {
        map[menu.code] = menu.path
      }
    })
    return map
  }, [flatMenus])

  // code → parent code 映射，用于向上追溯祖先
  const codeParentMap = useMemo(() => {
    const idToCode = {}
    flatMenus.forEach((m) => { idToCode[m.id] = m.code })
    const map = {}
    flatMenus.forEach((m) => {
      if (m.parent_id && idToCode[m.parent_id]) {
        map[m.code] = idToCode[m.parent_id]
      }
    })
    return map
  }, [flatMenus])

  const currentKey = useMemo(() => {
    const matched = flatMenus
      .filter((menu) => typeof menu.path === 'string' && menu.path.length > 0)
      .sort((a, b) => b.path.length - a.path.length)
      .find((menu) => location.pathname === menu.path || location.pathname.startsWith(`${menu.path}/`))
    return matched?.code
  }, [flatMenus, location.pathname])

  // 当前选中菜单的所有祖先 code（用于自动展开侧边栏分组）
  const ancestorKeys = useMemo(() => {
    if (!currentKey) return []
    const keys = []
    let key = currentKey
    while (codeParentMap[key]) {
      key = codeParentMap[key]
      keys.push(key)
    }
    return keys
  }, [currentKey, codeParentMap])

  // 受控的展开 key 列表：路由切换时合并新祖先，不折叠已手动展开的分组
  const [openKeys, setOpenKeys] = useState([])
  useEffect(() => {
    if (ancestorKeys.length === 0) return
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...ancestorKeys])
      return Array.from(merged)
    })
  }, [ancestorKeys])

  const navItems = buildNavItems(menus)

  const handleSelect = ({ itemKey }) => {
    const path = menuPathMap[itemKey]
    if (path) {
      navigate(path)
      if (isMobile) {
        setMobileMenuOpen(false)
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const dropdownMenu = (
    <Dropdown.Menu>
      <Dropdown.Item onClick={() => navigate('/profile')}>个人设置</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item type="danger" onClick={handleLogout}>
        退出登录
      </Dropdown.Item>
    </Dropdown.Menu>
  )

  return (
    <div className="as-layout">
      {isMobile && mobileMenuOpen ? (
        <div className="as-sider-mask" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      ) : null}
      {/* 深色侧边栏 */}
      <div className={`as-sider ${isMobile ? 'as-sider-mobile' : ''} ${mobileMenuOpen ? 'as-sider-open' : ''}`}>
        <Nav
          style={{ height: '100%', width: '100%', background: 'transparent' }}
          isCollapsed={isMobile ? false : collapsed}
          onCollapseChange={(next) => {
            if (!isMobile) {
              setCollapsed(next)
            }
          }}
          limitIndent={false}
          items={navItems}
          selectedKeys={currentKey ? [currentKey] : []}
          openKeys={openKeys}
          onOpenChange={({ openKeys: next }) => setOpenKeys(next)}
          onSelect={handleSelect}
          header={{
            logo: (
              <img
                src="/logo.svg"
                style={{ width: 44, height: 44, flexShrink: 0 }}
                alt="logo"
              />
            ),
            text: (
              <span className="as-brand-text">castor-kit</span>
            ),
          }}
          footer={isMobile ? undefined : { collapseButton: true }}
        />
      </div>

      {/* 右侧主区域 */}
      <div className="as-main">
        {/* Header */}
        <header className="as-header">
          <div className="as-header-left">
            {isMobile ? (
              <button
                type="button"
                className="as-menu-trigger"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label="打开菜单"
              >
                <IconMenu />
              </button>
            ) : null}
          </div>
          <div className="as-header-right">
            <Popover
              visible={notiVisible}
              onVisibleChange={handleNotiVisibleChange}
              trigger="click"
              position="bottomRight"
              showArrow
              content={
                <div style={{ width: 340, maxHeight: 480, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px 8px', fontWeight: 600, fontSize: 15, borderBottom: '1px solid var(--semi-color-border)' }}>
                    消息通知
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {recentNotifs.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
                        暂无通知
                      </div>
                    ) : (
                      recentNotifs.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotiItemClick(notif)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: notif.is_read ? 'transparent' : 'var(--semi-color-primary-light-default)',
                            borderBottom: '1px solid var(--semi-color-border)',
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: NOTI_DOT_COLORS[notif.noti_type] || 'var(--semi-color-primary)',
                              flexShrink: 0,
                              marginTop: 6,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: notif.is_read ? 400 : 600,
                                fontSize: 13,
                                color: 'var(--semi-color-text-0)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {notif.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 2 }}>
                              {notif.created_at?.slice(0, 19).replace('T', ' ')}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      borderTop: '1px solid var(--semi-color-border)',
                    }}
                  >
                    <button
                      type="button"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--semi-color-text-2)', fontSize: 13 }}
                      onClick={handleNotiMarkAll}
                    >
                      全部已读
                    </button>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--semi-color-primary)', fontSize: 13 }}
                      onClick={() => { setNotiVisible(false); navigate('/system/notifications') }}
                    >
                      查看全部
                    </button>
                  </div>
                </div>
              }
            >
              <Badge count={unreadCount} overflowCount={99} style={{ display: 'flex' }}>
                <button
                  type="button"
                  className="as-theme-toggle"
                  aria-label="消息通知"
                >
                  <IconBell />
                </button>
              </Badge>
            </Popover>
            <button
              type="button"
              className="as-theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <Dropdown render={dropdownMenu} trigger="click" position="bottomRight">
              <div className="as-user-info">
                <Avatar size="small" color="blue" style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}>
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Text className="as-username">{user?.username}</Text>
                <IconChevronDown size="small" style={{ color: 'var(--semi-color-text-2)' }} />
              </div>
            </Dropdown>
          </div>
        </header>

        {/* 内容区 */}
        <main className="as-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
