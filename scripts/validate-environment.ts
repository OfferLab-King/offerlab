import { parseServerEnvironment } from "../src/infrastructure/config/environment";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();
const environment = { ...process.env };
environment.NODE_ENV ??= "test";
parseServerEnvironment(environment);
process.stdout.write("Environment configuration is valid.\n");
