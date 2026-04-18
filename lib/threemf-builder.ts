import JSZip from "jszip";
import type { ParsedMesh } from "./stl-parser";

export interface ThreeMFObject {
  id: number;
  name: string;
  mesh: ParsedMesh;
  quantity?: number;
}

export interface ThreeMFMetadata {
  machineName?: string;
  buildVolumeX?: number;
  buildVolumeY?: number;
  buildVolumeZ?: number;
  filaments?: Array<{
    material: string;
    color: string;
    colorHex: string | null;
    brand: string | null;
    name: string;
  }>;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContentTypes(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
    "  <Default Extension=\"xml\" ContentType=\"application/xml\"/>\n" +
    "</Types>"
  );
}

function buildRels(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
    "</Relationships>"
  );
}

function buildModelXml(objects: ThreeMFObject[], metadata: ThreeMFMetadata): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<model unit="millimeter" xml:lang="en-US"' +
      ' xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"' +
      ' xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">'
  );
  lines.push("  <metadata name=\"Application\">OrcaSlicer</metadata>");
  lines.push("  <metadata name=\"BambuStudio:Version\">01.10.00.00</metadata>");
  if (metadata.machineName) {
    lines.push(`  <metadata name="PrinterName">${escapeXml(metadata.machineName)}</metadata>`);
  }

  // Resources
  lines.push("  <resources>");
  for (const obj of objects) {
    lines.push(`    <object id="${obj.id}" type="model" name="${escapeXml(obj.name)}">`);
    lines.push("      <mesh>");

    // Vertices
    lines.push("        <vertices>");
    const { vertices } = obj.mesh;
    for (let i = 0; i < vertices.length; i += 3) {
      lines.push(`          <vertex x="${vertices[i]}" y="${vertices[i + 1]}" z="${vertices[i + 2]}"/>`);
    }
    lines.push("        </vertices>");

    // Triangles
    lines.push("        <triangles>");
    const { triangles } = obj.mesh;
    for (let i = 0; i < triangles.length; i += 3) {
      lines.push(`          <triangle v1="${triangles[i]}" v2="${triangles[i + 1]}" v3="${triangles[i + 2]}"/>`);
    }
    lines.push("        </triangles>");

    lines.push("      </mesh>");
    lines.push("    </object>");
  }
  lines.push("  </resources>");

  // Build
  lines.push("  <build>");
  for (const obj of objects) {
    const qty = obj.quantity ?? 1;
    for (let q = 0; q < qty; q++) {
      const tx = q * 50;
      const transform = `1 0 0 0 1 0 0 0 1 ${tx} 0 0`;
      lines.push(`    <item objectid="${obj.id}" transform="${transform}"/>`);
    }
  }
  lines.push("  </build>");

  lines.push("</model>");
  return lines.join("\n");
}

function buildModelSettings(objects: ThreeMFObject[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<config>");
  for (const obj of objects) {
    lines.push(`  <object id="${obj.id}">`);
    lines.push(`    <metadata key="name" value="${escapeXml(obj.name)}"/>`);
    lines.push("  </object>");
  }
  lines.push("</config>");
  return lines.join("\n");
}

export async function buildThreeMF(
  objects: ThreeMFObject[],
  metadata: ThreeMFMetadata
): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", buildContentTypes());
  zip.file("_rels/.rels", buildRels());
  zip.file("3D/3dmodel.model", buildModelXml(objects, metadata));
  zip.file("Metadata/model_settings.config", buildModelSettings(objects));

  return zip.generateAsync({ type: "uint8array" });
}
