import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CredPageHeader from '../CredPageHeader';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import CredLedgerTable from '../CredLedgerTable';
import Money from '../Money';
import CredViewAll from '../CredViewAll';
import CredMobileTxList from '../CredMobileTxList';
import { fadeFast } from '../motionTokens';
import { sortNewestFirst } from '../usePagination';

/**
 * CredOverviewView (Dashboard Page)
 * Task 2: Exact five cards row (net balance, inflows, credit due, expenses, customers)
 * Task 3: Cards filter the table below (latest transactions, inflows, expenses, credit due, customers)
 * Task 4: View all links navigate to matching pages with preserved filter state
 */
const CredOverviewView = ({
  isMobile = false,
  netBalance = '0.00',
  statement = {},
  kpis = {},
  latestTransactions = [],
  customers = [],
  expensesList = [],
  onNavigate = null,
  onNavigateSection = null,
  onViewAllTransactions = null,
  initialDrawer = null,
  isLoading = false
}) => {
  const {
    totalInflows = '0.00',
    creditDue = '0.00',
    totalExpenses = '0.00',
    customersCount = customers.length
  } = kpis;

  // Active card filter: 'net_balance' | 'inflows' | 'credit_due' | 'expenses' | 'customers'
  // Preselect from ?view= URL param if an old URL contains view=inflows, view=credit_due, etc.
  const [activeCard, setActiveCard] = useState(() => {
    if (initialDrawer === 'inflows') return 'inflows';
    if (initialDrawer === 'credit_due') return 'credit_due';
    if (initialDrawer === 'expenses') return 'expenses';
    if (initialDrawer === 'clientele' || initialDrawer === 'customers') return 'customers';
    return 'net_balance';
  });

  // Clicking a card switches the table content; clicking active card again returns to default (net balance)
  const handleCardClick = (cardKey) => {
    if (activeCard === cardKey) {
      setActiveCard('net_balance');
    } else {
      setActiveCard(cardKey);
    }
  };

  // 1. Transaction Modes Data & Filtering
  const cashInTransactions = useMemo(() => {
    return (latestTransactions || []).filter(t => t.entry_type === 'in' || t.type === 'in');
  }, [latestTransactions]);

  const cashOutTransactions = useMemo(() => {
    return (latestTransactions || []).filter(t => t.entry_type === 'out' || t.type === 'out');
  }, [latestTransactions]);

  // 2. Customer Modes Data & Filtering
  const customersWithCreditDue = useMemo(() => {
    return (customers || []).filter(c => {
      const due = parseFloat(c.payable_amount || c.pending_balance || 0);
      return due > 0;
    });
  }, [customers]);

  // Section title, total count, view all text and destination
  const sectionConfig = useMemo(() => {
    switch (activeCard) {
      case 'inflows':
        return {
          title: 'CASH IN TRANSACTIONS',
          count: cashInTransactions.length,
          viewAllText: 'view all cash in >',
          ariaLabel: 'view all cash in transactions in the cash ledger',
          navigate: () => {
            if (onNavigate) onNavigate('ledger', { flow: 'in' });
            else if (onNavigateSection) onNavigateSection('ledger', { flow: 'in' });
          }
        };
      case 'expenses':
        return {
          title: 'EXPENSES',
          count: cashOutTransactions.length,
          viewAllText: 'view all expenses >',
          ariaLabel: 'view all expenses',
          navigate: () => {
            if (onNavigate) onNavigate('expenses');
            else if (onNavigateSection) onNavigateSection('expenses');
          }
        };
      case 'credit_due':
        return {
          title: 'CREDIT DUE',
          count: customersWithCreditDue.length,
          viewAllText: 'view all customers with credit due >',
          ariaLabel: 'view all customers with credit due',
          navigate: () => {
            if (onNavigate) onNavigate('customers', { due: '1' });
            else if (onNavigateSection) onNavigateSection('customers', { due: '1' });
          }
        };
      case 'customers':
        return {
          title: 'CUSTOMERS',
          count: customers.length,
          viewAllText: 'view all customers >',
          ariaLabel: 'view all customers',
          navigate: () => {
            if (onNavigate) onNavigate('customers');
            else if (onNavigateSection) onNavigateSection('customers');
          }
        };
      case 'net_balance':
      default:
        return {
          title: 'LATEST TRANSACTIONS',
          count: latestTransactions.length,
          viewAllText: 'view all transactions >',
          ariaLabel: 'view all transactions in the cash ledger',
          navigate: () => {
            if (onNavigate) onNavigate('ledger');
            else if (onViewAllTransactions) onViewAllTransactions();
            else if (onNavigateSection) onNavigateSection('ledger');
          }
        };
    }
  }, [activeCard, cashInTransactions, cashOutTransactions, customersWithCreditDue, customers, latestTransactions, onNavigate, onNavigateSection, onViewAllTransactions]);

  // Formatted date headline (e.g. "OCTOBER 24, 2026")
  const dateHeadline = useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    } catch (e) {
      return 'TODAY';
    }
  }, []);

  const isCustomerMode = activeCard === 'credit_due' || activeCard === 'customers';

  const latestTxEntries = useMemo(() => {
    return sortNewestFirst(
      activeCard === 'inflows' 
        ? cashInTransactions 
        : activeCard === 'expenses' 
          ? cashOutTransactions 
          : (latestTransactions || [])
    ).slice(0, 10);
  }, [activeCard, cashInTransactions, cashOutTransactions, latestTransactions]);

  return (
    <div className="cred-overview-page" style={{ width: '100%', position: 'relative' }}>
      {/* Page Header: Title "dashboard", no buttons on right */}
      <CredPageHeader
        title="dashboard"
        dateHeadline={dateHeadline}
        actions={null}
      />

      {/* Exactly FIVE cards: mobile horizontal carousel & desktop grid row */}
      <CredCardCarousel
        isMobile={isMobile}
        activeId={activeCard}
        className="cred-dashboard-cards-grid"
        desktopGridColumns="repeat(auto-fit, minmax(210px, 1fr))"
        style={{
          marginBottom: '28px'
        }}
      >
        {/* Card 1: Net Balance */}
        <MoneyCard
          label="NET BALANCE"
          value={netBalance}
          variant="default"
          caption="available cash & bank reserves"
          isActive={activeCard === 'net_balance'}
          onClick={() => handleCardClick('net_balance')}
        />

        {/* Card 2: Total Company Inflows */}
        <MoneyCard
          label="TOTAL COMPANY INFLOWS"
          value={totalInflows}
          variant="positive"
          caption="all channels: banks, books & cash"
          isActive={activeCard === 'inflows'}
          onClick={() => handleCardClick('inflows')}
        />

        {/* Card 3: Credit Due */}
        <MoneyCard
          label="CREDIT DUE"
          value={creditDue}
          variant="default"
          caption="remaining balances"
          isActive={activeCard === 'credit_due'}
          onClick={() => handleCardClick('credit_due')}
        />

        {/* Card 4: Total Company Expenses */}
        <MoneyCard
          label="TOTAL COMPANY EXPENSES"
          value={totalExpenses}
          variant="danger"
          caption="all business costs & expenses"
          isActive={activeCard === 'expenses'}
          onClick={() => handleCardClick('expenses')}
        />

        {/* Card 5: Customers (Plain number count, never formatted as currency) */}
        <MoneyCard
          label="CUSTOMERS"
          value={customersCount}
          isCount={true}
          variant="default"
          caption="saved accounts"
          isActive={activeCard === 'customers'}
          onClick={() => handleCardClick('customers')}
        />
      </CredCardCarousel>

      {/* Task 3 & 4: Section Header Row with Uppercase Label + Count & "View All >" link */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '12px',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)' }}>
          {sectionConfig.title} <span style={{ opacity: 0.7 }}>({sectionConfig.count})</span>
        </div>

        <CredViewAll
          onClick={sectionConfig.navigate}
          ariaLabel={sectionConfig.ariaLabel}
        />
      </div>

      {/* Task 3: One Outlined 20px Table Card on Desktop / Borderless Stack on Mobile */}
      <div
        className="cred-dashboard-table-card"
        style={isMobile ? {
          borderRadius: 0,
          border: 'none',
          background: 'transparent',
          overflow: 'visible',
          minHeight: 'auto',
          boxShadow: 'none',
          padding: 0
        } : {
          borderRadius: '20px',
          border: '1px solid var(--border, #E4E4E4)',
          background: 'var(--bg, #FFFFFF)',
          overflow: 'hidden',
          minHeight: '400px'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCard}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeFast}
            style={{ width: '100%' }}
          >
            {isCustomerMode ? (
              /* Customer Modes: Credit Due (balance > 0) or All Customers (first 10) */
              <div className="cred-ledger-table-wrap">
                <div 
                  className="cred-ledger-table-head"
                  style={{ gridTemplateColumns: 'minmax(240px, 2fr) minmax(160px, 1.2fr) 140px' }}
                >
                  <div>CUSTOMER</div>
                  <div>PHONE</div>
                  <div style={{ textAlign: 'right' }}>BALANCE DUE</div>
                </div>

                {isLoading ? (
                  <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div 
                        key={n} 
                        style={{ 
                          height: '42px', 
                          borderRadius: '10px', 
                          background: 'var(--bg-subtle, #F5F5F5)', 
                          animation: 'pulse 1.5s infinite ease-in-out' 
                        }} 
                      />
                    ))}
                  </div>
                ) : (activeCard === 'credit_due' ? customersWithCreditDue : customers).length === 0 ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                      {activeCard === 'credit_due' ? 'no customers with credit due' : 'no customers recorded'}
                    </div>
                  </div>
                ) : (
                  (activeCard === 'credit_due' ? customersWithCreditDue : customers).slice(0, 10).map((customer) => {
                    const dueAmount = customer.payable_amount || customer.pending_balance || '0.00';
                    const isDue = parseFloat(dueAmount || 0) > 0;
                    const initial = (customer.name || 'C')[0].toUpperCase();

                    return (
                      <div 
                        key={customer.id}
                        className="cred-ledger-table-row"
                        style={{
                          gridTemplateColumns: 'minmax(240px, 2fr) minmax(160px, 1.2fr) 140px',
                          cursor: 'default'
                        }}
                      >
                        {/* 1. CUSTOMER: Avatar initial + name + company */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div 
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              border: '1px solid var(--border, #E4E4E4)',
                              background: 'var(--bg-panel, #F7F7F7)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: 'var(--text, #0A0A0A)',
                              flexShrink: 0
                            }}
                          >
                            {initial}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text, #0A0A0A)' }}>
                              {customer.name || 'Unnamed Client'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                              {customer.company || 'Direct Client'}
                            </div>
                          </div>
                        </div>

                        {/* 2. PHONE */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customer.phone || '—'}
                        </div>

                        {/* 3. BALANCE DUE */}
                        <div 
                          style={{ 
                            textAlign: 'right', 
                            fontSize: '13px', 
                            fontWeight: 700,
                            color: isDue ? 'var(--danger, #E5482E)' : 'var(--text-muted, #8C8C8C)'
                          }}
                        >
                          <Money value={dueAmount} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : isMobile ? (
              /* Mobile Transaction List: extracted shared CredMobileTxList sitting directly on page background */
              <CredMobileTxList
                entries={latestTxEntries}
                isClickable={false}
                showBalance={false}
                isLoading={isLoading}
                emptyMessage={
                  activeCard === 'inflows' 
                    ? 'no cash-in transactions found' 
                    : activeCard === 'expenses' 
                      ? 'no expenses recorded' 
                      : 'no transactions found'
                }
              />
            ) : (
              /* Desktop Transaction Table */
              <CredLedgerTable
                entries={latestTxEntries}
                columns={['date', 'particulars', 'relation', 'flow', 'amount']}
                isClickable={false}
                isLoading={isLoading}
                emptyMessage={
                  activeCard === 'inflows' 
                    ? 'no cash-in transactions found' 
                    : activeCard === 'expenses' 
                      ? 'no expenses recorded' 
                      : 'no transactions found'
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CredOverviewView;
