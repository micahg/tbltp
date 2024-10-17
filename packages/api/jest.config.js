process.env.MONGOMS_VERSION="7.0.0";
process.env.MONGOMS_DOWNLOAD_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.0.tgz";
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
  '^.+\\.(ts|tsx)?$': 'ts-jest',
  "^.+\\.(js|jsx)$": "babel-jest",
}};