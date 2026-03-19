import fs from "node:fs/promises";
import path from "node:path";

export class FileStateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  async save(state) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}
