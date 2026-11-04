with open('frontend/src/pages/Cashbook.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """  const isAdmin = isUserAdmin(user)
  const hasAccess = isAdmin || hasModuleAccess(user, 'cashbook')

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  const [searchParams, setSearchParams] = useSearchParams()"""

replacement1 = """  const isAdmin = isUserAdmin(user)
  const hasAccess = isAdmin || hasModuleAccess(user, 'cashbook')

  const [searchParams, setSearchParams] = useSearchParams()"""

target2 = """    unreadCount: 0
  }

  return ("""

replacement2 = """    unreadCount: 0
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  return ("""

c = content.replace('\r\n', '\n')
assert target1 in c, 'target1 not found'
assert target2 in c, 'target2 not found'

c = c.replace(target1, replacement1, 1)
c = c.replace(target2, replacement2, 1)

with open('frontend/src/pages/Cashbook.jsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(c)

print('Successfully moved early return in Cashbook.jsx')

