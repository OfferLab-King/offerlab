export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { parseServerEnvironment } = await import("./infrastructure/config/environment");
  parseServerEnvironment(process.env);
}
