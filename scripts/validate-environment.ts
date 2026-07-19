import { parseServerEnvironment } from "../src/infrastructure/config/environment";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();
parseServerEnvironment(process.env);
process.stdout.write("Environment configuration is valid.\n");
