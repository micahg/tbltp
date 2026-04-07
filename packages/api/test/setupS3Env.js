const defaults = {
  STORAGE_PROVIDER: "s3",
  STORAGE_S3_BUCKET: "tbltp-test-bucket",
  STORAGE_S3_REGION: "us-east-1",
  STORAGE_S3_ACCESS_KEY_ID: "test",
  STORAGE_S3_SECRET_ACCESS_KEY: "test",
  STORAGE_S3_ENDPOINT: "http://127.0.0.1:4566",
  STORAGE_S3_FORCE_PATH_STYLE: "true",
  STORAGE_S3_REQUEST_HANDLER: "fetch",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
