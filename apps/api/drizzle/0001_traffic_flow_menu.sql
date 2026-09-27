-- The component gallery's traffic flow page takes over menu 413: existing databases get the new code, name, icon,
-- path and page in place (role grants stay); on a fresh database this matches nothing and seed-rbac inserts the menu.
UPDATE "menus"
SET "code" = 'cc_dataviz_traffic_flow',
    "name" = '流量转化分析',
    "icon" = 'Workflow',
    "path" = '/component-center/dataviz/traffic-flow',
    "component" = 'component_center/dataviz/traffic_flow_page',
    "updated_at" = timezone('utc', now())
WHERE "code" = 'cc_dataviz_map_heatmap';
