import { testAddon } from "@watchedcom/test";
import { tubiTvAddon } from "./index";

// Depending on your addon, change the test timeout
jest.setTimeout(30000);

test(`Test addon "${tubiTvAddon.getId()}"`, done => {
  testAddon(tubiTvAddon)
    .then(done)
    .catch(done);
});
