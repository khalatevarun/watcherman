interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    loadingText?: string;
    icon?: React.ReactNode;
    defaultText: string;
  }
  
  const Button: React.FC<ButtonProps> = ({ 
    isLoading = false, 
    className = '', 
    disabled = false,
    loadingText = 'Loading...',
    defaultText = 'Submit',
    icon=null,
    ...props 
  }) => {
    return (
      <button
        disabled={isLoading || disabled}
        className={`
          flex items-center gap-2 px-4 py-2 
          text-sm font-medium text-gray-900
          bg-white border border-gray-900 rounded-md 
          transition-colors duration-200
          hover:bg-gray-900 hover:text-white
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900
          ${className}
        `}
        {...props}
      >
        {icon}
        {isLoading ? loadingText : defaultText}
      </button>
    );
  };
  
  export default Button;