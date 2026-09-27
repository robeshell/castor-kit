/**
 * Generated from docs/apifox-full.openapi.json by apps/web/scripts/api-types.mjs. Do not edit;
 * run `pnpm openapi:generate` after changing the doc.
 */

export interface paths {
    "/api/admin/announcements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 公告列表
         * @description 需要 system_announcements。按置顶、排序权重、ID 倒序排列；注意返回只有 items 与 total，不含 page / per_page。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数（最大 200） */
                    per_page?: number;
                    /** @description 按标题模糊搜索 */
                    search?: string;
                    /** @description 按状态精确筛选；空串表示不筛选 */
                    status?: "draft" | "published" | "";
                    /** @description 按公告类型精确筛选；空串表示不筛选 */
                    announce_type?: "system" | "activity" | "update" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                title: string;
                                content: string | null;
                                /** @description 公告类型：system 系统 / activity 活动 / update 更新 */
                                announce_type: string;
                                /** @description 状态：draft 草稿 / published 已发布 */
                                status: string;
                                /** @description 是否置顶 */
                                is_top: boolean | null;
                                /** @description 排序权重（升序） */
                                sort_order: number | null;
                                /**
                                 * Format: date-time
                                 * @description 发布时间
                                 */
                                publish_at: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            }[];
                            total: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增公告
         * @description 需要 system_announcements_add。标题必填；公告类型与状态不做取值校验；超出列长度等数据库拒绝的值返回 400。announce_type 只能是 system、activity、update，status 只能是 draft、published，否则 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 标题（去掉首尾空格后不能为空） */
                        title: string;
                        /** @description 内容，空值存为空字符串 */
                        content?: string | null;
                        /**
                         * @description 公告类型：system / activity / update，缺省、null 或空串时为 system；其他值返回 400「公告类型只能是 system、activity 或 update」
                         * @enum {string|null}
                         */
                        announce_type?: "system" | "activity" | "update" | null;
                        /**
                         * @description 状态：draft / published，缺省、null 或空串时为 draft；其他值返回 400「状态只能是 draft 或 published」
                         * @enum {string|null}
                         */
                        status?: "draft" | "published" | null;
                        /** @description 是否置顶，缺省或 null 时为 false */
                        is_top?: boolean | null;
                        /** @description 排序权重，缺省或 null 时为 0 */
                        sort_order?: number | null;
                        /** @description 发布时间：YYYY-MM-DD HH:MM[:SS]（也可用 T 分隔），可带时区（Z / ±HH:MM，按时区换算为 UTC），不带时区按 UTC；空值表示未设置；格式不合法返回 400「发布时间的值无效」 */
                        publish_at?: string | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            title: string;
                            content: string | null;
                            /** @description 公告类型：system 系统 / activity 活动 / update 更新 */
                            announce_type: string;
                            /** @description 状态：draft 草稿 / published 已发布 */
                            status: string;
                            /** @description 是否置顶 */
                            is_top: boolean | null;
                            /** @description 排序权重（升序） */
                            sort_order: number | null;
                            /**
                             * Format: date-time
                             * @description 发布时间
                             */
                            publish_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 标题不能为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出公告
         * @description 需要 system_announcements_export。export_mode 为 selected 且 ids 非空时只导出这些公告（按 ID 升序），否则导出全部（置顶优先、ID 倒序）；fields 为空或无有效字段时导出全部列。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description 要导出的字段，未知字段忽略；缺省、null 或为空时导出全部 */
                        fields?: ("id" | "title" | "announce_type" | "status" | "is_top" | "sort_order" | "content" | "publish_at" | "created_at")[] | null;
                        /**
                         * @description 文件格式，其他值按 xlsx
                         * @default xlsx
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                        /**
                         * @description 导出范围，缺省、null 或空串时为 all
                         * @default all
                         * @enum {string|null}
                         */
                        export_mode?: "all" | "selected" | null;
                        /** @description export_mode 为 selected 时要导出的公告 ID；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                    };
                };
            };
            responses: {
                /** @description 文件内容（announcements_export.csv / .xlsx，附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/export-fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 公告可导出字段
         * @description 登录即可（不校验菜单权限）。返回导出时可选的字段及其中文列名。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 列名（如「标题」） */
                            label: string;
                            /**
                             * @description 字段名，导出时放进 fields
                             * @enum {string}
                             */
                            value: "id" | "title" | "announce_type" | "status" | "is_top" | "sort_order" | "content" | "publish_at" | "created_at";
                        }[];
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入公告
         * @description 需要 system_announcements_import。支持 csv（UTF-8）/ xlsx，最大 5MB；表头可用中文列名或字段名。整批在一个事务里写入：有任何错误行（如标题为空）时整批回滚，返回 400 与 error_rows；公告类型、状态取值不合法时分别按 system、draft 处理，不写发布时间。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv 或 xlsx 文件
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /**
                             * @description 始终为 0（只新增不更新）
                             * @enum {integer}
                             */
                            updated: 0;
                        };
                    };
                };
                /** @description 未上传文件、格式不支持（含 .xls）、文件为空、超过 5MB、解析失败，或存在错误数据（响应含 error_rows、error_count） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件超过 BODY_LIMIT */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载公告导入模板
         * @description 需要 system_announcements_import。模板列：标题、公告类型、状态、是否置顶、排序权重、内容，附一行示例。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，缺省或其他值按 xlsx */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 模板文件（announcements_import_template.csv / .xlsx，附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑公告
         * @description 需要 system_announcements_edit（先校验权限再查公告，公告不存在返回 404）。只更新请求体里出现的字段，没有变化时不写库；状态改为 published 且原发布时间为空时自动写入当前时间。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 公告 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description 标题（传了就不能为空） */
                        title?: string;
                        /** @description 内容，空值存为空字符串 */
                        content?: string | null;
                        /**
                         * @description 公告类型：system / activity / update，null 或空串时为 system；其他值返回 400「公告类型只能是 system、activity 或 update」
                         * @enum {string|null}
                         */
                        announce_type?: "system" | "activity" | "update" | null;
                        /**
                         * @description 状态：draft / published，null 或空串时为 draft；其他值返回 400「状态只能是 draft 或 published」。改为 published 且原发布时间为空时自动写入当前时间
                         * @enum {string|null}
                         */
                        status?: "draft" | "published" | null;
                        /** @description 是否置顶，null 时为 false */
                        is_top?: boolean | null;
                        /** @description 排序权重，null 时为 0 */
                        sort_order?: number | null;
                        /** @description 发布时间：YYYY-MM-DD HH:MM[:SS]（也可用 T 分隔），可带时区（Z / ±HH:MM，按时区换算为 UTC），不带时区按 UTC；传空值清空；格式不合法返回 400「发布时间的值无效」 */
                        publish_at?: string | null;
                    };
                };
            };
            responses: {
                /** @description 成功，返回更新后的公告 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            title: string;
                            content: string | null;
                            /** @description 公告类型：system 系统 / activity 活动 / update 更新 */
                            announce_type: string;
                            /** @description 状态：draft 草稿 / published 已发布 */
                            status: string;
                            /** @description 是否置顶 */
                            is_top: boolean | null;
                            /** @description 排序权重（升序） */
                            sort_order: number | null;
                            /**
                             * Format: date-time
                             * @description 发布时间
                             */
                            publish_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 标题不能为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 公告不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除公告
         * @description 需要 system_announcements_delete（先校验权限再查公告，公告不存在返回 404）。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 公告 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @example 删除成功 */
                            message: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 公告不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/{item_id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发布公告
         * @description 需要 system_announcements_edit（先校验权限再查公告）。状态改为 published，原发布时间为空时写入当前时间（UTC），已有发布时间则保留。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 公告 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功，返回更新后的公告 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            title: string;
                            content: string | null;
                            /** @description 公告类型：system 系统 / activity 活动 / update 更新 */
                            announce_type: string;
                            /** @description 状态：draft 草稿 / published 已发布 */
                            status: string;
                            /** @description 是否置顶 */
                            is_top: boolean | null;
                            /** @description 排序权重（升序） */
                            sort_order: number | null;
                            /**
                             * Format: date-time
                             * @description 发布时间
                             */
                            publish_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 公告不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/announcements/{item_id}/unpublish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤回公告
         * @description 需要 system_announcements_edit（先校验权限再查公告）。状态改回 draft，发布时间保持不变。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 公告 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功，返回更新后的公告 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            title: string;
                            content: string | null;
                            /** @description 公告类型：system 系统 / activity 活动 / update 更新 */
                            announce_type: string;
                            /** @description 状态：draft 草稿 / published 已发布 */
                            status: string;
                            /** @description 是否置顶 */
                            is_top: boolean | null;
                            /** @description 排序权重（升序） */
                            sort_order: number | null;
                            /**
                             * Format: date-time
                             * @description 发布时间
                             */
                            publish_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 公告不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/api-tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 全部 API Token
         * @description 需要 system_api_tokens（不接受 API Token）；按数据权限过滤创建人
         */
        get: {
            parameters: {
                query?: {
                    page?: number;
                    per_page?: number;
                    /** @description 名称、前缀、创建人 */
                    search?: string;
                    /** @description Token 状态：active 有效 / expired 已过期 / revoked 已吊销；空串或其他值不筛选 */
                    status?: "active" | "expired" | "revoked" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                name: string;
                                /** @description ck_ + 8 位，用于辨认 */
                                token_prefix: string;
                                scopes: string[];
                                /** Format: date-time */
                                expires_at: string | null;
                                /** Format: date-time */
                                last_used_at: string | null;
                                last_used_ip: string | null;
                                created_by: number;
                                creator_username: string | null;
                                creator_nickname: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                revoked_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/api-tokens/{token_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 吊销 API Token
         * @description 需要 system_api_tokens_revoke（不接受 API Token）；非超级管理员不能吊销超级管理员的 token
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description token ID */
                    token_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/app-info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取应用信息
         * @description 公开，无需登录。始终返回上传限制、安全配置（两步验证与找回密码当前是否可用、密码规则）和 AI 小助手是否可用，供登录页、密码表单与上传控件使用；DEMO_MODE 开启时另外返回演示账号与数据重置间隔。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 是否为演示环境 */
                            demo_mode: boolean;
                            /** @description 演示数据重置间隔（小时），仅演示模式返回 */
                            demo_reset_hours?: number;
                            /** @description 演示账号，仅演示模式返回 */
                            demo_account?: {
                                username: string;
                                password: string;
                            };
                            /** @description 上传限制 */
                            upload: {
                                /** @description 单个文件上限（字节），取系统设置 upload.max_size 与 BODY_LIMIT 的较小值 */
                                max_size: number;
                                /** @description 允许上传的扩展名（小写、不带点） */
                                allowed_types: string[];
                            };
                            /** @description 安全配置 */
                            security: {
                                /** @description 两步验证是否可用（开关已打开且当前环境允许；演示环境恒为 false） */
                                totp_enabled: boolean;
                                /** @description 邮件找回密码是否可用（开关已打开，且已配置 SMTP 与网站地址；演示环境恒为 false） */
                                password_reset_enabled: boolean;
                                /** @description 密码规则 */
                                password_policy: {
                                    /** @description 密码最短长度 */
                                    min_length: number;
                                    /** @description 是否必须同时包含字母和数字 */
                                    require_letters_digits: boolean;
                                    /** @description 是否必须包含符号 */
                                    require_symbol: boolean;
                                };
                            };
                            /** @description AI 小助手是否可用（开关已打开且已配置模型） */
                            assistant: boolean;
                        };
                    };
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/assistant/chat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AI 小助手对话（流式）
         * @description 只需登录；系统设置「AI 小助手」开启（且已配置 AI 模型）时可用，不接受 API Token。请求体是前端 useChat 发送的 UI 消息，外加 context（用户所在页面）。助手可调用三个工具：search_api（在接口目录中查找）、api_get（以当前用户身份读取）、api_write（POST / PUT / PATCH / DELETE，每次都返回 tool-approval-request，用户确认后前端带上 approval-responded 的消息再次请求才执行；确认请求带服务端签名，伪造无效）。账号、安全、导入导出等接口不在目录中且会被拒绝。工具经 app.inject 以当前用户的会话执行：权限、数据权限、演示模式限制、操作日志照常生效。响应为 AI SDK 的 UI message stream（SSE）。演示模式计入 AI 额度，每条消息最多 4 轮工具调用（平时 8 轮）。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        messages: {
                            id: string;
                            /** @enum {string} */
                            role: "user" | "assistant" | "system";
                            parts: {
                                [key: string]: unknown;
                            }[];
                        }[];
                        context?: {
                            path?: string | null;
                            title?: string | null;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description UI message stream（text/event-stream） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description 消息为空 / 格式不正确 / 对话太长 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description AI 小助手未开启 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 演示环境 AI 调用额度用完 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 修改当前用户密码
         * @description 只需登录。新密码按系统设置的密码规则校验；成功后该用户的其他会话全部下线，当前会话保留
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        old_password: string;
                        new_password: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/chat/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AI 对话（流式）
         * @description 需要 cc_ai_chat。请求体是前端 useChat（AI SDK）发送的 UI 消息，最多 200 条；没有任何文本的助手消息会被丢弃，之后至少要剩一条用户消息。系统提示词由服务端注入。未配置 AI 模型时先于请求体校验直接返回 500。响应是 AI SDK 的 UI message stream（SSE，响应头 x-vercel-ai-ui-message-stream: v1，不压缩）：start、text-start、若干 text-delta、text-end、finish，最后 data: [DONE]；上游出错或超时（60 秒）时流内给一个 {"type":"error","errorText":…}（通用文案，最多带上游状态码，按请求语言翻译），HTTP 状态仍是 200；客户端断开会中止上游请求。演示模式限制输入文字长度、调用频率与输出 token
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    /**
                     * @example {
                     *       "messages": [
                     *         {
                     *           "id": "m1",
                     *           "role": "user",
                     *           "parts": [
                     *             {
                     *               "type": "text",
                     *               "text": "介绍一下 castor-kit"
                     *             }
                     *           ]
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": {
                        /** @description 对话消息（清除上下文之后的部分），按 AI SDK UIMessage 校验 */
                        messages: {
                            id: string;
                            /** @enum {string} */
                            role: "user" | "assistant" | "system";
                            /** @description 消息片段，常用 { type: "text", text }；也接受 AI SDK 的其他片段类型（file、tool-* 等） */
                            parts: ({
                                /** @description 片段类型，如 text */
                                type: string;
                                /** @description 文本（type 为 text 时） */
                                text?: string;
                            } & {
                                [key: string]: unknown;
                            })[];
                        }[];
                        /** @description useChat 的会话 ID（服务端不使用） */
                        id?: string;
                        /** @description submit-message / regenerate-message（服务端不使用） */
                        trigger?: string;
                    } & {
                        [key: string]: unknown;
                    };
                };
            };
            responses: {
                /** @description UI message stream（text/event-stream），每个事件一行 data: <JSON> */
                200: {
                    headers: {
                        /** @description AI SDK UI 消息流协议版本 */
                        "x-vercel-ai-ui-message-stream"?: "v1";
                        [name: string]: unknown;
                    };
                    content: {
                        /**
                         * @example data: {"type":"start","messageId":"…"}
                         *
                         *     data: {"type":"text-start","id":"txt-0"}
                         *
                         *     data: {"type":"text-delta","id":"txt-0","delta":"你好"}
                         *
                         *     data: {"type":"text-end","id":"txt-0"}
                         *
                         *     data: {"type":"finish"}
                         *
                         *     data: [DONE]
                         */
                        "text/event-stream": string;
                    };
                };
                /** @description 消息不能为空 / 消息格式不正确 / 对话太长，请清除上下文后再试；演示环境单次输入过长 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 演示环境 AI 调用过于频繁 / 当日额度用完 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/prompt/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 预览提示词
         * @description 需要 cc_ai_prompt。只在服务端做变量替换，不调用 AI 模型、不写库：把 content 里的 {{键}} 替换成 variables 中对应的值，并列出替换后仍未赋值的变量。content 不是字符串或 variables 不是对象时返回 400「请求参数格式不正确」
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 提示词内容；缺省或 null 时按空串处理 */
                        content?: string | null;
                        /** @description 变量名 → 值（值会转成字符串）；省略时为空对象 */
                        variables?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 替换后的内容 */
                            preview: string;
                            /** @description 替换后仍残留的 {{变量名}}（按出现顺序，可能重复） */
                            undefined_vars: string[];
                        };
                    };
                };
                /** @description 请求参数格式不正确（content 不是字符串或 variables 不是对象） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/prompt/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 提示词模板列表
         * @description 需要 cc_ai_prompt。每次调用都会按名称补齐缺失的 5 个内置模板；不分页，返回 { data, total }（不是 items），按 ID 升序
         */
        get: {
            parameters: {
                query?: {
                    /** @description 按分类精确筛选（去首尾空白；为空不筛选） */
                    category?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: number;
                                /** @description 模板名称 */
                                name: string;
                                /** @description 分类，默认 custom（内置模板用 product / dev / marketing / data / office） */
                                category: string;
                                /** @description 模板说明 */
                                description: string | null;
                                /** @description 提示词内容，变量写作 {{变量名}} */
                                content: string;
                                /** @description 从 content 提取的变量名（去重，按首次出现顺序） */
                                variables: string[];
                                /** @description 标签 */
                                tags: string[];
                                is_active: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            }[];
                            total: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增提示词模板
         * @description 需要 cc_ai_prompt_add。name、content 去空白后不能为空，variables 由服务端从 content 的 {{变量名}} 自动提取（请求里传了也会忽略）。name / content / category / description 传非字符串或 is_active 传布尔与 0 / 1 以外的值返回 400「请求参数格式不正确」
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 模板名称 */
                        name: string;
                        /** @description 提示词内容，变量写作 {{变量名}}（字母、数字、下划线） */
                        content: string;
                        /** @description 分类，为空时用 custom */
                        category?: string | null;
                        /** @description 模板说明；空串存为 null */
                        description?: string | null;
                        /** @description 标签：字符串数组或逗号分隔的字符串，统一存为逗号分隔（去空白、去空项） */
                        tags?: string[] | string | null;
                        /** @description 是否启用（true / false），缺省为 true */
                        is_active?: boolean | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 模板名称 */
                            name: string;
                            /** @description 分类，默认 custom（内置模板用 product / dev / marketing / data / office） */
                            category: string;
                            /** @description 模板说明 */
                            description: string | null;
                            /** @description 提示词内容，变量写作 {{变量名}} */
                            content: string;
                            /** @description 从 content 提取的变量名（去重，按首次出现顺序） */
                            variables: string[];
                            /** @description 标签 */
                            tags: string[];
                            is_active: boolean;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 模板名称和内容不能为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限新建模板 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器内部错误（数据库拒绝的输入返回 400） */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/prompt/templates/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑提示词模板
         * @description 需要 cc_ai_prompt_edit（先校验权限，再查模板）。部分更新：只处理请求体里出现的字段；传了 name / content 就不能为空；每次都按最新 content 重新提取 variables；值都没变化时不写库，updated_at 不变
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 模板 ID */
                    template_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 模板名称（非字符串会转成字符串） */
                        name?: string;
                        /** @description 提示词内容 */
                        content?: string;
                        /** @description 分类，为空时用 custom */
                        category?: string | null;
                        /** @description 模板说明；空串存为 null */
                        description?: string | null;
                        /** @description 标签：字符串数组或逗号分隔的字符串，统一存为逗号分隔（去空白、去空项） */
                        tags?: string[] | string | null;
                        /** @description 是否启用（true / false） */
                        is_active?: boolean | null;
                    };
                };
            };
            responses: {
                /** @description 成功，返回更新后的模板 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 模板名称 */
                            name: string;
                            /** @description 分类，默认 custom（内置模板用 product / dev / marketing / data / office） */
                            category: string;
                            /** @description 模板说明 */
                            description: string | null;
                            /** @description 提示词内容，变量写作 {{变量名}} */
                            content: string;
                            /** @description 从 content 提取的变量名（去重，按首次出现顺序） */
                            variables: string[];
                            /** @description 标签 */
                            tags: string[];
                            is_active: boolean;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 模板名称不能为空 / 模板内容不能为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限编辑模板 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 模板不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器内部错误（数据库拒绝的输入返回 400） */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除提示词模板
         * @description 需要 cc_ai_prompt_delete（先校验权限，再查模板）。物理删除；内置模板删除后，下次查询列表时会按名称重新补回
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 模板 ID */
                    template_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已删除 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 删除成功 */
                            message: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限删除模板 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 模板不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器内部错误（数据库拒绝的输入返回 400） */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/sql/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 执行查询语句
         * @description 需要 cc_ai_sql。执行用户手动编辑的 SQL，不调用 AI 模型：同样经安全检查（只允许单条 SELECT / WITH）后在只读连接上执行，最多返回 200 行
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description SELECT / WITH 语句，结尾分号可有可无（去首尾空白后不能为空；非字符串返回 500） */
                        sql: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 实际执行的 SQL */
                            sql: string;
                            /** @description 列名（按查询顺序） */
                            columns: string[];
                            /** @description 行数据，每行是 列名 → JSON 值，最多 200 行。整数、浮点数、布尔为 JSON 数字 / 布尔（超出 ±2^53 的 bigint 为数字字符串，NaN / Infinity 为 null）；numeric 保持字符串（如 "12.50"）；json / jsonb 为解析后的对象或数组；timestamp 为 YYYY-MM-DDTHH:mm:ss[.ffffff]（timestamptz 带 ±HH:MM）；数组为 JSON 数组；其余类型（text、date、time、interval、uuid、range 等）为 PostgreSQL 原文 */
                            rows: {
                                [key: string]: unknown;
                            }[];
                            /** @description 返回的行数 */
                            row_count: number;
                            /** @description 结果超过 200 行被截断时为 true */
                            truncated: boolean;
                        };
                    };
                };
                /** @description SQL 不能为空；未通过安全检查（error 为原因）；SQL 执行错误（此时带 sql） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            /** @description 出错的 SQL（生成的 SQL 未通过安全检查或执行失败时返回） */
                            sql: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/sql/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 自然语言生成并执行查询
         * @description 需要 cc_ai_sql。把问题和可见表结构发给系统设置里配置的 AI 模型（超时 30 秒）生成一条 SELECT，经安全检查（只允许单条 SELECT / WITH，禁止写入、DDL、SET、FOR UPDATE 及危险函数）后在只读连接上执行，最多返回 200 行。演示模式下限制输入长度、调用频率和输出 token
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 自然语言问题（去首尾空白后不能为空；非字符串返回 500） */
                        question: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 实际执行的 SQL */
                            sql: string;
                            /** @description 列名（按查询顺序） */
                            columns: string[];
                            /** @description 行数据，每行是 列名 → JSON 值，最多 200 行。整数、浮点数、布尔为 JSON 数字 / 布尔（超出 ±2^53 的 bigint 为数字字符串，NaN / Infinity 为 null）；numeric 保持字符串（如 "12.50"）；json / jsonb 为解析后的对象或数组；timestamp 为 YYYY-MM-DDTHH:mm:ss[.ffffff]（timestamptz 带 ±HH:MM）；数组为 JSON 数组；其余类型（text、date、time、interval、uuid、range 等）为 PostgreSQL 原文 */
                            rows: {
                                [key: string]: unknown;
                            }[];
                            /** @description 返回的行数 */
                            row_count: number;
                            /** @description 结果超过 200 行被截断时为 true */
                            truncated: boolean;
                        };
                    };
                };
                /** @description 问题不能为空；生成的 SQL 未通过安全检查（error 为原因）；SQL 执行错误；演示环境单次输入过长 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            /** @description 出错的 SQL（生成的 SQL 未通过安全检查或执行失败时返回） */
                            sql: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 演示环境 AI 调用过于频繁 / 当日额度用完 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description AI 生成失败：未配置模型、模型服务返回错误状态（含 429 额度用完）、响应格式不对或没有内容、网络 / 超时 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/ai/sql/schema": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 数据库结构
         * @description 需要 cc_ai_sql。经只读连接读取当前 schema 下的业务表结构（与发给 AI 模型的内容一致），权限、菜单、会话、文件、系统设置、Webhook、日志、定时任务等敏感表不会出现
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 可见的表名（按字母排序） */
                            tables: string[];
                            /** @description 表结构文本，每张表形如 TABLE 表名 (\n  列名  类型 NOT NULL DEFAULT …\n)，表之间空一行 */
                            schema: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 获取数据库结构失败 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/dataviz/traffic-flow/data": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 流量转化分析数据
         * @description 需要 cc_dataviz_traffic_flow。返回演示数据，没有持久化：来源 → 落地页的访问次数每次请求在基准值上随机浮动 ±5%，各落地页再按固定比例分到注册 / 下单 / 离开（每个落地页的流入等于流出）；漏斗各环节按总访问量的固定比例计算，逐级递减。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 桑基图的边：先是 来源 → 落地页，再是 落地页 → 结果 */
                            links: {
                                /** @description 起点：访问来源（search / social / direct / ads / email）或落地页（home / product / campaign） */
                                source: string;
                                /** @description 终点：落地页（home / product / campaign）或结果（signup / order / exit） */
                                target: string;
                                /** @description 访问次数 */
                                value: number;
                            }[];
                            /** @description 转化漏斗，从访问到支付逐级递减 */
                            funnel: {
                                /**
                                 * @description 环节：访问 / 浏览商品 / 加入购物车 / 下单 / 支付
                                 * @enum {string}
                                 */
                                stage: "visit" | "view" | "cart" | "order" | "pay";
                                /** @description 该环节的人次 */
                                value: number;
                            }[];
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 示例数据列表
         * @description 需要页面模板目录（cc_patterns）或其下任一页面（cc_patterns_standard_list、cc_patterns_kanban 等）的菜单权限。按筛选条件分页；排序由 sort_field + sort_dir 指定，缺省按 ID 倒序。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数，最多 200 */
                    per_page?: number;
                    /** @description 按名称或编码模糊搜索 */
                    search?: string;
                    /** @description 分类；空串或缺省为全部 */
                    category?: "" | "product" | "design" | "engineering" | "marketing" | "operations";
                    /** @description 状态；空串或缺省为全部 */
                    status?: "" | "todo" | "in_progress" | "done" | "archived";
                    /** @description 负责人（完全匹配）；空串或缺省为全部 */
                    owner?: string;
                    /** @description 是否启用：true / 1 只看启用，false / 0 只看停用；空串或缺省为全部 */
                    is_active?: "" | "true" | "false" | "1" | "0";
                    /** @description 上级记录：root 只看顶级记录，数字只看该记录的直接下级；空串或缺省为全部 */
                    parent_id?: string;
                    /** @description 开始日期不早于（YYYY-MM-DD）；格式不对时忽略 */
                    start_from?: string;
                    /** @description 开始日期不晚于（YYYY-MM-DD）；格式不对时忽略 */
                    start_to?: string;
                    /** @description 排序字段；空串、缺省或其他值按 ID 倒序 */
                    sort_field?: "" | "id" | "name" | "code" | "status" | "priority" | "amount" | "quantity" | "progress" | "start_date" | "end_date" | "sort_order" | "board_order" | "created_at" | "updated_at";
                    /** @description 排序方向：asc 升序，desc 降序（缺省）；同值再按 ID 倒序 */
                    sort_dir?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                /** @description 名称 */
                                name: string | null;
                                /** @description 编码 */
                                code: string | null;
                                /**
                                 * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                                 * @enum {string|null}
                                 */
                                category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                                /**
                                 * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档
                                 * @enum {string|null}
                                 */
                                status: "todo" | "in_progress" | "done" | "archived" | null;
                                /** @description 负责人 */
                                owner: string | null;
                                /** @description 优先级；整数 */
                                priority: number | null;
                                /** @description 是否启用；布尔值（true / false） */
                                is_active: boolean | null;
                                /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                                amount: string | null;
                                /** @description 数量；整数 */
                                quantity: number | null;
                                /** @description 进度；0–100 的整数 */
                                progress: number | null;
                                /**
                                 * Format: date
                                 * @description 开始日期；YYYY-MM-DD
                                 */
                                start_date: string | null;
                                /**
                                 * Format: date
                                 * @description 结束日期；YYYY-MM-DD
                                 */
                                end_date: string | null;
                                /** @description 上级记录 ID；null 为顶级记录 */
                                parent_id: number | null;
                                /** @description 排序（树中同级记录的顺序）；整数 */
                                sort_order: number | null;
                                /** @description 看板顺序（看板列内卡片的顺序）；整数 */
                                board_order: number | null;
                                /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                                cover: string | null;
                                /** @description 描述 */
                                description: string | null;
                                /** @description 标签；字符串数组 */
                                tags: string[];
                                /** @description 扩展字段：动态表单填写的值（任意 JSON 对象） */
                                extra: {
                                    [key: string]: unknown;
                                };
                                /**
                                 * Format: date-time
                                 * @description 创建时间（ISO 8601，UTC）
                                 */
                                created_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 更新时间（ISO 8601，UTC）
                                 */
                                updated_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增示例数据
         * @description 需要 cc_patterns_add。唯一字段重复、值超长或类型不对返回 400。结束日期不能早于开始日期，上级记录必须存在（否则 400）。成功后触发 demo_record.created 事件。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 名称；必填 */
                        name: string;
                        /** @description 编码；必填；唯一 */
                        code: string;
                        /**
                         * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                         * @enum {string|null}
                         */
                        category?: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                        /**
                         * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档；新增时缺省为 todo
                         * @default todo
                         * @enum {string|null}
                         */
                        status?: "todo" | "in_progress" | "done" | "archived" | null;
                        /** @description 负责人 */
                        owner?: string | null;
                        /**
                         * @description 优先级；整数；新增时缺省为 0
                         * @default 0
                         */
                        priority?: number | null;
                        /**
                         * @description 是否启用；布尔值（true / false）；新增时缺省为 true
                         * @default true
                         */
                        is_active?: boolean | null;
                        /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                        amount?: number | string | null;
                        /** @description 数量；整数 */
                        quantity?: number | null;
                        /**
                         * @description 进度；0–100 的整数；新增时缺省为 0
                         * @default 0
                         */
                        progress?: number | null;
                        /**
                         * Format: date
                         * @description 开始日期；YYYY-MM-DD
                         */
                        start_date?: string | null;
                        /**
                         * Format: date
                         * @description 结束日期；YYYY-MM-DD
                         */
                        end_date?: string | null;
                        /** @description 上级记录 ID；null 为顶级记录。必须是已存在的记录，且不能是自身或其下级记录（否则 400） */
                        parent_id?: number | null;
                        /**
                         * @description 排序（树中同级记录的顺序）；整数；新增时缺省为 0
                         * @default 0
                         */
                        sort_order?: number | null;
                        /**
                         * @description 看板顺序（看板列内卡片的顺序，与树的 sort_order 互不影响）；整数；新增时缺省为 0
                         * @default 0
                         */
                        board_order?: number | null;
                        /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                        cover?: string | null;
                        /** @description 描述 */
                        description?: string | null;
                        /** @description 标签；字符串数组，每项去掉首尾空格，空项忽略；缺省或 null 为 [] */
                        tags?: string[] | null;
                        /** @description 扩展字段：动态表单填写的值（任意 JSON 对象）；缺省或 null 为 {} */
                        extra?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 名称 */
                            name: string | null;
                            /** @description 编码 */
                            code: string | null;
                            /**
                             * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                             * @enum {string|null}
                             */
                            category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                            /**
                             * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档
                             * @enum {string|null}
                             */
                            status: "todo" | "in_progress" | "done" | "archived" | null;
                            /** @description 负责人 */
                            owner: string | null;
                            /** @description 优先级；整数 */
                            priority: number | null;
                            /** @description 是否启用；布尔值（true / false） */
                            is_active: boolean | null;
                            /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                            amount: string | null;
                            /** @description 数量；整数 */
                            quantity: number | null;
                            /** @description 进度；0–100 的整数 */
                            progress: number | null;
                            /**
                             * Format: date
                             * @description 开始日期；YYYY-MM-DD
                             */
                            start_date: string | null;
                            /**
                             * Format: date
                             * @description 结束日期；YYYY-MM-DD
                             */
                            end_date: string | null;
                            /** @description 上级记录 ID；null 为顶级记录 */
                            parent_id: number | null;
                            /** @description 排序（树中同级记录的顺序）；整数 */
                            sort_order: number | null;
                            /** @description 看板顺序（看板列内卡片的顺序）；整数 */
                            board_order: number | null;
                            /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                            cover: string | null;
                            /** @description 描述 */
                            description: string | null;
                            /** @description 标签；字符串数组 */
                            tags: string[];
                            /** @description 扩展字段：动态表单填写的值（任意 JSON 对象） */
                            extra: {
                                [key: string]: unknown;
                            };
                            /**
                             * Format: date-time
                             * @description 创建时间（ISO 8601，UTC）
                             */
                            created_at: string | null;
                            /**
                             * Format: date-time
                             * @description 更新时间（ISO 8601，UTC）
                             */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误（必填字段为空、值无效、唯一字段重复等） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/batch-delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 批量删除示例数据
         * @description 需要 cc_patterns_delete。在一个事务里删除 ids 的全部记录。可以连同全部下级一起删除；若有下级记录不在 ids 中，整批不删并返回 400「所选记录包含未选中的下级记录，不能删除」。有记录不存在返回 400「记录不存在或已删除」。每条记录触发一次 demo_record.deleted 事件。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 要操作的记录 ID；不能为空（400「请选择要操作的记录」），一次最多 500 条 */
                        ids: number[];
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 已删除 N 条记录 */
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误、记录不存在或有未选中的下级记录 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/batch-update": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 批量修改示例数据
         * @description 需要 cc_patterns_edit。在一个事务里把请求中出现的字段写到 ids 的每条记录；没出现的字段不改。status / is_active / priority 为 null 也视为不改，owner / category 为 null 时清空。有记录不存在返回 400「记录不存在或已删除」，没有要改的字段返回 400「请至少修改一个字段」。每条记录触发一次 demo_record.updated 事件。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 要操作的记录 ID；不能为空（400「请选择要操作的记录」），一次最多 500 条 */
                        ids: number[];
                        /**
                         * @description 状态；null 或缺省为不改
                         * @enum {string|null}
                         */
                        status?: "todo" | "in_progress" | "done" | "archived" | null;
                        /**
                         * @description 分类；null 为清空，缺省为不改
                         * @enum {string|null}
                         */
                        category?: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                        /** @description 负责人；null 或空串为清空，缺省为不改 */
                        owner?: string | null;
                        /** @description 是否启用；null 或缺省为不改 */
                        is_active?: boolean | null;
                        /** @description 优先级；null 或缺省为不改 */
                        priority?: number | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 已更新 N 条记录 */
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出示例数据
         * @description 需要 cc_patterns_export。ids 为空时导出全部，按 ID 倒序；fields 缺省时导出所有列，枚举字段导出为选项名称，标签以逗号连接；扩展字段（extra）不导出。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 要导出的记录 ID；缺省、null 或为空时导出全部 */
                        ids?: number[] | null;
                        /** @description 导出列；缺省、null 或为空时导出所有列 */
                        fields?: ("id" | "name" | "code" | "category" | "status" | "owner" | "priority" | "is_active" | "amount" | "quantity" | "progress" | "start_date" | "end_date" | "parent_id" | "sort_order" | "board_order" | "cover" | "description" | "tags" | "created_at")[] | null;
                        /**
                         * @description 文件格式，缺省、null 或其他值按 xlsx
                         * @default xlsx
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 文件内容（demo_record_export.xlsx / .csv） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入示例数据
         * @description 需要 cc_patterns_import。表头按模板（第一列「名称」必填，固定选项列可填名称），只新增不更新；「上级记录」填已存在记录的 ID，「标签」用逗号分隔；任一行出错整批回滚，400 响应带 error_rows（最多 500 条）和 error_count。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv / xlsx 文件
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /** @description 固定为 0 */
                            updated: number;
                        };
                    };
                };
                /** @description 文件不合法或存在错误数据（响应含 error_rows、error_count） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件过大 */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/reorder": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 调整示例数据顺序
         * @description 需要 cc_patterns_edit。看板拖动和树拖动共用，两种顺序互不影响：请求体是数组，每项只修改它带出的字段——看板发 board_order（列内卡片顺序，换列时再带 status），树发 sort_order（同级顺序，换上级时再带 parent_id，null 移到顶级）。board_order / sort_order / status 缺省或 null 为不改；除 id 外一个字段都没带的项返回 400。在一个事务里先应用全部移动再检查：上级记录必须存在，且记录不能落到自身或其下级之下（400）；同一记录出现两次、有记录不存在都返回 400，一次最多 500 条。只写入值有变化的记录，每条触发一次 demo_record.updated 事件。请求体不是数组返回 400。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 记录 ID */
                        id: number;
                        /** @description 新的看板顺序（看板列内卡片的顺序）；null 或缺省为不改 */
                        board_order?: number | null;
                        /** @description 新的排序值（树中同级记录的顺序）；null 或缺省为不改 */
                        sort_order?: number | null;
                        /**
                         * @description 新的状态（看板换列）；null 或缺省为不改
                         * @enum {string|null}
                         */
                        status?: "todo" | "in_progress" | "done" | "archived" | null;
                        /** @description 新的上级记录 ID；null 移到顶级，缺省为不改 */
                        parent_id?: number | null;
                    }[];
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 排序成功 */
                            message: string;
                            /** @description 实际修改的记录数 */
                            updated: number;
                        };
                    };
                };
                /** @description 请求参数错误、记录不存在或会形成循环 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 示例数据统计
         * @description 需要页面模板目录（cc_patterns）或其下任一页面（cc_patterns_standard_list、cc_patterns_kanban 等）的菜单权限。统计与列表相同筛选条件下的记录：总数、金额合计、数量合计、各状态和各分类的记录数（每个选项都列出，没有记录为 0）。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 按名称或编码模糊搜索 */
                    search?: string;
                    /** @description 分类；空串或缺省为全部 */
                    category?: "" | "product" | "design" | "engineering" | "marketing" | "operations";
                    /** @description 状态；空串或缺省为全部 */
                    status?: "" | "todo" | "in_progress" | "done" | "archived";
                    /** @description 负责人（完全匹配）；空串或缺省为全部 */
                    owner?: string;
                    /** @description 是否启用：true / 1 只看启用，false / 0 只看停用；空串或缺省为全部 */
                    is_active?: "" | "true" | "false" | "1" | "0";
                    /** @description 上级记录：root 只看顶级记录，数字只看该记录的直接下级；空串或缺省为全部 */
                    parent_id?: string;
                    /** @description 开始日期不早于（YYYY-MM-DD）；格式不对时忽略 */
                    start_from?: string;
                    /** @description 开始日期不晚于（YYYY-MM-DD）；格式不对时忽略 */
                    start_to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 记录总数 */
                            total: number;
                            /** @description 金额合计；以字符串返回以免丢失精度（如 "12800.50"） */
                            amount_sum: string;
                            /** @description 数量合计 */
                            quantity_sum: number;
                            /** @description 各状态的记录数（按看板列顺序） */
                            by_status: {
                                /**
                                 * @description 状态
                                 * @enum {string}
                                 */
                                status: "todo" | "in_progress" | "done" | "archived";
                                /** @description 记录数 */
                                count: number;
                            }[];
                            /** @description 各分类的记录数；最后一项 category 为 null，是未分类（或分类不在选项中）的记录数 */
                            by_category: {
                                /**
                                 * @description 分类；null 为未分类
                                 * @enum {string|null}
                                 */
                                category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                                /** @description 记录数 */
                                count: number;
                            }[];
                        };
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载示例数据导入模板
         * @description 需要 cc_patterns_import。只含表头：名称、编码、分类、状态、负责人、优先级、是否启用、金额、数量、进度、开始日期、结束日期、上级记录、排序、看板顺序、封面、描述、标签（第一列必填）。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，缺省或其他值按 xlsx */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 模板文件（demo_record_import_template.xlsx / .csv） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 示例数据树
         * @description 需要页面模板目录（cc_patterns）或其下任一页面（cc_patterns_standard_list、cc_patterns_kanban 等）的菜单权限。按 parent_id 组装成树，同级按 sort_order、再按 ID 升序（看板的 board_order 不影响树）。带筛选条件时保留命中的记录及其所有上级（保证命中项可达），其余记录不返回。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 按名称或编码模糊搜索 */
                    search?: string;
                    /** @description 分类；空串或缺省为全部 */
                    category?: "" | "product" | "design" | "engineering" | "marketing" | "operations";
                    /** @description 状态；空串或缺省为全部 */
                    status?: "" | "todo" | "in_progress" | "done" | "archived";
                    /** @description 负责人（完全匹配）；空串或缺省为全部 */
                    owner?: string;
                    /** @description 是否启用：true / 1 只看启用，false / 0 只看停用；空串或缺省为全部 */
                    is_active?: "" | "true" | "false" | "1" | "0";
                    /** @description 开始日期不早于（YYYY-MM-DD）；格式不对时忽略 */
                    start_from?: string;
                    /** @description 开始日期不晚于（YYYY-MM-DD）；格式不对时忽略 */
                    start_to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功，返回顶级记录数组，每个节点带 children（同结构递归） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 名称 */
                            name: string | null;
                            /** @description 编码 */
                            code: string | null;
                            /**
                             * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                             * @enum {string|null}
                             */
                            category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                            /**
                             * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档
                             * @enum {string|null}
                             */
                            status: "todo" | "in_progress" | "done" | "archived" | null;
                            /** @description 负责人 */
                            owner: string | null;
                            /** @description 优先级；整数 */
                            priority: number | null;
                            /** @description 是否启用；布尔值（true / false） */
                            is_active: boolean | null;
                            /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                            amount: string | null;
                            /** @description 数量；整数 */
                            quantity: number | null;
                            /** @description 进度；0–100 的整数 */
                            progress: number | null;
                            /**
                             * Format: date
                             * @description 开始日期；YYYY-MM-DD
                             */
                            start_date: string | null;
                            /**
                             * Format: date
                             * @description 结束日期；YYYY-MM-DD
                             */
                            end_date: string | null;
                            /** @description 上级记录 ID；null 为顶级记录 */
                            parent_id: number | null;
                            /** @description 排序（树中同级记录的顺序）；整数 */
                            sort_order: number | null;
                            /** @description 看板顺序（看板列内卡片的顺序）；整数 */
                            board_order: number | null;
                            /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                            cover: string | null;
                            /** @description 描述 */
                            description: string | null;
                            /** @description 标签；字符串数组 */
                            tags: string[];
                            /** @description 扩展字段：动态表单填写的值（任意 JSON 对象） */
                            extra: {
                                [key: string]: unknown;
                            };
                            /**
                             * Format: date-time
                             * @description 创建时间（ISO 8601，UTC）
                             */
                            created_at: string | null;
                            /**
                             * Format: date-time
                             * @description 更新时间（ISO 8601，UTC）
                             */
                            updated_at: string | null;
                            /** @description 下级记录（与本节点结构相同，递归） */
                            children: {
                                [key: string]: unknown;
                            }[];
                        }[];
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/demo-records/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 示例数据详情
         * @description 需要页面模板目录（cc_patterns）或其下任一页面（cc_patterns_standard_list、cc_patterns_kanban 等）的菜单权限。先查权限（403）再查记录（不存在返回 404），没有权限时无法判断记录是否存在。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 示例数据 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 名称 */
                            name: string | null;
                            /** @description 编码 */
                            code: string | null;
                            /**
                             * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                             * @enum {string|null}
                             */
                            category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                            /**
                             * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档
                             * @enum {string|null}
                             */
                            status: "todo" | "in_progress" | "done" | "archived" | null;
                            /** @description 负责人 */
                            owner: string | null;
                            /** @description 优先级；整数 */
                            priority: number | null;
                            /** @description 是否启用；布尔值（true / false） */
                            is_active: boolean | null;
                            /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                            amount: string | null;
                            /** @description 数量；整数 */
                            quantity: number | null;
                            /** @description 进度；0–100 的整数 */
                            progress: number | null;
                            /**
                             * Format: date
                             * @description 开始日期；YYYY-MM-DD
                             */
                            start_date: string | null;
                            /**
                             * Format: date
                             * @description 结束日期；YYYY-MM-DD
                             */
                            end_date: string | null;
                            /** @description 上级记录 ID；null 为顶级记录 */
                            parent_id: number | null;
                            /** @description 排序（树中同级记录的顺序）；整数 */
                            sort_order: number | null;
                            /** @description 看板顺序（看板列内卡片的顺序）；整数 */
                            board_order: number | null;
                            /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                            cover: string | null;
                            /** @description 描述 */
                            description: string | null;
                            /** @description 标签；字符串数组 */
                            tags: string[];
                            /** @description 扩展字段：动态表单填写的值（任意 JSON 对象） */
                            extra: {
                                [key: string]: unknown;
                            };
                            /**
                             * Format: date-time
                             * @description 创建时间（ISO 8601，UTC）
                             */
                            created_at: string | null;
                            /**
                             * Format: date-time
                             * @description 更新时间（ISO 8601，UTC）
                             */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 记录不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑示例数据
         * @description 需要 cc_patterns_edit。先查权限（403）再查记录（不存在返回 404），没有权限时无法判断记录是否存在。只修改请求体中出现的字段，必填字段不能清空；唯一字段重复、值超长或类型不对返回 400。结束日期不能早于开始日期；上级记录必须存在，且不能是自身或其下级记录（否则 400）。成功后触发 demo_record.updated 事件。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 示例数据 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 名称；必填 */
                        name?: string;
                        /** @description 编码；必填；唯一 */
                        code?: string;
                        /**
                         * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                         * @enum {string|null}
                         */
                        category?: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                        /**
                         * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档；新增时缺省为 todo
                         * @default todo
                         * @enum {string|null}
                         */
                        status?: "todo" | "in_progress" | "done" | "archived" | null;
                        /** @description 负责人 */
                        owner?: string | null;
                        /**
                         * @description 优先级；整数；新增时缺省为 0
                         * @default 0
                         */
                        priority?: number | null;
                        /**
                         * @description 是否启用；布尔值（true / false）；新增时缺省为 true
                         * @default true
                         */
                        is_active?: boolean | null;
                        /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                        amount?: number | string | null;
                        /** @description 数量；整数 */
                        quantity?: number | null;
                        /**
                         * @description 进度；0–100 的整数；新增时缺省为 0
                         * @default 0
                         */
                        progress?: number | null;
                        /**
                         * Format: date
                         * @description 开始日期；YYYY-MM-DD
                         */
                        start_date?: string | null;
                        /**
                         * Format: date
                         * @description 结束日期；YYYY-MM-DD
                         */
                        end_date?: string | null;
                        /** @description 上级记录 ID；null 为顶级记录。必须是已存在的记录，且不能是自身或其下级记录（否则 400） */
                        parent_id?: number | null;
                        /**
                         * @description 排序（树中同级记录的顺序）；整数；新增时缺省为 0
                         * @default 0
                         */
                        sort_order?: number | null;
                        /**
                         * @description 看板顺序（看板列内卡片的顺序，与树的 sort_order 互不影响）；整数；新增时缺省为 0
                         * @default 0
                         */
                        board_order?: number | null;
                        /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                        cover?: string | null;
                        /** @description 描述 */
                        description?: string | null;
                        /** @description 标签；字符串数组，每项去掉首尾空格，空项忽略；缺省或 null 为 [] */
                        tags?: string[] | null;
                        /** @description 扩展字段：动态表单填写的值（任意 JSON 对象）；缺省或 null 为 {} */
                        extra?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 名称 */
                            name: string | null;
                            /** @description 编码 */
                            code: string | null;
                            /**
                             * @description 分类；可选值：product=产品，design=设计，engineering=研发，marketing=市场，operations=运营
                             * @enum {string|null}
                             */
                            category: "product" | "design" | "engineering" | "marketing" | "operations" | null;
                            /**
                             * @description 状态；可选值：todo=待办，in_progress=进行中，done=已完成，archived=已归档
                             * @enum {string|null}
                             */
                            status: "todo" | "in_progress" | "done" | "archived" | null;
                            /** @description 负责人 */
                            owner: string | null;
                            /** @description 优先级；整数 */
                            priority: number | null;
                            /** @description 是否启用；布尔值（true / false） */
                            is_active: boolean | null;
                            /** @description 金额；数值（最多 2 位小数），响应中以字符串返回以免丢失精度 */
                            amount: string | null;
                            /** @description 数量；整数 */
                            quantity: number | null;
                            /** @description 进度；0–100 的整数 */
                            progress: number | null;
                            /**
                             * Format: date
                             * @description 开始日期；YYYY-MM-DD
                             */
                            start_date: string | null;
                            /**
                             * Format: date
                             * @description 结束日期；YYYY-MM-DD
                             */
                            end_date: string | null;
                            /** @description 上级记录 ID；null 为顶级记录 */
                            parent_id: number | null;
                            /** @description 排序（树中同级记录的顺序）；整数 */
                            sort_order: number | null;
                            /** @description 看板顺序（看板列内卡片的顺序）；整数 */
                            board_order: number | null;
                            /** @description 封面；文件中心的图片文件 ID（也可传 /api/admin/files/<id> 地址） */
                            cover: string | null;
                            /** @description 描述 */
                            description: string | null;
                            /** @description 标签；字符串数组 */
                            tags: string[];
                            /** @description 扩展字段：动态表单填写的值（任意 JSON 对象） */
                            extra: {
                                [key: string]: unknown;
                            };
                            /**
                             * Format: date-time
                             * @description 创建时间（ISO 8601，UTC）
                             */
                            created_at: string | null;
                            /**
                             * Format: date-time
                             * @description 更新时间（ISO 8601，UTC）
                             */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 记录不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除示例数据
         * @description 需要 cc_patterns_delete。先查权限（403）再查记录（不存在返回 404），没有权限时无法判断记录是否存在。有下级记录时不能删除，返回 400「存在下级记录，不能删除」（先删除或移走下级记录）。成功后触发 demo_record.deleted 事件。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 示例数据 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已删除 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 存在下级记录 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 记录不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/component-center/devtools/perf-stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 服务器性能快照
         * @description 需要 cc_devtools_perf_monitor。采集一次 API 服务器所在机器的 CPU、内存、根分区磁盘与网络累计流量；实时推送请用 WebSocket /ws/devtools（同样的字段，每秒一次）。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description CPU 总使用率（%，1 位小数） */
                            cpu: number;
                            /** @description 已用内存（MB，1 位小数） */
                            mem_used: number;
                            /** @description 内存总量（MB，1 位小数） */
                            mem_total: number;
                            /** @description 内存使用率（%，1 位小数） */
                            mem_pct: number;
                            /** @description 根分区已用（GB，2 位小数） */
                            disk_used: number;
                            /** @description 根分区总量（GB，2 位小数） */
                            disk_total: number;
                            /** @description 根分区使用率（%，1 位小数） */
                            disk_pct: number;
                            /** @description 开机以来所有网卡累计发送（MB，2 位小数） */
                            net_sent: number;
                            /** @description 开机以来所有网卡累计接收（MB，2 位小数） */
                            net_recv: number;
                            /** @description 采集时间（毫秒时间戳） */
                            ts: number;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/csrf-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取跨站请求令牌
         * @description 登录即可。返回当前会话的 CSRF 令牌（没有则生成）；增删改请求需在请求头 X-CSRF-Token 中带上它（用 API Token 调用时不需要）。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description CSRF 令牌（32 位十六进制） */
                            csrf_token: string;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dashboard/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 工作台统计
         * @description 登录即可（不校验菜单权限）。返回用户、角色、菜单总数，以及按 UTC 日期统计的今日和最近 7 天（含今天，按日期升序）操作日志数。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 用户总数 */
                            user_count: number;
                            /** @description 角色总数 */
                            role_count: number;
                            /** @description 菜单总数（含按钮） */
                            menu_count: number;
                            /** @description 今日操作日志数 */
                            today_log_count: number;
                            /** @description 最近 7 天每天的操作日志数 */
                            week_log_counts: number[];
                            /** @description 对应日期标签（MM/DD） */
                            week_labels: string[];
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 部门树
         * @description 需要 system_departments、system_users 或 system_roles 之一；部门本身不做数据权限。search 保留匹配节点及其祖先和子树，status 只保留该状态的部门（及其祖先）
         */
        get: {
            parameters: {
                query?: {
                    /** @description 按名称 / 编码搜索 */
                    search?: string;
                    /** @description 部门状态，精确匹配；空串或其他值不筛选 */
                    status?: "active" | "disabled" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": ({
                            id: number;
                            parent_id: number | null;
                            name: string;
                            code: string;
                            leader_id: number | null;
                            sort_order: number;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            leader_name: string | null;
                            /** @description 直属用户数 */
                            user_count: number;
                            children: {
                                [key: string]: unknown;
                            }[];
                        } & {
                            [key: string]: unknown;
                        })[];
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增部门
         * @description 需要 system_departments_add
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** @description 唯一 */
                        code: string;
                        parent_id?: number | null;
                        /** @description 负责人（用户 ID） */
                        leader_id?: number | null;
                        /** @description 缺省或 null 时为 0 */
                        sort_order?: number | null;
                        /** @enum {string} */
                        status?: "active" | "disabled";
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            parent_id: number | null;
                            name: string;
                            code: string;
                            leader_id: number | null;
                            sort_order: number;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/departments/{dept_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 部门详情
         * @description 需要 system_departments；先校验权限再查部门；不按数据权限过滤，不含子部门。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 部门 ID */
                    dept_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            parent_id: number | null;
                            name: string;
                            code: string;
                            /** @description 负责人（用户 ID） */
                            leader_id: number | null;
                            sort_order: number;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 部门不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑部门
         * @description 需要 system_departments_edit；上级不能是自身或其下级部门
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 路径参数：dept_id */
                    dept_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        /** @description 唯一 */
                        code?: string;
                        parent_id?: number | null;
                        /** @description 负责人（用户 ID） */
                        leader_id?: number | null;
                        /** @description null 时为 0 */
                        sort_order?: number | null;
                        /** @enum {string} */
                        status?: "active" | "disabled";
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            parent_id: number | null;
                            name: string;
                            code: string;
                            leader_id: number | null;
                            sort_order: number;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 部门不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除部门
         * @description 需要 system_departments_delete；有下级部门或有用户时返回 400
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 路径参数：dept_id */
                    dept_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 部门不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/departments/{dept_id}/sort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 部门上移 / 下移
         * @description 需要 system_departments_edit；在同级部门之间移动一位
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 路径参数：dept_id */
                    dept_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        direction: "up" | "down";
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            changed: boolean;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 部门不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 字典列表
         * @description 需要 system_dicts。分页列出字典类型，按排序、ID 升序，每项带字典项数量
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码，默认 1 */
                    page?: number;
                    /** @description 每页条数，默认 20，最大 200 */
                    per_page?: number;
                    /** @description 按字典名称、编码模糊搜索 */
                    search?: string;
                    /** @description 是否启用；布尔筛选：1/true/yes/on/是/启用 视为是，0/false/no/off/否/停用 视为否，其他值忽略 */
                    is_active?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                /** @description 字典名称 */
                                name: string;
                                /** @description 字典编码，唯一 */
                                code: string;
                                description: string | null;
                                sort_order: number | null;
                                is_active: boolean | null;
                                /** @description 字典项数量 */
                                item_count: number;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增字典
         * @description 需要 system_dicts_add。名称、编码不能为空，编码重复返回 400
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 字典名称（去除首尾空格后不能为空） */
                        name: string;
                        /** @description 字典编码，全局唯一 */
                        code: string;
                        /** @description 描述 */
                        description?: string | null;
                        /** @description 排序，缺省或 null 时为 0 */
                        sort_order?: number | null;
                        /** @description 是否启用，缺省或 null 时为 true */
                        is_active?: boolean | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 字典名称 */
                            name: string;
                            /** @description 字典编码，唯一 */
                            code: string;
                            description: string | null;
                            sort_order: number | null;
                            is_active: boolean | null;
                            /** @description 字典项数量 */
                            item_count: number;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/items/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 字典项详情
         * @description 需要 system_dicts。先校验权限再查字典项，字典项不存在返回 404
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典项 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 所属字典 ID */
                            dict_type_id: number;
                            /** @description 字典标签 */
                            label: string;
                            /** @description 字典值，同一字典内唯一 */
                            value: string;
                            /** @description 标签颜色 */
                            color: string | null;
                            sort_order: number | null;
                            /** @description 是否默认项（同一字典至多一个） */
                            is_default: boolean | null;
                            is_active: boolean | null;
                            /** @description 备注 */
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 所属字典编码 */
                            dict_type_code: string;
                            /** @description 所属字典名称 */
                            dict_type_name: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典项不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑字典项
         * @description 需要 system_dicts_edit。只更新请求中出现的字段；传了标签或字典值则不能为空，字典值在目标字典内不能重复；可通过 dict_type_id 移到其他字典，目标字典不存在返回 404
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典项 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 移动到的目标字典 ID */
                        dict_type_id?: number | null;
                        /** @description 字典标签（去除首尾空格后不能为空） */
                        label?: string;
                        /** @description 字典值，同一字典内唯一 */
                        value?: string;
                        /** @description 标签颜色，如 #1677ff */
                        color?: string | null;
                        /** @description null 时为 0 */
                        sort_order?: number | null;
                        /** @description 设为 true 会取消目标字典其他项的默认，null 时为 false */
                        is_default?: boolean | null;
                        /** @description null 时为 true */
                        is_active?: boolean | null;
                        /** @description 备注 */
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 更新后的字典项 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 所属字典 ID */
                            dict_type_id: number;
                            /** @description 字典标签 */
                            label: string;
                            /** @description 字典值，同一字典内唯一 */
                            value: string;
                            /** @description 标签颜色 */
                            color: string | null;
                            sort_order: number | null;
                            /** @description 是否默认项（同一字典至多一个） */
                            is_default: boolean | null;
                            is_active: boolean | null;
                            /** @description 备注 */
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 所属字典编码 */
                            dict_type_code: string;
                            /** @description 所属字典名称 */
                            dict_type_name: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典项或目标字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除字典项
         * @description 需要 system_dicts_delete。字典项不存在返回 404
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典项 ID */
                    item_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已删除 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 删除成功 */
                            message: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典项不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按编码获取字典选项
         * @description 登录即可（不需要菜单权限，供各模块下拉框使用）。按逗号分隔的编码批量返回启用字典下的启用项，按排序、ID 升序；编码不存在或字典已停用时返回空数组
         */
        get: {
            parameters: {
                query: {
                    /** @description 字典编码，逗号分隔，如 user_status,gender */
                    codes: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 以编码为键的选项表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: {
                                label?: string;
                                value?: string;
                                color?: string | null;
                                is_default?: boolean | null;
                            }[];
                        };
                    };
                };
                /** @description codes 为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/{dict_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 字典详情
         * @description 需要 system_dicts。先校验权限再查字典，字典不存在返回 404；include_items 为真时附带全部字典项
         */
        get: {
            parameters: {
                query?: {
                    /** @description 是否附带字典项；布尔筛选：1/true/yes/on/是/启用 视为是，0/false/no/off/否/停用 视为否，其他值忽略 */
                    include_items?: string;
                };
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 字典名称 */
                            name: string;
                            /** @description 字典编码，唯一 */
                            code: string;
                            description: string | null;
                            sort_order: number | null;
                            is_active: boolean | null;
                            /** @description 字典项数量 */
                            item_count: number;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 仅 include_items 为真时返回，按排序、ID 升序 */
                            items: {
                                id: number;
                                /** @description 所属字典 ID */
                                dict_type_id: number;
                                /** @description 字典标签 */
                                label: string;
                                /** @description 字典值，同一字典内唯一 */
                                value: string;
                                /** @description 标签颜色 */
                                color: string | null;
                                sort_order: number | null;
                                /** @description 是否默认项（同一字典至多一个） */
                                is_default: boolean | null;
                                is_active: boolean | null;
                                /** @description 备注 */
                                description: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            }[];
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑字典
         * @description 需要 system_dicts_edit。只更新请求中出现的字段；传了名称或编码则不能为空，编码不能与其他字典重复
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 字典名称（去除首尾空格后不能为空） */
                        name?: string;
                        /** @description 字典编码，全局唯一 */
                        code?: string;
                        /** @description 描述 */
                        description?: string | null;
                        /** @description 排序，null 时为 0 */
                        sort_order?: number | null;
                        /** @description 是否启用，null 时为 true */
                        is_active?: boolean | null;
                    };
                };
            };
            responses: {
                /** @description 更新后的字典 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 字典名称 */
                            name: string;
                            /** @description 字典编码，唯一 */
                            code: string;
                            description: string | null;
                            sort_order: number | null;
                            is_active: boolean | null;
                            /** @description 字典项数量 */
                            item_count: number;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除字典
         * @description 需要 system_dicts_delete。字典下仍有字典项时返回 400，需先清空字典项
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已删除 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 删除成功 */
                            message: string;
                        };
                    };
                };
                /** @description 字典下仍有字典项 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/{dict_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 字典项列表
         * @description 需要 system_dicts。不分页，返回该字典全部匹配项（按排序、ID 升序）及字典本身信息
         */
        get: {
            parameters: {
                query?: {
                    /** @description 按标签、字典值模糊搜索 */
                    search?: string;
                    /** @description 是否启用；布尔筛选：1/true/yes/on/是/启用 视为是，0/false/no/off/否/停用 视为否，其他值忽略 */
                    is_active?: string;
                };
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                /** @description 所属字典 ID */
                                dict_type_id: number;
                                /** @description 字典标签 */
                                label: string;
                                /** @description 字典值，同一字典内唯一 */
                                value: string;
                                /** @description 标签颜色 */
                                color: string | null;
                                sort_order: number | null;
                                /** @description 是否默认项（同一字典至多一个） */
                                is_default: boolean | null;
                                is_active: boolean | null;
                                /** @description 备注 */
                                description: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 所属字典编码 */
                                dict_type_code: string;
                                /** @description 所属字典名称 */
                                dict_type_name: string;
                            }[];
                            total: number;
                            dict_type: {
                                id: number;
                                /** @description 字典名称 */
                                name: string;
                                /** @description 字典编码，唯一 */
                                code: string;
                                description: string | null;
                                sort_order: number | null;
                                is_active: boolean | null;
                                /** @description 字典项数量 */
                                item_count: number;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            };
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增字典项
         * @description 需要 system_dicts_add。标签、字典值不能为空，同一字典下字典值重复返回 400；is_default 为真时取消同字典其他默认项
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 字典标签（去除首尾空格后不能为空） */
                        label: string;
                        /** @description 字典值，同一字典内唯一 */
                        value: string;
                        /** @description 标签颜色，如 #1677ff */
                        color?: string | null;
                        /** @description 排序，缺省或 null 时为 0 */
                        sort_order?: number | null;
                        /** @description 是否默认项；设为 true 会取消同一字典其他项的默认；缺省或 null 时为 false */
                        is_default?: boolean | null;
                        /** @description 是否启用，缺省或 null 时为 true */
                        is_active?: boolean | null;
                        /** @description 备注 */
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            /** @description 所属字典 ID */
                            dict_type_id: number;
                            /** @description 字典标签 */
                            label: string;
                            /** @description 字典值，同一字典内唯一 */
                            value: string;
                            /** @description 标签颜色 */
                            color: string | null;
                            sort_order: number | null;
                            /** @description 是否默认项（同一字典至多一个） */
                            is_default: boolean | null;
                            is_active: boolean | null;
                            /** @description 备注 */
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 所属字典编码 */
                            dict_type_code: string;
                            /** @description 所属字典名称 */
                            dict_type_name: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/{dict_id}/items/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 导出字典项
         * @description 需要 system_dicts_export（只有查看权限不能导出）。导出该字典全部字典项（不受列表筛选影响），列为字典标签、字典值、标签颜色、排序、是否默认、是否启用、备注
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，默认 csv；其他值按 csv 处理 */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 表格文件（附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/{dict_id}/items/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入字典项
         * @description 需要 system_dicts_import（_add / _edit 不能代替）。必须有“字典标签”“字典值”列（也接受 label / value 等英文表头）；按字典值新增或更新，任一行标签或值为空则整批回滚并返回 400；标为默认的项会取消同字典其他默认项
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv 或 xlsx 文件，最大 5MB；不支持 .xls
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入结果 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /** @description 更新条数 */
                            updated: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件超过 BODY_LIMIT */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dicts/{dict_id}/items/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载字典项导入模板
         * @description 需要 system_dicts_import（与导入相同；只有查看权限不能下载）。模板含表头与一行示例
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，默认 csv；其他值按 csv 处理 */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path: {
                    /** @description 字典 ID */
                    dict_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 表格文件（附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 字典不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 文件列表
         * @description 需要 system_files
         */
        get: {
            parameters: {
                query?: {
                    page?: number;
                    per_page?: number;
                    /** @description 按文件名搜索 */
                    search?: string;
                    /** @description 文件类别：image 图片 / document 文档 / other 其他；空串或其他值不筛选 */
                    kind?: "image" | "document" | "other" | "";
                    /** @description 是否被业务记录引用；空串表示不筛选 */
                    referenced?: "yes" | "no" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                /** Format: uuid */
                                id: string;
                                original_name: string;
                                mime_type: string;
                                size: number;
                                sha256: string;
                                /** @enum {string} */
                                storage: "local" | "s3";
                                uploader_id: number | null;
                                uploader_name: string | null;
                                /** @description 被多少个业务字段引用 */
                                ref_count: number;
                                /** @description /api/admin/files/<id> */
                                url: string;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 上传文件
         * @description 只需登录。校验大小（系统设置的上传上限与 BODY_LIMIT 取小，超限 413）、扩展名白名单（系统设置的允许类型）以及文件头与扩展名是否一致；相同内容共用存储对象
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 已上传 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uuid */
                            id: string;
                            original_name: string;
                            mime_type: string;
                            size: number;
                            sha256: string;
                            /** @enum {string} */
                            storage: "local" | "s3";
                            uploader_id: number | null;
                            uploader_name: string | null;
                            /** @description 被多少个业务字段引用 */
                            ref_count: number;
                            /** @description /api/admin/files/<id> */
                            url: string;
                            /** Format: date-time */
                            created_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件过大 */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/files/{file_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 预览 / 下载文件
         * @description 只需登录。png / jpeg / gif / webp 内联显示，其余作为附件下载；?download=1 强制下载；ETag 命中返回 304。s3 驱动返回 302 到约 10 分钟有效的签名地址（或系统设置里的公开访问地址）
         */
        get: {
            parameters: {
                query?: {
                    download?: "1";
                };
                header?: never;
                path: {
                    /** @description 文件 ID */
                    file_id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 文件内容 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
                /** @description 跳转到存储服务 */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未修改 */
                304: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        /**
         * 删除文件
         * @description 需要 system_files_delete；被业务记录引用时返回 400
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 文件 ID */
                    file_id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/files/{file_id}/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 文件信息
         * @description 只需登录；包含引用位置
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 文件 ID */
                    file_id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uuid */
                            id: string;
                            original_name: string;
                            mime_type: string;
                            size: number;
                            sha256: string;
                            /** @enum {string} */
                            storage: "local" | "s3";
                            uploader_id: number | null;
                            uploader_name: string | null;
                            /** @description 被多少个业务字段引用 */
                            ref_count: number;
                            /** @description /api/admin/files/<id> */
                            url: string;
                            /** Format: date-time */
                            created_at: string | null;
                        } & {
                            references: {
                                ref_table: string;
                                ref_id: string;
                                ref_field: string;
                            }[];
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 登录
         * @description 公开，无需登录，也不需要 CSRF 头；每次都会新建会话并返回新的 csrf_token。开启两步验证后，已绑定的用户或所在角色要求两步验证的用户在密码正确时返回 mfa_required（verify：再调用「登录第二步」；setup：先绑定两步验证），此时尚未登录。缺少用户名或密码按密码错误处理（401）；账号停用返回 403；按 IP 与用户名统计的失败次数超限（演示环境只按 IP）或超过登录类接口每 IP 每分钟额度时返回 429。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 用户名 */
                        username: string;
                        /** @description 密码 */
                        password: string;
                    };
                };
            };
            responses: {
                /** @description 登录成功，或需要两步验证 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 提示信息 */
                            message: string;
                            /** @description 当前用户（无需两步验证时返回） */
                            user?: {
                                id: number;
                                /** @description 用户名 */
                                username: string;
                                /** @description 昵称 */
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                /** @description 头像地址 */
                                avatar: string | null;
                                /**
                                 * @description 账号状态
                                 * @enum {string}
                                 */
                                status: "active" | "disabled";
                                /** @description 所属部门 ID */
                                dept_id: number | null;
                                /** @description 所属部门名称 */
                                dept_name: string | null;
                                /**
                                 * Format: date-time
                                 * @description 上次登录时间
                                 */
                                last_login_at: string | null;
                                /** @description 上次登录 IP */
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 所属角色 */
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 拥有的菜单 / 按钮权限编码（去重，无固定顺序） */
                                menu_codes: string[];
                            };
                            /**
                             * @description 需要第二步时返回：verify 输入验证码；setup 先绑定两步验证
                             * @enum {string}
                             */
                            mfa_required?: "verify" | "setup";
                            /** @description 新会话的 CSRF 令牌 */
                            csrf_token: string;
                        };
                    };
                };
                /** @description 请求体格式错误（不是 JSON 对象） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用户名或密码错误 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 账号已停用；或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 登录失败次数过多，或请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/login/two-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 登录第二步：输入两步验证码
         * @description 登录返回 mfa_required=verify 后调用，使用登录时建立的待验证会话，并在 X-CSRF-Token 头带上登录响应里的 csrf_token。验证码与恢复码二选一（同时提供时只看恢复码）；同一时间步的验证码只能用一次，恢复码用后作废；错误计入登录失败锁定。成功后作废待验证会话并换发新会话与新的 csrf_token。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 身份验证器 App 上的 6 位验证码（允许前后一个周期，空格忽略） */
                        code?: string | null;
                        /** @description 恢复码（不区分大小写，忽略空格和连字符） */
                        recovery_code?: string | null;
                    };
                };
            };
            responses: {
                /** @description 登录成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 提示信息 */
                            message: string;
                            /** @description 当前用户 */
                            user: {
                                id: number;
                                /** @description 用户名 */
                                username: string;
                                /** @description 昵称 */
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                /** @description 头像地址 */
                                avatar: string | null;
                                /**
                                 * @description 账号状态
                                 * @enum {string}
                                 */
                                status: "active" | "disabled";
                                /** @description 所属部门 ID */
                                dept_id: number | null;
                                /** @description 所属部门名称 */
                                dept_name: string | null;
                                /**
                                 * Format: date-time
                                 * @description 上次登录时间
                                 */
                                last_login_at: string | null;
                                /** @description 上次登录 IP */
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 所属角色 */
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 拥有的菜单 / 按钮权限编码（去重，无固定顺序） */
                                menu_codes: string[];
                            };
                            /** @description 新会话的 CSRF 令牌 */
                            csrf_token: string;
                        };
                    };
                };
                /** @description 验证码错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 没有处于「输入验证码」步骤的会话，或账号已停用 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description CSRF 校验失败；或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 登录失败次数过多，或请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 退出登录
         * @description 不要求登录：有会话时撤销当前会话、清除会话 Cookie 并记录登出操作日志（此时需带 X-CSRF-Token 头），没有会话时同样返回成功。不接受 API Token。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 已退出登录 */
                            message: string;
                        };
                    };
                };
                /** @description CSRF 校验失败；或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logs/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 登录日志列表
         * @description 需要 system_logs。分页，按 ID 倒序
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码，默认 1 */
                    page?: number;
                    /** @description 每页条数，默认 20，最大 200 */
                    per_page?: number;
                    /** @description 按用户名模糊搜索 */
                    username?: string;
                    /** @description 登录结果，精确匹配；空串表示不筛选 */
                    status?: "success" | "failed" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                username: string;
                                /** @description 对应用户 ID（用户不存在时为 null） */
                                user_id: number | null;
                                /** @enum {string} */
                                status: "success" | "failed";
                                ip: string | null;
                                user_agent: string | null;
                                /** @description 说明 */
                                message: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logs/login/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出登录日志
         * @description 需要 system_logs_export（只有查看权限不能导出）。selected 模式导出勾选的日志（未勾选返回 400），filtered 模式按筛选条件导出全部；按 ID 升序
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description selected 导出勾选的 ids；filtered 按 filters 导出全部匹配（all 同 filtered）；缺省、null 或空串时为 selected
                         * @default selected
                         * @enum {string|null}
                         */
                        export_mode?: "selected" | "filtered" | "all" | null;
                        /** @description export_mode 为 selected 时必填且不能为空；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                        /** @description 导出列，按给定顺序；缺省、null、为空或全部无效时导出全部列 */
                        fields?: ("id" | "username" | "status" | "ip" | "user_agent" | "message" | "created_at")[] | null;
                        /** @description export_mode 为 filtered 时的筛选条件 */
                        filters?: {
                            /** @description 用户名，模糊匹配 */
                            username?: string | null;
                            /**
                             * @description 登录结果，精确匹配；空串或 null 表示全部
                             * @enum {string|null}
                             */
                            status?: "success" | "failed" | "" | null;
                        } | null;
                        /**
                         * @description 文件格式，缺省或其他值按 csv
                         * @default csv
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 表格文件（附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未勾选要导出的日志 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logs/operation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 操作日志列表
         * @description 需要 system_logs。分页，按 ID 倒序；操作日志由全局钩子自动记录已登录用户对 /api/admin/ 的 POST / PUT / DELETE 请求（不含日志模块自身和登录）
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码，默认 1 */
                    page?: number;
                    /** @description 每页条数，默认 20，最大 200 */
                    per_page?: number;
                    /** @description 按用户名模糊搜索 */
                    username?: string;
                    /** @description 模块，精确匹配，如 users */
                    module?: string;
                    /** @description 操作，精确匹配，如 create / update / delete / import / export */
                    action?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                username: string;
                                user_id: number | null;
                                /** @description 模块（路径 /api/admin/ 后第一段） */
                                module: string;
                                /** @description 操作：create / update / delete / import / export / logout / change_password 等 */
                                action: string;
                                method: string;
                                path: string;
                                /** @description 路径末段为数字时记录为目标 ID */
                                target_id: string | null;
                                /** @description 请求体（敏感字段已脱敏） */
                                payload: string | null;
                                ip: string | null;
                                user_agent: string | null;
                                status_code: number | null;
                                /** @description 通过 API 令牌调用时的令牌 ID */
                                api_token_id: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logs/operation/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出操作日志
         * @description 需要 system_logs_export（只有查看权限不能导出）。selected 模式导出勾选的日志（未勾选返回 400），filtered 模式按筛选条件导出全部；按 ID 升序
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description selected 导出勾选的 ids；filtered 按 filters 导出全部匹配（all 同 filtered）；缺省、null 或空串时为 selected
                         * @default selected
                         * @enum {string|null}
                         */
                        export_mode?: "selected" | "filtered" | "all" | null;
                        /** @description export_mode 为 selected 时必填且不能为空；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                        /** @description 导出列，按给定顺序；缺省、null、为空或全部无效时导出全部列 */
                        fields?: ("id" | "username" | "module" | "action" | "method" | "path" | "target_id" | "status_code" | "ip" | "user_agent" | "payload" | "created_at")[] | null;
                        /** @description export_mode 为 filtered 时的筛选条件 */
                        filters?: {
                            /** @description 用户名，模糊匹配 */
                            username?: string | null;
                            /** @description 精确匹配 */
                            module?: string | null;
                            /** @description 精确匹配 */
                            action?: string | null;
                        } | null;
                        /**
                         * @description 文件格式，缺省或其他值按 csv
                         * @default csv
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 表格文件（附件下载） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未勾选要导出的日志 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取当前登录用户
         * @description 登录即可。返回当前用户（含角色、权限编码、部门名称）和当前会话的 CSRF 令牌；页面刷新后用它恢复登录状态。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 当前用户 */
                            user: {
                                id: number;
                                /** @description 用户名 */
                                username: string;
                                /** @description 昵称 */
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                /** @description 头像地址 */
                                avatar: string | null;
                                /**
                                 * @description 账号状态
                                 * @enum {string}
                                 */
                                status: "active" | "disabled";
                                /** @description 所属部门 ID */
                                dept_id: number | null;
                                /** @description 所属部门名称 */
                                dept_name: string | null;
                                /**
                                 * Format: date-time
                                 * @description 上次登录时间
                                 */
                                last_login_at: string | null;
                                /** @description 上次登录 IP */
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 所属角色 */
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 拥有的菜单 / 按钮权限编码（去重，无固定顺序） */
                                menu_codes: string[];
                            };
                            /** @description CSRF 令牌 */
                            csrf_token: string;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 菜单列表
         * @description 需要 system_menus；默认返回菜单树（按 sort_order 排序），带 search 时保留命中节点的完整子树及其祖先路径；format 为其他值时返回不带 children 的平铺列表。
         */
        get: {
            parameters: {
                query?: {
                    /** @description tree（默认）返回树；其他任意值（如 flat）返回平铺列表 */
                    format?: string;
                    /** @description 按菜单名称、编码模糊搜索 */
                    search?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功（数组；tree 模式每项带 children） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            icon: string | null;
                            path: string | null;
                            component: string | null;
                            parent_id: number | null;
                            sort_order: number | null;
                            is_visible: boolean | null;
                            is_active: boolean | null;
                            /** @description directory / menu / button */
                            menu_type: string | null;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 子菜单（按 sort_order 排序，递归） */
                            children: {
                                [key: string]: unknown;
                            }[];
                        }[];
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增菜单
         * @description 需要 system_menus_add；名称和编码必填，编码唯一（重复返回 400）；返回的菜单不含 children。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 菜单名称 */
                        name: string;
                        /** @description 菜单编码（权限码），唯一 */
                        code: string;
                        /**
                         * @description 类型：directory / menu / button，缺省、null 或空串时为 menu；其他值返回 400「菜单类型只能是 directory、menu 或 button」
                         * @enum {string|null}
                         */
                        menu_type?: "directory" | "menu" | "button" | null;
                        icon?: string | null;
                        /** @description 前端路由路径 */
                        path?: string | null;
                        /** @description 前端组件，格式 <module>/<subdir>/<page> */
                        component?: string | null;
                        /** @description 父菜单 ID，null 为顶级 */
                        parent_id?: number | null;
                        /** @description 排序，缺省或 null 时为 0 */
                        sort_order?: number | null;
                        /** @description 是否在侧边栏显示，缺省或 null 时为 true */
                        is_visible?: boolean | null;
                        /** @description 是否启用，缺省或 null 时为 true */
                        is_active?: boolean | null;
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            icon: string | null;
                            path: string | null;
                            component: string | null;
                            parent_id: number | null;
                            sort_order: number | null;
                            is_visible: boolean | null;
                            is_active: boolean | null;
                            /** @description directory / menu / button */
                            menu_type: string | null;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出菜单
         * @description 需要 system_menus_export（只有查看权限不能导出）；按 sort_order、id 排序导出，父级以父级编码输出。selected 模式未勾选时返回 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description selected 导出勾选的 ids；filtered 按 filters 导出全部匹配数据（all 同 filtered）；缺省、null 或空串时为 selected
                         * @default selected
                         * @enum {string|null}
                         */
                        export_mode?: "selected" | "filtered" | "all" | null;
                        /** @description selected 模式必填且不能为空；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                        /** @description 导出列，缺省、null、为空或全部无效时导出所有列 */
                        fields?: ("id" | "name" | "code" | "menu_type" | "path" | "component" | "icon" | "parent_code" | "sort_order" | "is_visible" | "is_active" | "description")[] | null;
                        /** @description filtered 模式的筛选条件 */
                        filters?: {
                            /** @description 按菜单名称、编码模糊搜索 */
                            search?: string | null;
                        } | null;
                        /**
                         * @description 文件格式，缺省或其他值按 csv
                         * @default csv
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 文件内容（menus_export.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入菜单
         * @description 需要 system_menus_import（_add / _edit 不能代替）；按菜单编码新增或更新，类型限 directory / menu / button，父级编码须存在于库中或本文件，且不能指向自身或成环。任一行出错整批回滚，400 响应带 error_rows（最多 500 条）和 error_count。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv / xlsx 文件，最大 5MB
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /** @description 更新条数 */
                            updated: number;
                        };
                    };
                };
                /** @description 文件不合法或存在错误数据（响应含 error_rows、error_count） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件过大 */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载菜单导入模板
         * @description 需要 system_menus_import（与导入相同；只有查看权限不能下载）；返回带表头（菜单名称、菜单编码、类型、路径、组件、图标、父级编码、排序、是否显示、是否启用、描述）和一行示例的模板文件。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，缺省或其他值按 csv */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 模板文件（menus_import_template.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus/{menu_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 菜单详情
         * @description 需要 system_menus；先校验权限再查菜单；返回该菜单及其完整子树。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 菜单 ID */
                    menu_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            icon: string | null;
                            path: string | null;
                            component: string | null;
                            parent_id: number | null;
                            sort_order: number | null;
                            is_visible: boolean | null;
                            is_active: boolean | null;
                            /** @description directory / menu / button */
                            menu_type: string | null;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 子菜单（按 sort_order 排序，递归） */
                            children: {
                                [key: string]: unknown;
                            }[];
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 菜单不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑菜单
         * @description 需要 system_menus_edit；先校验权限再查菜单。只更新请求里出现且有变化的字段（无变化时原样返回、不更新 updated_at）；name / code 出现时不能为空，编码不能与其他菜单重复，父菜单不能是自身或其子菜单。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 菜单 ID */
                    menu_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 菜单名称 */
                        name?: string;
                        /** @description 菜单编码（权限码），唯一 */
                        code?: string;
                        /**
                         * @description 类型：directory / menu / button，null 或空串时为 menu；其他值返回 400「菜单类型只能是 directory、menu 或 button」
                         * @enum {string|null}
                         */
                        menu_type?: "directory" | "menu" | "button" | null;
                        icon?: string | null;
                        /** @description 前端路由路径 */
                        path?: string | null;
                        /** @description 前端组件，格式 <module>/<subdir>/<page> */
                        component?: string | null;
                        /** @description 父菜单 ID，null 为顶级 */
                        parent_id?: number | null;
                        /** @description 排序，null 时为 0 */
                        sort_order?: number | null;
                        /** @description 是否在侧边栏显示，null 时为 true */
                        is_visible?: boolean | null;
                        /** @description 是否启用，null 时为 true */
                        is_active?: boolean | null;
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 成功（不含 children） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            icon: string | null;
                            path: string | null;
                            component: string | null;
                            parent_id: number | null;
                            sort_order: number | null;
                            is_visible: boolean | null;
                            is_active: boolean | null;
                            /** @description directory / menu / button */
                            menu_type: string | null;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 菜单不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除菜单
         * @description 需要 system_menus_delete；先校验权限再查菜单；还有子菜单时不能删除（400）；角色上的该菜单授权一并移除。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 菜单 ID */
                    menu_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 菜单不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/menus/{menu_id}/sort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 调整菜单顺序
         * @description 需要 system_menus_edit；先校验权限再查菜单。与同级相邻菜单交换位置，并把同级 sort_order 重排为 10、20、30…；已在最前 / 最后或同级只有一个时 changed 为 false。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 菜单 ID */
                    menu_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description 上移 / 下移（不区分大小写）
                         * @enum {string}
                         */
                        direction: "up" | "down";
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 是否真的调整了顺序 */
                            changed: boolean;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 菜单不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/my-menus": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 当前用户菜单
         * @description 登录即可；返回当前用户角色所授权、且启用并显示的菜单，再补上它们的祖先，组成树（按 sort_order、id 排序）。超级管理员也只看实际授权的菜单；叶子节点没有 children 字段。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            icon: string | null;
                            path: string | null;
                            component: string | null;
                            parent_id: number | null;
                            sort_order: number | null;
                            is_visible: boolean | null;
                            is_active: boolean | null;
                            /** @description directory / menu / button */
                            menu_type: string | null;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 子菜单（叶子节点无此字段） */
                            children: {
                                [key: string]: unknown;
                            }[];
                        }[];
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的通知列表
         * @description 登录即可。只返回当前用户可见的通知（全员通知或发给自己的定向通知），按创建时间倒序，并标出当前用户是否已读。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数（最大 200） */
                    per_page?: number;
                    /** @description 已读筛选：true 已读 / false 未读；all、空串或其他值不筛选 */
                    is_read?: "all" | "true" | "false" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                title: string;
                                content: string | null;
                                /** @enum {string} */
                                noti_type: "info" | "warning" | "success" | "error";
                                /** @description 跳转链接 */
                                link: string | null;
                                /** @description 是否全员通知 */
                                is_global: boolean | null;
                                /** @description 定向通知的接收用户 ID，全员通知为 null */
                                user_id: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** @description 当前用户是否已读 */
                                is_read: boolean;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 当前登录用户已不存在（用户不存在） */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新建通知
         * @description 需要 system_notifications_add。is_global 默认 true（全员可见）；设为 false 时发给 user_id 指定的用户（未传 user_id 则无人可见）；is_global 为 false 时必须指定存在的 user_id，否则 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 标题（去掉首尾空格后不能为空） */
                        title: string;
                        /** @description 内容，空值存为空字符串 */
                        content?: string | null;
                        /**
                         * @description 通知类型：info / warning / success / error，缺省、null 或空串时为 info；其他值返回 400「通知类型的值无效」
                         * @default info
                         * @enum {string|null}
                         */
                        noti_type?: "info" | "warning" | "success" | "error" | null;
                        /** @description 点击跳转的链接 */
                        link?: string | null;
                        /**
                         * @description 是否全员通知，缺省或 null 时为 true
                         * @default true
                         */
                        is_global?: boolean | null;
                        /** @description 接收用户 ID，仅 is_global 为 false 时使用 */
                        user_id?: number | null;
                    };
                };
            };
            responses: {
                /** @description 已创建（is_read 固定为 false） */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            title: string;
                            content: string | null;
                            /** @enum {string} */
                            noti_type: "info" | "warning" | "success" | "error";
                            /** @description 跳转链接 */
                            link: string | null;
                            /** @description 是否全员通知 */
                            is_global: boolean | null;
                            /** @description 定向通知的接收用户 ID，全员通知为 null */
                            user_id: number | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** @description 当前用户是否已读 */
                            is_read: boolean;
                        };
                    };
                };
                /** @description 标题不能为空 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限创建通知 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 当前登录用户已不存在（用户不存在） */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 创建通知失败 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 全部标为已读
         * @description 登录即可。把当前用户可见的所有未读通知标为已读，返回本次标记的条数。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            success: true;
                            /** @description 本次标记为已读的条数 */
                            marked: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 当前登录用户已不存在（用户不存在） */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 未读通知数
         * @description 登录即可。统计当前用户可见且未读的通知数；当前用户已不存在时返回 0。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 未读数 */
                            count: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/{noti_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除通知
         * @description 登录即可删除发给自己的定向通知；删除全员通知需要 system_notifications_delete。删除的是通知本身，所有人都看不到了；不可见的通知返回 404。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 通知 ID */
                    noti_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            success: true;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限删除全局通知 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 通知不存在或无权限（含当前用户已不存在） */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/{noti_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 标记通知已读
         * @description 登录即可。只能标记自己可见的通知；已读的再次调用直接返回成功（幂等）。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 通知 ID */
                    noti_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            success: true;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 通知不存在或无权限（含当前用户已不存在） */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/password-reset/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 找回密码：设置新密码
         * @description 公开，无需登录；与登录类接口共用每 IP 每分钟额度。需系统设置已开启找回密码（且已配置 SMTP 与网站地址）；token 来自重置邮件链接，30 分钟内有效、只能用一次；新密码按密码规则校验。成功后该用户所有会话下线，两步验证不会因此跳过。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 重置邮件链接里的 token */
                        token: string;
                        /** @description 新密码（按系统设置的密码规则校验） */
                        new_password: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 密码已重置，请使用新密码登录 */
                            message: string;
                        };
                    };
                };
                /** @description 找回密码功能未开启、信息不完整、新密码不符合密码规则，或重置链接无效 / 已过期 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/password-reset/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 找回密码：发送重置邮件
         * @description 公开，无需登录；与登录类接口共用每 IP 每分钟额度。需系统设置已开启找回密码（且已配置 SMTP 与网站地址）。无论邮箱是否属于某个启用中的账号（不区分大小写匹配）都返回同一提示，邮件在后台发送；邮件语言跟随 Accept-Language，链接 30 分钟内有效、只能用一次，新申请会使旧链接作废。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * Format: email
                         * @description 账号绑定的邮箱（必须包含 @）
                         */
                        email: string;
                    };
                };
            };
            responses: {
                /** @description 已受理 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 如果该邮箱属于某个账号，重置链接已发送，请查收邮件 */
                            message: string;
                        };
                    };
                };
                /** @description 找回密码功能未开启，或邮箱格式不正确 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 修改个人资料
         * @description 当前登录用户修改自己的昵称、邮箱、手机、头像；只传需要修改的字段，空字符串表示清空
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        nickname?: string | null;
                        /** Format: email */
                        email?: string | null;
                        phone?: string | null;
                        /** @description http(s):// 或 / 开头的图片地址 */
                        avatar?: string | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            user: {
                                id: number;
                                username: string;
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                avatar: string | null;
                                /** @enum {string} */
                                status: "active" | "disabled";
                                dept_id: number | null;
                                dept_name: string | null;
                                /** Format: date-time */
                                last_login_at: string | null;
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 所有角色授权菜单编码（去重） */
                                menu_codes: string[];
                            };
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/api-tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的 API Token
         * @description 只需登录（不接受 API Token）。enabled 表示系统设置里是否允许使用 API Token
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            enabled: boolean;
                            items: {
                                id: number;
                                name: string;
                                /** @description ck_ + 8 位，用于辨认 */
                                token_prefix: string;
                                scopes: string[];
                                /** Format: date-time */
                                expires_at: string | null;
                                /** Format: date-time */
                                last_used_at: string | null;
                                last_used_ip: string | null;
                                created_by: number;
                                creator_username: string | null;
                                creator_nickname: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                revoked_at: string | null;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 创建 API Token
         * @description 只需登录（不接受 API Token），需要 10 分钟内验证过身份；系统设置里需开启。scopes 只能是自己拥有的权限编码；每人最多 20 个有效 token。token 明文只在这里返回一次
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        scopes: string[];
                        /** @description null = 永不过期 */
                        expires_in_days: number | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description ck_...，只返回这一次 */
                            token: string;
                            item: {
                                id: number;
                                name: string;
                                /** @description ck_ + 8 位，用于辨认 */
                                token_prefix: string;
                                scopes: string[];
                                /** Format: date-time */
                                expires_at: string | null;
                                /** Format: date-time */
                                last_used_at: string | null;
                                last_used_ip: string | null;
                                created_by: number;
                                creator_username: string | null;
                                creator_nickname: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                revoked_at: string | null;
                            };
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/api-tokens/scopes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 可授予的权限
         * @description 只需登录（不接受 API Token）；自己拥有的菜单 / 按钮权限（grantable=true），附带上级目录便于显示成树
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                parent_id: number | null;
                                code: string;
                                name: string;
                                menu_type: string;
                                grantable: boolean;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/api-tokens/{token_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 吊销我的 API Token
         * @description 只需登录（不接受 API Token）；立即失效
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description token ID */
                    token_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的登录设备
         * @description 只需登录；当前用户自己的有效会话
         */
        get: {
            parameters: {
                query?: {
                    page?: number;
                    per_page?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                /** @description 会话标识（强制下线时使用；不能当作 cookie） */
                                key: string;
                                user_id: number;
                                username: string | null;
                                nickname: string | null;
                                ip: string | null;
                                user_agent: string | null;
                                /**
                                 * Format: date-time
                                 * @description 登录时间
                                 */
                                created_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 最近活动时间（每分钟最多刷新一次）
                                 */
                                last_seen_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 到期时间（滑动续期）
                                 */
                                expires_at: string | null;
                                /** @description 是否为发起本次请求的会话 */
                                current: boolean;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/sessions/revoke-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 下线我的其他设备
         * @description 登录即可，不接受 API Token。撤销当前用户除本次请求所用会话以外的全部会话，其他设备需重新登录。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 已下线其他设备 */
                            message: string;
                            /** @description 下线的会话数 */
                            revoked: number;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description CSRF 校验失败；或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/profile/sessions/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 下线我的某个设备
         * @description 只需登录；只能下线自己的其他会话
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 会话标识（列表里的 key） */
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 会话不存在或已失效 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/reauth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 验证身份（敏感修改前）
         * @description 只需登录；与登录类接口共用每 IP 限流。敏感修改（保存系统设置、系统设置的测试按钮）要求 10 分钟内登录过或验证过身份，否则返回 403 { error, reauth_required: true }。提交当前密码；已开启两步验证的用户还要提交验证码或恢复码（缺少时返回 400 且 mfa_required: true）。失败计入登录失败锁定
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        password: string;
                        /** @description 6 位验证码 */
                        code?: string | null;
                        /** @description 恢复码 */
                        recovery_code?: string | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 密码或验证码错误；需要验证码时带 mfa_required: true */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁，或登录失败次数过多 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 角色列表
         * @description 需要 system_roles；不分页，返回全部角色及其菜单权限、数据范围。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /**
                             * @description 数据范围：全部数据 / 本部门及下级 / 本部门 / 仅本人 / 自定义部门
                             * @enum {string}
                             */
                            data_scope: "all" | "dept_and_children" | "dept" | "self" | "custom";
                            /** @description 自定义数据范围的部门 ID（data_scope 不是 custom 时为空数组） */
                            dept_ids: number[];
                            /** @description 已授权菜单 ID，按 sort_order、id 排序 */
                            menu_ids: number[];
                            /** @description 已授权菜单（精简字段） */
                            menus: {
                                id: number;
                                name: string;
                                code: string;
                                parent_id: number | null;
                                menu_type: string | null;
                            }[];
                        }[];
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增角色
         * @description 需要 system_roles_add；名称和编码必填，编码唯一；成功后触发 role.created 事件。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 角色名称 */
                        name: string;
                        /** @description 角色编码，唯一 */
                        code: string;
                        description?: string | null;
                        /**
                         * @description 数据范围，缺省、null 或空串时为 all
                         * @enum {string|null}
                         */
                        data_scope?: "all" | "dept_and_children" | "dept" | "self" | "custom" | null;
                        /** @description 自定义部门（仅 data_scope 为 custom 时生效，部门须存在）；缺省或 null 视为空列表 */
                        dept_ids?: number[] | null;
                        /** @description 授权菜单 ID，整体替换；不存在的 ID 会被忽略；缺省或 null 视为空列表 */
                        menu_ids?: number[] | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /**
                             * @description 数据范围：全部数据 / 本部门及下级 / 本部门 / 仅本人 / 自定义部门
                             * @enum {string}
                             */
                            data_scope: "all" | "dept_and_children" | "dept" | "self" | "custom";
                            /** @description 自定义数据范围的部门 ID（data_scope 不是 custom 时为空数组） */
                            dept_ids: number[];
                            /** @description 已授权菜单 ID，按 sort_order、id 排序 */
                            menu_ids: number[];
                            /** @description 已授权菜单（精简字段） */
                            menus: {
                                id: number;
                                name: string;
                                code: string;
                                parent_id: number | null;
                                menu_type: string | null;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出角色
         * @description 需要 system_roles_export（只有查看权限不能导出）；按 ID 正序导出。selected 模式未勾选时返回 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description selected 导出勾选的 ids；filtered 按 filters 导出全部匹配数据（all 同 filtered）；缺省、null 或空串时为 selected
                         * @default selected
                         * @enum {string|null}
                         */
                        export_mode?: "selected" | "filtered" | "all" | null;
                        /** @description selected 模式必填且不能为空；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                        /** @description 导出列，缺省、null、为空或全部无效时导出所有列 */
                        fields?: ("id" | "name" | "code" | "description" | "data_scope" | "dept_codes" | "menu_codes" | "menu_names" | "created_at")[] | null;
                        /** @description filtered 模式的筛选条件 */
                        filters?: {
                            /** @description 按角色名称、编码模糊搜索 */
                            search?: string | null;
                        } | null;
                        /**
                         * @description 文件格式，缺省或其他值按 csv
                         * @default csv
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 文件内容（roles_export.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入角色
         * @description 需要 system_roles_import（_add / _edit 不能代替）；按角色编码新增或更新，菜单编码 / 部门编码须存在，数据范围可填编码或中文名称；super_admin 的菜单和数据范围不能改。任一行出错整批回滚，400 响应带 error_rows（最多 500 条）和 error_count。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv / xlsx 文件，最大 5MB
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /** @description 更新条数 */
                            updated: number;
                        };
                    };
                };
                /** @description 文件不合法或存在错误数据（响应含 error_rows、error_count） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件过大 */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载角色导入模板
         * @description 需要 system_roles_import（与导入相同；只有查看权限不能下载）；返回带表头（角色名称、角色编码、描述、数据范围、部门编码、菜单编码）和一行示例的模板文件。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，缺省或其他值按 csv */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 模板文件（roles_import_template.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles/{role_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑角色
         * @description 需要 system_roles_edit；先校验权限再查角色。只更新请求里出现的字段，menu_ids 整体替换授权菜单；data_scope 改为非 custom 时清空自定义部门。super_admin 角色只能改名称和描述（编码、数据范围、菜单固定）；成功后触发 role.updated 事件。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 角色 ID */
                    role_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 角色名称 */
                        name?: string;
                        /** @description 角色编码，唯一 */
                        code?: string;
                        description?: string | null;
                        /**
                         * @description 数据范围，null 或空串时为 all
                         * @enum {string|null}
                         */
                        data_scope?: "all" | "dept_and_children" | "dept" | "self" | "custom" | null;
                        /** @description 自定义部门（仅 data_scope 为 custom 时生效，部门须存在）；null 视为空列表 */
                        dept_ids?: number[] | null;
                        /** @description 授权菜单 ID，整体替换；不存在的 ID 会被忽略；null 视为空列表（清空授权） */
                        menu_ids?: number[] | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            code: string;
                            description: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /**
                             * @description 数据范围：全部数据 / 本部门及下级 / 本部门 / 仅本人 / 自定义部门
                             * @enum {string}
                             */
                            data_scope: "all" | "dept_and_children" | "dept" | "self" | "custom";
                            /** @description 自定义数据范围的部门 ID（data_scope 不是 custom 时为空数组） */
                            dept_ids: number[];
                            /** @description 已授权菜单 ID，按 sort_order、id 排序 */
                            menu_ids: number[];
                            /** @description 已授权菜单（精简字段） */
                            menus: {
                                id: number;
                                name: string;
                                code: string;
                                parent_id: number | null;
                                menu_type: string | null;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 角色不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除角色
         * @description 需要 system_roles_delete；super_admin 角色不能删除（400）；删除后用户与该角色的关联一并移除，触发 role.deleted 事件。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 角色 ID */
                    role_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 角色不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/scheduled-tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 定时任务列表
         * @description 需要 system_scheduled_tasks。按 ID 倒序。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数（最大 200） */
                    per_page?: number;
                    /** @description 按任务名称、任务编码、请求地址模糊搜索 */
                    search?: string;
                    /** @description 按最近状态（last_status）精确筛选；空串表示不筛选 */
                    status?: "idle" | "running" | "success" | "failed" | "";
                    /** @description 按启用状态筛选：true/false（也接受 1/0、yes/no、on/off、是/否、启用/停用），无法识别时不筛选 */
                    is_active?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                name: string;
                                /** @description 任务编码（唯一） */
                                task_code: string;
                                /** @description 5 段 Cron：分 时 日 月 周 */
                                cron_expression: string;
                                /** @enum {string|null} */
                                request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                                request_url: string;
                                /** @description 请求头（JSON 对象字符串） */
                                request_headers: string | null;
                                /** @description 请求体原文 */
                                request_body: string | null;
                                /** @description 超时秒数（1–120） */
                                timeout_seconds: number | null;
                                /** @description 是否启用 */
                                is_active: boolean | null;
                                remark: string | null;
                                /**
                                 * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                                 * @enum {string|null}
                                 */
                                last_status: "idle" | "running" | "success" | "failed" | null;
                                /** @description 最近一次错误信息 */
                                last_error: string | null;
                                /** @description 最近一次耗时（毫秒） */
                                last_duration_ms: number | null;
                                /** @description 累计执行次数 */
                                run_count: number | null;
                                /**
                                 * Format: date-time
                                 * @description 最近执行时间（UTC）
                                 */
                                last_run_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 下次执行时间（UTC），停用时为 null
                                 */
                                next_run_at: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限查看定时任务列表 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增定时任务
         * @description 需要 system_scheduled_tasks_add。校验顺序：名称、编码、Cron 非空 → 请求地址（协议与内网地址拦截）→ 请求方法 → 编码唯一 → Cron 语法 → 请求头 JSON；启用时按当前 UTC 时间计算 next_run_at。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 任务名称，不能为空 */
                        name: string;
                        /** @description 任务编码，不能为空且唯一 */
                        task_code: string;
                        /** @description 5 段 Cron 表达式：分 时 日 月 周（如 *\/5 * * * *），一年内必须有触发时间 */
                        cron_expression: string;
                        /**
                         * @description 请求方法，不区分大小写；缺省、null 或空串时为 GET
                         * @default GET
                         * @enum {string|null}
                         */
                        request_method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                        /** @description 目标地址：只支持 http/https，不能指向内网或保留地址（域名会解析后逐个检查） */
                        request_url: string;
                        /** @description 请求头：JSON 对象或 JSON 对象字符串，空值表示无请求头 */
                        request_headers?: {
                            [key: string]: unknown;
                        } | string | null;
                        /** @description 请求体原文；执行时能解析为 JSON 对象 / 数组则按 JSON 发送，否则按文本发送 */
                        request_body?: string | null;
                        /**
                         * @description 超时秒数，超出范围自动截到 1–120；缺省或 null 时为 10
                         * @default 10
                         */
                        timeout_seconds?: number | null;
                        /**
                         * @description 是否启用（true / false），缺省或 null 时为 true
                         * @default true
                         */
                        is_active?: boolean | null;
                        /** @description 备注 */
                        remark?: string | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            /** @description 任务编码（唯一） */
                            task_code: string;
                            /** @description 5 段 Cron：分 时 日 月 周 */
                            cron_expression: string;
                            /** @enum {string|null} */
                            request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                            request_url: string;
                            /** @description 请求头（JSON 对象字符串） */
                            request_headers: string | null;
                            /** @description 请求体原文 */
                            request_body: string | null;
                            /** @description 超时秒数（1–120） */
                            timeout_seconds: number | null;
                            /** @description 是否启用 */
                            is_active: boolean | null;
                            remark: string | null;
                            /**
                             * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                             * @enum {string|null}
                             */
                            last_status: "idle" | "running" | "success" | "failed" | null;
                            /** @description 最近一次错误信息 */
                            last_error: string | null;
                            /** @description 最近一次耗时（毫秒） */
                            last_duration_ms: number | null;
                            /** @description 累计执行次数 */
                            run_count: number | null;
                            /**
                             * Format: date-time
                             * @description 最近执行时间（UTC）
                             */
                            last_run_at: string | null;
                            /**
                             * Format: date-time
                             * @description 下次执行时间（UTC），停用时为 null
                             */
                            next_run_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 参数不合法（如任务编码已存在、Cron 表达式格式错误、不允许访问内网地址、请求头 JSON 格式不合法） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限新增定时任务 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/scheduled-tasks/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 执行记录列表
         * @description 需要 system_scheduled_tasks。包含定时触发与手动执行的记录，按 ID 倒序；每条带上所属任务的名称与编码。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数（最大 200） */
                    per_page?: number;
                    /** @description 只看某个任务的记录；0 或无法解析时不筛选 */
                    task_id?: number;
                    /** @description 按执行结果精确筛选；空串表示不筛选 */
                    status?: "success" | "failed" | "";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                task_id: number;
                                task_name: string | null;
                                task_code: string | null;
                                /**
                                 * @description scheduled 定时触发 / manual 手动执行
                                 * @enum {string|null}
                                 */
                                trigger_type: "scheduled" | "manual" | null;
                                /** @enum {string} */
                                status: "success" | "failed";
                                /** @description 目标接口返回的 HTTP 状态码 */
                                response_status: number | null;
                                /** @description 响应内容（最多 2000 字符） */
                                response_body: string | null;
                                error_message: string | null;
                                /** Format: date-time */
                                started_at: string | null;
                                /** Format: date-time */
                                finished_at: string | null;
                                /** @description 耗时（毫秒） */
                                duration_ms: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限查看执行记录 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/scheduled-tasks/{task_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 定时任务详情
         * @description 需要 system_scheduled_tasks。先校验权限再查任务：没有权限时返回 403，有权限但任务不存在返回 404。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 任务 ID */
                    task_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            /** @description 任务编码（唯一） */
                            task_code: string;
                            /** @description 5 段 Cron：分 时 日 月 周 */
                            cron_expression: string;
                            /** @enum {string|null} */
                            request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                            request_url: string;
                            /** @description 请求头（JSON 对象字符串） */
                            request_headers: string | null;
                            /** @description 请求体原文 */
                            request_body: string | null;
                            /** @description 超时秒数（1–120） */
                            timeout_seconds: number | null;
                            /** @description 是否启用 */
                            is_active: boolean | null;
                            remark: string | null;
                            /**
                             * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                             * @enum {string|null}
                             */
                            last_status: "idle" | "running" | "success" | "failed" | null;
                            /** @description 最近一次错误信息 */
                            last_error: string | null;
                            /** @description 最近一次耗时（毫秒） */
                            last_duration_ms: number | null;
                            /** @description 累计执行次数 */
                            run_count: number | null;
                            /**
                             * Format: date-time
                             * @description 最近执行时间（UTC）
                             */
                            last_run_at: string | null;
                            /**
                             * Format: date-time
                             * @description 下次执行时间（UTC），停用时为 null
                             */
                            next_run_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限查看定时任务 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 任务不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 编辑定时任务
         * @description 需要 system_scheduled_tasks_edit（先校验权限再查任务，不存在时返回 404）。只更新请求体里出现的字段，校验规则同新增；每次保存都按当前时间重新计算 next_run_at（停用时置空），没有变化时不写库。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 任务 ID */
                    task_id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description 任务名称，不能为空 */
                        name?: string;
                        /** @description 任务编码，不能为空且唯一 */
                        task_code?: string;
                        /** @description 5 段 Cron 表达式：分 时 日 月 周（如 *\/5 * * * *），一年内必须有触发时间 */
                        cron_expression?: string;
                        /**
                         * @description 请求方法，不区分大小写；null 或空串时为 GET
                         * @enum {string|null}
                         */
                        request_method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                        /** @description 目标地址：只支持 http/https，不能指向内网或保留地址（域名会解析后逐个检查） */
                        request_url?: string;
                        /** @description 请求头：JSON 对象或 JSON 对象字符串，空值表示无请求头 */
                        request_headers?: {
                            [key: string]: unknown;
                        } | string | null;
                        /** @description 请求体原文；执行时能解析为 JSON 对象 / 数组则按 JSON 发送，否则按文本发送 */
                        request_body?: string | null;
                        /** @description 超时秒数，超出范围自动截到 1–120；null 时为 10 */
                        timeout_seconds?: number | null;
                        /** @description 是否启用（true / false），null 时为 true */
                        is_active?: boolean | null;
                        /** @description 备注 */
                        remark?: string | null;
                    };
                };
            };
            responses: {
                /** @description 成功，返回更新后的任务 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            /** @description 任务编码（唯一） */
                            task_code: string;
                            /** @description 5 段 Cron：分 时 日 月 周 */
                            cron_expression: string;
                            /** @enum {string|null} */
                            request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                            request_url: string;
                            /** @description 请求头（JSON 对象字符串） */
                            request_headers: string | null;
                            /** @description 请求体原文 */
                            request_body: string | null;
                            /** @description 超时秒数（1–120） */
                            timeout_seconds: number | null;
                            /** @description 是否启用 */
                            is_active: boolean | null;
                            remark: string | null;
                            /**
                             * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                             * @enum {string|null}
                             */
                            last_status: "idle" | "running" | "success" | "failed" | null;
                            /** @description 最近一次错误信息 */
                            last_error: string | null;
                            /** @description 最近一次耗时（毫秒） */
                            last_duration_ms: number | null;
                            /** @description 累计执行次数 */
                            run_count: number | null;
                            /**
                             * Format: date-time
                             * @description 最近执行时间（UTC）
                             */
                            last_run_at: string | null;
                            /**
                             * Format: date-time
                             * @description 下次执行时间（UTC），停用时为 null
                             */
                            next_run_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                        };
                    };
                };
                /** @description 参数不合法（如任务编码已存在、Cron 表达式格式错误、不允许访问内网地址） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限编辑定时任务 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 任务不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除定时任务
         * @description 需要 system_scheduled_tasks_delete（先校验权限再查任务，不存在时返回 404）。任务的执行记录随之级联删除。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 任务 ID */
                    task_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @example 删除成功 */
                            message: string;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限删除定时任务 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 任务不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/scheduled-tasks/{task_id}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 立即执行定时任务
         * @description 需要 system_scheduled_tasks_run（先校验权限再查任务）。同步发起一次请求并写入 manual 执行记录，同时更新任务的最近状态、执行次数和 next_run_at；目标接口请求失败或返回 4xx/5xx 时返回 500，但响应体仍是完整的执行结果。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 任务 ID */
                    task_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 执行成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 执行成功 / 执行失败（按 Accept-Language 翻译） */
                            message: string;
                            task: {
                                id: number;
                                name: string;
                                /** @description 任务编码（唯一） */
                                task_code: string;
                                /** @description 5 段 Cron：分 时 日 月 周 */
                                cron_expression: string;
                                /** @enum {string|null} */
                                request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                                request_url: string;
                                /** @description 请求头（JSON 对象字符串） */
                                request_headers: string | null;
                                /** @description 请求体原文 */
                                request_body: string | null;
                                /** @description 超时秒数（1–120） */
                                timeout_seconds: number | null;
                                /** @description 是否启用 */
                                is_active: boolean | null;
                                remark: string | null;
                                /**
                                 * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                                 * @enum {string|null}
                                 */
                                last_status: "idle" | "running" | "success" | "failed" | null;
                                /** @description 最近一次错误信息 */
                                last_error: string | null;
                                /** @description 最近一次耗时（毫秒） */
                                last_duration_ms: number | null;
                                /** @description 累计执行次数 */
                                run_count: number | null;
                                /**
                                 * Format: date-time
                                 * @description 最近执行时间（UTC）
                                 */
                                last_run_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 下次执行时间（UTC），停用时为 null
                                 */
                                next_run_at: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            };
                            run: {
                                id: number;
                                task_id: number;
                                task_name: string | null;
                                task_code: string | null;
                                /**
                                 * @description scheduled 定时触发 / manual 手动执行
                                 * @enum {string|null}
                                 */
                                trigger_type: "scheduled" | "manual" | null;
                                /** @enum {string} */
                                status: "success" | "failed";
                                /** @description 目标接口返回的 HTTP 状态码 */
                                response_status: number | null;
                                /** @description 响应内容（最多 2000 字符） */
                                response_body: string | null;
                                error_message: string | null;
                                /** Format: date-time */
                                started_at: string | null;
                                /** Format: date-time */
                                finished_at: string | null;
                                /** @description 耗时（毫秒） */
                                duration_ms: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                            };
                            /** @description 失败原因，仅失败时返回 */
                            error?: string;
                        };
                    };
                };
                /** @description 已保存的请求头不是合法 JSON 对象 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限执行定时任务 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 任务不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 执行失败（响应体同 200 的结构，带 error）或写执行记录失败 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {string} */
                            message: "执行成功" | "执行失败";
                            task: {
                                id: number;
                                name: string;
                                /** @description 任务编码（唯一） */
                                task_code: string;
                                /** @description 5 段 Cron：分 时 日 月 周 */
                                cron_expression: string;
                                /** @enum {string|null} */
                                request_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
                                request_url: string;
                                /** @description 请求头（JSON 对象字符串） */
                                request_headers: string | null;
                                /** @description 请求体原文 */
                                request_body: string | null;
                                /** @description 超时秒数（1–120） */
                                timeout_seconds: number | null;
                                /** @description 是否启用 */
                                is_active: boolean | null;
                                remark: string | null;
                                /**
                                 * @description 最近状态：idle 未执行 / running 执行中 / success 成功 / failed 失败
                                 * @enum {string|null}
                                 */
                                last_status: "idle" | "running" | "success" | "failed" | null;
                                /** @description 最近一次错误信息 */
                                last_error: string | null;
                                /** @description 最近一次耗时（毫秒） */
                                last_duration_ms: number | null;
                                /** @description 累计执行次数 */
                                run_count: number | null;
                                /**
                                 * Format: date-time
                                 * @description 最近执行时间（UTC）
                                 */
                                last_run_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 下次执行时间（UTC），停用时为 null
                                 */
                                next_run_at: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                            };
                            run: {
                                id: number;
                                task_id: number;
                                task_name: string | null;
                                task_code: string | null;
                                /**
                                 * @description scheduled 定时触发 / manual 手动执行
                                 * @enum {string|null}
                                 */
                                trigger_type: "scheduled" | "manual" | null;
                                /** @enum {string} */
                                status: "success" | "failed";
                                /** @description 目标接口返回的 HTTP 状态码 */
                                response_status: number | null;
                                /** @description 响应内容（最多 2000 字符） */
                                response_body: string | null;
                                error_message: string | null;
                                /** Format: date-time */
                                started_at: string | null;
                                /** Format: date-time */
                                finished_at: string | null;
                                /** @description 耗时（毫秒） */
                                duration_ms: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                            };
                            /** @description 失败原因，仅失败时返回 */
                            error: string;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 在线用户列表
         * @description 需要 system_sessions；按数据权限过滤（能看到哪些用户就能看到他们的会话）；只列已登录（不含等待两步验证）的有效会话，按最近活动倒序
         */
        get: {
            parameters: {
                query?: {
                    page?: number;
                    per_page?: number;
                    /** @description 按用户名、昵称、IP 搜索 */
                    search?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                /** @description 会话标识（强制下线时使用；不能当作 cookie） */
                                key: string;
                                user_id: number;
                                username: string | null;
                                nickname: string | null;
                                ip: string | null;
                                user_agent: string | null;
                                /**
                                 * Format: date-time
                                 * @description 登录时间
                                 */
                                created_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 最近活动时间（每分钟最多刷新一次）
                                 */
                                last_seen_at: string | null;
                                /**
                                 * Format: date-time
                                 * @description 到期时间（滑动续期）
                                 */
                                expires_at: string | null;
                                /** @description 是否为发起本次请求的会话 */
                                current: boolean;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/sessions/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 强制下线
         * @description 需要 system_sessions_revoke；被下线的会话下一次请求即 401。不能下线自己当前的会话（请直接退出登录）；非超级管理员不能下线超级管理员；数据权限外的会话视为不存在
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 会话标识（列表里的 key） */
                    key: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 会话不存在或已失效 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 系统设置
         * @description 需要 system_settings；返回全部设置项定义、当前值与来源。密钥（SMTP 密码、S3 Secret Key、AI API Key）不返回明文。只有服务启动前需要的配置（数据库、SECRET_KEY、端口等）不在这里
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                /** @description 设置项，如 mail.smtp_host */
                                key: string;
                                /** @enum {string} */
                                group: "general" | "security" | "mail" | "storage" | "upload" | "ai";
                                /** @enum {string} */
                                type: "boolean" | "integer" | "string" | "secret" | "enum" | "string_list";
                                /** @description 当前生效值；密钥类恒为 null */
                                value: unknown;
                                /** @description 仅密钥类：是否已设置 */
                                has_value: boolean;
                                /** @description 默认值；密钥类为 null */
                                default: unknown;
                                min: number | null;
                                max: number | null;
                                /** @description 枚举的可选值 */
                                options: string[] | null;
                                /**
                                 * @description 值的来源；env = 由环境变量锁定，页面只读
                                 * @enum {string}
                                 */
                                source: "env" | "db" | "default";
                                /** @description 可锁定该项的环境变量名 */
                                env: string | null;
                                /** @description 开关当前不能打开的原因 */
                                unavailable_reason: string | null;
                            }[];
                            /** @description 各存储驱动上的文件数（S3 连接变更时提示受影响的文件） */
                            file_counts: {
                                [key: string]: number;
                            };
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /**
         * 保存系统设置
         * @description 需要 system_settings_edit；只提交要改的项，null = 恢复默认 / 清除密钥。全部校验通过才写入（类型、范围、未知键、角色编码、S3 必填项、开关的前置条件按同一次保存后的值判断）；由环境变量锁定的项不能改。密钥加密存储；其他进程最多 5 秒后生效。需要 10 分钟内登录或验证过身份（/api/admin/reauth）；地址类设置（SMTP 服务器、S3 接口地址、AI 接口地址）不能指向保留地址，生产环境默认也不能指向内网（SETTINGS_ALLOW_PRIVATE_NETWORK）。保存后给所有启用的超级管理员发站内通知
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description { 设置项: 值 }；除下列安全项外，还有 general.app_base_url、mail.*、storage.*、upload.*、ai.*、security.login_max_failures / login_lockout_minutes，见 GET 返回的定义 */
                        values: {
                            /** @description 两步验证总开关（关闭后登录不再询问，已有绑定保留） */
                            "security.totp_enabled"?: boolean;
                            /** @description 必须开启两步验证的角色编码 */
                            "security.totp_required_roles"?: string[];
                            /** @description 邮件找回密码（需要 SMTP 与网站地址） */
                            "security.password_reset_enabled"?: boolean;
                            "security.password_min_length"?: number;
                            "security.password_require_letters_digits"?: boolean;
                            "security.password_require_symbol"?: boolean;
                            /** @description 会话有效期（小时，滑动续期） */
                            "security.session_ttl_hours"?: number;
                            /** @description 每个 IP 每分钟的 /api 请求上限 */
                            "security.rate_limit_per_minute"?: number;
                            /** @description 登录、两步验证、找回密码共用的每 IP 每分钟上限 */
                            "security.auth_rate_limit_per_minute"?: number;
                        } & {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                /** @description 设置项，如 mail.smtp_host */
                                key: string;
                                /** @enum {string} */
                                group: "general" | "security" | "mail" | "storage" | "upload" | "ai";
                                /** @enum {string} */
                                type: "boolean" | "integer" | "string" | "secret" | "enum" | "string_list";
                                /** @description 当前生效值；密钥类恒为 null */
                                value: unknown;
                                /** @description 仅密钥类：是否已设置 */
                                has_value: boolean;
                                /** @description 默认值；密钥类为 null */
                                default: unknown;
                                min: number | null;
                                max: number | null;
                                /** @description 枚举的可选值 */
                                options: string[] | null;
                                /**
                                 * @description 值的来源；env = 由环境变量锁定，页面只读
                                 * @enum {string}
                                 */
                                source: "env" | "db" | "default";
                                /** @description 可锁定该项的环境变量名 */
                                env: string | null;
                                /** @description 开关当前不能打开的原因 */
                                unavailable_reason: string | null;
                            }[];
                            /** @description 各存储驱动上的文件数（S3 连接变更时提示受影响的文件） */
                            file_counts: {
                                [key: string]: number;
                            };
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（{ error, reauth_required: true }，见 /api/admin/reauth） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings/test/ai": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 测试 AI 接口
         * @description 需要 system_settings_edit；用（草稿 + 已保存的）AI 设置调用一次 <接口地址>/chat/completions（max_tokens=5）。需要 10 分钟内登录或验证过身份；目标地址同样经过保留地址 / 内网检查
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 表单里还没保存的修改（{ 设置项: 值 }），套在已保存的值上使用；不写入。密钥：字符串 = 用这个值，null = 视为清除，不传 = 用已保存的值 */
                        values?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            model: string;
                        };
                    };
                };
                /** @description 请求参数错误 / 测试失败（error 为原因） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（{ error, reauth_required: true }，见 /api/admin/reauth） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings/test/mail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发送测试邮件
         * @description 需要 system_settings_edit；与登录类接口共用每 IP 限流。用（草稿 + 已保存的）邮件设置发一封测试邮件；MAIL_DRIVER=log 时只写日志。需要 10 分钟内登录或验证过身份；目标地址同样经过保留地址 / 内网检查
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: email */
                        to: string;
                        /** @description 表单里还没保存的修改（{ 设置项: 值 }），套在已保存的值上使用；不写入。密钥：字符串 = 用这个值，null = 视为清除，不传 = 用已保存的值 */
                        values?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 / 测试失败（error 为原因） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（{ error, reauth_required: true }，见 /api/admin/reauth） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings/test/storage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 测试文件存储
         * @description 需要 system_settings_edit；在（草稿 + 已保存的）存储上写入、检查并删除一个小对象。需要 10 分钟内登录或验证过身份；目标地址同样经过保留地址 / 内网检查
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 表单里还没保存的修改（{ 设置项: 值 }），套在已保存的值上使用；不写入。密钥：字符串 = 用这个值，null = 视为清除，不传 = 用已保存的值 */
                        values?: {
                            [key: string]: unknown;
                        } | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @enum {string} */
                            driver: "local" | "s3";
                        };
                    };
                };
                /** @description 请求参数错误 / 测试失败（error 为原因） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（{ error, reauth_required: true }，见 /api/admin/reauth） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁 */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/two-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的两步验证状态
         * @description 只需登录
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 总开关是否打开且可用 */
                            available: boolean;
                            enabled: boolean;
                            /** Format: date-time */
                            enabled_at: string | null;
                            /** @description 所在角色要求开启 */
                            required: boolean;
                            /** @description 剩余未使用的恢复码 */
                            recovery_codes_left: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/two-factor/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 关闭两步验证
         * @description 需要当前密码；所在角色要求两步验证（且总开关打开）时不能关闭。关闭会删除密钥与恢复码
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        password: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/two-factor/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 开启两步验证
         * @description 用验证器 App 的第一个验证码确认绑定，返回恢复码。处于登录「绑定」步骤时，成功后直接完成登录（返回 user 与新的 csrf_token）
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 6 位验证码 */
                        code: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 10 个恢复码，只显示这一次 */
                            recovery_codes: string[];
                            /** @description 仅登录流程中返回 */
                            user?: {
                                id: number;
                                /** @description 用户名 */
                                username: string;
                                /** @description 昵称 */
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                /** @description 头像地址 */
                                avatar: string | null;
                                /**
                                 * @description 账号状态
                                 * @enum {string}
                                 */
                                status: "active" | "disabled";
                                /** @description 所属部门 ID */
                                dept_id: number | null;
                                /** @description 所属部门名称 */
                                dept_name: string | null;
                                /**
                                 * Format: date-time
                                 * @description 上次登录时间
                                 */
                                last_login_at: string | null;
                                /** @description 上次登录 IP */
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 所属角色 */
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 拥有的菜单 / 按钮权限编码（去重，无固定顺序） */
                                menu_codes: string[];
                            };
                            /** @description 仅登录流程中返回 */
                            csrf_token?: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 请求过于频繁（登录类接口共用更严格的每分钟额度） */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/two-factor/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 重新生成恢复码
         * @description 需要当前密码；旧恢复码全部作废
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        password: string;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 10 个恢复码，只显示这一次 */
                            recovery_codes: string[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/two-factor/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 获取两步验证绑定密钥
         * @description 已登录，或处于登录的「绑定」步骤（登录返回 mfa_required=setup）；不接受 API Token。生成新密钥并加密保存（调用「开启两步验证」成功前不生效，重复调用会替换），otpauth_url 用于生成二维码。两步验证开关未打开或已开启时返回 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Base32 密钥（手动输入用） */
                            secret: string;
                            /** @description otpauth:// 地址，用于生成二维码 */
                            otpauth_url: string;
                        };
                    };
                };
                /** @description 两步验证未开启，或已开启两步验证（需先关闭） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未登录，且不处于登录的「绑定」步骤 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description CSRF 校验失败；或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 用户列表
         * @description 需要 system_users；按数据权限过滤（只能看到数据范围内的用户）；按 ID 倒序分页。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 页码 */
                    page?: number;
                    /** @description 每页条数，超出范围会被截到 1–200 */
                    per_page?: number;
                    /** @description 按用户名、昵称、邮箱、手机号模糊搜索 */
                    search?: string;
                    /** @description 状态筛选；空串或其他值不筛选 */
                    status?: "active" | "disabled" | "";
                    /** @description 部门 ID，包含其下级部门；非数字忽略 */
                    dept_id?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                username: string;
                                nickname: string | null;
                                email: string | null;
                                phone: string | null;
                                avatar: string | null;
                                /** @enum {string} */
                                status: "active" | "disabled";
                                dept_id: number | null;
                                dept_name: string | null;
                                /** Format: date-time */
                                last_login_at: string | null;
                                last_login_ip: string | null;
                                /** @description 是否已开启两步验证 */
                                totp_enabled: boolean;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                roles: {
                                    id: number;
                                    name: string;
                                    code: string;
                                    description: string | null;
                                    /** Format: date-time */
                                    created_at: string | null;
                                }[];
                                /** @description 所有角色授权菜单编码（去重） */
                                menu_codes: string[];
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增用户
         * @description 需要 system_users_add。用户名唯一、密码须符合系统设置的密码规则；部门须在数据权限范围内；只有超级管理员能分配 super_admin 角色（否则 403）。新用户状态固定为 active，成功后触发 user.created 事件。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 用户名，唯一 */
                        username: string;
                        /** @description 密码，须符合系统设置的密码规则 */
                        password: string;
                        /** @description 昵称，空值存为 null */
                        nickname?: string | null;
                        /**
                         * Format: email
                         * @description 邮箱，唯一，保存为小写；空值存为 null
                         */
                        email?: string | null;
                        /** @description 手机号：可带 +，数字、空格、- 共 5–20 位；空值存为 null */
                        phone?: string | null;
                        /** @description 头像地址，需以 http(s):// 或 / 开头；空值存为 null */
                        avatar?: string | null;
                        /** @description 部门 ID，null 表示不分配；部门必须存在且在当前数据权限范围内 */
                        dept_id?: number | null;
                        /** @description 角色 ID 列表（全部须存在）；授予或移除 super_admin 仅超级管理员可做；缺省或 null 视为空列表 */
                        role_ids?: number[] | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            username: string;
                            nickname: string | null;
                            email: string | null;
                            phone: string | null;
                            avatar: string | null;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            dept_id: number | null;
                            dept_name: string | null;
                            /** Format: date-time */
                            last_login_at: string | null;
                            last_login_ip: string | null;
                            /** @description 是否已开启两步验证 */
                            totp_enabled: boolean;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            roles: {
                                id: number;
                                name: string;
                                code: string;
                                description: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            /** @description 所有角色授权菜单编码（去重） */
                            menu_codes: string[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出用户
         * @description 需要 system_users_export（只有查看权限不能导出）；只导出数据权限范围内的用户，按 ID 正序。selected 模式未勾选时返回 400。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * @description selected 导出勾选的 ids；filtered 按 filters 导出全部匹配数据（all 同 filtered）；缺省、null 或空串时为 selected
                         * @default selected
                         * @enum {string|null}
                         */
                        export_mode?: "selected" | "filtered" | "all" | null;
                        /** @description selected 模式必填且不能为空；缺省或 null 视为空列表 */
                        ids?: number[] | null;
                        /** @description 导出列，缺省、null、为空或全部无效时导出所有列 */
                        fields?: ("id" | "username" | "nickname" | "email" | "phone" | "dept_name" | "status" | "role_names" | "role_codes" | "last_login_at" | "last_login_ip" | "created_at")[] | null;
                        /** @description filtered 模式的筛选条件 */
                        filters?: {
                            /** @description 按用户名、昵称、邮箱、手机号模糊搜索 */
                            search?: string | null;
                            /**
                             * @description 用户状态，精确匹配；空串或 null 表示全部
                             * @enum {string|null}
                             */
                            status?: "active" | "disabled" | "" | null;
                            /** @description 部门 ID（须为 JSON 整数），包含其下级部门 */
                            dept_id?: number | null;
                        } | null;
                        /**
                         * @description 文件格式，缺省或其他值按 csv
                         * @default csv
                         * @enum {string|null}
                         */
                        file_type?: "csv" | "xlsx" | null;
                    };
                };
            };
            responses: {
                /** @description 文件内容（Content-Disposition: attachment; filename=users_export.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导入用户
         * @description 需要 system_users_import（_add / _edit 不能代替）；按用户名新增或更新，空白单元格不改原值，新增行必须有密码；填写状态列还需要 system_users_status；只能改数据权限范围内的用户和部门，超级管理员相关限制同编辑接口。任一行出错整批回滚，400 响应带 error_rows（最多 500 条）和 error_count。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description csv / xlsx 文件，最大 5MB
                         */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 导入成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                            /** @description 新增条数 */
                            created: number;
                            /** @description 更新条数 */
                            updated: number;
                        };
                    };
                };
                /** @description 文件不合法或存在错误数据（响应含 error_rows、error_count） */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 文件过大 */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 下载用户导入模板
         * @description 需要 system_users_import（与导入相同；只有查看权限不能下载）；返回带表头（用户名、密码、昵称、邮箱、手机、状态、部门编码、角色编码）和一行示例的模板文件。
         */
        get: {
            parameters: {
                query?: {
                    /** @description 文件格式，缺省或其他值按 csv */
                    file_type?: "csv" | "xlsx";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 模板文件（users_import_template.csv / .xlsx） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/csv": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑用户
         * @description 需要 system_users_edit；先校验权限再查用户，用户不存在或超出数据权限范围都返回 404。只更新请求里出现的字段，status 在此忽略（用启用 / 停用接口）；password 非空时重置密码。非超级管理员不能编辑超级管理员账号或变更 super_admin 角色（403），不能移除自己或最后一个超级管理员的 super_admin 角色；成功后触发 user.updated 事件。
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 用户 ID */
                    user_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 新密码，留空不修改；须符合密码规则 */
                        password?: string | null;
                        /** @description 昵称，空值存为 null */
                        nickname?: string | null;
                        /**
                         * Format: email
                         * @description 邮箱，唯一，保存为小写；空值存为 null
                         */
                        email?: string | null;
                        /** @description 手机号：可带 +，数字、空格、- 共 5–20 位；空值存为 null */
                        phone?: string | null;
                        /** @description 头像地址，需以 http(s):// 或 / 开头；空值存为 null */
                        avatar?: string | null;
                        /** @description 部门 ID，null 表示不分配；部门必须存在且在当前数据权限范围内 */
                        dept_id?: number | null;
                        /** @description 角色 ID 列表（全部须存在）；授予或移除 super_admin 仅超级管理员可做；null 视为空列表（移除全部角色） */
                        role_ids?: number[] | null;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            username: string;
                            nickname: string | null;
                            email: string | null;
                            phone: string | null;
                            avatar: string | null;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            dept_id: number | null;
                            dept_name: string | null;
                            /** Format: date-time */
                            last_login_at: string | null;
                            last_login_ip: string | null;
                            /** @description 是否已开启两步验证 */
                            totp_enabled: boolean;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            roles: {
                                id: number;
                                name: string;
                                code: string;
                                description: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            /** @description 所有角色授权菜单编码（去重） */
                            menu_codes: string[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用户不存在或超出数据权限范围 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除用户
         * @description 需要 system_users_delete；用户不存在或超出数据权限范围返回 404。不能删除当前登录账号和最后一个启用的超级管理员（400），非超级管理员不能删除超级管理员账号（403）；成功后触发 user.deleted 事件。
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 用户 ID */
                    user_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用户不存在或超出数据权限范围 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 启用 / 停用用户
         * @description 需要 system_users_status 权限；不能停用自己或最后一个可登录的超级管理员。停用后该用户已登录的会话在下一次请求时失效（401）
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 路径参数：user_id */
                    user_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status: "active" | "disabled";
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            username: string;
                            nickname: string | null;
                            email: string | null;
                            phone: string | null;
                            avatar: string | null;
                            /** @enum {string} */
                            status: "active" | "disabled";
                            dept_id: number | null;
                            dept_name: string | null;
                            /** Format: date-time */
                            last_login_at: string | null;
                            last_login_ip: string | null;
                            /** @description 是否已开启两步验证 */
                            totp_enabled: boolean;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            roles: {
                                id: number;
                                name: string;
                                code: string;
                                description: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            /** @description 所有角色授权菜单编码（去重） */
                            menu_codes: string[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用户不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{user_id}/two-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 重置用户的两步验证
         * @description 需要 system_users_edit，受数据权限约束；非超级管理员不能重置超级管理员。用于用户丢失手机与恢复码；角色要求时用户下次登录会重新绑定
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 路径参数：user_id */
                    user_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 用户不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Webhook 列表
         * @description 需要 system_webhooks。事件在业务写入提交后投递：POST JSON { id, event, created_at, data }，头部 X-Castor-Event / X-Castor-Delivery / X-Castor-Timestamp / X-Castor-Signature（sha256=HMAC-SHA256(密钥, "<timestamp>.<body>")）；10 秒超时，不跟随重定向，非 2xx 按 1 分钟 / 5 分钟 / 30 分钟 / 2 小时 / 6 小时重试，第 6 次仍失败记为失败。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                name: string;
                                url: string;
                                events: string[];
                                is_active: boolean;
                                created_by: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 最近一次投递状态（仅列表） */
                                last_status: string | null;
                                /** Format: date-time */
                                last_at: string | null;
                                /** @description 24 小时内失败次数（仅列表） */
                                failed_24h: number;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 新增 Webhook
         * @description 需要 system_webhooks_add（不接受 API Token），需要近期验证身份；返回签名密钥；通知所有超级管理员
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description 名称（去掉首尾空格后不能为空，最多 100 个字符） */
                        name: string;
                        /** @description http(s)，不能是保留地址；生产默认也不能是内网 */
                        url: string;
                        /** @description 订阅的事件（至少一个）：事件名、"*" 或 "user.*" 这样的前缀；未知事件返回 400 */
                        events: string[];
                        /** @description 是否启用（true / false），缺省为 true */
                        is_active?: boolean;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            item: {
                                id: number;
                                name: string;
                                url: string;
                                events: string[];
                                is_active: boolean;
                                created_by: number | null;
                                /** Format: date-time */
                                created_at: string | null;
                                /** Format: date-time */
                                updated_at: string | null;
                                /** @description 最近一次投递状态（仅列表） */
                                last_status: string | null;
                                /** Format: date-time */
                                last_at: string | null;
                                /** @description 24 小时内失败次数（仅列表） */
                                failed_24h: number;
                            };
                            /** @description whsec_... */
                            secret: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/deliveries/{delivery_id}/redeliver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 重新投递
         * @description 需要 system_webhooks_edit，不接受 API Token。用原投递的事件 ID 与内容新建一条投递记录并立即发送（最长等待 10 秒），返回新记录；接收方可按 X-Castor-Delivery 去重。失败按常规安排重试，Webhook 已停用则直接失败；投递记录不存在返回 404。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description 要重发的投递记录 ID */
                    delivery_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 新投递记录（id 与 delivery_id 不同） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 投递记录 ID */
                            id: number;
                            webhook_id: number;
                            /**
                             * Format: uuid
                             * @description 事件 ID，同请求头 X-Castor-Delivery（接收方据此去重）
                             */
                            event_id: string;
                            /** @description 事件名 */
                            event: string;
                            /** @description 发送给接收方的请求体 */
                            payload: {
                                /** @description 事件 ID */
                                id: string;
                                event: string;
                                /** Format: date-time */
                                created_at: string;
                                /** @description 事件数据 */
                                data: unknown;
                            };
                            /**
                             * @description success：成功；pending：失败且已安排重试（见 next_retry_at）；failed：最终失败（如 Webhook 已停用）
                             * @enum {string}
                             */
                            status: "pending" | "delivering" | "success" | "failed";
                            /** @description 已尝试次数 */
                            attempts: number;
                            /** @description 接收方返回的 HTTP 状态码（连接失败时为空） */
                            response_code: number | null;
                            /** @description 响应内容前 2000 个字符，或连接错误信息 */
                            response_body: string | null;
                            /**
                             * Format: date-time
                             * @description 下次重试时间
                             */
                            next_retry_at: string | null;
                            /**
                             * Format: date-time
                             * @description 成功送达时间
                             */
                            delivered_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限、CSRF 校验失败，或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 投递记录不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 可订阅的事件
         * @description 需要 system_webhooks；内置 ping、user.*、role.*、department.*，以及脚手架生成模块的 <模块>.created / updated / deleted
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                event: string;
                                label: string;
                            }[];
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/{webhook_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑 Webhook
         * @description 需要 system_webhooks_edit（不接受 API Token），需要近期验证身份；只传要改的字段；改地址会通知所有超级管理员
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        /** @description http(s)，不能是保留地址；生产默认也不能是内网 */
                        url?: string;
                        /** @description 事件名、"*" 或 "user.*" 这样的前缀 */
                        events?: string[];
                        is_active?: boolean;
                    };
                };
            };
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: number;
                            name: string;
                            url: string;
                            events: string[];
                            is_active: boolean;
                            created_by: number | null;
                            /** Format: date-time */
                            created_at: string | null;
                            /** Format: date-time */
                            updated_at: string | null;
                            /** @description 最近一次投递状态（仅列表） */
                            last_status: string | null;
                            /** Format: date-time */
                            last_at: string | null;
                            /** @description 24 小时内失败次数（仅列表） */
                            failed_24h: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /**
         * 删除 Webhook
         * @description 需要 system_webhooks_delete（不接受 API Token）；投递记录一并删除
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/{webhook_id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 投递记录
         * @description 需要 system_webhooks
         */
        get: {
            parameters: {
                query?: {
                    page?: number;
                    per_page?: number;
                    /** @description 投递状态，精确匹配；空串或其他值不筛选 */
                    status?: "pending" | "delivering" | "success" | "failed" | "";
                };
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                id: number;
                                webhook_id: number;
                                /**
                                 * Format: uuid
                                 * @description 事件 ID，同 X-Castor-Delivery
                                 */
                                event_id: string;
                                event: string;
                                payload: {
                                    [key: string]: unknown;
                                };
                                /** @enum {string} */
                                status: "pending" | "delivering" | "success" | "failed";
                                attempts: number;
                                response_code: number | null;
                                /** @description 前 2000 字符或连接错误 */
                                response_body: string | null;
                                /** Format: date-time */
                                next_retry_at: string | null;
                                /** Format: date-time */
                                delivered_at: string | null;
                                /** Format: date-time */
                                created_at: string | null;
                            }[];
                            total: number;
                            page: number;
                            per_page: number;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/{webhook_id}/secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查看签名密钥
         * @description 需要 system_webhooks_edit（不接受 API Token），需要近期验证身份
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            secret: string;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限，或需要先验证身份（reauth_required） */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        /**
         * 重新生成签名密钥
         * @description 需要 system_webhooks_edit，不接受 API Token，且需在 10 分钟内登录或验证过身份（否则 403 且带 reauth_required: true，先调用「验证身份」再重试）。生成新的 whsec_ 开头密钥并返回，旧密钥立即失效；先校验权限，Webhook 不存在返回 404。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 新的签名密钥（whsec_ 开头） */
                            secret: string;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限、需要先验证身份（reauth_required: true）、CSRF 校验失败，或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Webhook 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/webhooks/{webhook_id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发送测试事件
         * @description 需要 system_webhooks_edit，不接受 API Token。立即向该 Webhook 发送一个 ping 事件（最长等待 10 秒）并返回这次投递记录；失败按常规安排重试，Webhook 已停用则直接失败（响应内容为「Webhook 已停用」）。先校验权限，Webhook 不存在返回 404。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Webhook ID */
                    webhook_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 投递记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description 投递记录 ID */
                            id: number;
                            webhook_id: number;
                            /**
                             * Format: uuid
                             * @description 事件 ID，同请求头 X-Castor-Delivery（接收方据此去重）
                             */
                            event_id: string;
                            /** @description 事件名 */
                            event: string;
                            /** @description 发送给接收方的请求体 */
                            payload: {
                                /** @description 事件 ID */
                                id: string;
                                event: string;
                                /** Format: date-time */
                                created_at: string;
                                /** @description 事件数据 */
                                data: unknown;
                            };
                            /**
                             * @description success：成功；pending：失败且已安排重试（见 next_retry_at）；failed：最终失败（如 Webhook 已停用）
                             * @enum {string}
                             */
                            status: "pending" | "delivering" | "success" | "failed";
                            /** @description 已尝试次数 */
                            attempts: number;
                            /** @description 接收方返回的 HTTP 状态码（连接失败时为空） */
                            response_code: number | null;
                            /** @description 响应内容前 2000 个字符，或连接错误信息 */
                            response_body: string | null;
                            /**
                             * Format: date-time
                             * @description 下次重试时间
                             */
                            next_retry_at: string | null;
                            /**
                             * Format: date-time
                             * @description 成功送达时间
                             */
                            delivered_at: string | null;
                            /** Format: date-time */
                            created_at: string | null;
                        };
                    };
                };
                /** @description 未登录或会话已失效 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限、CSRF 校验失败，或用 API Token 调用 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Webhook 不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 健康检查 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 成功 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description 请求参数错误 */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 未授权 */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 无权限 */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 服务器错误 */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
