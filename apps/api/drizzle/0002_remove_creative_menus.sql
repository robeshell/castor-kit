-- The component gallery drops its 3D / creative pages (particles, CSS 3D, Three.js globe, morphing particles).
-- Deleting the "3D / 创意" directory removes its four pages (menus.parent_id cascades) and every role grant on them
-- (role_menus.menu_id cascades). seed-rbac never deletes menus, so existing databases need this; on a fresh database
-- it matches nothing.
DELETE FROM "menus" WHERE "code" IN ('cc_3d', 'cc_3d_particle', 'cc_3d_css', 'cc_3d_globe', 'cc_3d_morphing');
