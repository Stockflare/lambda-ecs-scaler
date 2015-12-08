# AWS Cloudformation

This template creates a Lambda function with sufficient IAM permissions so that it can manage entries in a DynamoDB Scheduler Table. The Cloudformation itself provides a number of outputs, to make it possible to build & schedule recurring tasks within other Cloudformations.

### Dependencies

| Stack                | Description                              |
|----------------------|------------------------------------------|
| lambda-stack-outputs | Lambda Stack Outputs Cloudformation      |
| environment          | Environment Configuration Cloudformation |

---

### Parameters

Should be configured from the appropriate configuration file within this folder.

| Parameter       | Default | Description                                                         |
|-----------------|---------|---------------------------------------------------------------------|
| FunctionPackage | `null`  | Prefix of the package name residing within the resources S3 bucket. |
| FunctionVersion | `null`  | Package key suffix of the version that will be deployed to lambda.  |
