/**
 * @fileoverview Secure input component with built-in validation and sanitization.
 * Provides a reusable, accessible input field with XSS protection and visual feedback.
 * 
 * @module components/ui/SecureInput
 * @version 1.0.0
 */

import React, { useState, useCallback, forwardRef } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import {
  validateInput,
  validateWithRules,
  sanitizeInput,
  VALIDATION_PATTERNS,
  type ValidationRules,
  type ValidationResult,
} from '@/lib/security';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the SecureInput component.
 * Extends standard HTML input attributes with security and validation features.
 * 
 * @interface SecureInputProps
 * @extends {Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>}
 */
interface SecureInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Optional label text displayed above the input */
  label?: string;
  
  /** Optional icon to display on the left side of the input */
  icon?: React.ReactNode;
  
  /** 
   * Predefined validation pattern to use.
   * @see VALIDATION_PATTERNS in lib/security.ts
   */
  validationType?: keyof typeof VALIDATION_PATTERNS;
  
  /** Custom validation rules for flexible validation */
  validationRules?: ValidationRules;
  
  /** 
   * Whether to sanitize input against XSS attacks.
   * Disabled for password fields automatically.
   * @default true
   */
  sanitize?: boolean;
  
  /** 
   * Whether to show validation status icons.
   * @default true
   */
  showValidation?: boolean;
  
  /** External error message to display (overrides internal validation) */
  error?: string;
  
  /** Success message to display when validation passes */
  success?: string;
  
  /** 
   * Callback fired when input value changes.
   * Receives sanitized value and validation status.
   */
  onChange?: (value: string, isValid: boolean) => void;
  
  /** Callback fired when validation state changes */
  onValidationChange?: (result: ValidationResult) => void;
}

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * A secure input component with built-in validation, sanitization, and visual feedback.
 * 
 * Features:
 * - Automatic XSS sanitization of user input
 * - Built-in validation with predefined patterns or custom rules
 * - Password visibility toggle for password fields
 * - Visual feedback with success/error states
 * - Accessible with proper ARIA attributes
 * - Supports forwarded refs for form integration
 * 
 * @component
 * @example
 * // Email input with built-in validation
 * <SecureInput
 *   label="Email Address"
 *   validationType="email"
 *   icon={<Mail className="w-5 h-5" />}
 *   onChange={(value, isValid) => {
 *     setEmail(value);
 *     setEmailValid(isValid);
 *   }}
 * />
 * 
 * @example
 * // Password input with custom rules
 * <SecureInput
 *   label="Password"
 *   type="password"
 *   validationRules={{
 *     required: true,
 *     minLength: 8,
 *     custom: (value) => ({
 *       valid: /[A-Z]/.test(value),
 *       error: 'Must contain uppercase letter'
 *     })
 *   }}
 * />
 * 
 * @example
 * // Simple text input with sanitization
 * <SecureInput
 *   label="Username"
 *   sanitize={true}
 *   validationRules={{ required: true, minLength: 3 }}
 * />
 */
export const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(
  (
    {
      label,
      icon,
      validationType,
      validationRules,
      sanitize = true,
      showValidation = true,
      error: externalError,
      success,
      onChange,
      onValidationChange,
      type = 'text',
      className = '',
      ...props
    },
    ref
  ) => {
    // ========================================================================
    // STATE
    // ========================================================================
    
    /** Controls password visibility for password-type inputs */
    const [showPassword, setShowPassword] = useState(false);
    
    /** Tracks whether the input has been interacted with */
    const [touched, setTouched] = useState(false);
    
    /** Internal validation error message */
    const [internalError, setInternalError] = useState<string | null>(null);
    
    /** Whether the current value passes validation */
    const [isValid, setIsValid] = useState(false);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================
    
    /** Use external error if provided, otherwise use internal validation error */
    const error = externalError || internalError;
    
    /** Check if this is a password field for special handling */
    const isPassword = type === 'password';

    // ========================================================================
    // VALIDATION LOGIC
    // ========================================================================

    /**
     * Validates the input value using configured validation type or rules.
     * 
     * @param {string} value - The value to validate
     * @returns {ValidationResult} Validation result with valid flag and error message
     */
    const validateValue = useCallback(
      (value: string): ValidationResult => {
        // Use predefined validation pattern if specified
        if (validationType) {
          return validateInput(value, validationType);
        }
        // Use custom validation rules if specified
        if (validationRules) {
          return validateWithRules(value, validationRules);
        }
        // No validation configured - always valid
        return { valid: true };
      },
      [validationType, validationRules]
    );

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handles input change events with sanitization and validation.
     * 
     * @param {React.ChangeEvent<HTMLInputElement>} e - The change event
     * 
     * @description
     * This handler:
     * 1. Sanitizes the input value (unless it's a password)
     * 2. Validates the sanitized value
     * 3. Updates internal state
     * 4. Notifies parent components of changes
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;

        // Sanitize input to prevent XSS attacks
        // Skip sanitization for passwords to preserve special characters
        if (sanitize && !isPassword) {
          value = sanitizeInput(value);
        }

        // Run validation on the (possibly sanitized) value
        const result = validateValue(value);
        setIsValid(result.valid);
        
        // Only show error if field has been touched (blur event)
        setInternalError(touched && !result.valid ? result.error || null : null);

        // Notify parent component of value change
        onChange?.(value, result.valid);
        
        // Notify parent of validation state change
        onValidationChange?.(result);
      },
      [sanitize, isPassword, validateValue, touched, onChange, onValidationChange]
    );

    /**
     * Handles input blur events to trigger validation display.
     * 
     * @param {React.FocusEvent<HTMLInputElement>} e - The blur event
     * 
     * @description
     * Marks the field as "touched" and displays validation errors.
     * This provides a better UX by not showing errors while typing.
     */
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Mark field as touched to enable error display
        setTouched(true);
        
        // Validate and update state
        const result = validateValue(e.target.value);
        setIsValid(result.valid);
        setInternalError(!result.valid ? result.error || null : null);
        
        // Notify parent of validation change
        onValidationChange?.(result);
        
        // Call original onBlur if provided
        props.onBlur?.(e);
      },
      [validateValue, onValidationChange, props]
    );

    // ========================================================================
    // COMPUTED INPUT TYPE
    // ========================================================================
    
    /**
     * Determines the actual input type to render.
     * For password fields, toggles between 'password' and 'text' based on visibility state.
     */
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
      <div className="w-full">
        {/* Label with required indicator */}
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {validationRules?.required && (
              <span className="text-red-500 ml-1" aria-label="required">*</span>
            )}
          </label>
        )}
        
        {/* Input container with icon support */}
        <div className="relative">
          {/* Left icon */}
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          
          {/* Main input element */}
          <input
            ref={ref}
            type={inputType}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id || 'input'}-error` : undefined}
            className={`
              w-full py-3 border rounded-xl outline-none transition-all
              ${icon ? 'pl-12' : 'pl-4'}
              ${isPassword ? 'pr-12' : 'pr-4'}
              ${error ? 'border-red-300 focus:ring-2 focus:ring-red-200' : ''}
              ${touched && isValid && showValidation ? 'border-green-300 focus:ring-2 focus:ring-green-200' : ''}
              ${!error && !(touched && isValid) ? 'border-gray-200 focus:ring-2 focus:ring-[#CFAFA3]' : ''}
              focus:border-transparent
              ${className}
            `}
            {...props}
          />
          
          {/* Password visibility toggle button */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
          
          {/* Validation status icon (for non-password fields) */}
          {showValidation && touched && !isPassword && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {error ? (
                <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
              ) : isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
              ) : null}
            </div>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <p 
            id={`${props.id || 'input'}-error`}
            className="text-red-500 text-xs mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
        
        {/* Success message */}
        {success && !error && (
          <p className="text-green-500 text-xs mt-1">
            {success}
          </p>
        )}
      </div>
    );
  }
);

// Set display name for React DevTools
SecureInput.displayName = 'SecureInput';

export default SecureInput;
