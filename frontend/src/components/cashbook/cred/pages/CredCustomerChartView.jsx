import React from 'react';
import CredPageHeader from '../CredPageHeader';
import { EmptyState } from '../CredStates';
import { ArrowLeft, LineChart, TrendingUp, Users } from 'lucide-react';

const CredCustomerChartView = ({
  isMobile = false,
  isDarkMode = false,
  onBack = () => {}
}) => {
  return (
    <div className="cred-customer-chart-view" style={{ padding: isMobile ? '12px 14px 80px' : '20px 28px 80px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onBack}
          title="Back to Customers"
          aria-label="Back to Customers"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '1px solid var(--border, #E4E4E4)',
            background: 'var(--bg-panel, #FFFFFF)',
            color: 'var(--text, #0A0A0A)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'border-color 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; }}
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted, #8C8C8C)' }}>
            Customers &nbsp;/&nbsp; Analytics
          </div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, margin: '2px 0 0', color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }}>
            customer chart
          </h1>
        </div>
      </div>

      {/* Main Empty State Placeholder */}
      <EmptyState
        icon={LineChart}
        title="Customer Analytics & Performance Charts"
        description="Comprehensive customer revenue analytics, outstanding balance trends, and billing history charts are currently in development."
        actionLabel="Return to Customers"
        onAction={onBack}
        style={{
          background: 'var(--bg-panel, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '24px',
          padding: isMobile ? '48px 20px' : '64px 32px',
          marginTop: '16px'
        }}
      />
    </div>
  );
};

export default CredCustomerChartView;
