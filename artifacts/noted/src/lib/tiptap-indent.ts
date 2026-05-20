import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

const INDENT_STEP = 40;
const MAX_INDENT = 8;
const INDENTABLE = ["paragraph", "heading"];

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const pl = (el as HTMLElement).style.paddingLeft;
              if (!pl) return 0;
              return Math.round(parseInt(pl) / INDENT_STEP);
            },
            renderHTML: (attrs) => {
              if (!attrs.indent || attrs.indent <= 0) return {};
              return { style: `padding-left: ${attrs.indent * INDENT_STEP}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ state, chain }) => {
          const { selection, doc } = state;
          const { from, to } = selection;
          let result = chain();
          doc.nodesBetween(from, to, (node, pos) => {
            if (INDENTABLE.includes(node.type.name)) {
              const current = (node.attrs.indent as number) || 0;
              const next = Math.min(current + 1, MAX_INDENT);
              if (next !== current) {
                result = result.updateAttributes(node.type.name, { indent: next });
              }
            }
          });
          return result.run();
        },

      decreaseIndent:
        () =>
        ({ state, chain }) => {
          const { selection, doc } = state;
          const { from, to } = selection;
          let result = chain();
          doc.nodesBetween(from, to, (node, pos) => {
            if (INDENTABLE.includes(node.type.name)) {
              const current = (node.attrs.indent as number) || 0;
              const next = Math.max(current - 1, 0);
              if (next !== current) {
                result = result.updateAttributes(node.type.name, { indent: next });
              }
            }
          });
          return result.run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("listItem") || editor.isActive("taskItem")) return false;
        return editor.commands.increaseIndent();
      },
      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("listItem") || editor.isActive("taskItem")) return false;
        return editor.commands.decreaseIndent();
      },
    };
  },
});
