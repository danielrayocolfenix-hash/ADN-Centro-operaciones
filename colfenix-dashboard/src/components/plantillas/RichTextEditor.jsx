import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize, Color } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered } from "lucide-react";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px"];

// onMouseDown+preventDefault en los botones de la barra evita que el click
// robe el foco/la selección del editor antes de que el comando se ejecute
// (si no, editor.chain().focus()... ya no tiene texto seleccionado).
const stopFocusSteal = (event) => event.preventDefault();

export default function RichTextEditor({ value, onChange, placeholder, className = "" }) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TextStyle,
        FontSize,
        Color,
        Placeholder.configure({ placeholder }),
      ],
      content: value || "",
      onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    },
    [],
  );

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (incoming !== current) editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={`rt-editor rt-editable ${className}`}>
      <BubbleMenu editor={editor} className="rt-bubble-menu">
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "active" : ""}
          title="Negrita"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "active" : ""}
          title="Cursiva"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "active" : ""}
          title="Subrayado"
        >
          <UnderlineIcon size={13} />
        </button>
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "active" : ""}
          title="Tachado"
        >
          <Strikethrough size={13} />
        </button>
        <span className="rt-bubble-divider" />
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "active" : ""}
          title="Lista con viñetas"
        >
          <List size={13} />
        </button>
        <button
          type="button"
          onMouseDown={stopFocusSteal}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "active" : ""}
          title="Lista numerada"
        >
          <ListOrdered size={13} />
        </button>
        <span className="rt-bubble-divider" />
        {FONT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onMouseDown={stopFocusSteal}
            onClick={() => editor.chain().focus().setFontSize(size).run()}
            className={editor.isActive("textStyle", { fontSize: size }) ? "active" : ""}
            title={`Tamaño ${parseInt(size, 10)}`}
          >
            {parseInt(size, 10)}
          </button>
        ))}
        <span className="rt-bubble-divider" />
        <input
          type="color"
          className="rt-bubble-color"
          value={editor.getAttributes("textStyle").color || "#1a1a1a"}
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          title="Color de texto"
        />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
