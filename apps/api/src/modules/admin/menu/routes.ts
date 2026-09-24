/**
 * 菜单模块路由（对齐 AuraStack backend/app/admin/api/menu.py）
 *
 * 顺序与 Flask 一致：`/menus/<id>` 先 get_or_404 再做权限检查；`/menus/<id>/sort` 反过来，先权限后 404。
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getCurrentAdminUser, hasMenuPermission, loginRequired } from '@/common/auth'
import { getUploadedFile, intParam, parseIntParam, queryString, rawJsonBody } from '@/common/http'
import { sendTable } from '@/common/tabular'
import { dictBody } from '@/common/py-values'
import { MenuService } from './service'

function menuIdOf(request: FastifyRequest): number {
  return parseIntParam((request.params as { menu_id: string }).menu_id)
}

export async function registerMenuRoutes(app: FastifyInstance): Promise<void> {
  const service = new MenuService(app.db)
  const opts = { preHandler: loginRequired }

  app.get('/api/admin/menus', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus'))) {
      return reply.status(403).send({ error: '无权限查看菜单列表' })
    }
    return service.listMenus(queryString(request, 'format', 'tree'), queryString(request, 'search').trim())
  })

  app.post('/api/admin/menus', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus_add'))) {
      return reply.status(403).send({ error: '无权限新增菜单' })
    }
    return reply.status(201).send(await service.createMenu(dictBody(rawJsonBody(request))))
  })

  app.get(`/api/admin/menus/${intParam('menu_id')}`, opts, async (request, reply) => {
    const menu = await service.getMenuOr404(menuIdOf(request))
    if (!(await hasMenuPermission(request, 'system_menus'))) {
      return reply.status(403).send({ error: '无权限查看菜单' })
    }
    return service.getMenuDetail(menu)
  })

  app.put(`/api/admin/menus/${intParam('menu_id')}`, opts, async (request, reply) => {
    const menu = await service.getMenuOr404(menuIdOf(request))
    if (!(await hasMenuPermission(request, 'system_menus_edit'))) {
      return reply.status(403).send({ error: '无权限编辑菜单' })
    }
    return service.updateMenu(menu, dictBody(rawJsonBody(request)))
  })

  app.delete(`/api/admin/menus/${intParam('menu_id')}`, opts, async (request, reply) => {
    const menu = await service.getMenuOr404(menuIdOf(request))
    if (!(await hasMenuPermission(request, 'system_menus_delete'))) {
      return reply.status(403).send({ error: '无权限删除菜单' })
    }
    return service.deleteMenu(menu)
  })

  app.post(`/api/admin/menus/${intParam('menu_id')}/sort`, opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus_edit'))) {
      return reply.status(403).send({ error: '无权限排序菜单' })
    }
    const menu = await service.getMenuOr404(menuIdOf(request))
    return service.sortMenu(menu, dictBody(rawJsonBody(request)).direction)
  })

  app.get('/api/admin/my-menus', opts, async (request) => {
    return service.getMyMenus(await getCurrentAdminUser(request))
  })

  app.post('/api/admin/menus/export', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus'))) {
      return reply.status(403).send({ error: '无权限导出菜单' })
    }
    return sendTable(reply, await service.exportMenus(dictBody(rawJsonBody(request))))
  })

  app.get('/api/admin/menus/template', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus'))) {
      return reply.status(403).send({ error: '无权限下载菜单导入模板' })
    }
    return sendTable(reply, await service.downloadTemplate(queryString(request, 'file_type')))
  })

  app.post('/api/admin/menus/import', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_menus_edit'))) {
      return reply.status(403).send({ error: '无权限导入菜单' })
    }
    return service.importMenus(await getUploadedFile(request))
  })
}
