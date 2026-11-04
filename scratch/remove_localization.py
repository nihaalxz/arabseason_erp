with open('frontend/src/pages/Settings.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove Globe from icons import
c = c.replace('Shield, Globe, Save, LogOut,', 'Shield, Save, LogOut,')

# 2. Update validTabs
c = c.replace(
    "const validTabs = isAccounting\n    ? ['manage-banks-cash', 'localization', 'workspace', 'profile', 'security']\n    : ['workspace', 'profile', 'security', 'localization']",
    "const validTabs = isAccounting\n    ? ['manage-banks-cash', 'workspace', 'profile', 'security']\n    : ['workspace', 'profile', 'security']"
)
# Also handle \r\n
c = c.replace(
    "const validTabs = isAccounting\r\n    ? ['manage-banks-cash', 'localization', 'workspace', 'profile', 'security']\r\n    : ['workspace', 'profile', 'security', 'localization']",
    "const validTabs = isAccounting\r\n    ? ['manage-banks-cash', 'workspace', 'profile', 'security']\r\n    : ['workspace', 'profile', 'security']"
)

# 3. Update tabs list
old_tabs = """  const tabs = useMemo(() => isAccounting
    ? [
        { id: 'manage-banks-cash', name: 'Manage Banks & Petty Cash', icon: Landmark },
        { id: 'localization', name: 'Localization & Currency', icon: Globe },
        { id: 'workspace', name: 'Financial Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
      ]
    : [
        { id: 'workspace', name: 'Operations Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
        { id: 'localization', name: 'Localization', icon: Globe },
      ], [isAccounting])"""

new_tabs = """  const tabs = useMemo(() => isAccounting
    ? [
        { id: 'manage-banks-cash', name: 'Manage Banks & Petty Cash', icon: Landmark },
        { id: 'workspace', name: 'Financial Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
      ]
    : [
        { id: 'workspace', name: 'Operations Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
      ], [isAccounting])"""

c = c.replace(old_tabs.replace('\r\n', '\n'), new_tabs.replace('\r\n', '\n'))
c = c.replace(old_tabs, new_tabs)

# 4. Update header subtitle
c = c.replace(
    "Configure company bank accounts, petty cash custody, localization, and module visibility",
    "Configure company bank accounts, petty cash custody, and module visibility"
)

# 5. Update useEffect to auto-replace tab parameter if invalid/localization
old_use_effect = """  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      if (validTabs.includes(tabParam)) {
        if (tabParam !== activeTab) {
          setActiveTab(tabParam)
        }
      } else {
        setActiveTab(defaultTab)
      }
    }
  }, [searchParams, validTabs, defaultTab, activeTab])"""

new_use_effect = """  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      if (validTabs.includes(tabParam)) {
        if (tabParam !== activeTab) {
          setActiveTab(tabParam)
        }
      } else {
        setActiveTab(defaultTab)
        setSearchParams({ tab: defaultTab }, { replace: true })
      }
    }
  }, [searchParams, validTabs, defaultTab, activeTab, setSearchParams])"""

c = c.replace(old_use_effect.replace('\r\n', '\n'), new_use_effect.replace('\r\n', '\n'))
c = c.replace(old_use_effect, new_use_effect)

# 6. Remove the entire Localization JSX block
import re
localization_block_pattern = re.compile(
    r'\s*\{\/\* Localization \*\/\}\s*\{activeTab === \'localization\' && \([\s\S]*?\n      \)\}\n',
    re.MULTILINE
)
c = localization_block_pattern.sub('\n', c)

with open('frontend/src/pages/Settings.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated Settings.jsx successfully')

