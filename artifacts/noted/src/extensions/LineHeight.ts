import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

const BLOCK_TYPES = ["paragraph", "heading", "listItem", "taskItem"];

export const LineHeight = Extension.create({
  name: "lineHeight",

  addOptions() {
    return { types: BLOCK_TYPES };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types as string[],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) => {
          return (this.options.types as string[]).every((type) =>
            commands.updateAttributes(type, { lineHeight }),
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return (this.options.types as string[]).every((type) =>
            commands.resetAttributes(type, "lineHeight"),
          );
        },
    };
  },
});
