import { useCallback, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Youtube from '@tiptap/extension-youtube'
import { common, createLowlight } from 'lowlight'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Table as TableIcon,
  Trash2,
  UnderlineIcon,
  Undo2,
  Video,
} from 'lucide-react'
import { uploadFile } from '../lib/api'

const lowlight = createLowlight(common)

const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS' },
]

interface Props {
  initialContent: Record<string, unknown> | null
  onUpdate: (json: Record<string, unknown>, html: string) => void
  onReady?: (editor: Editor) => void
  placeholder?: string
  embedded?: boolean
}

export default function TiptapEditor({
  initialContent,
  onUpdate,
  onReady,
  placeholder,
  embedded,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      CharacterCount,
      TextStyle,
      Color,
      FontFamily,
      Youtube.configure({ width: 640, height: 360 }),
    ],
    content: initialContent && Object.keys(initialContent).length ? initialContent : '',
    onUpdate: ({ editor }) => onUpdate(editor.getJSON() as Record<string, unknown>, editor.getHTML()),
    onCreate: ({ editor }) => onReady?.(editor),
  })

  if (!editor) return null

  return (
    <div className={embedded ? '' : 'overflow-hidden rounded-xl border border-zinc-200 bg-white'}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex justify-end border-t border-zinc-100 px-4 py-1.5 text-xs text-zinc-400">
        {editor.storage.characterCount.words()} word{editor.storage.characterCount.words() === 1 ? '' : 's'} ·{' '}
        {editor.storage.characterCount.characters()} characters
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const imageInputRef = useRef<HTMLInputElement>(null)

  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addYoutube = useCallback(() => {
    const url = window.prompt('YouTube URL')
    if (url) editor.commands.setYoutubeVideo({ src: url })
  }, [editor])

  const onImagePicked = async (file: File | undefined) => {
    if (!file) return
    try {
      const { url } = await uploadFile(file, 'image')
      editor.chain().focus().setImage({ src: url }).run()
    } catch (e) {
      alert(`Image upload failed: ${(e as Error).message}`)
    }
  }

  const inTable = editor.isActive('table')

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-zinc-50/60 px-2 py-1.5">
      <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={15} />
      </Btn>
      <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={15} />
      </Btn>

      <Divider />

      <select
        title="Font family"
        className="h-7 rounded-md border border-transparent bg-transparent px-1 text-xs text-zinc-600 hover:border-zinc-200 focus:outline-none"
        value={(editor.getAttributes('textStyle').fontFamily as string) ?? ''}
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run()
          else editor.chain().focus().unsetFontFamily().run()
        }}
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <label title="Text color" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-zinc-200/60">
        <span
          className="block h-4 w-4 rounded-sm border border-zinc-300"
          style={{ backgroundColor: (editor.getAttributes('textStyle').color as string) ?? '#18181b' }}
        />
        <input
          type="color"
          className="h-0 w-0 opacity-0"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>

      <Divider />

      <Btn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={15} />
      </Btn>
      <Btn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} />
      </Btn>
      <Btn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={15} />
      </Btn>

      <Divider />

      <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </Btn>
      <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </Btn>
      <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={15} />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={15} />
      </Btn>
      <Btn title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={15} />
      </Btn>
      <Btn title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}>
        <Highlighter size={15} />
      </Btn>
      <Btn title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
        <SubIcon size={15} />
      </Btn>
      <Btn title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        <SupIcon size={15} />
      </Btn>

      <Divider />

      <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft size={15} />
      </Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter size={15} />
      </Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight size={15} />
      </Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify size={15} />
      </Btn>

      <Divider />

      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} />
      </Btn>
      <Btn title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListTodo size={15} />
      </Btn>
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} />
      </Btn>
      <Btn title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <SquareCode size={15} />
      </Btn>
      <Btn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={15} />
      </Btn>

      <Divider />

      <Btn title="Add / edit link" active={editor.isActive('link')} onClick={setLink}>
        <Link2 size={15} />
      </Btn>
      <Btn title="Remove link" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>
        <Link2Off size={15} />
      </Btn>
      <Btn title="Insert image" onClick={() => imageInputRef.current?.click()}>
        <ImageIcon size={15} />
      </Btn>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onImagePicked(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Btn title="Embed YouTube video" onClick={addYoutube}>
        <Video size={15} />
      </Btn>
      <Btn
        title="Insert table"
        active={inTable}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon size={15} />
      </Btn>

      {inTable && (
        <>
          <Divider />
          <TextBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>+Col</TextBtn>
          <TextBtn onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</TextBtn>
          <TextBtn onClick={() => editor.chain().focus().deleteColumn().run()}>−Col</TextBtn>
          <TextBtn onClick={() => editor.chain().focus().deleteRow().run()}>−Row</TextBtn>
          <TextBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header</TextBtn>
          <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 size={15} />
          </Btn>
        </>
      )}

      <Divider />

      <Btn
        title="Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        <Eraser size={15} />
      </Btn>
    </div>
  )
}

function Btn({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-200/60'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-200" />
}

function TextBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-7 rounded-md px-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
    >
      {children}
    </button>
  )
}
