// Regenerate the checked-in desktop and web icons from CoCo's existing artwork.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import sharp from "sharp";
import { encodePngIco, WINDOWS_ICON_SIZES } from "./lib/icon-export.ts";

const root = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const svg = await NodeFSP.readFile(NodePath.join(root, "assets/coco/icon.svg"));
const ico = encodePngIco(
  await Promise.all(
    WINDOWS_ICON_SIZES.map(async (size) => ({
      size,
      contents: await sharp(svg).resize(size, size).png().toBuffer(),
    })),
  ),
);
await NodeFSP.writeFile(NodePath.join(root, "assets/coco/icon.ico"), ico);
await NodeFSP.writeFile(NodePath.join(root, "apps/web/public/favicon.ico"), ico);
for (const [file, size] of [
  ["assets/coco/icon.png", 1024],
  ["apps/web/public/favicon-16x16.png", 16],
  ["apps/web/public/favicon-32x32.png", 32],
  ["apps/web/public/apple-touch-icon.png", 180],
]) {
  await sharp(svg).resize(size, size).png().toFile(NodePath.join(root, file));
}
