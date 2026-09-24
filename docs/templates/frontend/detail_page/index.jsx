/**
 * 详情页模板（左侧列表 + 右侧详情面板）
 *
 * TODO: 替换所有 <Resource>、<resource> 占位符
 * TODO: 补充实际字段
 *
 * 参考实现：frontend/src/modules/component_center/pages/admin/detail_tabs_page/index.jsx
 */
import { useEffect, useState } from 'react'
import {
  Avatar, Button, Empty, Modal, Form,
  List, Space, Spin, Tabs, Toast, Typography,
} from '@douyinfe/semi-ui'
import { IconPlus } from '@douyinfe/semi-icons'
import { getItems, createItem, updateItem, deleteItem } from '../../api/<resource>'

const { Title, Text } = Typography

// ─── 左侧列表项 ──────────────────────────────────────────────
function SideItem({ item, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--semi-color-border)',
        background: selected ? 'var(--semi-color-primary-light-default)' : 'transparent',
      }}
    >
      {/* TODO: 替换为实际展示内容 */}
      <div style={{ fontWeight: selected ? 600 : 400 }}>{item.name}</div>
      <Text type="tertiary" size="small">{item.status}</Text>
    </div>
  )
}

export default function <Resource>Page() {
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [formApi, setFormApi] = useState(null)

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await getItems({ page: 1, per_page: 100 })
      const items = res.data.items || []
      setList(items)
      if (items.length > 0 && !selected) setSelected(items[0])
    } catch {
      Toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModalOk = async () => {
    try {
      const values = await formApi.validate()
      if (selected?.id) {
        await updateItem(selected.id, values)
        Toast.success('更新成功')
      } else {
        await createItem(values)
        Toast.success('创建成功')
      }
      setModalVisible(false)
      fetchList()
    } catch (err) {
      if (err?.message) Toast.error(err.message)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      await deleteItem(selected.id)
      Toast.success('删除成功')
      setSelected(null)
      fetchList()
    } catch {
      Toast.error('删除失败')
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {/* 左侧列表 */}
      <div style={{ width: 280, borderRight: '1px solid var(--semi-color-border)', overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--semi-color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title heading={6} style={{ margin: 0 }}>TODO: 列表标题</Title>
          <Button icon={<IconPlus />} size="small" onClick={() => { setSelected(null); setModalVisible(true) }} />
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
        ) : list.length === 0 ? (
          <Empty description="暂无数据" style={{ padding: 32 }} />
        ) : (
          list.map(item => (
            <SideItem
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              onClick={() => setSelected(item)}
            />
          ))
        )}
      </div>

      {/* 右侧详情 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!selected ? (
          <Empty description="请从左侧选择" style={{ marginTop: 80 }} />
        ) : (
          <>
            {/* 详情头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <Space>
                {/* TODO: 替换为实际头像/图标 */}
                <Avatar color="blue">{selected.name?.[0]}</Avatar>
                <div>
                  <Title heading={5} style={{ margin: 0 }}>{selected.name}</Title>
                  <Text type="tertiary">{selected.status}</Text>
                </div>
              </Space>
              <Space>
                <Button onClick={() => { setModalVisible(true); setTimeout(() => formApi?.setValues(selected), 0) }}>编辑</Button>
                <Button type="danger" onClick={handleDelete}>删除</Button>
              </Space>
            </div>

            {/* 详情标签页 */}
            <Tabs>
              <Tabs.TabPane tab="基本信息" itemKey="info">
                {/* TODO: 替换为实际字段展示 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {Object.entries(selected).filter(([k]) => !['id'].includes(k)).map(([key, val]) => (
                    <div key={key}>
                      <Text type="tertiary">{key}</Text>
                      <div>{String(val ?? '-')}</div>
                    </div>
                  ))}
                </div>
              </Tabs.TabPane>
              {/* TODO: 按需添加更多标签页 */}
            </Tabs>
          </>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={selected?.id ? '编辑' : '新增'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={480}
      >
        <Form getFormApi={setFormApi} labelPosition="left" labelWidth={80}>
          {/* TODO: 补充实际表单字段 */}
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
        </Form>
      </Modal>
    </div>
  )
}
