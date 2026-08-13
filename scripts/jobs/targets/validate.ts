import { validateWorkbookRows } from "../../../src/modules/employer-research/domain/workbook-parse";
import { readTop1000Sheet } from "./workbook";

const records = readTop1000Sheet();
const outcome = validateWorkbookRows(records);

process.stdout.write(`Validated ${outcome.rows.length} rows from the Top 1000 v2 sheet.\n`);
process.stdout.write(`Errors: ${outcome.errorCount}, warnings: ${outcome.warningCount}\n`);
for (const issue of outcome.issues) {
  process.stdout.write(
    `  [${issue.severity}] rank=${issue.rank ?? "-"} ${issue.field}: ${issue.message}\n`,
  );
}
if (outcome.errorCount > 0) process.exit(1);
