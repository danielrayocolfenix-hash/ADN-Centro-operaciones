import { useEditor, EditorContent } from "@tiptap/react";
import StartedKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import Toolbar from "./Toolbar";

export default function TipTapEditor({ value, onChange, placeholder }) {

    const editor = useEditor({
        extensions: [
            StartedKit,
            Placeholder.configure({
                placeholder
            })
        ],
        content: value,
        onUpdate({ editor }) {
            onChange(editor.getHTML());
        }
    });

    return (
        <div className="editor">
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>

    );
}