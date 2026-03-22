import { useState, useEffect } from 'react'

/**
 * A text input that allows the user to type any value, but validates on blur.
 * If the value is invalid on blur, it briefly shows a red cue then reverts
 * to the last valid (committed) value.
 *
 * Props:
 *   value      – the current committed (valid) value (number or string)
 *   onChange    – called with the new value when a valid value is committed
 *   validate   – (parsedNumber) => boolean; returns true if valid
 *   parse      – optional custom parser (default: parseFloat)
 *   step       – optional step for the input
 *   style      – optional inline styles
 *   className  – optional extra class name
 */
export default function ValidatedInput({
  value,
  onChange,
  validate,
  parse,
  step,
  style,
  className,
}) {
  const [displayValue, setDisplayValue] = useState(String(value))
  const [isInvalid, setIsInvalid] = useState(false)

  // Sync display value when the committed value changes externally
  useEffect(() => {
    setDisplayValue(String(value))
  }, [value])

  const handleChange = (e) => {
    setDisplayValue(e.target.value)
    setIsInvalid(false)
  }

  const handleBlur = () => {
    const parser = parse || parseFloat
    const parsed = parser(displayValue)
    if (!isNaN(parsed) && validate(parsed)) {
      onChange(parsed)
      setIsInvalid(false)
    } else {
      // Invalid: show cue and revert
      setIsInvalid(true)
      setTimeout(() => {
        setDisplayValue(String(value))
        setIsInvalid(false)
      }, 800)
    }
  }

  const classes = [className, isInvalid ? 'input-invalid' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={classes || undefined}
      step={step}
      style={style}
    />
  )
}
