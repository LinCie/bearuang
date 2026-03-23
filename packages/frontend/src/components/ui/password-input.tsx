import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PasswordInputProps extends React.ComponentProps<typeof Input> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div className="relative group w-full">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn(
            'w-full bg-transparent border-input border rounded-lg h-12 px-4 pr-12 focus-visible:ring-1 focus-visible:ring-primary transition-colors placeholder:text-muted-foreground/50',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={
            showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
          }
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
