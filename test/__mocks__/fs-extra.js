const fs = jest.requireActual('fs-extra'); // Import actual fs-extra module to keep real behavior

module.exports = {
  ...fs, // Spread and include all original exports
  pathExists: jest.fn(),
  readFile: jest.fn(),
  ensureFile: jest.fn(),
  writeJson: jest.fn(),
  readJson: jest.fn(),
  remove: jest.fn()
};
