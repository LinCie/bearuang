import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '#/lib/utils'

export interface IconInputProps extends React.ComponentProps<typeof Input> {
  icon: React.ElementType
  iconClassName?: string
}

const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ className, icon: Icon, iconClassName, ...props }, ref) => {
    return (
      <div className="relative group w-full">
        <Icon
          className={cn(
            'absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors',
            iconClassName,
          )}
        />
        <Input
          ref={ref}
          className={cn(
            'w-full bg-muted/80 hover:bg-muted border-none rounded-xl py-6 pl-12 pr-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-transparent transition-colors placeholder:text-muted-foreground/60',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
IconInput.displayName = 'IconInput'

export { IconInput }
