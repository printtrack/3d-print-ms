// Marks a piece of landing copy as editable in place.
//
// Deliberately a *server* component with no "use client": the listening is done
// once, delegated, by InlineEditBridge. So outside edit mode this renders the
// bare string and the public page ships not a single byte of editor JavaScript
// for it.
//
// Note what this does NOT render: contentEditable. The bridge sets that itself
// once its listeners are attached. Server-rendering the attribute would make the
// text typeable during the window between paint and hydration — when nothing is
// listening yet — so the edit would appear to work and then be silently lost.
// Tying "editable" to "someone is listening" makes that race impossible rather
// than merely unlikely.
//
// `field` is a path into the block's data:
//   field="headline1"            → data.headline1[locale]
//   field="items.title", index=0 → data.items[0].title[locale]
//
// Only *localized plain text* belongs here. Markdown bodies stay in the side
// panel — contentEditable would flatten the markup into text — and so does
// anything not visible on the page (alt text) or not a string (icons, images,
// background, order).

import type { ReactNode } from "react";

export interface EditableProps {
  editing: boolean;
  blockId: string;
  field: string;
  index?: number;
  /**
   * The field is a bare string, not a {de,en} pair — the step numerals are the
   * only case. Without this the listener would write "01" into the German slot
   * of a value that has no slots.
   */
  plain?: boolean;
  children: ReactNode;
}

export function Editable({ editing, blockId, field, index, plain, children }: EditableProps) {
  if (!editing) return <>{children}</>;

  return (
    <span
      data-landing-edit=""
      data-block-id={blockId}
      data-field={field}
      data-index={index}
      data-plain={plain ? "" : undefined}
      // Inherits every typographic property from its parent, so an editable
      // headline still looks exactly like the headline it replaces.
      className="landing-editable"
    >
      {children}
    </span>
  );
}
