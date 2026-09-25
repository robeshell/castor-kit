/**
 * Translations for API response messages (`error`, `message`, `error_rows[].reason`).
 *
 * Backend code keeps throwing Chinese messages (the source text doubles as the key); the response hook in
 * common/i18n.ts translates them for en-US / ja-JP requests. Keep entries grouped by module.
 * Messages built with template literals go in PATTERNS (regex on the Chinese text, $1… in the translation).
 */

export type TranslatedLanguage = 'en-US' | 'ja-JP'
export type MessageEntry = Record<TranslatedLanguage, string>

export const MESSAGES: Record<string, MessageEntry> = {
  // framework / common
  '服务器内部错误，请稍后重试': { 'en-US': 'Internal server error. Please try again later.', 'ja-JP': 'サーバー内部エラーが発生しました。しばらくしてから再度お試しください。' },
  '资源不存在': { 'en-US': 'Resource not found', 'ja-JP': 'リソースが見つかりません' },
  '请求方法不允许': { 'en-US': 'Method not allowed', 'ja-JP': '許可されていないリクエストメソッドです' },
  '请求参数不合法': { 'en-US': 'Invalid request parameters', 'ja-JP': 'リクエストパラメーターが不正です' },
  '请求体过大': { 'en-US': 'Request body too large', 'ja-JP': 'リクエストボディが大きすぎます' },
  '请求体格式错误': { 'en-US': 'Malformed request body', 'ja-JP': 'リクエストボディの形式が正しくありません' },
  'CSRF 校验失败，请刷新页面后重试': { 'en-US': 'CSRF check failed. Please refresh the page and try again.', 'ja-JP': 'CSRF 検証に失敗しました。ページを再読み込みしてから再度お試しください。' },
  '未登录': { 'en-US': 'Not signed in', 'ja-JP': 'ログインしていません' },
  '未授权访问': { 'en-US': 'Unauthorized', 'ja-JP': '認証されていません' },
  '会话异常': { 'en-US': 'Session error', 'ja-JP': 'セッションに異常があります' },
  '用户不存在': { 'en-US': 'User not found', 'ja-JP': 'ユーザーが存在しません' },
  '无权限': { 'en-US': 'Permission denied', 'ja-JP': '権限がありません' },
  '删除成功': { 'en-US': 'Deleted', 'ja-JP': '削除しました' },
  '导入成功': { 'en-US': 'Imported', 'ja-JP': 'インポートしました' },
  '导入失败，存在错误数据': { 'en-US': 'Import failed: some rows are invalid', 'ja-JP': 'インポートに失敗しました：不正なデータがあります' },

  // import / export files (common/tabular.ts)
  '请上传导入文件': { 'en-US': 'Please upload a file to import', 'ja-JP': 'インポートするファイルをアップロードしてください' },
  '导入文件内容为空': { 'en-US': 'The import file is empty', 'ja-JP': 'インポートファイルが空です' },
  '仅支持 csv/xlsx 文件': { 'en-US': 'Only csv / xlsx files are supported', 'ja-JP': 'csv / xlsx ファイルのみ対応しています' },
  '不支持 .xls 格式，请另存为 .xlsx 后重新上传': { 'en-US': '.xls is not supported. Save it as .xlsx and upload again.', 'ja-JP': '.xls 形式には対応していません。.xlsx で保存し直してからアップロードしてください。' },
  'CSV 编码错误，请使用 UTF-8 编码': { 'en-US': 'Invalid CSV encoding. Please use UTF-8.', 'ja-JP': 'CSV の文字コードが正しくありません。UTF-8 を使用してください。' },
  'xlsx 文件解析失败，请确认文件格式': { 'en-US': 'Failed to read the xlsx file. Please check the file format.', 'ja-JP': 'xlsx ファイルを読み込めませんでした。ファイル形式を確認してください。' },
  '文件过大，最大支持 5MB': { 'en-US': 'File too large (max 5 MB)', 'ja-JP': 'ファイルが大きすぎます（最大 5MB）' },

  // database constraint errors (common/db-errors.ts)
  '数据重复：唯一字段的值已存在': { 'en-US': 'Duplicate data: a unique field value already exists', 'ja-JP': 'データが重複しています：一意の項目の値が既に存在します' },
  '必填字段不能为空': { 'en-US': 'Required fields cannot be empty', 'ja-JP': '必須項目は空にできません' },
  '关联的数据不存在或仍被引用': { 'en-US': 'Related data does not exist or is still referenced', 'ja-JP': '関連データが存在しないか、まだ参照されています' },
  '数据不符合约束条件': { 'en-US': 'Data violates a constraint', 'ja-JP': 'データが制約条件を満たしていません' },
  '字段长度超出限制': { 'en-US': 'A field exceeds its maximum length', 'ja-JP': '項目の長さが上限を超えています' },
  '数值超出范围': { 'en-US': 'A number is out of range', 'ja-JP': '数値が範囲外です' },
  '日期时间格式不正确': { 'en-US': 'Invalid date/time format', 'ja-JP': '日時の形式が正しくありません' },
  '日期时间超出范围': { 'en-US': 'Date/time out of range', 'ja-JP': '日時が範囲外です' },
  '字段格式不正确': { 'en-US': 'Invalid field format', 'ja-JP': '項目の形式が正しくありません' },
}

export const PATTERNS: Array<{ re: RegExp } & MessageEntry> = [
  { re: /^缺少权限: (.+)$/, 'en-US': 'Missing permission: $1', 'ja-JP': '権限がありません：$1' },
]
