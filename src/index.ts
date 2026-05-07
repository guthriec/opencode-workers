#!/usr/bin/env node

import { runCli } from "./cli";

runCli(process.argv.slice(2)).then((exitCode) => {
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
});
