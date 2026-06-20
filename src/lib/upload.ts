export const MB = 1024 * 1024;

export function assertUploadedFile(input: FormDataEntryValue | null, options: {
  label: string;
  maxBytes: number;
  extensions: string[];
}) {
  if (!(input instanceof File)) throw new Error(`请选择${options.label}文件`);
  if (input.size > options.maxBytes) {
    throw new Error(`${options.label}文件不能超过 ${Math.floor(options.maxBytes / MB)} MB`);
  }
  const name = input.name.toLowerCase();
  if (!options.extensions.some(extension => name.endsWith(extension))) {
    throw new Error(`${options.label}文件仅支持 ${options.extensions.join("、")}`);
  }
  return input;
}

export const uploadLimits = {
  orderImport: 10 * MB,
  costImport: 10 * MB,
  productGrowthCsv: 5 * MB,
  gcode: 20 * MB
};
