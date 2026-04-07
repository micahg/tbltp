#!/bin/sh
set -eu

bucket_name="${STORAGE_S3_BUCKET:-tbltp-test-bucket}"

if awslocal s3api head-bucket --bucket "${bucket_name}" >/dev/null 2>&1; then
  exit 0
fi

awslocal s3api create-bucket --bucket "${bucket_name}"