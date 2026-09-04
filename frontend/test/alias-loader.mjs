/**
 * Registra os hooks de alias. Uso (só em teste):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/agent/escalate-simulacao.test.ts
 */
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
