import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { Bold, Italic, List, ListOrdered, ImageIcon } from "lucide-react";
import * as api from "../../lib/commands";
import { useT } from "../../i18n/translations";

const isImageNode = (node: { type: { name: string } } | null | undefined) =>
  !!node && node.type.name === "image";

const IMG_REGEX = /!\[img\]\(([^)]+)\)/g;

// Convert old ![img](path) format to HTML for backward compatibility
function migrateOldFormat(text: string): string {
  if (!text || !text.includes("![img](")) return text;
  return text.replace(IMG_REGEX, (_match, path) => {
    return `<img data-path="${path}" src="" />`;
  });
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function NoteEditor({ value, onChange, placeholder }: Props) {
  const { __ } = useT();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || "",
      }),
    ],
    content: migrateOldFormat(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[80px] max-h-[300px] overflow-y-auto focus:outline-none px-1 py-0.5 text-xs",
      },
      // Skip the node-selection "on image" state when arrow-navigating past an
      // inline image, so a single Left/Right jumps directly to the other side
      // instead of stopping "inside" the image (which needed two presses).
      handleKeyDown: (view, event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false;
        const { state, dispatch } = view;
        const { selection } = state;
        const jumpTo = (pos: number, bias: number) => {
          const $pos = state.doc.resolve(pos);
          dispatch(state.tr.setSelection(TextSelection.near($pos, bias)).scrollIntoView());
          return true;
        };

        if (event.key === "ArrowLeft") {
          // Already "on" the image (node selection) → go to its left side.
          if (selection instanceof NodeSelection && isImageNode((selection as NodeSelection).node)) {
            return jumpTo(selection.from, -1);
          }
          if (selection.empty) {
            const before = selection.$from.nodeBefore;
            if (before && isImageNode(before)) {
              return jumpTo(selection.$from.pos - before.nodeSize, -1);
            }
          }
        } else {
          // ArrowRight
          if (selection instanceof NodeSelection && isImageNode((selection as NodeSelection).node)) {
            return jumpTo(selection.to, 1);
          }
          if (selection.empty) {
            const after = selection.$from.nodeAfter;
            if (after && isImageNode(after)) {
              return jumpTo(selection.$from.pos + after.nodeSize, 1);
            }
          }
        }
        return false;
      },
    },
  });

  // Sync external value changes (e.g., when switching tasks)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const migrated = migrateOldFormat(value);
    if (current !== migrated && migrated !== editor.getHTML()) {
      editor.commands.setContent(migrated);
    }
  }, [value, editor]);

  // Load data URLs for images that have data-path but no src
  useEffect(() => {
    if (!editor) return;
    const doc = editor.state.doc;
    const updates: { pos: number; path: string }[] = [];

    doc.descendants((node, pos) => {
      if (node.type.name === "image") {
        const path = node.attrs["data-path"];
        const src = node.attrs.src;
        if (path && !src) {
          updates.push({ pos, path });
        }
      }
    });

    updates.forEach(({ pos, path }) => {
      api.getNoteImageDataUrl(path).then((dataUrl) => {
        const tr = editor.state.tr;
        const node = editor.state.doc.nodeAt(pos);
        if (node) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: dataUrl });
          editor.view.dispatch(tr);
        }
      }).catch((e) => { console.error("Failed to load image data URL:", e); });
    });
  }, [editor, value]);

  // Handle paste — intercept clipboard images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!editor) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const buffer = await blob.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));
        const ext = blob.type.split("/")[1] === "jpeg" ? "jpg" : blob.type.split("/")[1] || "png";

        try {
          const filepath = await api.saveNoteImage(data, ext);
          const dataUrl = await api.getNoteImageDataUrl(filepath);
          editor.chain().focus().setImage({ src: dataUrl }).run();
          // Store path in the image node's HTMLAttributes
          const { state } = editor;
          const pos = state.selection.$anchor.before();
          const node = state.doc.nodeAt(pos);
          if (node && node.type.name === "image") {
            const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, "data-path": filepath });
            editor.view.dispatch(tr);
          }
        } catch (err) {
          setImageError(true);
          setTimeout(() => setImageError(false), 3000);
          console.error("Failed to save image:", err);
        }
        return;
      }
    }
  }, [editor]);

  // Toolbar actions
  const addImage = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      const ext = file.name.split(".").pop() || "png";
      try {
        const filepath = await api.saveNoteImage(data, ext);
        const dataUrl = await api.getNoteImageDataUrl(filepath);
        editor.chain().focus().setImage({ src: dataUrl }).run();
        // Store path in the image node
        const { state } = editor;
        const pos = state.selection.$anchor.before();
        const node = state.doc.nodeAt(pos);
        if (node && node.type.name === "image") {
          const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, "data-path": filepath });
          editor.view.dispatch(tr);
        }
      } catch (err) {
        setImageError(true);
        setTimeout(() => setImageError(false), 3000);
        console.error("Failed to save image:", err);
      }
    };
    input.click();
  }, [editor]);

  // Double-click image to preview
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      setPreviewSrc((target as HTMLImageElement).src);
    }
  }, []);

  if (!editor) return null;

  return (
    <>
    {/* Full-size image preview overlay */}
    {previewSrc && (
      <div
        className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center cursor-pointer"
        onClick={() => setPreviewSrc(null)}
        onKeyDown={(e) => { if (e.key === "Escape") setPreviewSrc(null); }}
      >
        <img
          src={previewSrc}
          alt="preview"
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    <div className="space-y-1">
      {/* Toolbar + Editor — continuous border */}
      <div className="border border-input rounded-lg overflow-hidden" onPaste={handlePaste} onDoubleClick={handleDoubleClick}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-1 py-1 bg-muted/30 border-b border-border/30">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title={__("editor.bold")}
          >
            <Bold size={13} />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title={__("editor.italic")}
          >
            <Italic size={13} />
          </ToolbarButton>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title={__("editor.bulletList")}
          >
            <List size={13} />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title={__("editor.orderedList")}
          >
            <ListOrdered size={13} />
          </ToolbarButton>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarButton
            onClick={addImage}
            title={__("editor.addImage")}
          >
            <ImageIcon size={13} />
          </ToolbarButton>
        </div>

        {imageError && (
          <div className="px-2 py-1 text-[11px] text-destructive bg-destructive/10 border-b border-destructive/20">
            {__("editor.imageFailed")}
          </div>
        )}

        {/* Editor */}
        <div className="px-3 py-2 min-h-[80px] max-h-[300px] overflow-y-auto [&_.ProseMirror]:outline-none [&_.ProseMirror_img]:inline-block [&_.ProseMirror_img]:max-h-[200px] [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:align-bottom [&_.ProseMirror_img]:mx-0.5">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
    </>
  );
}

function ToolbarButton({ active, onClick, title, children }: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 inline-flex items-center justify-center rounded transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
