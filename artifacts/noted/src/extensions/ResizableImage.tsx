import { Image as TiptapImage } from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRef } from "react";

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { src, alt, title, width } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = imgRef.current?.getBoundingClientRect().width ?? (width as number) ?? 400;

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(80, Math.round(startWidth + ev.clientX - startX));
      updateAttributes({ width: newWidth });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <NodeViewWrapper as="div">
      <div
        style={{
          display: "inline-block",
          position: "relative",
          width: width ? `${width}px` : "auto",
          maxWidth: "100%",
          margin: "0.75em 0",
          lineHeight: 0,
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          style={{ width: "100%", display: "block", borderRadius: "6px" }}
          draggable={false}
        />
        {selected && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "2px solid hsl(var(--primary))",
                borderRadius: "6px",
                pointerEvents: "none",
              }}
            />
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: "absolute",
                bottom: -5,
                right: -5,
                width: 12,
                height: 12,
                background: "hsl(var(--primary))",
                border: "2px solid white",
                borderRadius: 3,
                cursor: "nwse-resize",
                zIndex: 10,
              }}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML(attrs) {
          if (!attrs.width) return {};
          return { style: `width: ${attrs.width}px; max-width: 100%;` };
        },
        parseHTML(element) {
          const style = element.getAttribute("style") ?? "";
          const match = style.match(/width:\s*(\d+)px/);
          return match ? parseInt(match[1], 10) : null;
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
