export type Messages = {
  app: {
    bannerTitleDefault: string;
    adminTitleSuffix: string;
  };
  nav: {
    openMenu: string;
    toggleTheme: string;
    toggleSidebar: string;
    showSidebar: string;
    hideSidebar: string;
    backToTop: string;
    searchPlaceholder: string;
    currentTime: string;
  };
  admin: {
    login: string;
    logout: string;
    backHome: string;
    username: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    loginFailed: string;
    currentlyCheckingAuth: string;

    links: string;
    add: string;
    edit: string;
    addSiteTitle: string;
    editSiteTitle: string;
    categoriesAndGroups: string;
    import: string;
    export: string;
    importExport: string;
    reset: string;
    resetConfirm: string;

    cancel: string;
    save: string;
    close: string;
    copy: string;
    apply: string;
    delete: string;
    actions: string;

    icon: string;
    category: string;
    name: string;
    siteName: string;
    url: string;
    descriptionOptional: string;
    tagsOptional: string;
    iconTypeAuto: string;
    iconTypeExternal: string;
    iconTypeBase64: string;

    categoriesGroupsTitle: string;
    group: string;
    noGroups: string;
    hideEmptyGroups: string;
    newGroupNamePlaceholder: string;
    categories: string;
    categoryNamePlaceholder: string;
    groupOptionalPlaceholder: string;
    orderPlaceholder: string;
    deleteCategory: string;
    linkCount: (n: number) => string;
    newGroup: string;
    newCategory: string;
    addCategory: string;

    exportTitle: string;
    exportHint: string;
    importTitle: string;
    pasteJsonYaml: string;

    saveFailedNeedKv: string;
    resetFailedNeedKv: string;
    importSavedButFailed: string;

    searchLinks: string;
    bulkActions: string;
    selectedLinksCount: (n: number) => string;
    moveToCategory: string;
    bulkDelete: string;
    confirmBulkDelete: (n: number) => string;
    reorderGroups: string;
    importFile: string;
    exportYaml: string;
    exportJson: string;
    dragToReorder: string;
    dragToReorderHelper: string;
    reload: string;
    conflictMessage: string;
    saveSuccess: string;
    saving: string;
    unsavedChanges: string;
    confirmLeaveUnsaved: string;
    confirm: string;
    ok: string;

    confirmDeleteGroup: (g: string) => string;
    confirmDeleteCategoryWithLinks: (name: string, count: number) => string;
    groupRequired: string;
  };
};

export const zhCN: Messages = {
  app: {
    bannerTitleDefault: '我的收藏夹',
    adminTitleSuffix: '管理后台',
  },
  nav: {
    openMenu: '打开菜单',
    toggleTheme: '切换主题',
    toggleSidebar: '切换侧栏',
    showSidebar: '显示侧栏',
    hideSidebar: '隐藏侧栏',
    backToTop: '返回顶部',
    searchPlaceholder: '搜索名称 / 网址 / 描述（支持拼音与缩写）',
    currentTime: '当前时间',
  },
  admin: {
    login: '登录',
    logout: '退出登录',
    backHome: '返回首页',
    username: '账号',
    password: '密码',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    loginFailed: '登录失败',
    currentlyCheckingAuth: '正在检查登录状态…',

    links: '链接管理',
    add: '添加',
    edit: '编辑',
    addSiteTitle: '添加网站',
    editSiteTitle: '编辑网站',
    categoriesAndGroups: '分类分组',
    import: '导入',
    export: '导出',
    importExport: '导入导出',
    reset: '恢复默认配置',
    resetConfirm: '确定要恢复默认配置吗？这将恢复为仓库默认配置（nav.yaml），并覆盖当前的自定义设置。',

    cancel: '取消',
    save: '保存',
    close: '关闭',
    copy: '复制',
    apply: '应用',
    delete: '删除',
    actions: '操作',

    icon: '图标',
    category: '分类',
    name: '分类名称',
    siteName: '网站名称',
    url: '网址',
    descriptionOptional: '说明（可选）',
    tagsOptional: '标签（可选，逗号分隔）',
    iconTypeAuto: '自动代理 (Proxy)',
    iconTypeExternal: '外部图片链接',
    iconTypeBase64: 'Base64 / Data URI',

    categoriesGroupsTitle: '分类/分组管理',
    group: '分组',
    noGroups: '暂无分组',
    hideEmptyGroups: '隐藏空分组',
    newGroupNamePlaceholder: '新分组名',
    categories: '分类',
    categoryNamePlaceholder: '分类名称',
    groupOptionalPlaceholder: '分组（可选）',
    orderPlaceholder: '排序',
    deleteCategory: '删除分类',
    linkCount: (n) => `当前链接数：${n}`,
    newGroup: '新增分组',
    newCategory: '新增分类',
    addCategory: '添加分类',

    exportTitle: '导出配置（JSON）',
    exportHint: '复制后可保存到仓库或备份',
    importTitle: '导入配置（JSON 或 YAML）',
    pasteJsonYaml: '粘贴 JSON/YAML',

    saveFailedNeedKv: '保存失败：请确认 Pages Functions 与 KV 已配置',
    resetFailedNeedKv: '重置失败：请确认 Pages Functions 与 KV 已配置',
    importSavedButFailed: '导入成功但保存失败：请确认 Pages Functions 与 KV 已配置',

    searchLinks: '搜索链接…',
    bulkActions: '批量操作',
    selectedLinksCount: (n) => `已选择 ${n} 个链接`,
    moveToCategory: '移动到分类',
    bulkDelete: '批量删除',
    confirmBulkDelete: (n) => `确定删除选中的 ${n} 个链接吗？`,
    reorderGroups: '调整分组排序',
    importFile: '从文件导入',
    exportYaml: '导出为 YAML',
    exportJson: '导出为 JSON',
    dragToReorder: '拖拽排序',
    dragToReorderHelper: '使用空格键抓取，使用方向键移动',
    reload: '重新加载',
    conflictMessage: '保存失败：配置已被他人修改。请重新加载后重试。',
    saveSuccess: '保存成功',
    saving: '保存中…',
    unsavedChanges: '未保存',
    confirmLeaveUnsaved: '当前有未保存的修改，确定要离开吗？',
    confirm: '确定',
    ok: '知道了',

    confirmDeleteGroup: (g) => `确定删除分组「${g}」？该分组下分类将变为未分组。`,
    confirmDeleteCategoryWithLinks: (name, count) =>
      `分类「${name}」下仍有 ${count} 个链接，确定删除该分类并丢弃这些链接吗？`,
    groupRequired: '分组不能为空，请先选择分组。',
  },
};

export const en: Messages = {
  app: {
    bannerTitleDefault: 'My Bookmarks',
    adminTitleSuffix: 'Admin',
  },
  nav: {
    openMenu: 'Open menu',
    toggleTheme: 'Toggle theme',
    toggleSidebar: 'Toggle sidebar',
    showSidebar: 'Show sidebar',
    hideSidebar: 'Hide sidebar',
    backToTop: 'Back to top',
    searchPlaceholder: 'Search name / URL / description (pinyin supported)',
    currentTime: 'Current time',
  },
  admin: {
    login: 'Sign in',
    logout: 'Sign out',
    backHome: 'Back to home',
    username: 'Username',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    loginFailed: 'Login failed',
    currentlyCheckingAuth: 'Checking login status…',

    links: 'Links',
    add: 'Add',
    edit: 'Edit',
    addSiteTitle: 'Add site',
    editSiteTitle: 'Edit site',
    categoriesAndGroups: 'Categories & Groups',
    import: 'Import',
    export: 'Export',
    importExport: 'Import/Export',
    reset: 'Restore Default Settings',
    resetConfirm: 'Are you sure you want to restore defaults from nav.yaml? This will overwrite your current configuration.',

    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    copy: 'Copy',
    apply: 'Apply',
    delete: 'Delete',
    actions: 'Actions',

    icon: 'Icon',
    category: 'Category',
    name: 'Category name',
    siteName: 'Site name',
    url: 'URL',
    descriptionOptional: 'Description (optional)',
    tagsOptional: 'Tags (optional, comma separated)',
    iconTypeAuto: 'Auto (Proxy)',
    iconTypeExternal: 'External URL',
    iconTypeBase64: 'Base64 / Data URI',

    categoriesGroupsTitle: 'Categories / Groups',
    group: 'Group',
    noGroups: 'No groups',
    hideEmptyGroups: 'Hide empty groups',
    newGroupNamePlaceholder: 'New group name',
    categories: 'Categories',
    categoryNamePlaceholder: 'Category name',
    groupOptionalPlaceholder: 'Group (optional)',
    orderPlaceholder: 'Order',
    deleteCategory: 'Delete category',
    linkCount: (n) => `Links: ${n}`,
    newGroup: 'New group',
    newCategory: 'New category',
    addCategory: 'Add category',

    exportTitle: 'Export config (JSON)',
    exportHint: 'Copy it to keep a backup',
    importTitle: 'Import config (JSON or YAML)',
    pasteJsonYaml: 'Paste JSON/YAML',

    saveFailedNeedKv: 'Save failed: please configure Pages Functions and KV',
    resetFailedNeedKv: 'Reset failed: please configure Pages Functions and KV',
    importSavedButFailed: 'Imported but failed to save: please configure Pages Functions and KV',

    searchLinks: 'Search links...',
    bulkActions: 'Bulk Actions',
    selectedLinksCount: (n) => `${n} links selected`,
    moveToCategory: 'Move to Category',
    bulkDelete: 'Bulk Delete',
    confirmBulkDelete: (n) => `Are you sure you want to delete ${n} selected links?`,
    reorderGroups: 'Reorder Groups',
    importFile: 'Import from File',
    exportYaml: 'Export as YAML',
    exportJson: 'Export as JSON',
    dragToReorder: 'Drag to reorder',
    dragToReorderHelper: 'Press spacebar to grab, arrow keys to move',
    reload: 'Reload',
    conflictMessage: 'Save failed due to conflict. Please reload and try again.',
    saveSuccess: 'Save successful',
    saving: 'Saving…',
    unsavedChanges: 'Unsaved',
    confirmLeaveUnsaved: 'You have unsaved changes. Leave anyway?',
    confirm: 'Confirm',
    ok: 'OK',

    confirmDeleteGroup: (g) => `Delete group "${g}"? Categories under it will become ungrouped.`,
    confirmDeleteCategoryWithLinks: (name, count) =>
      `Category "${name}" still has ${count} links. Delete it and discard those links?`,
    groupRequired: 'Group is required. Please select a group first.',
  },
};
