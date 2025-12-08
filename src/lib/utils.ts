type ClassValue = string | false | null | undefined;

export function cn(...inputs: ClassValue[]) {
  return inputs
    .filter((input): input is string => typeof input === "string" && input.trim().length > 0)
    .map((input) => input.trim())
    .join(" ");
}
