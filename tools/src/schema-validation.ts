import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import { loadRulesDocument, loadSchemaDocument } from "./rules";

export function validateSchema() {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
  });
  addFormats(ajv);

  const schema = loadSchemaDocument();
  const document = loadRulesDocument();
  const validate = ajv.compile(schema);
  const valid = validate(document);

  return {
    valid: Boolean(valid),
    errors: validate.errors ?? [],
  };
}
