export const projectTypes = [
  "Website",
  "Web app",
  "PWA",
  "E-commerce",
  "Portal or dashboard",
  "Operations / internal tool",
  "Not sure yet",
  "Something else",
];
export const budgets = [
  "Not sure yet",
  "Under $100",
  "$100–$300",
  "$300–$500",
  "$500+",
];
export const timelines = [
  "Flexible",
  "1-2 weeks",
  "2-4 weeks",
  "4-8 weeks",
  "8+ weeks",
];
export const involvementOptions = [
  "Hands-off",
  "Collaborative",
  "Very involved",
  "Not sure yet",
];
export class InputError extends Error {}
export async function readBoundedJson(
  req: Request,
): Promise<Record<string, unknown>> {
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new InputError("JSON required");
  const reader = req.body?.getReader();
  if (!reader) throw new InputError("Invalid request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20_000) {
      await reader.cancel();
      throw new InputError("Request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InputError("Invalid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Invalid request");
  return body as Record<string, unknown>;
}
export function validateIntake(body: Record<string, unknown>) {
  const field = (key: string, max: number, fallback = "") => {
    if (body[key] !== undefined && typeof body[key] !== "string")
      throw new InputError(`Invalid ${key}`);
    const value = (body[key] as string | undefined)?.trim() || fallback;
    if (value.length > max) throw new InputError(`${key} is too long`);
    return value;
  };
  const input = {
    name: field("name", 120),
    email: field("email", 254).toLowerCase(),
    company: field("company", 160),
    project_type: field("project_type", 80),
    budget_range: field("budget_range", 80, "Not sure yet"),
    timeline: field("timeline", 80, "Flexible"),
    involvement: field("involvement", 80, "Collaborative"),
    details: field("details", 5000),
  };
  if (input.name.length < 2) throw new InputError("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    throw new InputError("Please enter a valid email.");
  if (!projectTypes.includes(input.project_type))
    throw new InputError("Please choose a project type.");
  if (!budgets.includes(input.budget_range))
    throw new InputError("Invalid budget range.");
  if (!timelines.includes(input.timeline))
    throw new InputError("Invalid timeline.");
  if (!involvementOptions.includes(input.involvement))
    throw new InputError("Invalid involvement preference.");
  if (input.details.length < 20)
    throw new InputError("Please tell us a little more about the idea.");
  return input;
}
