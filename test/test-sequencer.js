// test/test-sequencer.js
import { default as DefaultSequencer } from '@jest/test-sequencer';

export default class CustomSequencer extends DefaultSequencer {
  constructor(...args) {
    super(...args);
  }

  sort(tests) {
    return tests; // Just return tests in the order Jest provides
  }
}
