import React, { useState, useEffect } from 'react'
import api from '../../api'
import { Field, Select as CredSelect } from '../common/FormPrimitives'

/**
 * Helper to fetch all records from an endpoint without silent truncation.
 * Tries `nopage=true` first, then paginates until exhaustion if needed.
 */
async function fetchAllAccounts(endpoint) {
  try {
    const res = await api.get(`${endpoint}?nopage=true`)
    let items = []
    if (Array.isArray(res.data)) {
      items = res.data
    } else if (res.data && Array.isArray(res.data.results)) {
      items = [...res.data.results]
      let nextUrl = res.data.next
      while (nextUrl) {
        // Fetch remaining pages if server enforced pagination
        const nextRes = await api.get(nextUrl)
        if (nextRes.data && Array.isArray(nextRes.data.results)) {
          items.push(...nextRes.data.results)
          nextUrl = nextRes.data.next
        } else {
          break
        }
      }
    }
    return items
  } catch (err) {
    console.error(`Failed to fetch accounts from ${endpoint}:`, err)
    return []
  }
}

/**
 * AdvancePaymentSource
 * Shared component for selecting the destination account for job order advance payments.
 * Supports Bank Account and Petty Cash Account types.
 * Shows account names only (no balances).
 * Includes active accounts plus the job's current account if inactive.
 */
export default function AdvancePaymentSource({
  accountType = 'bank', // 'bank' | 'petty_cash'
  accountId = '',
  onAccountTypeChange,
  onAccountIdChange,
  currentAccount = null, // { account_type, account_id, account_name }
  required = true,
  error = null
}) {
  const [banks, setBanks] = useState([])
  const [pettyCashAccounts, setPettyCashAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const loadAccounts = async () => {
      setLoading(true)
      const [bankData, pcaData] = await Promise.all([
        fetchAllAccounts('/banks/'),
        fetchAllAccounts('/petty-cash-accounts/')
      ])

      if (!isMounted) return

      // Filter active accounts
      let activeBanks = bankData.filter(b => b.status === 'Active' || !b.status)
      let activePcas = pcaData.filter(p => p.status === 'Active' || !p.status)

      // If current account is present and was inactive, ensure it is included
      if (currentAccount && currentAccount.account_id) {
        if (currentAccount.account_type === 'bank') {
          const exists = activeBanks.some(b => String(b.id) === String(currentAccount.account_id))
          if (!exists) {
            const match = bankData.find(b => String(b.id) === String(currentAccount.account_id))
            if (match) {
              activeBanks.push(match)
            } else {
              activeBanks.push({
                id: currentAccount.account_id,
                bank_name: currentAccount.account_name || `Bank #${currentAccount.account_id} (Archived)`
              })
            }
          }
        } else if (currentAccount.account_type === 'petty_cash') {
          const exists = activePcas.some(p => String(p.id) === String(currentAccount.account_id))
          if (!exists) {
            const match = pcaData.find(p => String(p.id) === String(currentAccount.account_id))
            if (match) {
              activePcas.push(match)
            } else {
              activePcas.push({
                id: currentAccount.account_id,
                name: currentAccount.account_name || `Petty Cash #${currentAccount.account_id} (Archived)`
              })
            }
          }
        }
      }

      setBanks(activeBanks)
      setPettyCashAccounts(activePcas)
      setLoading(false)
    }

    loadAccounts()
    return () => { isMounted = false }
  }, [currentAccount])

  const isBank = accountType === 'bank'
  const currentList = isBank ? banks : pettyCashAccounts

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px 20px',
      gridColumn: '1 / -1',
      padding: '12px 14px',
      backgroundColor: 'var(--fill-ghost-hover, #F8FAFC)',
      border: '1px solid var(--border, #E2E8F0)',
      borderRadius: '12px',
      marginBottom: '4px'
    }}>
      {/* 1. Account Type (Bank Account vs. Petty Cash) */}
      <div>
        <Field label="Payment Source Type" required={required}>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            height: '40px'
          }}>
            <button
              type="button"
              onClick={() => {
                if (accountType !== 'bank') {
                  onAccountTypeChange('bank')
                  onAccountIdChange('')
                }
              }}
              style={{
                flex: 1,
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                border: isBank ? '1.5px solid #0A0A0A' : '1px solid #E2E8F0',
                backgroundColor: isBank ? '#0A0A0A' : '#FFFFFF',
                color: isBank ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Bank Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (accountType !== 'petty_cash') {
                  onAccountTypeChange('petty_cash')
                  onAccountIdChange('')
                }
              }}
              style={{
                flex: 1,
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                border: !isBank ? '1.5px solid #0A0A0A' : '1px solid #E2E8F0',
                backgroundColor: !isBank ? '#0A0A0A' : '#FFFFFF',
                color: !isBank ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Petty Cash</span>
            </button>
          </div>
        </Field>
      </div>

      {/* 2. Account Dropdown (Names only, no balances) */}
      <div>
        <Field
          label={isBank ? 'Receiving Bank Account' : 'Receiving Petty Cash Account'}
          required={required}
          error={error}
        >
          <CredSelect
            value={accountId || ''}
            onChange={(e) => onAccountIdChange(e.target.value)}
            required={required}
            disabled={loading}
          >
            <option value="">
              {loading
                ? 'Loading accounts...'
                : isBank
                ? '-- Select Bank Account --'
                : '-- Select Petty Cash Account --'}
            </option>
            {currentList.map((acc) => {
              const name = isBank ? acc.bank_name : (acc.name || acc.holder_name)
              return (
                <option key={acc.id} value={acc.id}>
                  {name}
                </option>
              )
            })}
          </CredSelect>
        </Field>
      </div>
    </div>
  )
}

