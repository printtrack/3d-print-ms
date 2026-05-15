---
title: "3D Viewer & Print Orientation"
description: "View models in the browser, add notes, and set the print orientation"
icon: "Box"
group: "Orders & Production"
order: 2.2
---

# 3D Viewer & Print Orientation

The built-in 3D viewer lets you view STL, OBJ, and 3MF files directly in the browser — no external software required. Open it by clicking a compatible file in the [[Order detail|orders-detail]].

## Opening a model

Click an STL, OBJ, or 3MF file in the file list of the [[Order detail|orders-detail]]. The viewer loads the file and displays the model centered.

## Navigation controls

| Action | Mouse | Trackpad |
|--------|-------|---------|
| **Rotate** | Hold left button + drag | One finger + drag |
| **Zoom** | Scroll wheel | Two-finger pinch |
| **Pan** | Hold right button + drag | Two fingers + drag |
| **Reset view** | **Reset view** button in toolbar | — |

## Notes (annotations)

You can add markers directly on the model surface:

1. Click the **Note icon** (pencil/pin) in the toolbar.
2. Click the desired location on the model.
3. A dialog opens — enter your comment.
4. The note appears as a colored pin that shows the text on hover.

Notes are visible to all team members, not to customers.

## Setting the print orientation

The face tool lets you select which side of the model should rest on the print bed — just like manual alignment in a slicer.

### Step by step

1. Open the viewer and click the **Face tool** (Layers/stack icon) in the toolbar — the mode is activated.
2. Move the mouse over the model — coplanar faces are highlighted in **amber**.
3. Click the face that should rest on the **print bed**.
4. The model automatically rotates so the selected face points downward. A build plate preview (gray plate below the model) appears.
5. Click **Save** in the action bar that appears.

> **Tip:** For symmetric parts, a rough selection is often sufficient. For asymmetric geometries (angled bases, curved surfaces) it is worth choosing the ideal orientation carefully.

### What gets saved?

The orientation is stored as a rotation matrix in the database. It affects:

- **Viewer display** — the next time the viewer opens, the model is already correctly oriented (including build plate preview)
- **3MF download** — the orientation is embedded as a transform matrix (compatible with OrcaSlicer and Bambu Studio)
- **STL ZIP download** — geometry is pre-rotated so slicers import the model correctly
- **Automatic job planner** — the planner uses the footprint of the rotated bounding box; Z-rotation remains free (the part can still be rotated on the bed)

### Reset orientation

When an orientation is set, the toolbar shows **Reset orientation**. Clicking it removes the saved orientation — the model returns to its default pose.

## Downloads

The toolbar provides two download options:

| Download | Format | Use case |
|----------|--------|---------|
| **Export 3MF** | `.3mf` | Open directly in OrcaSlicer / Bambu Studio, includes orientation |
| **Download STL ZIP** | `.zip` with `.stl` | Pre-rotated geometry for other slicers |

## Supported file formats

| Format | Notes |
|--------|-------|
| **STL** | Standard format, binary and ASCII supported |
| **OBJ** | Including materials (MTL) if uploaded |
| **3MF** | Embedded metadata (colors, orientations) are read |
