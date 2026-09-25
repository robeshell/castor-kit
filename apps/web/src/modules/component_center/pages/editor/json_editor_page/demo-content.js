// i18n-ignore-file: sample JSON document is demo content, not UI copy

/** Sample JSON loaded into the editor */
export const EXAMPLE_JSON = {
  project: {
    name: 'castor-kit',
    version: '2.0.0',
    description: 'Fastify + React + RBAC AI-First 脚手架',
    active: true,
    stars: 1024,
    license: null,
    tags: ['fastify', 'typescript', 'react', 'rbac', 'ai', 'scaffold'],
    author: {
      name: '研发团队',
      email: 'dev@castor-kit.dev',
      roles: ['maintainer', 'committer'],
    },
    dependencies: {
      backend: {
        node: '22.x',
        fastify: '5.x',
        drizzle: '0.x',
        postgresql: '15+',
      },
      frontend: {
        react: '19.x',
        vite: '5.x',
        tailwindcss: '4.x',
        shadcn: 'new-york',
      },
    },
    features: [
      {
        id: 1,
        name: 'RBAC 权限',
        enabled: true,
        config: { strict: true, superAdmin: 'super_admin' },
      },
      {
        id: 2,
        name: '组件示例中心',
        enabled: true,
        config: { modules: 12, categories: 6 },
      },
      {
        id: 3,
        name: 'AI 集成',
        enabled: false,
        config: null,
      },
    ],
    stats: {
      totalUsers: 256,
      activeUsers: 128,
      dailyRequests: 50000,
      uptime: 99.9,
    },
  },
}

