import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Link } from '@tiptap/extension-link'

import { cn } from '#lib/utils'
import { Button } from '#components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '#components/ui/tooltip'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  editorClassName?: string
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  tooltip,
  children,
  size = 'icon-sm',
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  tooltip: string
  children: React.ReactNode
  size?: 'icon-sm' | 'icon-xs'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isActive ? 'secondary' : 'ghost'}
          size={size}
          onClick={onClick}
          disabled={disabled}
          className={cn(isActive && 'bg-muted text-foreground')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span>{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  )
}

export function RichTextEditor({
  value,
  onChange,
  className,
  editorClassName,
}: RichTextEditorProps) {
  const editorRef = React.useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
        },
      }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[80px] px-3 py-2',
          'data-[state=empty]:text-muted-foreground [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold',
          '[&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4',
          '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono',
          '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_a]:text-primary [&_a]:underline',
          editorClassName,
        ),
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const markdown = updatedEditor.getMarkdown()
      onChange(markdown)
    },
  })

  editorRef.current = editor

  React.useEffect(() => {
    const currentEditor = editorRef.current
    if (currentEditor && value !== currentEditor.getMarkdown()) {
      currentEditor.commands.setContent(value || '', {
        contentType: 'markdown',
        emitUpdate: false,
      })
    }
  }, [value])

  if (!editor) {
    return null
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div
      className={cn('rounded-lg border border-input bg-background', className)}
    >
      <div className="flex flex-wrap gap-0.5 border-b border-input p-1.5">
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive('heading', { level: 1 })}
          tooltip="Heading 1"
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive('heading', { level: 2 })}
          tooltip="Heading 2"
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive('heading', { level: 3 })}
          tooltip="Heading 3"
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Bold (Ctrl+B)"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Italic (Ctrl+I)"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          tooltip="Inline Code"
        >
          <Code className="size-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Bullet List"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Numbered List"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>

        <div className="w-px bg-border mx-1 self-stretch" />

        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive('link')}
          tooltip="Add Link"
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
        {editor.isActive('link') && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            isActive={false}
            tooltip="Remove Link"
          >
            <Unlink className="size-4" />
          </ToolbarButton>
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
