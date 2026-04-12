import { writeFileSync } from "node:fs";

export function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

export function getOptionValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
