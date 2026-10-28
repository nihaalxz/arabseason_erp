import React from 'react';

const CredButton = ({
  variant = 'primary', // 'primary' | 'pill-outlined' | 'text-link' | 'cta-yellow'
  children,
  onClick,
  icon: Icon = null,
  iconPosition = 'left',
  disabled = false,
  className = '',
  style = {},
  type = 'button',
  ...rest
}) => {
  let variantClass = 'cred-btn-primary';
  if (variant === 'pill-outlined') variantClass = 'cred-btn-pill-outlined';
  else if (variant === 'text-link') variantClass = 'cred-btn-text-link';
  else if (variant === 'cta-yellow') variantClass = 'cred-btn-cta-yellow';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variantClass} ${className}`}
      style={style}
      {...rest}
    >
      {Icon && iconPosition === 'left' && <Icon size={16} strokeWidth={1.5} />}
      <span>{children}</span>
      {Icon && iconPosition === 'right' && <Icon size={16} strokeWidth={1.5} />}
    </button>
  );
};

export default CredButton;
