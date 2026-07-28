import {Bold, Italic, List, ListOrdered, Undo, Redo} from "lucide-react";

export default function Toolbar({ editor }) {
    if (!editor){
        return null;
    }

    return (
        <div className="editor-toolbar">
            <button onclick={()=>editor.chain().focus().toggleBold().run()}><Bold size={16}/></button>
            <button onclick={()=>editor.chain().focus().toggleItalic().run()}><Italic size={16}/></button>
            <button onclick={()=>editor.chain().focus().toggleBulletList().run()}><List size={16}/></button>
            <button onclick={()=>editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16}/></button>
            <button onclick={()=>editor.chain().focus().undo().run()}><Undo size={16}/></button>
            <button onclick={()=>editor.chain().focus().redo().run()}><Redo size={16}/></button>
        </div>
    );
}

